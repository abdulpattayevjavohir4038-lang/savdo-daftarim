// Umumiy modul: baza, Telegram API, vaqt (Toshkent), hisobot matnlari. Har bir funksiyaga nusxa sifatida qo'shiladi.
import postgres from 'npm:postgres@3.4.5';

const DB_URL = Deno.env.get('DB_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
const m = /^socket:(.+):(\d+)\/(\w+)$/.exec(DB_URL); // mahalliy sinov: socket:/tmp:54329/sd
export const sql = m
  ? postgres({ host: m[1], port: +m[2], user: 'postgres', database: m[3], max: 3 })
  : postgres(DB_URL, { max: 3, prepare: false, idle_timeout: 20 });
export const TG_API = Deno.env.get('TG_API') || 'https://api.telegram.org';
export const SUPA_URL = Deno.env.get('SUPABASE_URL') || '';
export const FN_BASE = Deno.env.get('FN_BASE') || SUPA_URL + '/functions/v1';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
export const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

export async function secret(k: string): Promise<string | null> {
  const r = await sql`select public._secret(${k}) as v`;
  return (r[0] && r[0].v) || null;
}
export async function setSecret(k: string, v: string) {
  await sql`insert into public.app_secrets (key, value, updated_at) values (${k}, ${v}, now()) on conflict (key) do update set value = excluded.value, updated_at = now()`;
}
export async function call<T = any>(fn: string, ...args: unknown[]): Promise<T> {
  const ph = args.map((_, i) => '$' + (i + 1)).join(', ');
  const r = await sql.unsafe('select public.' + fn + '(' + ph + ') as v', args as any[]);
  return r[0].v as T;
}
export async function tg(token: string, method: string, params: Record<string, unknown>) {
  try {
    const r = await fetch(TG_API + '/bot' + token + '/' + method, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    return await r.json();
  } catch (e) { return { ok: false, description: String(e) }; }
}
export const send = (token: string, chat: number | string, text: string, extra: Record<string, unknown> = {}) =>
  tg(token, 'sendMessage', Object.assign({ chat_id: chat, text, parse_mode: 'HTML', disable_web_page_preview: true }, extra));

/* ---------- formatlash ---------- */
export const fmt = (n: unknown) => { const x = Math.round(+(n as number) || 0); const s = Math.abs(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return (x < 0 ? '−' : '') + s; };
export const fq = (q: unknown) => String(Math.round((+(q as number) || 0) * 1000) / 1000).replace('.', ',');
export const esc = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
export const SUM = "so'm";

/* ---------- vaqt: O'zbekiston (UTC+5, yozgi vaqt yo'q) ---------- */
export const TZ = 5 * 3600e3;
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const WD = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
export const local = (ts = Date.now()) => new Date(ts + TZ); // getUTC* = mahalliy vaqt
export const todayK = () => local().toISOString().slice(0, 10);
export const dayStart = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) - TZ;
export const addK = (k: string, n: number) => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) + n * 864e5).toISOString().slice(0, 10);
const kd = (k: string) => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)));
export const kLabel = (k: string) => { const d = kd(k); return d.getUTCDate() + '-' + MONTHS[d.getUTCMonth()] + ', ' + WD[d.getUTCDay()]; };
export const kShort = (k: string) => { const d = kd(k); return d.getUTCDate() + '-' + MONTHS[d.getUTCMonth()]; };
export const weekStart = (k: string) => addK(k, -((kd(k).getUTCDay() + 6) % 7)); // dushanba
export const monthStart = (k: string) => k.slice(0, 8) + '01';
export const monthName = (k: string) => { const d = kd(k); const n = MONTHS[d.getUTCMonth()]; return n[0].toUpperCase() + n.slice(1) + ' ' + d.getUTCFullYear(); };

