// «👛 Hamyon nazorat» — bot ichidagi bo'lim: xarajat/kirim yozish, toifa, hisobotlar, byudjet, qarz daftari, hisobni bo'lish.
// Ro'yxatdan o'tmagan va obunasi tugaganlarga ham ochiq. Do'kon hisobiga (ilovaga) hech qanday ta'sir qilmaydi.
import { sql, send, tg, esc, fmt } from './tg.ts';
import { CATS, catOf, cl, nz, parse, detect, isIncome, otherOf, sh, bar, dmy, wUser, wEnsure, sums, homeView, dayView, monthView, historyView, budgetView, budgetNote, money, soOf, type WUser } from './wcore.ts';
import { type Cur, isUsdText, parseUsd, usd } from '../hisobchi/cur.ts';
import { todayK, addK, dayStart } from './tg.ts';
import { matchAlloc, allocState, allocLine } from '../hisobchi/alloc.ts';

export const WKB = {
  keyboard: [[{ text: '➖ Xarajat' }, { text: '➕ Kirim' }], [{ text: '📊 Bugun hisobi' }, { text: '📆 Shu oy' }], [{ text: '🎯 Byudjet' }, { text: '📒 Qarz daftari' }], [{ text: '🕘 Tarix' }, { text: '👛 Hamyon' }], [{ text: '⬅️ Asosiy menyu' }]],
  resize_keyboard: true, is_persistent: true, input_field_placeholder: 'kofe 38000 · taksi 25 ming · netflix 12$',
};
export const isWalletEntry = (text: string) => nz(text) === 'hamyon nazorat' || /^\/hamyon\b/i.test(text);
export const isWalletExit = (text: string) => nz(text) === 'asosiy menyu';
const SO = ' soʻm';
const setStep = (chat: number, step: unknown) => sql`update public.w_user set step = ${sql.json(step as any)}, updated_at = now() where chat = ${chat}`;
const today = () => todayK();

async function show(token: string, chat: number, v: { text: string; markup: unknown }, editId?: number) {
  if (editId) {
    const r: any = await tg(token, 'editMessageText', { chat_id: chat, message_id: editId, text: v.text, parse_mode: 'HTML', reply_markup: v.markup, disable_web_page_preview: true });
    if (r && (r.ok || /not modified/.test(String(r.description || '')))) return;
  }
  await send(token, chat, v.text, { reply_markup: v.markup });
}

/* ---------- kirish / chiqish ---------- */
export async function walletEnter(token: string, chat: number) {
  const before = await wUser(chat);
  await wEnsure(chat);
  await sql`update public.w_user set mode = true, step = '{}'::jsonb, updated_at = now() where chat = ${chat}`;
  await send(token, chat, before
    ? '👛 <b>Hamyon nazorat</b> — xarajatni shunchaki yozing, masalan <code>kofe 38000</code>.'
    : '👛 <b>Hamyon nazorat</b> — kunlik xarajatlaringizni hisoblab boraman.\n\n' +
      '✍️ Xarajatni oddiy yozing: <code>kofe 38000</code>, <code>taksi 25 ming</code>, <code>obed 45k</code> — toifani oʻzim aniqlayman (Ovqat, Kofe, Transport…).\n' +
      '➕ Kirim: <code>+5 mln oylik</code>\n' +
      '🔔 Har kuni 21:00 da kunlik hisobot yuboraman.\n\n' +
      '<i>Bu boʻlim doʻkon hisobingizdan butunlay alohida — ilovaga taʼsir qilmaydi, bepul.</i>', { reply_markup: WKB });
  await show(token, chat, await homeView(chat));
}
export async function walletExit(chat: number) { await sql`update public.w_user set mode = false, step = '{}'::jsonb, updated_at = now() where chat = ${chat}`; }

