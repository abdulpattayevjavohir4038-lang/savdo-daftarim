// Valyuta: so'm (UZS) va dollar (USD). Hisobchi va botdagi «👛 Hamyon nazorat» uchun umumiy.
// Bazada (w_tx.amount, w_debt.amount/paid): UZS — so'mda, USD — sentda (1 $ = 100 sent).
// Hisob-kitoblar (balans, byudjet, so'mdagi hisobotlar) faqat UZS; dollar alohida ko'rsatiladi.

export type Cur = 'UZS' | 'USD';
export const curOf = (v: unknown): Cur => (v === 'USD' ? 'USD' : 'UZS');

// matnda dollar belgisi bormi: «50$», «$12», «100 dollar», «20 usd», «долл»
const WORD = /(^|[^a-zа-яёʻʼ'])(dollar[a-z]*|dollor[a-z]*|usd|у\.е|долл[а-яё]*)(?=$|[^a-zа-яё])/i;
export const isUsdText = (t: string) => /\$/.test(t) || WORD.test(String(t || ''));

// «kofe 5$», «$120 oylik», «+1 200,50 dollar», «2,5 ming $» -> sent, belgi, izoh
const NUM = /([+\-−]?)[ \t]*\$?[ \t]*(\d{1,3}(?:[  ]\d{3})+(?:[.,]\d{1,2})?(?!\d)|\d+(?:[.,]\d{1,2})?)(?:\s*(ming|минг|тыс|k)(?![a-zа-яё]))?/gi;
export function parseUsd(text: string): { amount: number; sign: string; note: string } | null {
  let best: { v: number; sign: string; i: number; len: number } | null = null;
  for (const m of String(text || '').matchAll(NUM)) {
    let v = +m[2].replace(/[  ]/g, '').replace(',', '.');
    if (m[3]) v *= 1000;
    const cents = Math.round(v * 100);
    if (!isFinite(cents) || cents <= 0 || cents > 1e12) continue;
    if (!best || cents > best.v) best = { v: cents, sign: m[1] === '+' ? '+' : m[1] ? '-' : '', i: m.index || 0, len: m[0].length };
  }
  if (!best) return null;
  const t = String(text);
  const note = (t.slice(0, best.i) + ' ' + t.slice(best.i + best.len))
    .replace(/\$/g, ' ').replace(new RegExp(WORD.source, 'gi'), '$1 ')
    .replace(/\s+/g, ' ').replace(/^[\s,.;:—-]+|[\s,.;:—-]+$/g, '').slice(0, 80);
  return { amount: best.v, sign: best.sign, note };
}

// dollar: sent -> «$1 250» yoki «$12,50»
export function usd(cents: number) {
  const a = Math.abs(Math.round(cents)), d = Math.floor(a / 100), c = a % 100;
  return (cents < 0 ? '−' : '') + '$' + String(d).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (c ? ',' + String(c).padStart(2, '0') : '');
}

// Markaziy bank kursi (cbu.uz): bazada saqlanadi, 6 soatda bir yangilanadi. null — umuman olinmagan
// deno-lint-ignore no-explicit-any
export async function usdRate(sql: any): Promise<{ rate: number; day: string | null } | null> {
  const r: any = (await sql`select rate::float8 rate, to_char(day, 'YYYY-MM-DD') d, updated_at > now() - interval '6 hours' fresh from public.fx_rate where cur = 'USD'`)[0];
  if (r && r.fresh) return { rate: +r.rate, day: r.d };
  try {
    const ctl = new AbortController(), tm = setTimeout(() => ctl.abort(), 2500);
    const j: any = await fetch('https://cbu.uz/uz/arkhiv-kursov-valyut/json/USD/', { signal: ctl.signal }).then((x) => x.json()).finally(() => clearTimeout(tm));
    const x = Array.isArray(j) ? j.find((y: any) => y && y.Ccy === 'USD') : null;
    const rate = x ? +x.Rate / (+x.Nominal || 1) : 0, dm = x && /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(String(x.Date || ''));
    if (rate > 1000 && rate < 1e6) {
      const day = dm ? dm[3] + '-' + dm[2] + '-' + dm[1] : null;
      await sql`insert into public.fx_rate (cur, rate, day, updated_at) values ('USD', ${rate}, ${day}, now())
        on conflict (cur) do update set rate = excluded.rate, day = excluded.day, updated_at = now()`;
      return { rate, day };
    }
  } catch (e) { console.error('usdRate', e); }
  return r ? { rate: +r.rate, day: r.d } : null;
}
