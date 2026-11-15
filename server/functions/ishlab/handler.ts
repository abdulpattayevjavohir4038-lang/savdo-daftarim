// «🏭 Ishlab chiqarish» ilovasi serveri: pishiriq, konditer va boshqa ishlab chiqaruvchilar uchun.
// Xomashyo xarajati (qancha, necha so'mdan), boshqa xarajatlar, sotuv (necha kg, qanchadan, naqd yoki qarzga) va oylik foyda-ziyon.
// Kirish Hisobchi bilan bir xil: Telegram imzosi yoki botda «Ha, kirish» bilan beriladigan kalit. Do'kon (Minimarket) ma'lumotlariga tegmaydi.
import { sql, json, cors, secret, dayStart, todayK, local } from '../hisobchi/tg.ts';
import { checkInit, makeToken, checkToken, hex } from '../hisobchi/auth.ts';

const ERR = (code: string, status = 400) => json({ error: code }, status);
const money = (v: unknown, zero = false) => { const n = Math.round(+(v as number)); return isFinite(n) && (zero ? n >= 0 : n > 0) && n <= 1e12 ? n : -1; };
const qtyOf = (v: unknown) => { const n = Math.round(+String(v ?? '').replace(',', '.') * 1000) / 1000; return isFinite(n) && n > 0 && n <= 1e9 ? n : 0; };
const txt = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const okId = (v: unknown) => { const n = +(v as number); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
const isKey = (k: unknown) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !isNaN(dayStart(k));
// yozuv vaqti: bugun — hozirgi vaqt; o'tgan kun — o'sha kunning shu soati
function tsOf(k: unknown): Date {
  if (!isKey(k) || (k as string) >= todayK()) return new Date();
  const now = local(), sec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return new Date(dayStart(k as string) + sec * 1000);
}
const ms = (d: unknown) => (d ? new Date(d as string).getTime() : null);
const ITEM_UNITS = ['kg', 'dona', 'litr', 'quti', 'metr'];
const MAT_UNITS = ['kg', 'dona', 'litr', 'quti', 'metr', 'gramm'];
export const EXP_CATS: [string, string, string][] = [
  ['gaz', '🔥', 'Gaz va svet'], ['ijara', '🏠', 'Ijara'], ['ishhaqi', '👷', 'Ish haqi'], ['qadoq', '📦', 'Qadoq'],
  ['transport', '🚚', 'Transport'], ['asbob', '🛠', 'Asbob-uskuna'], ['soliq', '🧾', 'Soliq'], ['boshqa', '💸', 'Boshqa'],
];

// ilova ochilishi: statistika; birinchi marta ochganda sotuvchiga xabar
const escH = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
async function trackOpen(chat: number) {
  const r: any = (await sql`insert into public.pr_user (chat, app_opens) values (${chat}, 1)
    on conflict (chat) do update set app_seen = now(), app_opens = public.pr_user.app_opens + 1 returning app_opens`)[0];
  if (!r || +r.app_opens !== 1) return;
  const admins: number[] = ((await sql`select public.tg_admin_chats() as v`)[0] as any).v || [];
  const token = await secret('tg_token');
  if (!token || !admins.length || admins.includes(chat)) return;
  const u: any = (await sql`select name, username from public.tg_users where chat_id = ${chat}`)[0] || {};
  const all = ((await sql`select count(*)::int n from public.pr_user`)[0] as any).n;
  const text = '🏭 <b>«Ishlab chiqarish»ni birinchi marta ochdi</b>: ' + (u.name ? escH(u.name) : 'Ismi nomaʼlum') + (u.username ? ' (@' + escH(u.username) + ')' : '') + '\nFoydalanuvchilar: <b>' + all + '</b>';
  for (const a of admins) await fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: a, text, parse_mode: 'HTML' }) }).catch(() => null);
}