/* ---------- yozuv kartasi ---------- */
async function topCats(chat: number, kind: string, not: string) {
  const r: any[] = await sql`select cat from public.w_tx where chat = ${chat} and kind = ${kind} and cat not in ('qarz', ${not}, ${otherOf(kind)}) group by cat order by count(*) desc limit 2`;
  const a = r.map((x) => x.cat);
  for (const d of kind === 'out' ? ['ovqat', 'transport', 'xarid', 'kofe'] : ['oylik', 'savdo']) if (a.length < 2 && d !== not && !a.includes(d)) a.push(d);
  return a;
}
function catGrid(id: number, kind: string, cur: string) {
  const cs = CATS.filter((c) => c.kind === kind), rows: any[] = [];
  for (let i = 0; i < cs.length; i += 3) rows.push(cs.slice(i, i + 3).map((c) => ({ text: (c.id === cur ? '✅ ' : '') + c.e + ' ' + c.n, callback_data: 'wc:' + id + ':' + c.id })));
  return rows;
}
async function txView(chat: number, id: number, grid = false) {
  const u = await wUser(chat);
  const r: any = (await sql`select id, kind, amount::float8 amount, cur, cat, note, alloc, ts from public.w_tx where id = ${id} and chat = ${chat}`)[0];
  if (!r || !u) return null;
  const t = today(), [d, m] = await Promise.all([sums(chat, t, addK(t, 1)), sums(chat, t.slice(0, 8) + '01', addK(t, 1))]);
  const unknown = r.cat === otherOf(r.kind);
  const L = ['✅ ' + (r.kind === 'out' ? 'Xarajat' : 'Kirim') + ': <b>' + (r.kind === 'out' ? '−' : '+') + money(r.amount, r.cur) + '</b>' + soOf(r.cur) + ' · ' + cl(r.cat)];
  if (r.note) L.push('📝 ' + esc(r.note));
  if (r.cur === 'USD') L.push('💵 Bugun dollar: ' + (d.uOut ? '−' + usd(d.uOut) : '') + (d.uOut && d.uIn ? ' · ' : '') + (d.uIn ? '+' + usd(d.uIn) : '') + ' · Shu oy: −' + usd(m.uOut));
  else L.push('📅 Bugun: −' + fmt(d.out) + (d.inn ? ' · +' + fmt(d.inn) : '') + ' · Shu oy: −' + fmt(m.out));
  if (r.kind === 'out' && r.cur !== 'USD') { const b = await budgetNote(u, r.cat); if (b) L.push(b); }
  // «Oylik reja» (Hisobchi ilovasida): shu chiqim qaysi yo'nalishdan va qancha qoldi
  if (r.kind === 'out') {
    const aid = r.alloc ? +r.alloc : (((await sql`select id from public.w_alloc where chat = ${chat} and cat = ${r.cat} and cur = ${r.cur} order by sort, id limit 1`)[0] as any)?.id || 0);
    const ms = t.slice(0, 8) + '01', me = addK(ms, 32).slice(0, 8) + '01';
    const st = aid ? await allocState(sql, chat, +aid, new Date(dayStart(ms)), new Date(dayStart(me))) : null;
    if (st) L.push(allocLine(st, fmt));
  }
  if (unknown || grid) L.push('', '🗂 <b>Toifani tanlang</b> 👇');
  const rows: any[] = [];
  if (unknown || grid) rows.push(...catGrid(r.id, r.kind, r.cat));
  else {
    const alt = await topCats(chat, r.kind, r.cat);
    rows.push([{ text: '✅ ' + catOf(r.cat).e + ' ' + catOf(r.cat).n, callback_data: 'wk:' + r.id }, ...alt.map((c) => ({ text: catOf(c).e + ' ' + catOf(c).n, callback_data: 'wc:' + r.id + ':' + c }))]);
    rows.push([{ text: '🗂 Boshqa toifa', callback_data: 'wk:' + r.id }]);
  }
  rows.push([...(r.kind === 'out' && r.cur !== 'USD' ? [{ text: '👥 Hisobni boʻlish', callback_data: 'ws:' + r.id }] : []), { text: '🗑 Oʻchirish', callback_data: 'wd:' + r.id }]);
  return { text: L.join('\n'), markup: { inline_keyboard: rows } };
}

