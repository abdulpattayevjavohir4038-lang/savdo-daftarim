// «👛 Hamyon nazorat» — umumiy qism (tg-webhook va tg-cron): toifalar, summa o'qish, hisob-kitob va hisobot matnlari.
// Do'kon (ilova) ma'lumotlariga tegmaydi: faqat w_user, w_tx, w_debt jadvallari (chat_id bo'yicha).
import { sql, send, fmt, esc, local, todayK, addK, dayStart, secret } from './tg.ts';
import { usd } from '../hisobchi/cur.ts';
import { allocMonth, allocLine } from '../hisobchi/alloc.ts';
// summa o'z valyutasida: so'm — «1 250 000», dollar (sentda) — «$1 250»
export const money = (n: number, cur?: string) => (cur === 'USD' ? usd(n) : fmt(n));
export const soOf = (cur?: string) => (cur === 'USD' ? '' : ' soʻm');

/* ---------- toifalar ---------- */
type Cat = { id: string; e: string; n: string; kind: 'out' | 'in'; kw: string[] };
const C = (id: string, e: string, n: string, kind: 'out' | 'in', kw: string): Cat => ({ id, e, n, kind, kw: kw ? kw.split(',') : [] });
// kalit so'zlar apostrofsiz, kichik harfda (nz() dan keyingi ko'rinish); ko'p so'zli kalitlar birinchi tekshiriladi
export const CATS: Cat[] = [
  C('ovqat', '🍽', 'Ovqat', 'out', 'osh,ovqat,obed,tushlik,nonushta,kechki ovqat,lavash,shaurma,burger,hotdog,hot dog,pizza,somsa,shashlik,kafe,restoran,choyxona,evos,oqtepa,maxway,max way,kfc,safia,chopar,dodo,les ailes,lagmon,manti,non,fastfood,fast food,yandex eats,yemak,wolt,express24'),
  C('kofe', '☕️', 'Kofe', 'out', 'kofe,kofi,coffee,latte,kapuchino,kapuchina,cappuccino,americano,amerikano,espresso,starbucks,choy,coffee like'),
  C('transport', '🚕', 'Transport', 'out', 'taksi,taxi,yandex go,yandex,mytaxi,uber,avtobus,metro,benzin,metan,propan,zapravka,yoqilgi,parkovka,moyka,yol kira,yolkira,poyezd,poezd,samolyot,avia'),
  C('xarid', '🛒', 'Xaridlar', 'out', 'korzinka,makro,havas,magazin,dokon,bozor,market,supermarket,oziq,gosht,meva,sabzavot,sut,tuxum,uzum market,yandex market,yandex lavka,xarid'),
  C('uy', '🏠', 'Uy', 'out', 'ijara,kvartira,uy,mebel,tamir,remont,santexnik,xojalik'),
  C('kommunal', '💡', 'Kommunal', 'out', 'kommunal,svet,elektr,gaz,chiqindi,issiqlik,otoplenie'),
  C('aloqa', '📱', 'Aloqa', 'out', 'telefon,internet,beeline,ucell,uzmobile,mobiuz,humans,uztelecom,tarif,paket'),
  C('sogliq', '💊', 'Sogʻliq', 'out', 'dori,apteka,dorixona,shifokor,doktor,vrach,klinika,stomatolog,tish,analiz,kasalxona,massaj'),
  C('kiyim', '👕', 'Kiyim', 'out', 'kiyim,poyabzal,krossovka,tufli,shim,koylak,kurtka,futbolka,palto,sumka'),
  C('talim', '🎓', 'Taʼlim', 'out', 'kurs,kitob,oqish,kontrakt,repetitor,maktab,universitet,daftar,ruchka'),
  C('obuna', '🔁', 'Obunalar', 'out', 'netflix,spotify,youtube,premium,obuna,icloud,chatgpt,claude,apple music,yandex plus'),
  C('dam', '🎉', 'Dam olish', 'out', 'kino,park,sayohat,mehmonxona,hotel,oyin,bilyard,futbol,konsert,dam olish'),
  C('sovga', '🎁', 'Sovgʻa', 'out', 'sovga,tugilgan kun,toy,gul,hadya,tort'),
  C('ish', '💼', 'Ish / biznes', 'out', 'material,ish uchun,ustaxona,asbob,tovar'),
  C('boshqa', '📦', 'Boshqa', 'out', ''),
  C('oylik', '💼', 'Oylik', 'in', 'oylik,maosh,zarplata,avans,premiya,bonus'),
  C('savdo', '💰', 'Savdo / biznes', 'in', 'savdo,tushum,foyda,zakaz,buyurtma,mijoz'),
  C('sovgain', '🎁', 'Sovgʻa', 'in', 'sovga,hadya'),
  C('boshqain', '📦', 'Boshqa kirim', 'in', ''),
];
const QARZ: Cat = { id: 'qarz', e: '📒', n: 'Qarz', kind: 'out', kw: [] };
// «Oylik reja»: yo'nalishga berilgan pul (Hisobchi ilovasi)
const REJA: Cat = { id: 'reja', e: '📥', n: 'Oylik reja', kind: 'out', kw: [] };
export const catOf = (id: string): Cat => CATS.find((c) => c.id === id) || (id === 'qarz' ? QARZ : id === 'reja' ? REJA : (CATS.find((c) => c.id === 'boshqa') as Cat));
export const cl = (id: string) => { const c = catOf(id); return c.e + ' ' + c.n; };
export const otherOf = (kind: string) => (kind === 'in' ? 'boshqain' : 'boshqa');