async function load(chat: number, open = false) {
  if (open) await trackOpen(chat).catch((e) => console.error('trackOpen', e));
  const [items, mats, tx, who, cnt] = await Promise.all([
    sql`select id, name, unit, price::float8 price, archived from public.pr_item where chat = ${chat} order by archived, name`,
    sql`select id, name, unit, price::float8 price, archived from public.pr_mat where chat = ${chat} order by archived, name`,
    sql`select id, kind, item, mat, cat, qty::float8 qty, price::float8 price, amount::float8 amount, paid::float8 paid, customer, note, ts from public.pr_tx where chat = ${chat} order by ts desc, id desc limit 5000`,
    sql`select name, username from public.tg_users where chat_id = ${chat}`,
    sql`select count(*)::int n from public.pr_tx where chat = ${chat}`,
  ]);
  return {
    ok: true, now: Date.now(), today: todayK(), bot: await secret('tg_bot'),
    user: { name: (who[0] as any)?.name || '', username: (who[0] as any)?.username || '' },
    cats: EXP_CATS.map(([id, e, n]) => ({ id, e, n })),
    items: (items as any[]).map((x) => ({ id: +x.id, name: x.name, unit: x.unit, price: x.price, archived: x.archived })),
    mats: (mats as any[]).map((x) => ({ id: +x.id, name: x.name, unit: x.unit, price: x.price, archived: x.archived })),
    tx: (tx as any[]).map((r) => ({ id: +r.id, kind: r.kind, item: r.item ? +r.item : null, mat: r.mat ? +r.mat : null, cat: r.cat, qty: r.qty, price: r.price, amount: r.amount, paid: r.paid, customer: r.customer || '', note: r.note || '', ts: ms(r.ts) })),
    more: ((cnt[0] as any)?.n || 0) > 5000,
  };
}

// mahsulot / xomashyo: nom bo'yicha topish yoki yaratish (bir xil nom — bitta yozuv)
async function upsertNamed(table: 'pr_item' | 'pr_mat', chat: number, name: string, unit: string, price: number) {
  const ex: any = table === 'pr_item'
    ? (await sql`select id from public.pr_item where chat = ${chat} and lower(name) = lower(${name}) limit 1`)[0]
    : (await sql`select id from public.pr_mat where chat = ${chat} and lower(name) = lower(${name}) limit 1`)[0];
  if (ex) return +ex.id;
  const n = table === 'pr_item' ? (await sql`select count(*)::int n from public.pr_item where chat = ${chat}`)[0] : (await sql`select count(*)::int n from public.pr_mat where chat = ${chat}`)[0];
  if ((n as any).n >= 300) throw { code: 'LIMIT' };
  const r: any = table === 'pr_item'
    ? (await sql`insert into public.pr_item (chat, name, unit, price) values (${chat}, ${name}, ${unit}, ${Math.max(0, price)}) returning id`)[0]
    : (await sql`insert into public.pr_mat (chat, name, unit, price) values (${chat}, ${name}, ${unit}, ${Math.max(0, price)}) returning id`)[0];
  return +r.id;
}
async function owns(table: 'pr_item' | 'pr_mat', chat: number, id: number) {
  const r = table === 'pr_item' ? await sql`select 1 from public.pr_item where id = ${id} and chat = ${chat}` : await sql`select 1 from public.pr_mat where id = ${id} and chat = ${chat}`;
  return r.length > 0;
}

