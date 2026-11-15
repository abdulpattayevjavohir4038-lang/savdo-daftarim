// Umumiy modul (Hisobchi uchun qisqa nusxa): baza, javob, vaqt (Toshkent)
import postgres from 'npm:postgres@3.4.5';

const DB_URL = Deno.env.get('DB_URL') || Deno.env.get('SUPABASE_DB_URL') || '';
const m = /^socket:(.+):(\d+)\/(\w+)$/.exec(DB_URL); // mahalliy sinov: socket:/tmp:54329/sd
export const sql = m
  ? postgres({ host: m[1], port: +m[2], user: 'postgres', database: m[3], max: 3 })
  : postgres(DB_URL, { max: 3, prepare: false, idle_timeout: 20 });
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
/* ---------- formatlash ---------- */
export const fmt = (n: unknown) => { const x = Math.round(+(n as number) || 0); const s = Math.abs(x).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); return (x < 0 ? '−' : '') + s; };

/* ---------- vaqt: O'zbekiston (UTC+5, yozgi vaqt yo'q) ---------- */
export const TZ = 5 * 3600e3;
export const local = (ts = Date.now()) => new Date(ts + TZ); // getUTC* = mahalliy vaqt
export const todayK = () => local().toISOString().slice(0, 10);
export const dayStart = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) - TZ;
export const addK = (k: string, n: number) => new Date(Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) + n * 864e5).toISOString().slice(0, 10);
