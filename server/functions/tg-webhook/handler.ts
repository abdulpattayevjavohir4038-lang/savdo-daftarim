// Telegram bot: ro'yxatdan o'tish (parolsiz), boshqa qurilmada kirishni tasdiqlash, hisobotlar, obuna to'lovi (chek), AI savol-javob, xodimlar (kassir taklif qilish),
// «👛 Hamyon nazorat» — shaxsiy xarajatlar (do'kon hisobidan alohida, hammaga ochiq)
import { secret, call, send, tg, todayK, addK, weekStart, monthStart, monthName, kLabel, periodReport, dayReport, stockReport, debtReport, topReport, kbOf, ROLE, esc, fmt, local, active, WALLET_BTN, type Link } from './tg.ts';
import { askShop, aiQuota } from './ai.ts';
import { createUser, deleteUser } from './auth.ts';
import { staffMenu, staffCallback, staffText, staffJoin } from './staff.ts';
import { track, statsText, notifyAdmins } from './stats.ts';
import { WELCOME, guideBtn, sendGuide, guideCallback, sendVideoLesson } from './guide.ts';
import { walletEnter, walletExit, walletText, walletCallback, walletPhoto, isWalletEntry, isWalletExit } from './wallet.ts';
import { wUser } from './wcore.ts';
import { sql } from './tg.ts';

