// Sotuvchi (admin) uchun: bot foydalanuvchilari statistikasi va «kim kirdi / kim chiqdi» xabarlari
import { call, send, esc, local } from './tg.ts';

const who = (name?: string | null, username?: string | null) => (name ? esc(name) : 'Ismi nomaʼlum') + (username ? ' (@' + esc(username) + ')' : '');
const dt = (ms: number) => { const d = local(ms); const p = (n: number) => String(n).padStart(2, '0'); return p(d.getUTCDate()) + '.' + p(d.getUTCMonth() + 1) + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes()); };
const shopsTxt = (s: unknown) => { const a = Array.isArray(s) ? s : []; return a.length ? a.map((x) => esc(x)).join(', ') : 'roʻyxatdan oʻtmagan'; };

export async function notifyAdmins(token: string, text: string, except?: number) {
  const admins = (await call<number[]>('tg_admin_chats')) || [];
  for (const a of admins) if (a !== except) await send(token, a, text);
}

// har bir Telegram hodisasida chaqiriladi: oxirgi faollik, yangi foydalanuvchi, botni to'xtatish/qaytish.
// true — hodisa shu yerda to'liq ishlandi (my_chat_member)
export async function track(token: string, u: any): Promise<boolean> {
  const mcm = u.my_chat_member;
  if (mcm) {
    if (!mcm.chat || mcm.chat.type !== 'private') return true;
    const st = mcm.new_chat_member && mcm.new_chat_member.status;
    if (st !== 'kicked' && st !== 'member') return true;
    const f = mcm.from || {}, name = [f.first_name, f.last_name].filter(Boolean).join(' ');
    const r: any = await call('tg_block', mcm.chat.id, st === 'kicked', name, f.username || '');
    if (r && r.changed) {
      await notifyAdmins(token, (st === 'kicked' ? '🚪 <b>Botni toʻxtatdi</b> (chiqdi): ' : '🔁 <b>Botga qaytdi</b>: ') + who(r.name, r.username) + '\nDoʻkon: ' + shopsTxt(r.shops), mcm.chat.id);
    }
    return true;
  }
  const m = u.message || (u.callback_query && u.callback_query.message ? { chat: u.callback_query.message.chat, from: u.callback_query.from } : null);
  if (!m || !m.chat || m.chat.type !== 'private') return false;
  const f = m.from || {}, name = [f.first_name, f.last_name].filter(Boolean).join(' ');
  const r: any = await call('tg_seen', m.chat.id, name, f.username || '');
  if (r && r.new) await notifyAdmins(token, '👋 <b>Botga yangi odam kirdi</b>: ' + who(name, f.username), m.chat.id);
  else if (r && r.back) await notifyAdmins(token, '🔁 <b>Botga qaytdi</b>: ' + who(name, f.username), m.chat.id);
  return false;
}

export async function statsText() {
  const s: any = await call('admin_tg_stats');
  const L = [
    '📈 <b>Bot statistikasi</b>', '',
    '👥 Foydalanuvchilar: <b>' + s.users + '</b>' + (+s.blocked ? ' (botni toʻxtatganlar: ' + s.blocked + ')' : ''),
    '🟢 Faol: bugun <b>' + s.active1 + '</b> · 7 kunda <b>' + s.active7 + '</b> · 30 kunda ' + s.active30,
    '🆕 Yangi: bugun ' + s.new1 + ' · 7 kunda ' + s.new7,
    '⏳ Roʻyxatdan oʻtmay qolgan: ' + s.unfinished,
    '',
    '🏪 Doʻkonlar: <b>' + s.shops + '</b> (botga ulangan: ' + s.shopsTg + ')',
    '📱 Ilovada ishlagan: bugun ' + s.shopsApp1 + ' · 7 kunda ' + s.shopsApp7,
    '💳 Toʻlagan: ' + s.shopsPaid + ' · 🎁 Sinovda: ' + s.shopsTrial + ' · ⛔️ Muddati tugagan: ' + s.shopsExpired,
    '👤 Ulangan xodimlar: ' + s.staff,
  ];
  if ((s.recentNew || []).length) {
    L.push('', '🆕 <b>Oxirgi kirganlar</b>');
    s.recentNew.forEach((x: any, i: number) => L.push((i + 1) + '. ' + who(x.name, x.username) + ' — ' + (x.shop ? esc(x.shop) : 'roʻyxatdan oʻtmagan') + (x.blocked ? ' · 🚪 chiqqan' : '') + ' · ' + dt(+x.ts)));
  }
  if ((s.recentLeft || []).length) {
    L.push('', '🚪 <b>Oxirgi chiqqanlar</b> (botni toʻxtatgan)');
    s.recentLeft.forEach((x: any, i: number) => L.push((i + 1) + '. ' + who(x.name, x.username) + (x.shop ? ' — ' + esc(x.shop) : '') + (x.ts ? ' · ' + dt(+x.ts) : '')));
  }
  return L.join('\n').slice(0, 4000);
}
