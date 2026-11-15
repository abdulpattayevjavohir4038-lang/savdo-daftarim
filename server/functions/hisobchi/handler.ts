// «🧮 Hisobchi» ilovasi uchun server: kirim-chiqim, qarz oldi-berdi, balans, byudjet.
// Ma'lumotlar bot ichidagi «👛 Hamyon nazorat» bilan bitta (w_user, w_tx, w_debt — Telegram chat_id bo'yicha).
// Kirish: Telegram ichida — Telegram imzosi (initData); brauzer/telefonda — botda «Ha, kirish» bosilgach beriladigan kalit.
// Do'kon (Minimarket) ma'lumotlariga tegmaydi.
import { sql, json, cors, secret, setSecret, dayStart, todayK, local } from './tg.ts';
import { CATS, nz, parse, detect, isIncome, otherOf, wEnsure, wUser, balanceOf, avgDaily } from './wcore.ts';

const enc = new TextEncoder();
async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
const same = (a: string, b: string) => { if (a.length !== b.length) return false; let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; };

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export async function checkInit(initData: string, botToken: string, maxAgeSec = 7 * 86400) {
  const p = new URLSearchParams(initData);
  const hash = p.get('hash') || '';
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  p.delete('hash');
  const dcs = [...p.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => k + '=' + v).join('\n');
  const sk = await hmac(enc.encode('WebAppData'), botToken);
  if (!same(hex(await hmac(sk, dcs)), hash)) return null;
  const age = Date.now() / 1000 - (+(p.get('auth_date') || 0));
  if (!(age >= -300 && age < maxAgeSec)) return null;
  try { const u = JSON.parse(p.get('user') || 'null'); return u && u.id ? u : null; } catch (_) { return null; }
}

// brauzer/telefon uchun kalit: «chat.muddat.imzo» (180 kun)
async function hbKey() {
  let k = await secret('hb_key');
  if (!k) { k = hex(crypto.getRandomValues(new Uint8Array(32))); await setSecret('hb_key', k); }
  return k;
}
async function makeToken(chat: number) {
  const exp = Math.floor(Date.now() / 1000) + 180 * 86400, body = chat + '.' + exp;
  return body + '.' + hex(await hmac(enc.encode(await hbKey()), 'hb:' + body));
}
async function checkToken(t: string): Promise<number | null> {
  const m = /^(-?\d{1,20})\.(\d{10})\.([0-9a-f]{64})$/.exec(t || '');
  if (!m || +m[2] < Date.now() / 1000) return null;
  return same(hex(await hmac(enc.encode(await hbKey()), 'hb:' + m[1] + '.' + m[2])), m[3]) ? +m[1] : null;
}