const norm = (t: string) => t.toLowerCase().replace(/[^a-zʻ'\s]/g, ' ').replace(/\s+/g, ' ').trim();
const dmy = (ms: number) => local(ms).toISOString().slice(0, 10).split('-').reverse().join('.');
const PLANS: [string, string, number][] = [['m', '1 oy', 30], ['q', '3 oy', 90], ['h', '6 oy', 180], ['y', '1 yil', 365]];
const CONTACT_KB = { keyboard: [[{ text: '📱 Telefon raqamni yuborish', request_contact: true }], [{ text: WALLET_BTN }]], resize_keyboard: true, one_time_keyboard: true };
const MENU = ['bugun', 'kecha', 'hafta', 'oy', 'ombor', 'qarzlar', 'top tovarlar', 'obuna', 'kassir taklif qilish', 'statistika', 'yordam', 'qoʻllanma', "qo'llanma", 'qollanma', 'hamyon nazorat'];
const GUIDE_WORDS = ['yordam', 'help', 'qoʻllanma', "qo'llanma", 'qollanma'];
// do'kon menyusi tugmalari (hamyon rejimida bosilsa — do'kon menyusiga qaytiladi)
const SHOP_BTNS = MENU.filter((x) => x !== 'hamyon nazorat' && !GUIDE_WORDS.includes(x));
// ilovani ochish + qo'llanma tugmalari
// ikki ilova: Minimarket POS (do'kon) va Hisobchi (shaxsiy kirim-chiqim, qarz)
const appBtn = async (text = '🏪 Minimarket POS') => { const u = await secret('app_url'); return u ? { inline_keyboard: [[{ text, web_app: { url: u } }, { text: '🧮 Hisobchi', web_app: { url: u + 'hisobchi/' } }], [guideBtn.inline_keyboard[0][0], { text: '🎬 Video darslik', callback_data: 'v:menu' }]] } : undefined; };
const getState = async (chat: number) => (await call<any>('tg_state_get', chat)) || {};
const setState = (chat: number, st: unknown) => call('tg_state_set', chat, JSON.stringify(st || {}));
const tgName = (m: any) => [m.from && m.from.first_name, m.from && m.from.last_name].filter(Boolean).join(' ') || (m.chat && m.chat.title) || '';
const normPhone = (p: unknown) => { let d = String(p ?? '').replace(/\D/g, ''); if (d.length === 9) d = '998' + d; return /^998\d{9}$/.test(d) ? d : ''; };
const kbFor = async (chat: number) => { const l = await call<Link | null>('tg_chat_shop', chat); return kbOf(l ? l.role : '', !!(l && l.admin)); };

export async function handle(req: Request): Promise<Response> {
  if (req.method !== 'POST') return new Response('ok');
  const sec = await secret('tg_hook');
  if (!sec || req.headers.get('x-telegram-bot-api-secret-token') !== sec) return new Response('forbidden', { status: 403 });
  const token = await secret('tg_token');
  if (!token) return new Response('ok');
  let u: any = null;
  try { u = await req.json(); } catch (_) { return new Response('ok'); }
  try { await route(token, u); } catch (e) { console.error('tg-webhook', e); }
  return new Response('ok');
}

// ---------- boshqa qurilmada kirish ----------
async function askLogin(token: string, chat: number, code: string) {
  const link = await call<Link | null>('tg_chat_shop', chat);
  await send(token, chat, '🔐 <b>Ilovaga kirish</b>\n\nYangi qurilmada <b>' + esc(link ? link.shopName : '') + '</b> hisobiga kirilmoqda. Bu siz boʻlsangiz — «Ha, kirish»ni bosing.\n\n<i>Havolani oʻzingiz ochmagan boʻlsangiz, bosmang.</i>',
    { reply_markup: { inline_keyboard: [[{ text: '✅ Ha, kirish', callback_data: 'la:' + code }, { text: '❌ Yoʻq', callback_data: 'ln' }]] } });
}
// ---------- ro'yxatdan o'tish ----------
async function askPhone(token: string, chat: number, st: any, welcome = false) {
  await setState(chat, Object.assign({}, st, { step: 'phone' }));
  // /start bosilganda — avval botdan foydalanish haqida yozma ma'lumot, keyin raqam so'raladi
  if (welcome) { await send(token, chat, WELCOME, { reply_markup: guideBtn }); await send(token, chat, '👇 Boshlash uchun telefon raqamingizni yuboring:', { reply_markup: CONTACT_KB }); return; }
  await send(token, chat, '👋 <b>Minimarket POS</b> — doʻkon kassasi, ombor, qarz daftari va hisobotlar.\n\nBoshlash uchun pastdagi tugma bilan <b>telefon raqamingizni</b> yuboring. Hisobingiz shu raqamga ochiladi (parol kerak emas), <b>30 kun bepul</b>.\n\n👛 Shaxsiy xarajatlaringizni hisoblash uchun — «Hamyon nazorat» (roʻyxatdan oʻtmasdan ham ishlaydi).', { reply_markup: CONTACT_KB });
}
async function afterLinked(token: string, chat: number, st: any, text: string, role = 'owner') {
  await setState(chat, {});
  await send(token, chat, text, { reply_markup: role === 'owner' ? await kbFor(chat) : kbOf(role) });
  // ilovaga Telegram orqali parolsiz kirish: ega — o'z hisobi; eski usulda (kod bilan) ulangan kassir/menejerda alohida hisob yo'q
  const btn = role === 'owner' ? await appBtn() : undefined;
  if (btn) await send(token, chat, 'Ilovani shu yerdan oching — parol soʻralmaydi:', { reply_markup: btn });
  if (st && st.login) await askLogin(token, chat, st.login);
  if (st && st.pay) await payMenu(token, chat);
}
// ---------- obuna to'lovi ----------
async function payMenu(token: string, chat: number) {
  const link = await call<Link | null>('tg_chat_shop', chat);
  if (!link) { await askPhone(token, chat, { pay: 1 }); return; }
  const cfg: any = (await call('public_cfg')) || {}, pr = cfg.prices || {}, sel = cfg.seller || {};
  const left = Math.ceil(((link.paidUntil || 0) - Date.now()) / 864e5);
  const rows = PLANS.filter((p) => +pr[p[0]] > 0).map((p) => [{ text: p[1] + ' — ' + fmt(pr[p[0]]) + " so'm", callback_data: 'pp:' + p[0] }]);
  const head = '💳 <b>' + esc(link.shopName) + ' — obuna</b>\n' + (left > 0 ? 'Muddat: ' + dmy(link.paidUntil || 0) + ' gacha (' + left + ' kun qoldi)' : '⛔️ Muddat tugagan (' + dmy(link.paidUntil || 0) + ')');
  if (!rows.length) { await send(token, chat, head + '\n\nNarxlar hali belgilanmagan. Sotuvchiga murojaat qiling' + (sel.phone ? ': ' + esc(sel.phone) : '') + '.'); return; }
  await send(token, chat, head + '\n\nTarifni tanlang:', { reply_markup: { inline_keyboard: rows } });
}
async function payPlan(token: string, chat: number, plan: string) {
  const link = await call<Link | null>('tg_chat_shop', chat);
  if (!link) { await askPhone(token, chat, { pay: 1 }); return; }
  const cfg: any = (await call('public_cfg')) || {}, pr = cfg.prices || {}, sel = cfg.seller || {};
  const p = PLANS.find((x) => x[0] === plan), amount = p ? +pr[p[0]] || 0 : 0;
  if (!p || !amount) { await payMenu(token, chat); return; }
  await setState(chat, { step: 'receipt', plan: p[0] });
  const card = String(sel.card || '').replace(/\D/g, '').replace(/(\d{4})(?=\d)/g, '$1 ');
  await send(token, chat, '💳 <b>' + p[1] + ' — ' + fmt(amount) + " so'm</b>\n\n" +
    (card ? '1. Shu kartaga oʻtkazing:\n<code>' + esc(card) + '</code>' + (sel.cardName ? '\n' + esc(sel.cardName) : '') + '\n' : '1. Sotuvchiga toʻlang' + (sel.phone ? ' (' + esc(sel.phone) + ')' : '') + '.\n') +
    '2. Toʻlov chekini (skrinshot) <b>rasm qilib shu yerga yuboring</b>.\n\nSotuvchi tasdiqlashi bilan obuna oʻzi yoqiladi.');
}
async function payReceipt(token: string, chat: number, st: any, fileId: string, from: string) {
  const link = await call<Link | null>('tg_chat_shop', chat);
  if (!link) { await askPhone(token, chat, {}); return; }
  const cfg: any = (await call('public_cfg')) || {}, pr = cfg.prices || {};
  const p = PLANS.find((x) => x[0] === st.plan), amount = p ? +pr[p[0]] || 0 : 0;
  const id = await call<string>('tg_pay_create', link.shop, chat, p ? p[0] : '?', p ? p[2] : 0, amount, fileId);
  await setState(chat, {});
  const admins = (await call<number[]>('tg_admin_chats')) || [];
  const msgs: any[] = [];
  const shopInfo: any = await call('shop_info_svc', link.shop);
  const caption = '💳 <b>Toʻlov qildim — chek</b>\nDoʻkon: <b>' + esc(link.shopName) + '</b>' + (shopInfo && shopInfo.phone ? ' (+' + esc(shopInfo.phone) + ')' : '') + '\nYubordi: ' + esc(from || '—') +
    '\nTarif: ' + (p ? p[1] + ' — <b>' + fmt(amount) + " so'm</b>" : '<i>tanlanmagan — pastda tanlang</i>') + '\nHozirgi muddat: ' + dmy(shopInfo && shopInfo.paidUntil || 0);
  const kb = { inline_keyboard: (p ? [[{ text: '✅ Tasdiqlash (+' + p[2] + ' kun)', callback_data: 'py:' + id }]]
    : PLANS.filter((x) => +pr[x[0]] > 0).map((x) => [{ text: '✅ ' + x[1] + ' — ' + fmt(pr[x[0]]) + ' (+' + x[2] + ' kun)', callback_data: 'pa:' + id + ':' + x[0] }])).concat([[{ text: '❌ Rad etish', callback_data: 'pn:' + id }]]) };
  for (const a of admins) {
    const doc = fileId.startsWith('doc:');
    const r: any = await tg(token, doc ? 'sendDocument' : 'sendPhoto', Object.assign({ chat_id: a, caption, parse_mode: 'HTML', reply_markup: kb }, doc ? { document: fileId.slice(4) } : { photo: fileId }));
    if (r && r.ok) msgs.push({ chat: a, id: r.result.message_id });
  }
  await call('tg_pay_msgs', id, JSON.stringify(msgs));
  await send(token, chat, msgs.length ? '✅ Chek qabul qilindi. Sotuvchi tasdiqlashi bilan obuna oʻzi yoqiladi — shu yerga xabar keladi.' : '✅ Chek saqlandi. Sotuvchi koʻrib chiqqach obuna yoqiladi.', { reply_markup: kbOf(link.role, link.admin) });
}
async function payDecide(token: string, cq: any, id: string, ok: boolean) {
  const chat = cq.message.chat.id;
  const admins = (await call<number[]>('tg_admin_chats')) || [];
  if (!admins.includes(chat)) { await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Faqat sotuvchi tasdiqlaydi', show_alert: true }); return; }
  const r: any = await call('tg_pay_decide', id, ok);
  if (!r.ok) { await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: r.status === 'ok' ? 'Allaqachon tasdiqlangan' : r.status === 'no' ? 'Allaqachon rad etilgan' : 'Topilmadi' }); return; }
  const note = ok ? '\n\n✅ <b>Tasdiqlandi</b>: +' + r.days + ' kun, ' + dmy(r.paidUntil) + ' gacha' : '\n\n❌ <b>Rad etildi</b>';
  for (const m of r.admin_msgs || []) await tg(token, 'editMessageCaption', { chat_id: m.chat, message_id: m.id, caption: esc(cq.message.caption || '') + note, parse_mode: 'HTML' });
  await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: ok ? 'Obuna yoqildi' : 'Rad etildi' });
  const sel: any = ((await call('public_cfg')) || {}).seller || {};
  await send(token, r.chat, ok ? '🎉 <b>Obuna faollashtirildi!</b>\n' + esc(r.shopName) + ' — <b>' + dmy(r.paidUntil) + '</b> gacha.\n\nIlovani qayta oching (yoki «Sozlamalar → Obuna → Holatni yangilash») — hammasi ishlaydi.'
    : '❌ Chek tasdiqlanmadi. Savol boʻlsa sotuvchiga murojaat qiling' + (sel.phone ? ': ' + esc(sel.phone) : '') + '.', { reply_markup: await kbFor(r.chat) });
}

