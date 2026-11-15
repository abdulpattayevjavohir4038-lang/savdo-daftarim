// Har 10 daqiqada (pg_cron): kunlik hisobot (sozlangan vaqtda), dushanba — o'tgan hafta, ertalab — kam qolgan tovarlar,
// kechqurun — sotuvchiga to'liq kunlik hisobot (bot, Minimarket, Hisobchi: kim kirdi / kim chiqdi, kim ishlatdi),
// 21:00 dan keyin — «👛 Hamyon nazorat» foydalanuvchilariga shaxsiy kunlik xarajat hisoboti.
// Umumiy modullar tg-webhook bilan bitta (../tg-webhook/).
import { secret, call, send, local, todayK, addK, dayStart, weekStart, kLabel, periodReport, dayReport, stockReport, active, esc, type Link } from '../tg-webhook/tg.ts';
import { walletDigest } from '../tg-webhook/wcore.ts';

const hm = (s: unknown, d: string): number => { const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '')); return m ? +m[1] * 60 + +m[2] : hm(d, '21:00'); };
const who = (x: any) => (x && x.name ? esc(x.name) : 'Ismi nomaʼlum') + (x && x.username ? ' (@' + esc(x.username) + ')' : '');

async function adminDigest(token: string, t: string) {
  if (!(await call<boolean>('admin_digest_mark', t))) return 0;
  const admins = (await call<number[]>('tg_admin_chats')) || [];
  if (!admins.length) return 0;
  const d: any = await call('admin_tg_digest', new Date(Date.now() - 864e5).toISOString());
  const s: any = await call('admin_tg_stats');
  const p: any = await call('admin_pr_digest', new Date(Date.now() - 864e5).toISOString()).catch(() => ({ new: [] }));
  const list = (a: any[], f: (x: any) => string) => a.slice(0, 20).map((x) => '• ' + f(x)).join('\n') + (a.length > 20 ? '\n… yana ' + (a.length - 20) + ' ta' : '');
  const L = ['📈 <b>Kunlik hisobot</b> · ' + t.split('-').reverse().join('.'), '<i>oxirgi 24 soat</i>', ''];
  L.push('🤖 <b>Telegram bot</b> — jami ' + d.users + ' kishi');
  L.push('👋 Yangi kirdi: <b>' + d.joined.length + '</b>' + (d.joined.length ? '\n' + list(d.joined, who) : ''));
  L.push('🚪 Chiqdi (botni toʻxtatdi): <b>' + d.left.length + '</b>' + (d.left.length ? '\n' + list(d.left, who) : ''));
  L.push('🟢 Faol: <b>' + d.active + '</b> kishi');
  L.push('', '🏪 <b>Minimarket POS</b> — jami ' + s.shops + ' doʻkon');
  L.push('🆕 Yangi doʻkonlar: <b>' + d.shopsNew.length + '</b>' + (d.shopsNew.length ? '\n' + list(d.shopsNew, (x) => esc(x)) : ''));
  L.push('📱 Ilovada ishladi: <b>' + d.shopsApp + '</b>' + (d.shopsAppList.length ? '\n' + list(d.shopsAppList, (x) => esc(x)) : ''));
  L.push('🧾 Cheklar: <b>' + d.sales + '</b>');
  L.push('💳 Toʻlagan: ' + s.shopsPaid + ' · 🎁 Sinovda: ' + s.shopsTrial + ' · ⛔️ Tugagan: ' + s.shopsExpired);
  if (d.staffNew.length) L.push('👤 Yangi xodimlar: <b>' + d.staffNew.length + '</b>\n' + list(d.staffNew, (x) => esc(x)));
  L.push('', '🧮 <b>Hisobchi</b> — jami ' + d.hbApp + ' kishi ochgan');
  L.push('🆕 Birinchi marta ochdi: <b>' + d.hbNew.length + '</b>' + (d.hbNew.length ? '\n' + list(d.hbNew, who) : ''));
  L.push('📱 Ochganlar: <b>' + d.hbOpen + '</b> · ✍️ Yozuv qilganlar: <b>' + d.hbWriters + '</b> (' + d.hbTx + ' ta yozuv, botdagi «Hamyon» bilan)');
  L.push('', '🏭 <b>Ishlab chiqarish</b> — jami ' + (p.app || 0) + ' kishi ochgan');
  L.push('🆕 Birinchi marta ochdi: <b>' + p.new.length + '</b>' + (p.new.length ? '\n' + list(p.new, who) : ''));
  L.push('📱 Ochganlar: <b>' + (p.open || 0) + '</b> · ✍️ Yozuv qilganlar: <b>' + (p.writers || 0) + '</b> (' + (p.tx || 0) + ' ta yozuv)');
  L.push('', 'Istalgan payt — «📈 Statistika» tugmasi yoki /statistika.');
  for (const a of admins) await send(token, a, L.join('\n').slice(0, 4000));
  return admins.length;
}