// matnni solishtirish uchun: kichik harf, apostrofsiz, faqat harf/raqam
export const nz = (s: string) => String(s || '').toLowerCase().replace(/[ʻʼ'`‘’]/g, '').replace(/[^a-z0-9а-яёқғўҳ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
const INCOME = ['oylik', 'maosh', 'zarplata', 'avans', 'premiya', 'bonus', 'tushdi', 'tushum', 'kirim', 'daromad'];
export const isIncome = (note: string) => nz(note).split(' ').some((w) => INCOME.some((k) => w.startsWith(k)));

// izohdan toifa: avval foydalanuvchi o'zi o'rgatgani, keyin kalit so'zlar. '' — topilmadi
export function detect(note: string, kind: 'out' | 'in', learn: Record<string, string> = {}): string {
  const t = nz(note); if (!t) return '';
  const ok = (id?: string) => { const c = id ? CATS.find((x) => x.id === id) : null; return c && c.kind === kind ? c.id : ''; };
  if (ok(learn[t])) return learn[t];
  const words = t.split(' ');
  for (const w of words) if (w.length >= 3 && ok(learn[w])) return learn[w];
  const cs = CATS.filter((c) => c.kind === kind);
  for (const c of cs) for (const k of c.kw) if (k.includes(' ') && (' ' + t + ' ').includes(' ' + k)) return c.id;
  for (const w of words) for (const c of cs) for (const k of c.kw) if (!k.includes(' ') && w.startsWith(k) && (k.length >= 4 || w.length - k.length <= 3)) return c.id;
  return '';
}

// «kofe 38000», «taksi 25 ming», «+1,5 mln oylik», «obed 45k», «38» (= 38 000) -> summa, belgi, izoh
const NUM = /([+\-−]?)[ \t]*(\d{1,3}(?:[ . ]\d{3})+(?!\d)|\d+(?:[.,]\d+)?)(?:\s*(ming|минг|тыс|mln|million|millon|милл|млн)[a-zа-яё'ʻ]*|\s*(k)(?![a-zа-яё]))?/gi;
export function parse(text: string): { amount: number; sign: string; note: string; x1000: boolean } | null {
  let best: { v: number; sign: string; i: number; len: number; x1000: boolean } | null = null;
  for (const m of String(text || '').matchAll(NUM)) {
    const raw = m[2], suf = (m[3] || m[4] || '').toLowerCase();
    const grouped = /^\d{1,3}(?:[ . ]\d{3})+$/.test(raw);
    let v = grouped ? +raw.replace(/[ . ]/g, '') : +raw.replace(',', '.');
    let x1000 = false;
    if (/^(mln|million|millon|милл|млн)/.test(suf)) v *= 1e6;
    else if (suf) v *= 1e3;
    else if (v > 0 && v < 1000) { v *= 1000; x1000 = true; }
    v = Math.round(v);
    if (!isFinite(v) || v > 1e12) continue;
    if (!best || v > best.v) best = { v, sign: m[1] === '+' ? '+' : m[1] ? '-' : '', i: m.index || 0, len: m[0].length, x1000 };
  }
  if (!best) return null;
  const t = String(text);
  const note = (t.slice(0, best.i) + ' ' + t.slice(best.i + best.len))
    .replace(/(^|\s)(so['ʻ`’]?m|sum|сум|uzs)(?=\s|$|[.,!])/gi, ' ').replace(/\s+/g, ' ').replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, '').slice(0, 80);
  return { amount: best.v, sign: best.sign, note, x1000: best.x1000 };
}

/* ---------- formatlash va vaqt ---------- */
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const WD = ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'];
const kd = (k: string) => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)));
export const mStart = (k: string) => k.slice(0, 8) + '01';
export const nextM = (k: string) => { const y = +k.slice(0, 4), m = +k.slice(5, 7); return m === 12 ? (y + 1) + '-01-01' : y + '-' + String(m + 1).padStart(2, '0') + '-01'; };
export const prevM = (k: string) => mStart(addK(mStart(k), -1));
const dim = (k: string) => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7), 0)).getUTCDate();
const mName = (k: string) => { const n = MONTHS[+k.slice(5, 7) - 1]; return n[0].toUpperCase() + n.slice(1) + ' ' + k.slice(0, 4); };
const mShort = (k: string) => { const n = MONTHS[+k.slice(5, 7) - 1]; return n[0].toUpperCase() + n.slice(1); };
const dLabel = (k: string) => { const d = kd(k); return d.getUTCDate() + '-' + MONTHS[d.getUTCMonth()] + ', ' + WD[d.getUTCDay()]; };
const dShort = (k: string) => { const d = kd(k); return d.getUTCDate() + '-' + MONTHS[d.getUTCMonth()].slice(0, 3); };
const D = (k: string) => new Date(dayStart(k));
const hhmm = (ts: Date | string) => local(new Date(ts).getTime()).toISOString().slice(11, 16);
const dayK = (ts: Date | string) => local(new Date(ts).getTime()).toISOString().slice(0, 10);
export const dmy = (ts: Date | string) => dayK(ts).split('-').reverse().join('.');
// qisqa summa: 255,6 ming · 13,8 mln
export const sh = (n: number) => {
  const a = Math.abs(n), s = n < 0 ? '−' : '';
  const d1 = (x: number) => (Math.round(x * 10) / 10).toString().replace('.', ',');
  if (a >= 1e6) return s + d1(a / 1e6) + ' mln';
  if (a >= 1e3) return s + (a < 1e5 ? d1(a / 1e3) : Math.round(a / 1e3)) + ' ming';
  return s + fmt(a);
};
export const bar = (p: number) => { const f = Math.max(0, Math.min(10, Math.round(p / 10))); return '▰'.repeat(f) + '▱'.repeat(10 - f); };
const pct = (a: number, b: number) => (b > 0 ? Math.round((a * 100) / b) : 0);
const SO = ' soʻm';
// «pul qancha kunga yetadi» satri
const lasts = (bal: number, avg: number, bold: boolean) => {
  if (bal <= 0) return '⚠️ Balans tugagan';
  const d = Math.floor(bal / avg);
  return d < 1 ? '⚠️ Kuniga ~' + sh(avg) + ' sarflansa, 1 kunga ham yetmaydi' : 'Kuniga ~' + sh(avg) + ' bilan ' + (bold ? '<b>' + d + ' kunga</b>' : d + ' kunga') + ' yetadi';
};

/* ---------- baza ---------- */
export type WUser = { chat: number; mode: boolean; step: any; balance: string | null; balance_at: Date | null; budgets: Record<string, number>; learn: Record<string, string>; daily: boolean };
export async function wUser(chat: number): Promise<WUser | null> { return ((await sql`select * from public.w_user where chat = ${chat}`)[0] as any) || null; }
export async function wEnsure(chat: number): Promise<WUser> { await sql`insert into public.w_user (chat) values (${chat}) on conflict (chat) do nothing`; return (await wUser(chat)) as WUser; }

// davr bo'yicha yig'indi (qarz harakatlari statistikaga kirmaydi). out/inn/by — so'mda; uOut/uIn — dollar (sentda)
export async function sums(chat: number, fromK: string, toK: string) {
  const r = await sql`select kind, cat, cur, sum(amount)::float8 s, count(*)::int n from public.w_tx
    where chat = ${chat} and ts >= ${D(fromK)} and ts < ${D(toK)} and cat <> 'qarz' group by 1, 2, 3`;
  let out = 0, inn = 0, n = 0, uOut = 0, uIn = 0, uN = 0; const by: Record<string, number> = {};
  for (const x of r as any[]) {
    if (x.cur === 'USD') { if (x.kind === 'out') uOut += x.s; else uIn += x.s; uN += x.n; continue; }
    if (x.kind === 'out') { out += x.s; by[x.cat] = (by[x.cat] || 0) + x.s; } else inn += x.s; n += x.n;
  }
  return { out, inn, n, by, uOut, uIn, uN };
}
// dollar satri (bo'lsa)
const usdLine = (s: { uOut: number; uIn: number }, pre = '💵 Dollar: ') => (s.uOut || s.uIn ? pre + (s.uOut ? 'chiqim <b>−' + usd(s.uOut) + '</b>' : '') + (s.uOut && s.uIn ? ' · ' : '') + (s.uIn ? 'kirim <b>+' + usd(s.uIn) + '</b>' : '') : '');
// hozirgi balans — asosiy kassa (so'mda): kiritilgan balans + o'shandan keyingi kirim − xarajat (qarz harakatlari va oylik rejaga berilgan pul ham). Dollar alohida
export async function balanceOf(u: WUser | null): Promise<number | null> {
  if (!u || u.balance == null || !u.balance_at) return null;
  const r = await sql`select coalesce(sum(case when kind = 'in' then amount else -amount end), 0)::float8 v from public.w_tx where chat = ${u.chat} and cur = 'UZS' and ts >= ${u.balance_at}`;
  return +u.balance + (r[0] as any).v;
}
// kunlik o'rtacha xarajat (oxirgi 30 kun, yozuv boshlangandan beri)
export async function avgDaily(chat: number): Promise<number> {
  const r: any = (await sql`select coalesce(sum(amount), 0)::float8 s, min(ts) f from public.w_tx where chat = ${chat} and kind = 'out' and cat <> 'qarz' and cur = 'UZS' and ts >= now() - interval '30 days'`)[0];
  if (!r.f || !r.s) return 0;
  const days = Math.min(30, Math.max(1, Math.round((dayStart(todayK()) - dayStart(dayK(r.f))) / 864e5) + 1));
  return r.s / days;
}

/* ---------- matn bo'laklari ---------- */
function catLines(by: Record<string, number>, total: number, max = 8) {
  const a = Object.entries(by).sort((x, y) => y[1] - x[1]);
  const L = a.slice(0, max).map(([c, v]) => cl(c) + ' — <b>' + fmt(v) + '</b> · ' + pct(v, total) + '%');
  if (a.length > max) { const rest = a.slice(max).reduce((s, x) => s + x[1], 0); L.push('… boshqalar — ' + fmt(rest) + ' · ' + pct(rest, total) + '%'); }
  return L;
}
// byudjet holati: full — hammasi, aks holda faqat ogohlantirishlar
function budgetLines(u: WUser | null, by: Record<string, number>, monthK: string, full: boolean) {
  const b = (u && u.budgets) || {}, t = todayK(), cur = mStart(t) === mStart(monthK);
  const dom = cur ? +t.slice(8, 10) : dim(monthK), D_ = dim(monthK);
  const L: string[] = [];
  for (const c of CATS) {
    const lim = +b[c.id] || 0; if (!lim) continue;
    const spent = by[c.id] || 0, p = pct(spent, lim), fc = cur ? (spent / dom) * D_ : spent;
    const warn = p >= 100 ? '⛔️ limit oshdi' : fc > lim ? '⚠️ oy oxiriga ~' + sh(fc) + ' — oshib ketadi' : '';
    if (!full && !warn) continue;
    L.push(cl(c.id) + ': ' + sh(spent) + ' / ' + sh(lim) + ' · ' + p + '%' + (full ? '\n' + bar(p) + (warn ? ' ' + warn : cur ? ' ✅' : '') : ' — ' + warn));
  }
  return L;
}

/* ---------- ekranlar ---------- */
export async function homeView(chat: number) {
  const u = await wUser(chat), t = todayK(), ms = mStart(t);
  const [day, mon, bal, avg] = await Promise.all([sums(chat, t, addK(t, 1)), sums(chat, ms, nextM(ms)), balanceOf(u), avgDaily(chat)]);
  const any = (await sql`select 1 from public.w_tx where chat = ${chat} limit 1`).length > 0;
  const dom = +t.slice(8, 10), fc = (mon.out / dom) * dim(t);
  const L = ['👛 <b>Hamyon nazorat</b>', ''];
  L.push(bal != null ? '💰 Balans: <b>' + fmt(bal) + '</b>' + SO : '💰 Balans: <i>kiritilmagan</i> (pastdagi tugma)');
  L.push('📉 ' + mShort(t) + ' oyida sarflandi: <b>' + fmt(mon.out) + '</b>' + SO);
  if (mon.inn) L.push('📈 ' + mShort(t) + ' oyida kirim: <b>+' + fmt(mon.inn) + '</b>');
  if (mon.out) L.push('🔮 Oy oxiriga prognoz: ~' + fmt(fc));
  if (bal != null && avg > 0) { const l = lasts(bal, avg, true); L.push(l.startsWith('⚠️') ? l : '⏳ ' + l); }
  L.push('📅 Bugun: sarflandi <b>' + fmt(day.out) + '</b> · tushdi ' + fmt(day.inn));
  const ul = usdLine(mon, '💵 ' + mShort(t) + ' oyida dollar: '); if (ul) L.push(ul);
  if (mon.out) L.push('', '🗂 <b>Toifalar</b> (' + mShort(t).toLowerCase() + ')', ...catLines(mon.by, mon.out, 6));
  const w = budgetLines(u, mon.by, t, false);
  if (w.length) L.push('', '🎯 <b>Byudjet</b>', ...w);
  if (!any) L.push('', 'Hali yozuv yoʻq. Birinchi xarajatni yozing — masalan:\n<code>kofe 38000</code>\n<code>taksi 25 ming</code>\n<code>+5 mln oylik</code>');
  else L.push('', '✍️ <i>Yozing: «kofe 38000», «taksi 25 ming», «+5 mln oylik»</i>');
  const app = await secret('app_url');
  const markup = { inline_keyboard: [
    ...(app ? [[{ text: '🧮 Hisobchi ilovasi — hammasi bir joyda', web_app: { url: app + 'hisobchi/' } }]] : []),
    [{ text: bal != null ? '💰 Balansni oʻzgartirish' : '💰 Balansni kiritish', callback_data: 'wb:' }],
    [{ text: '🎯 Byudjet', callback_data: 'wG:' }, { text: '📒 Qarzlar', callback_data: 'wq:' }],
    [{ text: '🔔 Kechki hisobot (21:00): ' + (u && u.daily === false ? 'oʻchiq ⬜' : 'yoqilgan ✅'), callback_data: 'wr:' }],
  ] };
  return { text: L.join('\n'), markup };
}

// kunlik hisobot (tugma va 21:00 da). forecast — oylik prognoz qismi bilan
export async function dayView(chat: number, k: string, forecast = false) {
  const u = await wUser(chat), t = todayK();
  const rows: any[] = await sql`select kind, amount::float8 amount, cur, cat, note, ts from public.w_tx where chat = ${chat} and ts >= ${D(k)} and ts < ${D(addK(k, 1))} and cat <> 'qarz' order by ts`;
  let out = 0, inn = 0, uOut = 0, uIn = 0; const by: Record<string, number> = {};
  for (const r of rows) {
    if (r.cur === 'USD') { if (r.kind === 'out') uOut += r.amount; else uIn += r.amount; continue; }
    if (r.kind === 'out') { out += r.amount; by[r.cat] = (by[r.cat] || 0) + r.amount; } else inn += r.amount;
  }
  const L = ['📊 <b>' + (k === t ? 'Bugun, ' : k === addK(t, -1) ? 'Kecha, ' : '') + dLabel(k) + ' — hisobot</b>', ''];
  if (!rows.length) L.push('Bu kunda yozuv yoʻq.');
  else {
    L.push('Xarajat: <b>−' + fmt(out) + '</b>' + SO);
    if (inn) L.push('Kirim: <b>+' + fmt(inn) + '</b>' + SO);
    const ul = usdLine({ uOut, uIn }); if (ul) L.push(ul);
    L.push('Amaliyotlar: ' + rows.length + ' ta');
    if (out) L.push('', '🗂 <b>Qayerga ketdi</b>', ...catLines(by, out));
    L.push('', '🧾 <b>Yozuvlar</b>');
    for (const r of rows.slice(-25)) L.push(hhmm(r.ts) + '  ' + (r.kind === 'out' ? '−' : '+') + money(r.amount, r.cur) + ' ' + catOf(r.cat).e + (r.note ? ' ' + esc(String(r.note).slice(0, 28)) : ' ' + catOf(r.cat).n));
  }
  if (forecast || k === t) {
    const ms = mStart(k), mon = await sums(chat, ms, nextM(ms));
    const cur = mStart(t) === ms, dom = cur ? +t.slice(8, 10) : dim(k);
    if (mon.out && cur) {
      const [bal, avg] = await Promise.all([balanceOf(u), avgDaily(chat)]);
      L.push('', '🔮 <b>Oylik prognoz</b>', 'Xarajat: ~' + fmt((mon.out / dom) * dim(k)) + SO);
      if (bal != null && avg > 0) L.push(lasts(bal, avg, false));
      const w = budgetLines(u, mon.by, k, false);
      if (w.length) L.push(...w.map((x) => '⚠️ ' + x));
    }
  }
  const nav = [{ text: '⬅️ ' + dShort(addK(k, -1)), callback_data: 'wy:' + addK(k, -1) }];
  if (k < t) nav.push({ text: dShort(addK(k, 1)) + ' ➡️', callback_data: 'wy:' + addK(k, 1) });
  const rowsKb: any[] = [nav];
  if (forecast) rowsKb.push([{ text: '👛 Hamyonni ochish', callback_data: 'w:home' }, { text: '📆 Shu oy', callback_data: 'wm:' + k.slice(0, 7) }]);
  return { text: L.join('\n').slice(0, 4000), markup: { inline_keyboard: rowsKb } };
}

export async function monthView(chat: number, k: string) {
  const u = await wUser(chat), t = todayK(), ms = mStart(k), cur = ms === mStart(t);
  const s = await sums(chat, ms, nextM(ms));
  const days = cur ? +t.slice(8, 10) : dim(ms);
  const L = ['📆 <b>' + mName(ms) + ' — hamyon</b>', ''];
  if (!s.n && !s.uN) L.push('Bu oyda yozuv yoʻq.');
  else {
    L.push('📉 Xarajat: <b>−' + fmt(s.out) + '</b>' + SO);
    L.push('📈 Kirim: <b>+' + fmt(s.inn) + '</b>' + SO);
    L.push('⚖️ Farq: <b>' + (s.inn - s.out >= 0 ? '+' : '') + fmt(s.inn - s.out) + '</b>');
    const ul = usdLine(s); if (ul) L.push(ul);
    L.push('🧾 Amaliyotlar: ' + (s.n + s.uN) + ' ta · kuniga oʻrtacha ' + fmt(s.out / days));
    if (cur && s.out) L.push('🔮 Oy oxiriga prognoz: ~' + fmt((s.out / days) * dim(ms)) + ' (' + (dim(ms) - days) + ' kun qoldi)');
    if (s.out) L.push('', '🗂 <b>Toifalar</b>', ...catLines(s.by, s.out, 12));
  }
  const b = budgetLines(u, s.by, ms, true);
  if (b.length) L.push('', '🎯 <b>Byudjet</b>', ...b);
  const al = await allocMonth(sql, chat, D(ms), D(nextM(ms)));
  if (al.length) L.push('', '📥 <b>Oylik reja — kimga/qayerga qancha berildi</b>', ...al.map((x) => allocLine(x, fmt)));
  const nav = [{ text: '⬅️ ' + mShort(prevM(ms)), callback_data: 'wm:' + prevM(ms).slice(0, 7) }];
  if (!cur) nav.push({ text: mShort(nextM(ms)) + ' ➡️', callback_data: 'wm:' + nextM(ms).slice(0, 7) });
  return { text: L.join('\n').slice(0, 4000), markup: { inline_keyboard: [nav] } };
}

export async function historyView(chat: number, off = 0) {
  const P = 15;
  const rows: any[] = await sql`select id, kind, amount::float8 amount, cur, cat, note, ts from public.w_tx where chat = ${chat} order by ts desc, id desc limit ${P + 1} offset ${off}`;
  const L = ['🕘 <b>Tarix</b>' + (off ? ' (' + (off + 1) + '–' + (off + Math.min(P, rows.length)) + ')' : ''), ''];
  if (!rows.length) L.push('Hali yozuv yoʻq.');
  let last = '';
  for (const r of rows.slice(0, P)) {
    const k = dayK(r.ts);
    if (k !== last) { L.push((last ? '\n' : '') + '<b>' + dLabel(k) + '</b>'); last = k; }
    L.push(hhmm(r.ts) + '  ' + (r.kind === 'out' ? '−' : '+') + money(r.amount, r.cur) + '  ' + cl(r.cat) + (r.note ? ' · ' + esc(String(r.note).slice(0, 30)) : ''));
  }
  const nav: any[] = [];
  if (off > 0) nav.push({ text: '⬅️ Yangiroq', callback_data: 'wh:' + Math.max(0, off - P) });
  if (rows.length > P) nav.push({ text: 'Eskiroq ➡️', callback_data: 'wh:' + (off + P) });
  return { text: L.join('\n').slice(0, 4000), markup: { inline_keyboard: nav.length ? [nav] : [] } };
}

export async function budgetView(chat: number) {
  const u = await wUser(chat), t = todayK(), ms = mStart(t), s = await sums(chat, ms, nextM(ms));
  const b = (u && u.budgets) || {};
  const L = ['🎯 <b>Byudjet — ' + mName(ms) + '</b> (' + (dim(ms) - +t.slice(8, 10)) + ' kun qoldi)', ''];
  const lines = budgetLines(u, s.by, ms, true);
  if (lines.length) L.push(...lines.map((x) => x + '\n'));
  else L.push('Hali limit qoʻyilmagan.\n');
  L.push('<i>Toifani tanlang va oylik limit yozing — oshib ketishi mumkin boʻlsa, xarajat yozganingizda va kechki hisobotda ogohlantiraman.</i>');
  const cats = CATS.filter((c) => c.kind === 'out');
  const rows: any[] = [];
  for (let i = 0; i < cats.length; i += 2) rows.push(cats.slice(i, i + 2).map((c) => ({ text: c.e + ' ' + c.n + (+b[c.id] ? ' · ' + sh(+b[c.id]) : ''), callback_data: 'wg:' + c.id })));
  return { text: L.join('\n').trim(), markup: { inline_keyboard: rows } };
}

// xarajat/kirim yozilganda shu toifa bo'yicha byudjet satri
export async function budgetNote(u: WUser, cat: string) {
  const lim = +((u.budgets || {})[cat]) || 0; if (!lim) return '';
  const t = todayK(), ms = mStart(t), s = await sums(u.chat, ms, nextM(ms));
  const l = budgetLines({ ...u, budgets: { [cat]: lim } }, s.by, t, true)[0] || '';
  return l ? '🎯 ' + l : '';
}

/* ---------- 21:00 kunlik hisobot (tg-cron chaqiradi) ---------- */
export async function walletDigest(token: string) {
  const t = todayK();
  // bugun yozuvi bor va hisobot yoqilganlarga — kuniga bir marta (atomar belgilash)
  const rows: any[] = await sql`update public.w_user u set last_report = ${t}::date
    where u.daily and (u.last_report is null or u.last_report < ${t}::date)
      and exists (select 1 from public.w_tx x where x.chat = u.chat and x.ts >= ${D(t)} and x.cat <> 'qarz')
    returning u.chat`;
  let n = 0;
  for (const r of rows) {
    try {
      const v = await dayView(+r.chat, t, true);
      v.markup.inline_keyboard.push([{ text: '🔕 Kechki hisobotni oʻchirish', callback_data: 'wr:' }] as any);
      const res: any = await send(token, +r.chat, v.text, { reply_markup: v.markup });
      if (res && res.ok) n++;
      // oyning oxirgi kuni — oylik hisobot (oylik reja bo'yicha kimga qancha berilgani bilan)
      if (addK(t, 1).slice(8, 10) === '01') { const m = await monthView(+r.chat, t); await send(token, +r.chat, m.text, { reply_markup: m.markup }); }
    } catch (e) { console.error('wallet digest', r.chat, e); }
  }
  return n;
}
