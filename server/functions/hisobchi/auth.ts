// Telegram orqali kirish (Hisobchi va Ishlab chiqarish ilovalari uchun umumiy): Telegram imzosi va brauzer/telefon kaliti
import { secret, setSecret } from './tg.ts';

const enc = new TextEncoder();
async function hmac(key: Uint8Array, data: string): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key as BufferSource, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data)));
}
export const hex = (b: Uint8Array) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
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
export async function makeToken(chat: number) {
  const exp = Math.floor(Date.now() / 1000) + 180 * 86400, body = chat + '.' + exp;
  return body + '.' + hex(await hmac(enc.encode(await hbKey()), 'hb:' + body));
}
export async function checkToken(t: string): Promise<number | null> {
  const m = /^(-?\d{1,20})\.(\d{10})\.([0-9a-f]{64})$/.exec(t || '');
  if (!m || +m[2] < Date.now() / 1000) return null;
  return same(hex(await hmac(enc.encode(await hbKey()), 'hb:' + m[1] + '.' + m[2])), m[3]) ? +m[1] : null;
}