export async function handle(req: Request): Promise<Response> {
  const sec = await secret('cron_secret');
  if (!sec || req.headers.get('x-cron-secret') !== sec) return new Response('forbidden', { status: 403 });
  const token = await secret('tg_token');
  if (!token) return new Response('no bot');
  const shops: any[] = await call('tg_cron_list');
  const now = local(), mins = now.getUTCHours() * 60 + now.getUTCMinutes(), t = todayK(), wd = now.getUTCDay();
  let sent = 0, contact = '';
  // sotuvchiga kechki hisobot: 21:00 dan keyin, kuniga bir marta
  if (mins >= 21 * 60) { try { sent += await adminDigest(token, t); } catch (e) { console.error('admin digest', e); } }
  // hamyon: 21:00 dan keyin, bugun yozuv qilganlarga, kuniga bir marta (do'kon obunasiga bog'liq emas)
  if (mins >= 21 * 60) { try { sent += await walletDigest(token); } catch (e) { console.error('wallet digest', e); } }
  try { const sel: any = ((await call('public_cfg')) || {}).seller || {}; contact = [sel.phone, sel.tg ? '@' + String(sel.tg).replace(/^@/, '') : ''].filter(Boolean).join(', '); } catch (_) { /* ignore */ }
  for (const s of shops) {
    const st = s.settings || {}, name = st.shopName || s.name;
    const targets: any[] = await call('tg_targets', s.shop);
    const bosses = targets.filter((x) => x.role !== 'cashier');
    // obuna muddati eslatmasi: 7, 3, 1 kun qolganda, tugagan kuni va ertasi (kunduzi, kuniga bir marta)
    const pu = +s.paidUntil || 0, endK = local(pu).toISOString().slice(0, 10), left = Math.round((dayStart(endK) - dayStart(t)) / 864e5);
    if (!s.blocked && pu && [7, 3, 1, 0, -1].includes(left) && mins >= 9 * 60 && mins < 20 * 60 && bosses.length && await call('tg_mark', s.shop, 'sub', t)) {
      const d = endK.split('-').reverse().join('.');
      const txt = (left > 0 ? '⏳ <b>' + esc(name) + '</b>: obuna muddati <b>' + left + ' kundan keyin</b> (' + d + ') tugaydi.'
        : left === 0 ? '⚠️ <b>' + esc(name) + '</b>: obuna muddati <b>bugun</b> tugaydi.'
        : '⛔️ <b>' + esc(name) + '</b>: obuna muddati tugadi (' + d + '). Uzaytirilmaguncha ilovada sotuv toʻxtaydi, maʼlumotlar saqlanadi.') +
        '\n\nPastdagi tugma orqali toʻlang' + (contact ? ' yoki sotuvchiga murojaat qiling: ' + esc(contact) : '') + '.';
      for (const x of bosses) { await send(token, x.chat, txt, { reply_markup: { inline_keyboard: [[{ text: '💳 Obunani toʻlash', callback_data: 'pay' }]] } }); sent++; }
    }
    if (!active(s)) continue;
    const link = (role: string): Link => ({ shop: s.shop, shopName: name, role });
    // kunlik hisobot: sozlangan vaqtdan keyingi 3 soat ichida, kuniga bir marta
    const at = hm(st.tgTime, '21:00');
    if (st.tgDaily !== false && mins >= at && mins < at + 180 && bosses.length && await call('tg_mark', s.shop, 'daily', t)) {
      for (const x of bosses) { const r = await dayReport(link(x.role), t); await send(token, x.chat, r.text, { reply_markup: r.markup }); sent++; }
    }
    // dushanba: o'tgan hafta
    if (st.tgWeekly !== false && wd === 1 && mins >= 9 * 60 && mins < 12 * 60 && bosses.length && await call('tg_mark', s.shop, 'weekly', t)) {
      const ws = addK(weekStart(t), -7);
      for (const x of bosses) { await send(token, x.chat, await periodReport(link(x.role), ws, weekStart(t), 'Oʻtgan hafta: ' + kLabel(ws) + ' — ' + kLabel(addK(ws, 6)))); sent++; }
    }
    // ertalab: kam qolgan tovarlar
    if (st.tgMorning && mins >= 8 * 60 && mins < 11 * 60 && bosses.length && await call('tg_mark', s.shop, 'morning', t)) {
      const txt = await stockReport(link('owner'));
      if (!txt.includes('Kam qolgan tovar yoʻq')) for (const x of bosses) { await send(token, x.chat, '☀️ Xayrli tong!\n\n' + txt); sent++; }
    }
  }
  return new Response(JSON.stringify({ ok: true, shops: shops.length, sent }), { headers: { 'Content-Type': 'application/json' } });
}