/* ---------- qarz daftari ---------- */
async function debtsView(chat: number, closed = false) {
  const rows: any[] = await sql`select id, dir, name, amount::float8 amount, paid::float8 paid, cur, created_at, closed_at from public.w_debt where chat = ${chat} and closed = ${closed} order by created_at desc limit 40`;
  const L = [closed ? '📁 <b>Yopilgan qarzlar</b>' : '📒 <b>Qarz daftari</b>', ''];
  if (!closed) {
    const tot = (dir: string, cur: string) => rows.filter((x) => x.dir === dir && x.cur === cur).reduce((s, x) => s + x.amount - x.paid, 0);
    const me = tot('me', 'UZS'), i = tot('i', 'UZS'), uMe = tot('me', 'USD'), uI = tot('i', 'USD');
    L.push('🟢 Menga qarz: <b>' + fmt(me) + '</b>' + SO + (uMe ? ' + <b>' + usd(uMe) + '</b>' : ''), '🔴 Men qarzdorman: <b>' + fmt(i) + '</b>' + SO + (uI ? ' + <b>' + usd(uI) + '</b>' : ''), '⚖️ Sof: <b>' + (me - i >= 0 ? '+' : '') + fmt(me - i) + '</b>' + (uMe || uI ? ' · <b>' + (uMe - uI >= 0 ? '+' : '') + usd(uMe - uI) + '</b>' : ''));
    if (!rows.length) L.push('', 'Ochiq qarz yoʻq. Pastdagi tugmalar bilan qoʻshing.');
  } else if (!rows.length) L.push('Yopilgan qarz yoʻq.');
  for (const dir of ['me', 'i']) {
    const a = rows.filter((x) => x.dir === dir); if (!a.length) continue;
    L.push('', dir === 'me' ? '<b>Menga qarz</b>' : '<b>Men qarzdorman</b>');
    a.forEach((x, n) => L.push((n + 1) + '. ' + esc(x.name) + ' — <b>' + money(closed ? x.amount : x.amount - x.paid, x.cur) + '</b>' + (!closed && x.paid ? ' (' + money(x.amount, x.cur) + ' dan)' : '') + ' · ' + dmy(closed ? x.closed_at : x.created_at)));
  }
  const kb: any[] = rows.slice(0, 20).map((x) => [{ text: (x.dir === 'me' ? '🟢 ' : '🔴 ') + x.name + ' · ' + (x.cur === 'USD' ? usd(closed ? x.amount : x.amount - x.paid) : sh(closed ? x.amount : x.amount - x.paid)), callback_data: 'wqv:' + x.id }]);
  if (!closed) kb.push([{ text: '➕ Qarz berdim', callback_data: 'wqa:me' }, { text: '➕ Qarz oldim', callback_data: 'wqa:i' }], [{ text: '📁 Yopilganlar', callback_data: 'wqz:' }]);
  else kb.push([{ text: '⬅️ Ochiq qarzlar', callback_data: 'wq:' }]);
  return { text: L.join('\n').slice(0, 4000), markup: { inline_keyboard: kb } };
}
async function debtView(chat: number, id: number, fresh = false) {
  const d: any = (await sql`select id, dir, name, amount::float8 amount, paid::float8 paid, cur, closed, note, flow, created_at, closed_at from public.w_debt where id = ${id} and chat = ${chat}`)[0];
  if (!d) return null;
  const left = d.amount - d.paid, p = Math.round((d.paid * 100) / d.amount);
  const L = [(d.dir === 'me' ? '🟢 <b>' + esc(d.name) + '</b> — menga qarz' : '🔴 <b>' + esc(d.name) + '</b> — men qarzdorman')];
  L.push('Jami: ' + money(d.amount, d.cur) + ' · ' + (d.dir === 'me' ? 'Qaytardi' : 'Toʻladim') + ': ' + money(d.paid, d.cur) + ' · Qoldi: <b>' + money(left, d.cur) + '</b>' + soOf(d.cur));
  L.push(bar(p) + ' ' + p + '%');
  L.push('📅 ' + dmy(d.created_at) + (d.note ? ' · 📝 ' + esc(d.note) : '') + (d.closed ? '\n✅ Yopilgan: ' + dmy(d.closed_at) : ''));
  if (fresh && d.flow) L.push('', '<i>Pul ' + (d.dir === 'me' ? 'hozir berildi deb balansdan ayirdim' : 'hozir olindi deb balansga qoʻshdim') + '. Bu eski qarz boʻlsa — pastdagi tugmani bosing.</i>');
  const kb: any[] = [];
  if (!d.closed) kb.push([{ text: d.dir === 'me' ? '💸 Toʻlov qabul qilish' : '💸 Toʻlov qildim', callback_data: 'wqp:' + d.id }, { text: '✅ Toʻliq yopish', callback_data: 'wqc:' + d.id }]);
  if (d.flow && !d.paid) kb.push([{ text: '📝 Eski qarz — balansga taʼsir qilmasin', callback_data: 'wqo:' + d.id }]);
  kb.push([{ text: '🗑 Oʻchirish', callback_data: 'wqx:' + d.id }, { text: '⬅️ Qarzlar', callback_data: d.closed ? 'wqz:' : 'wq:' }]);
  return { text: L.join('\n'), markup: { inline_keyboard: kb } };
}
async function debtCreate(chat: number, dir: string, name: string, amount: number, note: string | null, txId: number | null, cur: Cur = 'UZS') {
  return await sql.begin(async (q: any) => {
    const d: any = (await q`insert into public.w_debt (chat, dir, name, amount, cur, note, tx) values (${chat}, ${dir}, ${name}, ${amount}, ${cur}, ${note}, ${txId}) returning id`)[0];
    const f: any = (await q`insert into public.w_tx (chat, kind, amount, cur, cat, note, debt) values (${chat}, ${dir === 'me' ? 'out' : 'in'}, ${amount}, ${cur}, 'qarz', ${(dir === 'me' ? 'Qarz berildi: ' : 'Qarz olindi: ') + name}, ${d.id}) returning id`)[0];
    await q`update public.w_debt set flow = ${f.id} where id = ${d.id}`;
    return +d.id;
  });
}
// to'lov: x — summa (qolgandan ko'p bo'lmaydi). Qaytaradi: yangi holat yoki null
async function debtPay(chat: number, id: number, x: number | null) {
  return await sql.begin(async (q: any) => {
    const d: any = (await q`select * from public.w_debt where id = ${id} and chat = ${chat} and not closed for update`)[0];
    if (!d) return null;
    const left = +d.amount - +d.paid, v = Math.min(left, x == null ? left : x);
    if (v <= 0) return null;
    await q`insert into public.w_tx (chat, kind, amount, cur, cat, note, debt) values (${chat}, ${d.dir === 'me' ? 'in' : 'out'}, ${v}, ${d.cur}, 'qarz', ${(d.dir === 'me' ? 'Qarz qaytdi: ' : 'Qarz toʻlandi: ') + d.name}, ${id})`;
    const closed = +d.paid + v >= +d.amount;
    await q`update public.w_debt set paid = paid + ${v}, closed = ${closed}, closed_at = ${closed ? new Date() : null} where id = ${id}`;
    return { v, closed, cur: d.cur as string };
  });
}