// sotuv / xomashyo / xarajat yozuvini tekshirish -> bazaga yoziladigan qiymatlar
async function txValues(chat: number, b: any) {
  const kind = ['sale', 'buy', 'exp'].includes(b.kind) ? b.kind : '';
  if (!kind) throw { code: 'BAD' };
  const note = txt(b.note, 100) || null;
  if (kind === 'exp') {
    const cat = EXP_CATS.some((c) => c[0] === b.cat) ? b.cat : 'boshqa';
    const amount = money(b.amount); if (amount <= 0) throw { code: 'NO_AMOUNT' };
    return { kind, item: null, mat: null, cat, qty: null, price: null, amount, paid: amount, customer: null, note };
  }
  const qty = qtyOf(b.qty); if (!qty) throw { code: 'NO_QTY' };
  let price = money(b.price, true), amount = money(b.amount);
  if (amount <= 0 && price > 0) amount = Math.round(qty * price);
  if (amount <= 0) throw { code: 'NO_AMOUNT' };
  if (price < 0) price = Math.round(amount / qty);
  const table = kind === 'sale' ? 'pr_item' : 'pr_mat';
  let id = okId(kind === 'sale' ? b.item : b.mat);
  if (id && !(await owns(table, chat, id))) id = 0;
  if (!id) {
    const name = txt(b.name, 60); if (!name) throw { code: kind === 'sale' ? 'NO_ITEM' : 'NO_MAT' };
    const units = kind === 'sale' ? ITEM_UNITS : MAT_UNITS;
    id = await upsertNamed(table, chat, name, units.includes(b.unit) ? b.unit : 'kg', price);
  }
  // oxirgi narxni eslab qolamiz (keyingi safar tayyor turadi)
  if (kind === 'sale') await sql`update public.pr_item set price = ${price}, archived = false where id = ${id}`;
  else await sql`update public.pr_mat set price = ${price}, archived = false where id = ${id}`;
  // sotuv: naqd (to'liq to'langan) yoki qarzga (paid — oldindan berilgan pul)
  let paid = amount, customer: string | null = null;
  if (kind === 'sale' && b.credit) {
    customer = txt(b.customer, 50); if (!customer) throw { code: 'NO_CUSTOMER' };
    paid = Math.min(amount, Math.max(0, money(b.paid, true)));
  }
  return { kind, item: kind === 'sale' ? id : null, mat: kind === 'buy' ? id : null, cat: null, qty, price, amount, paid, customer, note };
}

async function act(chat: number, a: string, b: any): Promise<Response> {
  switch (a) {
    case 'load': return json(await load(chat, !!b.open));
    case 'tx_add': {
      const v = await txValues(chat, b);
      const r: any = (await sql`insert into public.pr_tx (chat, kind, item, mat, cat, qty, price, amount, paid, customer, note, ts)
        values (${chat}, ${v.kind}, ${v.item}, ${v.mat}, ${v.cat}, ${v.qty}, ${v.price}, ${v.amount}, ${v.paid}, ${v.customer}, ${v.note}, ${tsOf(b.date)}) returning id`)[0];
      return json({ ok: true, id: +r.id });
    }
    case 'tx_edit': {
      const id = okId(b.id);
      if (!id || !(await sql`select 1 from public.pr_tx where id = ${id} and chat = ${chat}`).length) return ERR('NOT_FOUND', 404);
      const v = await txValues(chat, b);
      await sql`update public.pr_tx set kind = ${v.kind}, item = ${v.item}, mat = ${v.mat}, cat = ${v.cat}, qty = ${v.qty}, price = ${v.price}, amount = ${v.amount},
        paid = ${v.paid}, customer = ${v.customer}, note = ${v.note}${isKey(b.date) ? sql`, ts = ${tsOf(b.date)}` : sql``} where id = ${id} and chat = ${chat}`;
      return json({ ok: true });
    }
    case 'tx_del': {
      const r = await sql`delete from public.pr_tx where id = ${okId(b.id)} and chat = ${chat} returning id`;
      return r.length ? json({ ok: true }) : ERR('NOT_FOUND', 404);
    }
    case 'pay': { // qarzga sotilgan: to'lov qabul qilish (summa bo'lmasa — to'liq)
      const id = okId(b.id), x = b.amount == null ? null : money(b.amount);
      if (!id || x === -1) return ERR('BAD');
      const r: any = (await sql`update public.pr_tx set paid = least(amount, paid + coalesce(${x}::bigint, amount)) where id = ${id} and chat = ${chat} and kind = 'sale' and paid < amount
        returning (amount - paid)::float8 as left`)[0];
      return r ? json({ ok: true, left: r.left }) : ERR('NOT_FOUND', 404);
    }
    case 'pay_customer': { // mijozning barcha qarzi yopildi
      const c = txt(b.customer, 50); if (!c) return ERR('BAD');
      const r = await sql`update public.pr_tx set paid = amount where chat = ${chat} and kind = 'sale' and paid < amount and customer = ${c} returning id`;
      return json({ ok: true, n: r.length });
    }
    case 'item_save': case 'mat_save': {
      const isItem = a === 'item_save', units = isItem ? ITEM_UNITS : MAT_UNITS;
      const name = txt(b.name, 60), unit = units.includes(b.unit) ? b.unit : 'kg', price = Math.max(0, money(b.price, true)), id = okId(b.id);
      if (!name) return ERR('BAD');
      if (id) {
        const r = isItem
          ? await sql`update public.pr_item set name = ${name}, unit = ${unit}, price = ${price}, archived = ${!!b.archived} where id = ${id} and chat = ${chat} returning id`
          : await sql`update public.pr_mat set name = ${name}, unit = ${unit}, price = ${price}, archived = ${!!b.archived} where id = ${id} and chat = ${chat} returning id`;
        return r.length ? json({ ok: true, id }) : ERR('NOT_FOUND', 404);
      }
      return json({ ok: true, id: await upsertNamed(isItem ? 'pr_item' : 'pr_mat', chat, name, unit, price) });
    }
  }
  return ERR('UNKNOWN_ACTION');
}