/* ---------- hisobot matnlari ---------- */
export type Link = { shop: string; role: string; shopName: string; blocked?: boolean; paidUntil?: number; admin?: boolean };
export async function periodReport(link: Link, from: string, toExcl: string, title: string) {
  const r: any = await call('rep_period', link.shop, dayStart(from), dayStart(toExcl));
  const cashier = link.role === 'cashier';
  const L: string[] = ['📊 <b>' + esc(link.shopName) + '</b>', '🗓 ' + esc(title), ''];
  if (!+r.count && !+r.retN) L.push('Bu davrda savdo yoʻq.');
  else {
    L.push('💰 Tushum: <b>' + fmt(r.oborot) + '</b> ' + SUM);
    L.push('🧾 Cheklar: ' + r.count + ' ta' + (+r.count ? ' · oʻrtacha ' + fmt(r.gross_sales / r.count) : ''));
    L.push('💵 Naqd: ' + fmt(r.naqd) + ' · 💳 Karta: ' + fmt(r.karta) + (+r.qarzga ? ' · 📒 Qarzga: ' + fmt(r.qarzga) : ''));
    if (+r.retN) L.push('↩️ Qaytarish: ' + r.retN + ' ta, −' + fmt(r.ret));
    if (+r.disc) L.push('🏷 Chegirmalar: ' + fmt(r.disc));
    if (+r.custPay) L.push('💸 Qarz toʻlovlari: ' + fmt(r.custPay));
    if (!cashier) {
      const gross = r.oborot - r.cost, net = gross - r.exp - r.spis;
      L.push('📈 Yalpi foyda: <b>' + fmt(gross) + '</b>');
      if (+r.exp || +r.spis) L.push('🧾 Xarajatlar: ' + fmt(r.exp) + (+r.spis ? ' · 🗑 Brak: ' + fmt(r.spis) : ''));
      L.push((net < 0 ? '🔻 <b>Sof zarar: ' : '✅ <b>Sof foyda: ') + fmt(net) + '</b> ' + SUM);
    }
    const top = (r.top || []).slice(0, 5);
    if (top.length) { L.push('', '🏆 <b>Top tovarlar</b>'); top.forEach((t: any, i: number) => L.push((i + 1) + '. ' + esc(t.name) + ' — ' + fq(t.qty) + ' ' + esc(t.unit || '') + ' · ' + fmt(t.sum))); }
  }
  return L.join('\n');
}
export async function dayReport(link: Link, k: string) {
  const t = todayK();
  const txt = await periodReport(link, k, addK(k, 1), (k === t ? 'Bugun, ' : k === addK(t, -1) ? 'Kecha, ' : '') + kLabel(k));
  const nav = [{ text: '⬅️ ' + kShort(addK(k, -1)), callback_data: 'd:' + addK(k, -1) }];
  if (k < t) nav.push({ text: kShort(addK(k, 1)) + ' ➡️', callback_data: 'd:' + addK(k, 1) });
  return { text: txt, markup: { inline_keyboard: [nav] } };
}
export async function stockReport(link: Link) {
  const s: any = await call('rep_stock', link.shop);
  const L = ['📦 <b>' + esc(link.shopName) + ' — ombor</b>', ''];
  L.push('Tovar turlari: ' + s.n + ' ta');
  if (link.role !== 'cashier') L.push('Ombordagi mol (tannarx): <b>' + fmt(s.cost) + '</b> · sotilsa: ' + fmt(s.sale));
  if (+s.minusN) { L.push('', '🔴 <b>Minusdagi tovarlar: ' + s.minusN + ' ta</b>'); for (const x of s.minus) L.push('• ' + esc(x.name) + ': ' + fq(x.stock) + ' ' + esc(x.unit || '')); }
  if (+s.lowN) { L.push('', '🟡 <b>Kam qolganlar: ' + s.lowN + ' ta</b>'); for (const x of s.low) L.push('• ' + esc(x.name) + ': ' + fq(x.stock) + ' / min ' + fq(x.min) + ' ' + esc(x.unit || '')); }
  if ((s.exp || []).length) { L.push('', '⏰ <b>Muddati tugayapti</b>'); for (const x of s.exp) L.push('• ' + esc(x.name) + ' — ' + esc(String(x.exp).split('-').reverse().join('.'))); }
  if (!+s.minusN && !+s.lowN && !(s.exp || []).length) L.push('', '✅ Kam qolgan tovar yoʻq');
  return L.join('\n');
}
export async function debtReport(link: Link) {
  const d: any = await call('rep_debts', link.shop);
  const L = ['📒 <b>' + esc(link.shopName) + ' — qarzlar</b>', ''];
  L.push('Mijozlar qarzi (bizga): <b>' + fmt(d.cust) + '</b> ' + SUM + ' · ' + d.custN + ' ta mijoz');
  if (link.role !== 'cashier') L.push('Bizning qarz (taʼminotchilarga): <b>' + fmt(d.sup) + '</b> ' + SUM);
  if ((d.top || []).length) { L.push(''); d.top.slice(0, 15).forEach((x: any, i: number) => L.push((i + 1) + '. ' + esc(x.name) + (x.phone ? ' (' + esc(x.phone) + ')' : '') + ' — <b>' + fmt(x.bal) + '</b>')); }
  return L.join('\n');
}
export async function topReport(link: Link) {
  const t = todayK(), r: any = await call('rep_period', link.shop, dayStart(addK(t, -6)), dayStart(addK(t, 1)));
  const L = ['🏆 <b>' + esc(link.shopName) + ' — top tovarlar</b>', '🗓 Oxirgi 7 kun', ''];
  if (!(r.top || []).length) L.push('Bu davrda savdo yoʻq.');
  (r.top || []).forEach((x: any, i: number) => L.push((i + 1) + '. ' + esc(x.name) + ' — ' + fq(x.qty) + ' ' + esc(x.unit || '') + ' · ' + fmt(x.sum) + (link.role !== 'cashier' ? ' (foyda ' + fmt(x.profit) + ')' : '')));
  return L.join('\n');
}
// «👛 Hamyon nazorat» — shaxsiy xarajatlar (do'kon hisobidan alohida) har bir menyuda bor
export const WALLET_BTN = '👛 Hamyon nazorat';
export const KB = {
  keyboard: [[{ text: '📊 Bugun' }, { text: '📅 Kecha' }], [{ text: '🗓 Hafta' }, { text: '📆 Oy' }], [{ text: '📦 Ombor' }, { text: '📒 Qarzlar' }, { text: '🏆 Top tovarlar' }], [{ text: '💳 Obuna' }, { text: WALLET_BTN }]],
  resize_keyboard: true, is_persistent: true,
};
// do'kon egasi uchun: qo'shimcha «Kassir taklif qilish» tugmasi
export const OWNER_KB = { keyboard: [...KB.keyboard.slice(0, 3), [{ text: '👥 Kassir taklif qilish' }, { text: '💳 Obuna' }], [{ text: WALLET_BTN }]], resize_keyboard: true, is_persistent: true };
// sotuvchi (admin) uchun: qo'shimcha «Statistika» tugmasi
export const ADMIN_KB = { keyboard: [...OWNER_KB.keyboard.slice(0, 4), [{ text: '📈 Statistika' }, { text: WALLET_BTN }]], resize_keyboard: true, is_persistent: true };
export const kbOf = (role?: string, admin?: boolean) => (role === 'owner' ? (admin ? ADMIN_KB : OWNER_KB) : KB);
export const ROLE: Record<string, string> = { owner: 'egasi', manager: 'menejer', cashier: 'kassir' };

/* ---------- foydalanuvchini tekshirish (ilova / panel chaqirganda) ---------- */
const PUB_KEY = (() => {
  try { const k = JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default; if (k) return k as string; } catch (_) { /* eski kalit */ }
  return Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('PUB_KEY') || '';
})();
function jwtPayload(t: string) { try { const p = t.split('.')[1]; return JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((p.length + 3) % 4))); } catch (_) { return null; } }
export type Member = { shop: string; shopName: string; blocked: boolean; paidUntil: number; role: string; admin: boolean; perms?: string[]; staffName?: string | null };
export async function member(req: Request): Promise<Member | null> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const r = await fetch(SUPA_URL + '/auth/v1/user', { headers: { apikey: PUB_KEY, Authorization: 'Bearer ' + token } });
  if (!r.ok) return null;
  const u = await r.json().catch(() => null);
  if (!u || !u.id) return null;
  const sid = u.session_id || (jwtPayload(token) || {}).session_id;
  if (!sid) return null;
  return await call<Member | null>('member_svc', u.id, sid);
}
export const active = (m: { blocked?: boolean; paidUntil?: number }) => !m.blocked && (m.paidUntil || 0) + 7 * 864e5 > Date.now();
