// «Oylik reja» (konvert usuli): har oy yo'nalishga pul ajratiladi — «Uy ro'zg'ori 3 mln», «Ayolimga 1 mln», «Ijara $300».
// w_alloc: yo'nalishlar (amount — har oylik reja summasi); w_fund: kassadan yo'nalishga o'tkazilgan pul (+) yoki qaytarilgan (−);
// w_tx.alloc — chiqim qaysi yo'nalish pulidan. Yo'nalishdagi pul = ajratilgan − sarflangan (oydan oyga o'tadi).
// Toifa bog'langan bo'lsa (cat), shu toifadagi chiqim yozilganda yo'nalish o'zi qo'yiladi. Faqat bir xil valyutada.
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

// yo'nalish holati: shu oy sarflangan va hozir yo'nalishda qolgan pul (bazadagi birlikda: so'm yoki sent)
// deno-lint-ignore no-explicit-any
export async function allocState(sql: any, chat: number, id: number, from: Date, to: Date) {
  const a: any = (await sql`select id, name, emoji, amount::float8 amount, cur from public.w_alloc where id = ${id} and chat = ${chat}`)[0];
  if (!a) return null;
  const [m, all, f]: any[] = await Promise.all([
    sql`select coalesce(sum(amount), 0)::float8 s from public.w_tx where alloc = ${id} and chat = ${chat} and kind = 'out' and ts >= ${from} and ts < ${to}`,
    sql`select coalesce(sum(amount), 0)::float8 s from public.w_tx where alloc = ${id} and chat = ${chat} and kind = 'out'`,
    sql`select coalesce(sum(amount), 0)::float8 s from public.w_fund where alloc = ${id} and chat = ${chat}`,
  ]);
  return { name: a.name as string, emoji: (a.emoji || '📌') as string, amount: +a.amount, spent: +m[0].s, left: +f[0].s - +all[0].s, cur: a.cur as string };
}

// bot uchun qisqa satr: «🏠 Uy ro'zg'ori: shu oy 1 200 000 sarflandi · qoldi 1 800 000»
export function allocLine(s: { name: string; emoji: string; spent: number; left: number; cur: string }, fmt: (n: number) => string) {
  const f = (n: number) => (s.cur === 'USD' ? usd(n) : fmt(n));
  return s.emoji + ' <b>' + s.name.replace(/[&<>]/g, '') + '</b> (oylik reja): shu oy ' + f(s.spent) + ' sarflandi · ' + (s.left >= 0 ? 'qoldi <b>' + f(s.left) + '</b>' : '⛔️ yetmadi <b>' + f(-s.left) + '</b> — ilovada qoʻshing');
}