/* ---------- yordamchilar ---------- */
const ERR = (code: string, status = 400) => json({ error: code }, status);
const amt = (v: unknown) => { const n = Math.round(+(v as number)); return isFinite(n) && n > 0 && n <= 1e12 ? n : 0; };
const txt = (v: unknown, n: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const okId = (v: unknown) => { const n = +(v as number); return Number.isSafeInteger(n) && n > 0 ? n : 0; };
const isKey = (k: unknown) => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !isNaN(dayStart(k));
// yozuv vaqti: bugun — hozirgi vaqt; o'tgan kun — o'sha kunning shu soati (kelajak kun — bugun)
function tsOf(k: unknown): Date {
  if (!isKey(k) || (k as string) >= todayK()) return new Date();
  const now = local(), sec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds();
  return new Date(dayStart(k as string) + sec * 1000);
}
const catFor = (cat: unknown, kind: 'in' | 'out') => { const c = CATS.find((x) => x.id === cat); return c && c.kind === kind ? c.id : ''; };
const ms = (d: unknown) => (d ? new Date(d as string).getTime() : null);

async function learnCat(chat: number, note: string | null, cat: string) {
  const c = CATS.find((x) => x.id === cat); const n = nz(note || '');
  if (!c || !n || n.length > 40 || c.id === otherOf(c.kind)) return;
  const u = await wUser(chat); if (!u) return;
  const learn = Object.assign({}, u.learn || {}); learn[n] = c.id;
  const w = n.split(' ')[0]; if (w.length >= 3 && !/^\d/.test(w)) learn[w] = c.id;
  const keys = Object.keys(learn); if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete learn[k];
  await sql`update public.w_user set learn = ${sql.json(learn)}, updated_at = now() where chat = ${chat}`;
}

// ilova ochilishi: statistika uchun; birinchi marta ochganda sotuvchiga darhol xabar
const escH = (s: unknown) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c] as string));
async function trackOpen(chat: number) {
  const r: any = (await sql`update public.w_user set app_first = coalesce(app_first, now()), app_seen = now(), app_opens = app_opens + 1 where chat = ${chat} returning app_opens`)[0];
  if (!r || +r.app_opens !== 1) return;
  const admins: number[] = ((await sql`select public.tg_admin_chats() as v`)[0] as any).v || [];
  const token = await secret('tg_token');
  if (!token || !admins.length || admins.includes(chat)) return;
  const u: any = (await sql`select name, username from public.tg_users where chat_id = ${chat}`)[0] || {};
  const all = ((await sql`select count(*)::int n from public.w_user where app_first is not null`)[0] as any).n;
  const text = '🧮 <b>Hisobchini birinchi marta ochdi</b>: ' + (u.name ? escH(u.name) : 'Ismi nomaʼlum') + (u.username ? ' (@' + escH(u.username) + ')' : '') + '\nHisobchi foydalanuvchilari: <b>' + all + '</b>';
  for (const a of admins) await fetch('https://api.telegram.org/bot' + token + '/sendMessage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: a, text, parse_mode: 'HTML' }) }).catch(() => null);
}

async function load(chat: number, open = false) {
  const u = await wEnsure(chat);
  if (open) await trackOpen(chat).catch((e) => console.error('trackOpen', e));
  const [tx, debts, who, bal, avg, cnt] = await Promise.all([
    sql`select id, kind, amount::float8 amount, cat, note, debt, ts from public.w_tx where chat = ${chat} order by ts desc, id desc limit 5000`,
    sql`select id, dir, name, amount::float8 amount, paid::float8 paid, closed, note, flow, tx, created_at, closed_at from public.w_debt where chat = ${chat} order by created_at desc`,
    sql`select name, username from public.tg_users where chat_id = ${chat}`,
    balanceOf(u), avgDaily(chat),
    sql`select count(*)::int n from public.w_tx where chat = ${chat}`,
  ]);
  return {
    ok: true, now: Date.now(), today: todayK(), bot: await secret('tg_bot'),
    user: { name: (who[0] as any)?.name || '', username: (who[0] as any)?.username || '', balance: u.balance == null ? null : +u.balance, balanceAt: ms(u.balance_at), balanceNow: bal, avgDaily: avg, budgets: u.budgets || {}, daily: u.daily !== false },
    cats: CATS.map((c) => ({ id: c.id, e: c.e, n: c.n, kind: c.kind })),
    tx: (tx as any[]).map((r) => ({ id: +r.id, kind: r.kind, amount: r.amount, cat: r.cat, note: r.note || '', debt: r.debt ? +r.debt : null, ts: ms(r.ts) })),
    more: ((cnt[0] as any)?.n || 0) > 5000,
    debts: (debts as any[]).map((d) => ({ id: +d.id, dir: d.dir, name: d.name, amount: d.amount, paid: d.paid, closed: d.closed, note: d.note || '', flow: d.flow ? +d.flow : null, split: !!d.tx, at: ms(d.created_at), closedAt: ms(d.closed_at) })),
  };
}

/* ---------- amallar ---------- */
async function act(chat: number, a: string, b: any): Promise<Response> {
  switch (a) {
    case 'load': return json(await load(chat, !!b.open));
    case 'quick': { // «kofe 38000», «+5 mln oylik» — botdagidek
      const p = parse(txt(b.text, 120));
      if (!p || !amt(p.amount)) return ERR('NO_AMOUNT');
      const u = await wEnsure(chat);
      const kind: 'in' | 'out' = b.kind === 'in' || b.kind === 'out' ? b.kind : p.sign === '+' || (p.sign !== '-' && isIncome(p.note)) ? 'in' : 'out';
      const cat = detect(p.note, kind, u.learn || {}) || otherOf(kind);
      const r: any = (await sql`insert into public.w_tx (chat, kind, amount, cat, note, ts) values (${chat}, ${kind}, ${amt(p.amount)}, ${cat}, ${p.note || null}, ${tsOf(b.date)}) returning id`)[0];
      return json({ ok: true, id: +r.id, kind, amount: amt(p.amount), cat, note: p.note, x1000: p.x1000 });
    }
    case 'tx_add': {
      const kind = b.kind === 'in' ? 'in' : 'out', v = amt(b.amount);
      if (!v) return ERR('NO_AMOUNT');
      const u = await wEnsure(chat), note = txt(b.note, 80) || null;
      const cat = catFor(b.cat, kind) || detect(note || '', kind, u.learn || {}) || otherOf(kind);
      if (catFor(b.cat, kind)) await learnCat(chat, note, cat);
      const r: any = (await sql`insert into public.w_tx (chat, kind, amount, cat, note, ts) values (${chat}, ${kind}, ${v}, ${cat}, ${note}, ${tsOf(b.date)}) returning id`)[0];
      return json({ ok: true, id: +r.id, cat });
    }
    case 'tx_edit': {
      const id = okId(b.id), kind = b.kind === 'in' ? 'in' : 'out', v = amt(b.amount);
      if (!id || !v) return ERR('BAD');
      const old: any = (await sql`select cat, note from public.w_tx where id = ${id} and chat = ${chat} and cat <> 'qarz'`)[0];
      if (!old) return ERR('NOT_FOUND', 404);
      const u = await wEnsure(chat), note = txt(b.note, 80) || null, cat = catFor(b.cat, kind) || detect(note || '', kind, u.learn || {}) || otherOf(kind);
      await sql`update public.w_tx set kind = ${kind}, amount = ${v}, cat = ${cat}, note = ${note}${isKey(b.date) ? sql`, ts = ${tsOf(b.date)}` : sql``} where id = ${id} and chat = ${chat}`;
      if (cat !== old.cat) await learnCat(chat, note, cat);
      return json({ ok: true });
    }
    case 'tx_del': {
      const id = okId(b.id);
      const r = await sql`delete from public.w_tx where id = ${id} and chat = ${chat} and cat <> 'qarz' returning id`;
      return r.length ? json({ ok: true }) : ERR('NOT_FOUND', 404);
    }
    case 'debt_add': { // dir: 'me' — qarz berdim (menga qarz), 'i' — qarz oldim (men qarzdorman)
      const dir = b.dir === 'i' ? 'i' : b.dir === 'me' ? 'me' : '', v = amt(b.amount), name = txt(b.name, 40);
      if (!dir || !v || !name) return ERR('BAD');
      await wEnsure(chat);
      const note = txt(b.note, 80) || null, flow = b.flow !== false, ts = tsOf(b.date);
      const id = await sql.begin(async (q: any) => {
        const d: any = (await q`insert into public.w_debt (chat, dir, name, amount, note, created_at) values (${chat}, ${dir}, ${name}, ${v}, ${note}, ${ts}) returning id`)[0];
        if (flow) {
          const f: any = (await q`insert into public.w_tx (chat, kind, amount, cat, note, debt, ts) values (${chat}, ${dir === 'me' ? 'out' : 'in'}, ${v}, 'qarz', ${(dir === 'me' ? 'Qarz berildi: ' : 'Qarz olindi: ') + name}, ${d.id}, ${ts}) returning id`)[0];
          await q`update public.w_debt set flow = ${f.id} where id = ${d.id}`;
        }
        return +d.id;
      });
      return json({ ok: true, id });
    }
    case 'debt_pay': { // amount bo'lmasa — qolganini to'liq yopish
      const id = okId(b.id), x = b.amount == null ? null : amt(b.amount);
      if (!id || x === 0) return ERR('BAD');
      const r = await sql.begin(async (q: any) => {
        const d: any = (await q`select * from public.w_debt where id = ${id} and chat = ${chat} and not closed for update`)[0];
        if (!d) return null;
        const left = +d.amount - +d.paid, v = Math.min(left, x == null ? left : x);
        if (v <= 0) return null;
        await q`insert into public.w_tx (chat, kind, amount, cat, note, debt, ts) values (${chat}, ${d.dir === 'me' ? 'in' : 'out'}, ${v}, 'qarz', ${(d.dir === 'me' ? 'Qarz qaytdi: ' : 'Qarz toʻlandi: ') + d.name}, ${id}, ${tsOf(b.date)})`;
        const closed = +d.paid + v >= +d.amount;
        await q`update public.w_debt set paid = paid + ${v}, closed = ${closed}, closed_at = ${closed ? new Date() : null} where id = ${id}`;
        return { v, closed };
      });
      return r ? json({ ok: true, ...r }) : ERR('NOT_FOUND', 404);
    }
    case 'debt_noflow': { // eski qarz — balansga ta'sir qilmasin
      const id = okId(b.id);
      await sql`delete from public.w_tx where id = (select flow from public.w_debt where id = ${id} and chat = ${chat} and paid = 0) and chat = ${chat}`;
      const r = await sql`update public.w_debt set flow = null where id = ${id} and chat = ${chat} and paid = 0 returning id`;
      return r.length ? json({ ok: true }) : ERR('NOT_FOUND', 404);
    }
    case 'debt_del': { // qarz va unga bog'liq to'lovlar o'chadi (botdagidek)
      const id = okId(b.id);
      const ok = await sql.begin(async (q: any) => {
        const d: any = (await q`delete from public.w_debt where id = ${id} and chat = ${chat} returning amount, tx`)[0];
        if (!d) return false;
        await q`delete from public.w_tx where debt = ${id} and chat = ${chat} and cat = 'qarz'`;
        if (d.tx) await q`update public.w_tx set amount = amount + ${d.amount} where id = ${d.tx} and chat = ${chat}`;
        return true;
      });
      return ok ? json({ ok: true }) : ERR('NOT_FOUND', 404);
    }
    case 'balance': { // null — balans kuzatuvini o'chirish
      await wEnsure(chat);
      if (b.value == null || b.value === '') await sql`update public.w_user set balance = null, balance_at = null, updated_at = now() where chat = ${chat}`;
      else {
        const n = Math.round(+b.value);
        if (!isFinite(n) || Math.abs(n) > 1e12) return ERR('BAD');
        await sql`update public.w_user set balance = ${n}, balance_at = now(), updated_at = now() where chat = ${chat}`;
      }
      return json({ ok: true });
    }
    case 'budget': {
      const c = CATS.find((x) => x.id === b.cat && x.kind === 'out');
      if (!c) return ERR('BAD');
      const u = await wEnsure(chat), v = Math.max(0, Math.round(+b.value || 0));
      const bud = Object.assign({}, u.budgets || {}); if (v > 0 && v <= 1e12) bud[c.id] = v; else delete bud[c.id];
      await sql`update public.w_user set budgets = ${sql.json(bud)}, updated_at = now() where chat = ${chat}`;
      return json({ ok: true });
    }
    case 'daily': {
      await wEnsure(chat);
      await sql`update public.w_user set daily = ${!!b.on}, updated_at = now() where chat = ${chat}`;
      return json({ ok: true });
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
    // --- brauzer/telefonda kirish: kod -> botda «Ha, kirish» -> kalit
    if (a === 'login_start') {
      const code = hex(crypto.getRandomValues(new Uint8Array(12)));
      await sql`delete from public.w_login where created_at < now() - interval '1 day'`;
      await sql`insert into public.w_login (code) values (${code})`;
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
    // --- qolgan amallar: kim ekanini aniqlaymiz
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
  } catch (e) {
    console.error('hisobchi', a, e);
    return ERR('SERVER', 500);
  }
}
