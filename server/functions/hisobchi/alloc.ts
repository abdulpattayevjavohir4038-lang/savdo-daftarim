// «Oylik reja»: har oy yo'nalishga beriladigan pul — «Uy ro'zg'ori 3 mln», «Ayolimga 1 mln», «Ijara $300».
// Pul berilganda asosiy kassadan oddiy chiqim bo'lib chiqadi (w_tx.alloc = yo'nalish, cat = 'reja'); keyin u pul qanday
// ishlatilishini kuzatmaymiz. Oy oxirida: har yo'nalishga qancha berildi va rejadan oshdimi.
// Toifa bog'langan bo'lsa (cat), shu toifadagi chiqim ham o'sha yo'nalishga yoziladi. Faqat bir xil valyutada.
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

// chiqim uchun yo'nalishni topish (shu valyutadagi): avval izohdagi nom, keyin bog'langan toifa. null — topilmadi
// deno-lint-ignore no-explicit-any
export async function matchAlloc(sql: any, chat: number, note: string, cur: string, cat = ''): Promise<number | null> {
  const rows: any[] = await sql`select id, name, cat from public.w_alloc where chat = ${chat} and cur = ${cur} order by sort, id`;
  const hit = (note && rows.find((r) => matchName(note, r.name))) || (cat && rows.find((r) => r.cat && r.cat === cat));
  return hit ? +hit.id : null;
}

// yo'nalishning oy holati: shu oy berilgan (kassadan chiqqan) pul va reja (bazadagi birlikda: so'm yoki sent)
// deno-lint-ignore no-explicit-any
export async function allocState(sql: any, chat: number, id: number, from: Date, to: Date) {
  const a: any = (await sql`select id, name, emoji, amount::float8 amount, cur from public.w_alloc where id = ${id} and chat = ${chat}`)[0];
  if (!a) return null;
  const m: any = (await sql`select coalesce(sum(amount), 0)::float8 s from public.w_tx where alloc = ${id} and chat = ${chat} and kind = 'out' and ts >= ${from} and ts < ${to}`)[0];
  return { name: a.name as string, emoji: (a.emoji || '📌') as string, amount: +a.amount, spent: +m.s, cur: a.cur as string };
}
// barcha yo'nalishlar oy bo'yicha (oylik hisobot uchun)
// deno-lint-ignore no-explicit-any
export async function allocMonth(sql: any, chat: number, from: Date, to: Date) {
  return (await sql`select a.id, a.name, coalesce(a.emoji, '📌') emoji, a.amount::float8 amount, a.cur,
      coalesce((select sum(t.amount) from public.w_tx t where t.alloc = a.id and t.chat = ${chat} and t.kind = 'out' and t.ts >= ${from} and t.ts < ${to}), 0)::float8 spent
    from public.w_alloc a where a.chat = ${chat} order by a.sort, a.id`) as { name: string; emoji: string; amount: number; spent: number; cur: string }[];
}

// qisqa satr: «🏠 Uy ro'zg'ori: shu oy 3 400 000 / reja 3 000 000 · rejadan 400 000 oshdi»
export function allocLine(s: { name: string; emoji: string; amount: number; spent: number; cur: string }, fmt: (n: number) => string, pre = '') {
  const f = (n: number) => (s.cur === 'USD' ? usd(n) : fmt(n)), d = s.spent - s.amount;
  return s.emoji + ' <b>' + s.name.replace(/[&<>]/g, '') + '</b>' + pre + ': ' + f(s.spent) + ' / reja ' + f(s.amount) + (d > 0 ? ' · ⚠️ rejadan <b>' + f(d) + '</b> oshdi' : d < 0 ? ' · qoldi ' + f(-d) : ' ✅');
}
