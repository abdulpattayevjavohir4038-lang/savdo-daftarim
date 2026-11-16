// «Oylik reja» (pul ajratish): har oy yo'nalishga ajratiladigan pul — «Uy ro'zg'ori 3 mln», «Ayolimga 1 mln», «Ijara $300».
// w_alloc: yo'nalishlar; w_tx.alloc — chiqim qaysi yo'nalishdan. Yo'nalishga toifa bog'lansa (cat), shu toifadagi
// belgilanmagan chiqimlar ham o'sha yo'nalishga hisoblanadi. Faqat bir xil valyutadagi chiqimlar qo'shiladi.
import { usd } from './cur.ts';

// matnni solishtirish uchun (wcore.nz bilan bir xil)
const nz = (s: string) => String(s || '').toLowerCase().replace(/[ʻʼ'`‘’]/g, '').replace(/[^a-z0-9а-яёқғўҳ\s-]/g, ' ').replace(/\s+/g, ' ').trim();
// «ayolimga» ~ «Ayolimga», «uy rozgori uchun» ~ «Uy ro'zg'ori», «opamga berdim» ~ «Opamga»
const stem = (w: string) => w.replace(/(lariga|larga|imga|ning|ga|ka|qa|ni|im|lar)$/, '');
export function matchName(note: string, name: string): boolean {
  const a = nz(note), b = nz(name);
  if (!a || !b) return false;
  if (a === b || (' ' + a + ' ').includes(' ' + b + ' ')) return true;
  const aw = a.split(' ').map(stem).filter((w) => w.length >= 3), bw = b.split(' ').map(stem).filter((w) => w.length >= 3);
  return bw.length > 0 && bw.every((w) => aw.some((x) => x === w || (w.length >= 4 && x.startsWith(w)) || (x.length >= 4 && w.startsWith(x))));
}

// izohdan yo'nalishni topish (shu valyutadagi). null — topilmadi
// deno-lint-ignore no-explicit-any
export async function matchAlloc(sql: any, chat: number, note: string, cur: string): Promise<number | null> {
  if (!note) return null;
  const rows: any[] = await sql`select id, name from public.w_alloc where chat = ${chat} and cur = ${cur} order by sort, id`;
  const hit = rows.find((r) => matchName(note, r.name));
  return hit ? +hit.id : null;
}

// yo'nalishning shu oydagi holati: ajratilgan, sarflangan, qolgan (bazadagi birlikda: so'm yoki sent)
// deno-lint-ignore no-explicit-any
export async function allocState(sql: any, chat: number, id: number, from: Date, to: Date) {
  const a: any = (await sql`select id, name, emoji, amount::float8 amount, cur, cat from public.w_alloc where id = ${id} and chat = ${chat}`)[0];
  if (!a) return null;
  // toifa bog'langan bo'lsa — o'sha toifadagi belgilanmagan chiqimlar ham (shu toifa bog'langan birinchi yo'nalishga)
  const first: any = a.cat ? (await sql`select id from public.w_alloc where chat = ${chat} and cat = ${a.cat} and cur = ${a.cur} order by sort, id limit 1`)[0] : null;
  const viaCat = first && +first.id === +a.id;
  const r: any = (await sql`select coalesce(sum(amount), 0)::float8 s from public.w_tx where chat = ${chat} and kind = 'out' and cat <> 'qarz' and cur = ${a.cur}
    and ts >= ${from} and ts < ${to} and (alloc = ${id} ${viaCat ? sql`or (alloc is null and cat = ${a.cat})` : sql``})`)[0];
  return { name: a.name as string, emoji: (a.emoji || '📌') as string, amount: +a.amount, spent: +r.s, cur: a.cur as string };
}

// bot uchun qisqa satr: «📌 Uy ro'zg'ori: 1 200 000 / 3 000 000 · qoldi 1 800 000»
export function allocLine(s: { name: string; emoji: string; amount: number; spent: number; cur: string }, fmt: (n: number) => string) {
  const f = (n: number) => (s.cur === 'USD' ? usd(n) : fmt(n));
  const left = s.amount - s.spent;
  return s.emoji + ' <b>' + s.name.replace(/[&<>]/g, '') + '</b> (oylik reja): ' + f(s.spent) + ' / ' + f(s.amount) + (left >= 0 ? ' · qoldi ' + f(left) : ' · ⛔️ ' + f(-left) + ' oshdi');
}