/* ---------- matn (hamyon rejimida) ---------- */
// true — matn shu yerda ishlandi
export async function walletText(token: string, chat: number, text: string, u: WUser): Promise<boolean> {
  const t = nz(text), step = (u.step || {}) as any;
  const reply = (s: string, extra: Record<string, unknown> = {}) => send(token, chat, s, Object.assign({ reply_markup: WKB }, extra));
  // menyu tugmalari — kutilayotgan javobni bekor qiladi
  const btn: Record<string, () => Promise<unknown>> = {
    'xarajat': async () => { await setStep(chat, { s: 'out' }); await reply('➖ <b>Xarajat</b>: summa va nima uchunligini yozing.\nMasalan: <code>taksi 25000</code>, <code>obed 45 ming</code>'); },
    'kirim': async () => { await setStep(chat, { s: 'in' }); await reply('➕ <b>Kirim</b>: summa va qayerdanligini yozing.\nMasalan: <code>5 mln oylik</code>, <code>800 ming savdo</code>'); },
    'bugun hisobi': async () => show(token, chat, await dayView(chat, today())),
    'shu oy': async () => show(token, chat, await monthView(chat, today())),
    'byudjet': async () => show(token, chat, await budgetView(chat)),
    'qarz daftari': async () => show(token, chat, await debtsView(chat)),
    'tarix': async () => show(token, chat, await historyView(chat, 0)),
    'hamyon': async () => show(token, chat, await homeView(chat)),
    'hamyon nazorat': async () => show(token, chat, await homeView(chat)),
  };
  if (btn[t]) { if (t !== 'xarajat' && t !== 'kirim' && step.s) await setStep(chat, {}); await btn[t](); return true; }

  const p = parse(text);
  // --- kutilayotgan javoblar
  if (step.s === 'bal') {
    if (!p && t !== '0') { await reply('Balansni raqam bilan yozing, masalan: <code>2 500 000</code> yoki <code>2,5 mln</code>'); return true; }
    const v = p ? (p.sign === '-' ? -p.amount : p.amount) : 0;
    await sql`update public.w_user set balance = ${v}, balance_at = now(), step = '{}'::jsonb where chat = ${chat}`;
    await reply('💰 Balans: <b>' + fmt(v) + '</b>' + SO + ' — saqlandi. Bundan keyingi kirim va xarajatlar oʻzi qoʻshiladi/ayiriladi.');
    await show(token, chat, await homeView(chat));
    return true;
  }
  if (step.s === 'budget' && catOf(step.cat).kind === 'out') {
    if (!p && t !== '0') { await reply('Limitni raqam bilan yozing, masalan: <code>4 mln</code>. <code>0</code> — limitni olib tashlash.'); return true; }
    const v = p ? p.amount : 0;
    const b = Object.assign({}, u.budgets || {}); if (v > 0) b[step.cat] = v; else delete b[step.cat];
    await sql`update public.w_user set budgets = ${sql.json(b)}, step = '{}'::jsonb where chat = ${chat}`;
    await reply(v > 0 ? '🎯 ' + cl(step.cat) + ': oylik limit <b>' + fmt(v) + '</b>' + SO : '🎯 ' + cl(step.cat) + ': limit olib tashlandi');
    await show(token, chat, await budgetView(chat));
    return true;
  }
  if (step.s === 'debt' && (step.dir === 'me' || step.dir === 'i')) {
    const uq = isUsdText(text) ? parseUsd(text) : null, dp = uq || p;
    if (!dp) { await reply('Ism va summani yozing, masalan: <code>Alisher 200000</code> yoki <code>Alisher 100$</code>'); return true; }
    const name = (dp.note || 'Nomaʼlum').slice(0, 40);
    await setStep(chat, {});
    const id = await debtCreate(chat, step.dir, name, dp.amount, null, null, uq ? 'USD' : 'UZS');
    await reply('📒 Qarz daftariga yozildi.');
    const v = await debtView(chat, id, true); if (v) await show(token, chat, v);
    return true;
  }
  if (step.s === 'dpay' && step.id) {
    const dc: any = (await sql`select cur from public.w_debt where id = ${+step.id} and chat = ${chat}`)[0];
    const pp = dc && dc.cur === 'USD' ? parseUsd(text) : p; // dollar qarz — summa dollarda
    if (!pp) { await reply('Summani yozing, masalan: <code>' + (dc && dc.cur === 'USD' ? '50' : '100000') + '</code>'); return true; }
    await setStep(chat, {});
    const r = await debtPay(chat, +step.id, pp.amount);
    await reply(r ? '💸 ' + money(r.v, r.cur) + soOf(r.cur) + ' yozildi' + (r.closed ? ' — qarz toʻliq yopildi ✅' : '') : 'Qarz topilmadi yoki allaqachon yopilgan.');
    const v = await debtView(chat, +step.id); if (v) await show(token, chat, v);
    return true;
  }
  if (step.s === 'split' && step.tx) {
    const tx: any = (await sql`select id, amount::float8 amount, cat, note from public.w_tx where id = ${+step.tx} and chat = ${chat} and kind = 'out' and cat <> 'qarz' and cur = 'UZS'`)[0];
    if (!tx) { await setStep(chat, {}); await reply('Bu yozuv topilmadi.'); return true; }
    if (!p || p.amount <= 0 || p.amount >= tx.amount) { await reply('Hisob: <b>' + fmt(tx.amount) + '</b>' + SO + '. Oʻz ulushingizni (undan kam summa) va kim qaytarishini yozing, masalan: <code>140000 Hamkasblar</code>'); return true; }
    const rest = tx.amount - p.amount, name = (p.note || 'Doʻstlar').slice(0, 40);
    await setStep(chat, {});
    let id = 0;
    await sql.begin(async (q: any) => {
      await q`update public.w_tx set amount = ${p.amount} where id = ${tx.id}`;
      const d: any = (await q`insert into public.w_debt (chat, dir, name, amount, note, tx) values (${chat}, 'me', ${name}, ${rest}, ${'Hisobni boʻlish: ' + fmt(tx.amount) + (tx.note ? ' (' + tx.note + ')' : '')}, ${tx.id}) returning id`)[0];
      const f: any = (await q`insert into public.w_tx (chat, kind, amount, cat, note, debt) values (${chat}, 'out', ${rest}, 'qarz', ${'Hisobni boʻlish: ' + name}, ${d.id}) returning id`)[0];
      await q`update public.w_debt set flow = ${f.id} where id = ${d.id}`;
      id = +d.id;
    });
    await reply('👥 <b>Hisob boʻlindi</b>: ' + fmt(tx.amount) + SO + '\n• Siz: <b>' + fmt(p.amount) + '</b> — ' + cl(tx.cat) + ' xarajatiga\n• ' + esc(name) + ': <b>' + fmt(rest) + '</b> — qaytaradi, qarz daftariga yozildi 📒');
    const v = await debtView(chat, id); if (v) await show(token, chat, { text: v.text.replace(/\n\n<i>.*<\/i>$/s, ''), markup: v.markup });
    return true;
  }

  // --- oddiy yozuv: «kofe 38000», «netflix 12$»
  const uq = isUsdText(text) ? parseUsd(text) : null, cur: Cur = uq ? 'USD' : 'UZS';
  const q = uq ? { ...uq, x1000: false } : p;
  if (!q || q.amount <= 0) {
    await reply('🤔 Summani topolmadim. Masalan: <code>kofe 38000</code>, <code>taksi 25 ming</code>, <code>+5 mln oylik</code>.\n\nDoʻkon menyusiga qaytish — «⬅️ Asosiy menyu».');
    return true;
  }
  const kind: 'out' | 'in' = step.s === 'in' ? 'in' : step.s === 'out' ? 'out' : q.sign === '+' || (q.sign !== '-' && isIncome(q.note)) ? 'in' : 'out';
  const cat = detect(q.note, kind, u.learn || {}) || otherOf(kind);
  if (step.s) await setStep(chat, {});
  const alloc = kind === 'out' ? await matchAlloc(sql, chat, q.note, cur) : null;
  const r: any = (await sql`insert into public.w_tx (chat, kind, amount, cur, cat, note, alloc) values (${chat}, ${kind}, ${q.amount}, ${cur}, ${cat}, ${q.note || null}, ${alloc}) returning id`)[0];
  const v = await txView(chat, +r.id);
  if (v) await send(token, chat, v.text + (q.x1000 ? '\n<i>(' + fmt(q.amount / 1000) + ' → ' + fmt(q.amount) + SO + ' deb oldim)</i>' : ''), { reply_markup: v.markup });
  return true;
}

