// Supabase Auth bilan ishlash (faqat server): parolsiz hisob ochish va Telegram tasdig'i bilan sessiya berish
import { SUPA_URL } from './tg.ts';

const keyOf = (name: string, legacy: string) => {
  try { const k = JSON.parse(Deno.env.get(name) || '{}').default; if (k) return k as string; } catch (_) { /* eski kalit */ }
  return Deno.env.get(legacy) || '';
};
const SECRET = keyOf('SUPABASE_SECRET_KEYS', 'SUPABASE_SERVICE_ROLE_KEY');
const PUBLIC = keyOf('SUPABASE_PUBLISHABLE_KEYS', 'SUPABASE_ANON_KEY') || Deno.env.get('PUB_KEY') || '';
export const DOMAIN = 'users.savdo-daftarim.app';
const adm = { apikey: SECRET, Authorization: 'Bearer ' + SECRET, 'Content-Type': 'application/json' };

async function newUser(email: string, meta: Record<string, unknown>): Promise<string | null> {
  const pw = crypto.randomUUID() + crypto.randomUUID();
  const r = await fetch(SUPA_URL + '/auth/v1/admin/users', { method: 'POST', headers: adm, body: JSON.stringify({ email, password: pw, email_confirm: true, user_metadata: meta }) });
  const j: any = await r.json().catch(() => ({}));
  return r.ok && j.id ? j.id : null;
}
// tasodifiy (hech kimga ko'rsatilmaydigan) parol bilan hisob — kirish faqat Telegram orqali
export const createUser = (phone: string) => newUser(phone + '@' + DOMAIN, { phone, via: 'telegram' });
// xodim (kassir/menejer) uchun alohida hisob — do'kon egasining hisobidan butunlay ajralgan
export const createStaffUser = (staffId: string) => newUser('st' + staffId.replace(/-/g, '') + '@' + DOMAIN, { staff: staffId, via: 'telegram' });
export async function deleteUser(id: string) {
  await fetch(SUPA_URL + '/auth/v1/admin/users/' + id, { method: 'DELETE', headers: adm }).catch(() => null);
}
// bir martalik kirish havolasi (xat yuborilmaydi) -> darhol sessiyaga almashtiriladi
export async function sessionFor(email: string) {
  const g = await fetch(SUPA_URL + '/auth/v1/admin/generate_link', { method: 'POST', headers: adm, body: JSON.stringify({ type: 'magiclink', email }) });
  const gj: any = await g.json().catch(() => ({}));
  const th = gj.hashed_token || (gj.properties && gj.properties.hashed_token);
  if (!g.ok || !th) throw { code: 'LINK', detail: gj.msg || gj.error_description || g.status };
  const v = await fetch(SUPA_URL + '/auth/v1/verify', { method: 'POST', headers: { apikey: PUBLIC, 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'magiclink', token_hash: th }) });
  const s: any = await v.json().catch(() => ({}));
  if (!v.ok || !s.access_token) throw { code: 'VERIFY', detail: s.msg || s.error_description || v.status };
  return { access_token: s.access_token, refresh_token: s.refresh_token, expires_in: s.expires_in, expires_at: s.expires_at, user: { id: s.user && s.user.id } };
}