export async function handle(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return ERR('METHOD', 405);
  let b: any;
  try { b = await req.json(); } catch (_) { return ERR('BAD_JSON'); }
  if (!b || typeof b !== 'object') return ERR('BAD_JSON');
  const a = String(b.action || 'load');
  try {
    // brauzer/telefonda kirish: kod -> botda «Ha, kirish» -> kalit
    if (a === 'login_start') {
      const code = hex(crypto.getRandomValues(new Uint8Array(12)));
      await sql`delete from public.w_login where created_at < now() - interval '1 day'`;
      await sql`insert into public.w_login (code, app) values (${code}, 'ishlab')`;
      return json({ ok: true, code, bot: await secret('tg_bot') });
    }
    if (a === 'login_poll') {
      const code = String(b.code || '');
      if (!/^[0-9a-f]{24}$/.test(code)) return ERR('BAD_CODE');
      const r: any = (await sql`select chat, used_at, created_at > now() - interval '15 minutes' fresh from public.w_login where code = ${code}`)[0];
      if (!r || !r.fresh || r.used_at) return ERR('EXPIRED', 410);
      if (!r.chat) return json({ pending: true });
      await sql`update public.w_login set used_at = now() where code = ${code}`;
      return json({ ok: true, token: await makeToken(+r.chat) });
    }
    let chat: number | null = null, token: string | undefined;
    if (b.initData) {
      const bot = await secret('tg_token');
      if (!bot) return ERR('NO_BOT', 503);
      const init = String(b.initData);
      const u = init.length <= 4096 ? await checkInit(init, bot) : null;
      if (!u) return ERR('AUTH', 401);
      chat = +u.id;
      if (a === 'load') token = await makeToken(chat);
    } else if (b.token) chat = await checkToken(String(b.token));
    if (!chat) return ERR('AUTH', 401);
    const res = await act(chat, a, b);
    if (token && res.status === 200) { const j = await res.json(); return json(Object.assign(j, { token })); }
    return res;
  } catch (e: any) {
    if (e && typeof e.code === 'string' && /^[A-Z_]+$/.test(e.code)) return ERR(e.code);
    console.error('ishlab', a, e);
    return ERR('SERVER', 500);
  }
}