async function route(token: string, u: any) {
  // kim kirdi / kim chiqdi — sotuvchiga xabar va statistika uchun (xato bo'lsa ham bot ishlayveradi)
  try { if (await track(token, u)) return; } catch (e) { console.error('track', e); }
  if (u.callback_query) {
    const cq = u.callback_query, chat = cq.message && cq.message.chat && cq.message.chat.id, data = String(cq.data || '');
    if (!chat) return;
    if (data.startsWith('g:')) { await guideCallback(token, cq, data.slice(2)); return; }
    if (data.startsWith('v:')) { await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: '🎬 Video yuborilmoqda…' }); await sendVideoLesson(token, chat, data.slice(2)); return; }
    // hamyon nazorat — do'kon hisobi va obunadan qat'i nazar
    if (/^w[a-zA-Z]*:/.test(data)) { await walletCallback(token, cq, data); return; }
    if (data.startsWith('py:') || data.startsWith('pn:')) { await payDecide(token, cq, data.slice(3), data.startsWith('py:')); return; }
    if (data.startsWith('pa:')) {
      const [, id, plan] = data.split(':');
      const admins = (await call<number[]>('tg_admin_chats')) || [];
      const pr = (((await call('public_cfg')) || {}) as any).prices || {}, p = PLANS.find((x) => x[0] === plan);
      if (admins.includes(chat) && p && +pr[p[0]] > 0) await call('tg_pay_setplan', id, p[0], p[2], +pr[p[0]]);
      await payDecide(token, cq, id, true); return;
    }
    if (data.startsWith('la:')) {
      const r: any = await call('tg_login_approve', data.slice(3), chat);
      await tg(token, 'editMessageText', { chat_id: chat, message_id: cq.message.message_id, parse_mode: 'HTML',
        text: r.ok ? '✅ Kirish tasdiqlandi — <b>' + esc(r.shopName) + '</b>. Ilovaga qayting.'
          : r.why === 'role' ? '🔒 Bu Telegram hisobi ilovaga kirish uchun ulanmagan. Doʻkon egasidan «Kassir taklif qilish» orqali taklif havolasini soʻrang.'
          : r.why === 'not_linked' ? 'Bu Telegram hisobi doʻkonga ulanmagan.' : '⌛️ Havola muddati oʻtgan. Ilovada «Telegram orqali kirish»ni qayta bosing.' });
      await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id }); return;
    }
    // Hisobchi ilovasiga (brauzer/telefon) kirishni tasdiqlash
    if (data.startsWith('hb:') || data === 'hbn') {
      const code = data.slice(3), ok = data !== 'hbn' && /^[0-9a-f]{24}$/.test(code)
        ? (await sql`update public.w_login set chat = ${chat} where code = ${code} and chat is null and used_at is null and created_at > now() - interval '15 minutes' returning code`).length > 0 : false;
      await tg(token, 'editMessageText', { chat_id: chat, message_id: cq.message.message_id, parse_mode: 'HTML',
        text: data === 'hbn' ? 'Bekor qilindi.' : ok ? '✅ <b>Hisobchi</b> ilovasiga kirish tasdiqlandi. Ilovaga qayting — u oʻzi ochiladi.' : '⌛️ Havola muddati oʻtgan yoki ishlatilgan. Ilovada «Telegram orqali kirish»ni qayta bosing.' });
      await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id }); return;
    }
    if (data === 'ln') { await tg(token, 'editMessageText', { chat_id: chat, message_id: cq.message.message_id, text: 'Bekor qilindi.' }); await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id }); return; }
    if (data === 'pay') { await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id }); await payMenu(token, chat); return; }
    if (data.startsWith('pp:')) { await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id }); await payPlan(token, chat, data.slice(3)); return; }
    const link = await call<Link | null>('tg_chat_shop', chat);
    // xodimlar bo'limi — faqat do'kon egasi
    if (/^(sl|sa|s[vpirdx]:)/.test(data)) {
      if (!link || link.role !== 'owner') { await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Bu boʻlim faqat doʻkon egasi uchun', show_alert: true }); return; }
      if (await staffCallback(token, cq, link, data)) return;
    }
    if (link && /^d:\d{4}-\d{2}-\d{2}$/.test(data)) {
      if (!active(link)) { await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id, text: 'Obuna muddati tugagan', show_alert: true }); return; }
      const k = data.slice(2) > todayK() ? todayK() : data.slice(2);
      const r = await dayReport(link, k);
      await tg(token, 'editMessageText', { chat_id: chat, message_id: cq.message.message_id, text: r.text, parse_mode: 'HTML', reply_markup: r.markup });
    }
    await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id });
    return;
  }
  const m = u.message;
  if (!m || !m.chat || m.chat.type !== 'private') return;
  const chat = m.chat.id, text = typeof m.text === 'string' ? m.text.trim() : '';
  const st = await getState(chat);
  // --- kontakt: ro'yxatdan o'tish yoki mavjud hisobga ulanish (faqat o'z raqami: contact.user_id === from.id)
  if (m.contact) {
    if (!m.from || !m.contact.user_id || m.contact.user_id !== m.from.id) { await send(token, chat, 'Iltimos, <b>oʻz raqamingizni</b> pastdagi tugma orqali yuboring.', { reply_markup: CONTACT_KB }); return; }
    const phone = normPhone(m.contact.phone_number);
    if (!phone) { await send(token, chat, 'Hozircha faqat Oʻzbekiston raqamlari (+998) qabul qilinadi.', { reply_markup: { remove_keyboard: true } }); return; }
    await walletExit(chat).catch(() => null);
    const ex: any = await call('tg_shop_by_phone', phone);
    if (ex) { await call('tg_link_owner', ex.shop, chat, tgName(m)); await afterLinked(token, chat, st, '✅ <b>' + esc(ex.name) + '</b> hisobingizga ulandingiz.'); return; }
    await setState(chat, Object.assign({}, st, { step: 'name', phone }));
    await send(token, chat, 'Rahmat! Endi <b>doʻkoningiz nomini</b> yozing (masalan: Baraka market).', { reply_markup: { remove_keyboard: true } });
    return;
  }
  const photo = m.photo && m.photo.length ? m.photo[m.photo.length - 1].file_id : (m.document ? 'doc:' + m.document.file_id : '');
  // --- 👛 Hamyon nazorat: do'kon hisobidan butunlay alohida; ro'yxatdan o'tmagan va obunasi tugaganlarga ham ochiq
  if (text && isWalletEntry(text)) {
    if (st.step === 'staff_name' || st.step === 'staff_rename') await setState(chat, {});
    await walletEnter(token, chat);
    return;
  }
  const wu = await wUser(chat);
  if (wu && wu.mode) {
    if (photo && st.step !== 'receipt') { await walletPhoto(token, chat); return; }
    if (text && isWalletExit(text)) {
      await walletExit(chat);
      const l = await call<Link | null>('tg_chat_shop', chat);
      if (l) await send(token, chat, '🏠 <b>' + esc(l.shopName) + '</b> — asosiy menyu.', { reply_markup: kbOf(l.role, l.admin) });
      else await send(token, chat, '🏠 <b>Asosiy menyu</b>\n\nDoʻkoningiz uchun kassa, ombor va hisobotlar kerak boʻlsa — telefon raqamingizni yuboring (<b>30 kun bepul</b>).\n\nHamyonga qaytish — «' + WALLET_BTN + '».', { reply_markup: CONTACT_KB });
      return;
    }
    // /start yoki do'kon menyusi tugmasi — hamyondan chiqib, odatdagidek davom etadi
    if (text.startsWith('/start') || SHOP_BTNS.includes(norm(text.replace(/^\//, '')))) await walletExit(chat);
    else if (text && !text.startsWith('/') && await walletText(token, chat, text, wu)) return;
  }
  // --- chek rasmi
  if (photo) {
    const admins = (await call<number[]>('tg_admin_chats')) || [];
    if (admins.includes(chat) && st.step !== 'receipt') { await send(token, chat, 'Bu sotuvchi hisobi — obuna kerak emas. Mijozlar yuborgan cheklar shu yerga keladi.'); return; }
    await payReceipt(token, chat, st.step === 'receipt' ? st : {}, photo, tgName(m));
    return;
  }
  if (!text) return;
  // --- /start buyruqlari
  if (text.startsWith('/start')) {
    const arg = text.split(/\s+/)[1] || '';
    if (arg.startsWith('st_')) { await staffJoin(token, chat, arg, tgName(m), appBtn); return; }
    if (arg.startsWith('login_')) {
      const linked = await call<Link | null>('tg_chat_shop', chat);
      if (linked) await askLogin(token, chat, arg.slice(6)); else await askPhone(token, chat, { login: arg.slice(6) }, true);
      return;
    }
    if (arg === 'pay') { await payMenu(token, chat); return; }
    if (arg === 'hamyon') { await walletEnter(token, chat); return; }
    if (arg.startsWith('hb_')) {
      await send(token, chat, '🔐 <b>Hisobchi ilovasiga kirish</b>\n\nBrauzer yoki telefon ilovasida Hisobchiga sizning Telegram hisobingiz bilan kirilmoqda. Bu siz boʻlsangiz — «Ha, kirish»ni bosing.\n\n<i>Havolani oʻzingiz ochmagan boʻlsangiz, bosmang — aks holda boshqa odam kirim-chiqimingizni koʻradi.</i>',
        { reply_markup: { inline_keyboard: [[{ text: '✅ Ha, kirish', callback_data: 'hb:' + arg.slice(3, 27) }, { text: '❌ Yoʻq', callback_data: 'hbn' }]] } });
      return;
    }
    if (arg && arg !== 'reg') {
      const r: any = await call('tg_link_use', arg, chat, tgName(m));
      if (r && r.ok) {
        await afterLinked(token, chat, {}, '✅ <b>' + esc(r.shopName) + '</b> doʻkoniga ulandingiz (' + (ROLE[r.role] || r.role) + ').\n\nPastdagi tugmalar bilan hisobotlarni olasiz. ' + (r.role !== 'cashier' ? 'Har kuni kechqurun kunlik hisobot oʻzi keladi, smena yopilganda — Z-hisobot, katta chegirma yoki qaytarish boʻlsa — darhol xabar.' : 'Smena yopilganda Z-hisobot oʻzi keladi.'), r.role);
      } else await send(token, chat, '❌ Kod notoʻgʻri yoki muddati oʻtgan (30 daqiqa amal qiladi).\n\nIlovada <b>Sozlamalar → Telegram bot va AI → Telegramni ulash</b> tugmasini qayta bosing.');
      return;
    }
    const linked = await call<Link | null>('tg_chat_shop', chat);
    if (!linked) { await askPhone(token, chat, {}, true); return; }
  }
  // --- qo'llanma: /yordam yoki «qo'llanma» — ro'yxatdan o'tmagan odamga ham
  if (/^\/(yordam|help|qollanma)\b/i.test(text) || GUIDE_WORDS.includes(norm(text)) && st.step !== 'name') { await sendGuide(token, chat, 'menu'); return; }
  if (/^\/video\b/i.test(text) || ['video', 'video darslik', 'video qoʻllanma', "video qo'llanma"].includes(norm(text)) && st.step !== 'name') { await sendVideoLesson(token, chat, 'menu'); return; }
  // --- do'kon nomi (ro'yxatdan o'tishning oxirgi qadami)
  if (st.step === 'name' && st.phone && !text.startsWith('/')) {
    const name = text.replace(/\s+/g, ' ').slice(0, 80);
    if (name.length < 2) { await send(token, chat, 'Doʻkon nomini yozing (kamida 2 harf).'); return; }
    const ex: any = await call('tg_shop_by_phone', st.phone);
    if (ex) { await call('tg_link_owner', ex.shop, chat, tgName(m)); await afterLinked(token, chat, st, '✅ <b>' + esc(ex.name) + '</b> hisobingizga ulandingiz.'); return; }
    const uid = await createUser(st.phone);
    if (!uid) { await send(token, chat, 'Hisob ochib boʻlmadi — birozdan keyin qayta urinib koʻring.'); return; }
    try { await call('tg_register_shop', uid, st.phone, name, chat, tgName(m)); }
    catch (e) { await deleteUser(uid); await send(token, chat, 'Hisob ochib boʻlmadi — birozdan keyin qayta urinib koʻring.'); console.error('register', e); return; }
    await notifyAdmins(token, '🏪 <b>Yangi doʻkon roʻyxatdan oʻtdi</b>: ' + esc(name) + ' (+' + esc(st.phone) + ')' + (tgName(m) ? '\nEgasi: ' + esc(tgName(m)) : '') + (m.from && m.from.username ? ' (@' + esc(m.from.username) + ')' : ''), chat);
    await afterLinked(token, chat, st, '🎉 <b>' + esc(name) + '</b> doʻkoni ochildi!\n\n<b>30 kun bepul</b> — keyin «💳 Obuna» orqali toʻlaysiz. Pastdagi tugmalar — hisobotlar, «👥 Kassir taklif qilish» — xodim qoʻshish.');
    // yangi do'kon: ilovadan qanday foydalanishni darhol videoda ko'rsatamiz
    await sendVideoLesson(token, chat, '1');
    return;
  }
  const link = await call<Link | null>('tg_chat_shop', chat);
  if (!link) { await askPhone(token, chat, {}); return; }
  const K = { reply_markup: kbOf(link.role, link.admin) };
  const t = todayK(), n = text.startsWith('/start') ? 'start' : norm(text.replace(/^\//, ''));
  // --- xodim nomini yozish (ega) — menyu tugmasi bosilsa, nom kutish bekor qilinadi
  if (st.step === 'staff_name' || st.step === 'staff_rename') {
    if (link.role === 'owner' && !text.startsWith('/') && !MENU.includes(n) && await staffText(token, chat, link, st, text)) return;
    await setState(chat, {});
  }
  if (n === 'statistika' || n === 'stat') {
    if (!link.admin) { await send(token, chat, 'Bu boʻlim faqat sotuvchi uchun.', K); return; }
    await send(token, chat, await statsText(), K);
    return;
  }
  if (n === 'obuna' || n === 'tolov' || n === "to'lov" || n === 'toʻlov') { await payMenu(token, chat); return; }
  if (!active(link)) { await send(token, chat, '⛔️ <b>' + esc(link.shopName) + '</b>: obuna muddati tugagan.\n\n👛 «Hamyon nazorat» esa ishlayveradi.', { reply_markup: { inline_keyboard: [[{ text: '💳 Obunani toʻlash', callback_data: 'pay' }], [{ text: WALLET_BTN, callback_data: 'w:home' }]] } }); return; }
  if (n === 'kassir taklif qilish' || n === 'xodimlar' || n === 'kassirlar') {
    if (link.role !== 'owner') { await send(token, chat, 'Bu boʻlim faqat doʻkon egasi uchun.', K); return; }
    await staffMenu(token, chat, link);
    return;
  }
  if (n === 'start') {
    await send(token, chat, '👋 <b>' + esc(link.shopName) + '</b> — hisobotlar uchun pastdagi tugmalarni bosing yoki savolingizni yozing.' + (link.role === 'owner' ? '\n\n«👥 Kassir taklif qilish» — xodim qoʻshish va unga ilovadagi boʻlimlarni ochib berish.' : '') + '\n\n👛 «Hamyon nazorat» — shaxsiy kunlik xarajatlaringiz (doʻkon hisobiga taʼsir qilmaydi).\n\n📖 Ilovadan qanday foydalanish — pastdagi «Qoʻllanma» tugmasida yoki /yordam.', K);
    const btn = await appBtn(); if (btn) await send(token, chat, '📱 Ilovalar:', { reply_markup: btn });
    return;
  }
  if (n === 'bugun' || n === 'kecha') { const r = await dayReport(link, n === 'bugun' ? t : addK(t, -1)); await send(token, chat, r.text, { reply_markup: r.markup }); return; }
  if (n === 'hafta') { await send(token, chat, await periodReport(link, weekStart(t), addK(t, 1), 'Shu hafta: ' + kLabel(weekStart(t)) + ' — bugun'), K); return; }
  if (n === 'oy') { await send(token, chat, await periodReport(link, monthStart(t), addK(t, 1), monthName(t)), K); return; }
  if (n === 'ombor') { await send(token, chat, await stockReport(link), K); return; }
  if (n === 'qarzlar' || n === 'qarz') { await send(token, chat, await debtReport(link), K); return; }
  if (n === 'top tovarlar' || n === 'top') { await send(token, chat, await topReport(link), K); return; }
  // oddiy savol — AI
  if (link.role === 'cashier') { await send(token, chat, 'Savol-javob (AI) faqat doʻkon egasi va menejer uchun. Hisobotlar — pastdagi tugmalarda.', K); return; }
  if (!(await secret('ai_key'))) { await send(token, chat, 'Savol-javob (AI) hali yoqilmagan. Hisobotlar — pastdagi tugmalarda.', K); return; }
  if (!(await aiQuota(link.shop))) { await send(token, chat, 'Bugungi savollar limiti tugadi — ertaga yana soʻrang.', K); return; }
  await tg(token, 'sendChatAction', { chat_id: chat, action: 'typing' });
  try {
    const a = await askShop(link.shop, link.shopName, text);
    const html = esc(a || 'Javob topilmadi.').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>').replace(/^\s*[-*]\s+/gm, '• ');
    await send(token, chat, html, Object.assign({ parse_mode: 'HTML' }, K));
  } catch (e: any) {
    console.error('ai', e);
    await send(token, chat, 'AI hozir javob bera olmadi. Keyinroq urinib koʻring.', K);
  }
}