// hamyon rejimida rasm yuborilsa (obuna cheki kutilmayotgan bo'lsa)
export async function walletPhoto(token: string, chat: number) {
  await send(token, chat, '👛 Hamyonga xarajatni matn bilan yozing: <code>kofe 38000</code>.\n\n<i>Obuna cheki yubormoqchi boʻlsangiz: «⬅️ Asosiy menyu» → «💳 Obuna».</i>', { reply_markup: WKB });
}

/* ---------- tugmalar (callback) ---------- */
export async function walletCallback(token: string, cq: any, data: string) {
  const chat = cq.message.chat.id, mid = cq.message.message_id;
  const ans = (text?: string, alert = false) => tg(token, 'answerCallbackQuery', Object.assign({ callback_query_id: cq.id }, text ? { text, show_alert: alert } : {}));
  const [cmd, a = '', b = ''] = data.split(':');
  if (cmd === 'w') { await ans(); await walletEnter(token, chat); return; }
  const u = await wUser(chat);
  if (!u) { await ans(); await walletEnter(token, chat); return; }
  const id = +a;
  switch (cmd) {
    case 'wc': { // toifani almashtirish (va eslab qolish)
      const c = CATS.find((x) => x.id === b);
      const r: any = (await sql`select kind, note from public.w_tx where id = ${id} and chat = ${chat} and cat <> 'qarz'`)[0];
      if (!c || !r || c.kind !== r.kind) { await ans('Yozuv topilmadi'); return; }
      await sql`update public.w_tx set cat = ${c.id} where id = ${id}`;
      const note = nz(r.note || '');
      if (note && note.length <= 40 && c.id !== otherOf(c.kind)) {
        const learn = Object.assign({}, u.learn || {}); learn[note] = c.id;
        const w = note.split(' ')[0]; if (w.length >= 3 && !/^\d/.test(w)) learn[w] = c.id;
        const keys = Object.keys(learn); if (keys.length > 300) for (const k of keys.slice(0, keys.length - 300)) delete learn[k];
        await sql`update public.w_user set learn = ${sql.json(learn)} where chat = ${chat}`;
      }
      await ans(c.e + ' ' + c.n + ' deb belgilandi');
      const v = await txView(chat, id); if (v) await show(token, chat, v, mid);
      return;
    }
    case 'wk': { await ans(); const v = await txView(chat, id, true); if (v) await show(token, chat, v, mid); return; }
    case 'wd': {
      const r: any = (await sql`delete from public.w_tx where id = ${id} and chat = ${chat} and cat <> 'qarz' returning kind, amount::float8 amount, cur, cat`)[0];
      await ans(r ? 'Oʻchirildi' : 'Topilmadi');
      if (r) await tg(token, 'editMessageText', { chat_id: chat, message_id: mid, parse_mode: 'HTML', text: '🗑 <s>' + (r.kind === 'out' ? '−' : '+') + money(r.amount, r.cur) + soOf(r.cur) + ' · ' + cl(r.cat) + '</s> — oʻchirildi' });
      return;
    }
    case 'ws': {
      const r: any = (await sql`select amount::float8 amount from public.w_tx where id = ${id} and chat = ${chat} and kind = 'out' and cat <> 'qarz' and cur = 'UZS'`)[0];
      if (!r) { await ans('Topilmadi'); return; }
      await ans();
      await sql`update public.w_user set mode = true, step = ${sql.json({ s: 'split', tx: id })} where chat = ${chat}`;
      await send(token, chat, '👥 <b>Hisobni boʻlish</b> — hisob: <b>' + fmt(r.amount) + '</b>' + SO + '\n\nOʻz ulushingizni va kim qaytarishini yozing:\n<code>140000 Hamkasblar</code>\n\nQolgani «menga qarz» boʻlib qarz daftariga yoziladi.', { reply_markup: WKB });
      return;
    }
    case 'wy': { await ans(); if (/^\d{4}-\d{2}-\d{2}$/.test(a)) await show(token, chat, await dayView(chat, a > today() ? today() : a), mid); return; }
    case 'wm': { await ans(); if (/^\d{4}-\d{2}$/.test(a)) await show(token, chat, await monthView(chat, a + '-01' > today() ? today() : a + '-01'), mid); return; }
    case 'wh': { await ans(); await show(token, chat, await historyView(chat, Math.max(0, id || 0)), mid); return; }
    case 'wb': {
      await ans();
      await sql`update public.w_user set mode = true, step = ${sql.json({ s: 'bal' })} where chat = ${chat}`;
      await send(token, chat, '💰 <b>Hozir qoʻlingizda (karta + naqd) qancha pul bor?</b>\n\nMasalan: <code>2 500 000</code> yoki <code>2,5 mln</code>. Bundan keyin har bir kirim va xarajat balansga oʻzi qoʻshiladi/ayiriladi.', { reply_markup: WKB });
      return;
    }
    case 'wr': {
      const d = u.daily === false;
      await sql`update public.w_user set daily = ${d} where chat = ${chat}`;
      await ans(d ? '🔔 Kechki hisobot yoqildi (21:00)' : '🔕 Kechki hisobot oʻchirildi');
      await show(token, chat, await homeView(chat), mid);
      return;
    }
    case 'wG': { await ans(); await show(token, chat, await budgetView(chat), mid); return; }
    case 'wg': {
      const c = CATS.find((x) => x.id === a && x.kind === 'out'); if (!c) { await ans(); return; }
      await ans();
      await sql`update public.w_user set mode = true, step = ${sql.json({ s: 'budget', cat: c.id })} where chat = ${chat}`;
      const cur = +((u.budgets || {})[c.id]) || 0;
      await send(token, chat, '🎯 <b>' + c.e + ' ' + c.n + '</b> uchun oylik limit qancha?' + (cur ? '\nHozir: ' + fmt(cur) + SO : '') + '\n\nMasalan: <code>4 mln</code>, <code>500 ming</code>. <code>0</code> — limitni olib tashlash.', { reply_markup: WKB });
      return;
    }
    case 'wq': { await ans(); await show(token, chat, await debtsView(chat), mid); return; }
    case 'wqz': { await ans(); await show(token, chat, await debtsView(chat, true), mid); return; }
    case 'wqa': {
      if (a !== 'me' && a !== 'i') { await ans(); return; }
      await ans();
      await sql`update public.w_user set mode = true, step = ${sql.json({ s: 'debt', dir: a })} where chat = ${chat}`;
      await send(token, chat, (a === 'me' ? '🟢 <b>Qarz berdim</b> — kimga va qancha?' : '🔴 <b>Qarz oldim</b> — kimdan va qancha?') + '\n\nMasalan: <code>Alisher 200000</code>', { reply_markup: WKB });
      return;
    }
    case 'wqv': { await ans(); const v = await debtView(chat, id); if (v) await show(token, chat, v, mid); else await show(token, chat, await debtsView(chat), mid); return; }
    case 'wqp': {
      const d: any = (await sql`select dir, name, cur, (amount - paid)::float8 left from public.w_debt where id = ${id} and chat = ${chat} and not closed`)[0];
      if (!d) { await ans('Topilmadi'); return; }
      await ans();
      await sql`update public.w_user set mode = true, step = ${sql.json({ s: 'dpay', id })} where chat = ${chat}`;
      await send(token, chat, '💸 <b>' + esc(d.name) + '</b> — ' + (d.dir === 'me' ? 'qancha qaytardi?' : 'qancha toʻladingiz?') + '\nQoldi: ' + money(d.left, d.cur) + soOf(d.cur) + '\n\nSummani yozing, masalan: <code>' + (d.cur === 'USD' ? Math.min(50, d.left / 100) + '$' : Math.min(100000, d.left)) + '</code>', { reply_markup: WKB });
      return;
    }
    case 'wqc': {
      const r = await debtPay(chat, id, null);
      await ans(r ? '✅ Qarz yopildi' : 'Allaqachon yopilgan');
      const v = await debtView(chat, id); if (v) await show(token, chat, v, mid);
      return;
    }
    case 'wqo': {
      await sql`delete from public.w_tx where id = (select flow from public.w_debt where id = ${id} and chat = ${chat} and paid = 0) and chat = ${chat}`;
      await sql`update public.w_debt set flow = null where id = ${id} and chat = ${chat} and paid = 0`;
      await ans('Balansga taʼsir qilmaydi');
      const v = await debtView(chat, id); if (v) await show(token, chat, v, mid);
      return;
    }
    case 'wqx': {
      await ans();
      await show(token, chat, { text: '🗑 Bu qarzni oʻchirasizmi? Unga bogʻliq toʻlovlar ham oʻchadi.', markup: { inline_keyboard: [[{ text: '🗑 Ha, oʻchirish', callback_data: 'wqX:' + id }, { text: '⬅️ Yoʻq', callback_data: 'wqv:' + id }]] } }, mid);
      return;
    }
    case 'wqX': {
      await sql.begin(async (q: any) => {
        const d: any = (await q`delete from public.w_debt where id = ${id} and chat = ${chat} returning amount, tx`)[0];
        // hisobni bo'lishdan bo'lsa — asl xarajat summasi qaytariladi
        if (d && d.tx) await q`update public.w_tx set amount = amount + ${d.amount} where id = ${d.tx} and chat = ${chat}`;
      });
      await ans('Oʻchirildi');
      await show(token, chat, await debtsView(chat), mid);
      return;
    }
  }
  await ans();
}
