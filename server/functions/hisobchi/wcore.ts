// «👛 Hamyon nazorat» umumiy qismi (Hisobchi uchun qisqa nusxa): toifalar, summa o'qish, balans.
// Do'kon (ilova) ma'lumotlariga tegmaydi: faqat w_user, w_tx, w_debt jadvallari (chat_id bo'yicha).
import { sql, local, todayK, dayStart } from './tg.ts';

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
export const catOf = (id: string): Cat => CATS.find((c) => c.id === id) || (id === 'qarz' ? QARZ : (CATS.find((c) => c.id === 'boshqa') as Cat));
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

/* ---------- vaqt ---------- */
const dayK = (ts: Date | string) => local(new Date(ts).getTime()).toISOString().slice(0, 10);

/* ---------- baza ---------- */
export type WUser = { chat: number; mode: boolean; step: any; balance: string | null; balance_at: Date | null; budgets: Record<string, number>; learn: Record<string, string>; daily: boolean };
export async function wUser(chat: number): Promise<WUser | null> { return ((await sql`select * from public.w_user where chat = ${chat}`)[0] as any) || null; }
export async function wEnsure(chat: number): Promise<WUser> { await sql`insert into public.w_user (chat) values (${chat}) on conflict (chat) do nothing`; return (await wUser(chat)) as WUser; }

// hozirgi balans (so'mda): kiritilgan balans + o'shandan keyingi barcha so'mdagi kirim − xarajat (qarz harakatlari ham). Dollar alohida
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
