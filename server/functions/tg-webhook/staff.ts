// Xodimlar: do'kon egasi botda kassir taklif qiladi, unga nom beradi va ilovadagi bo'limlarni ochib beradi.
// Savdo va Tovar kirimi xodimga doim ochiq. Xodim ilovaga o'z Telegrami orqali, alohida hisob bilan kiradi.
import { call, send, tg, esc, secret, KB, type Link } from './tg.ts';
import { createStaffUser, deleteUser } from './auth.ts';

export const STAFF_TABS: [string, string][] = [
  ['bosh', 'Bosh sahifa'], ['ombor', 'Mahsulotlar'], ['qarz', 'Qarzdorlar'],
  ['xarajat', 'Xarajatlar'], ['moliya', 'Hisobotlar va foyda'], ['sozlama', 'Sozlamalar'],
];
type Staff = { id: string; name: string; perms: string[]; joined: boolean; tgName: string | null; user: string | null; chat: number | null; invite: boolean };

const setState = (chat: number, st: unknown) => call('tg_state_set', chat, JSON.stringify(st || {}));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const cleanName = (t: string) => t.replace(/\s+/g, ' ').trim().slice(0, 40);
const status = (s: Staff) => s.joined ? '✅ ulangan' + (s.tgName ? ' (' + esc(s.tgName) + ')' : '') : s.invite ? '⏳ havola yuborilgan — xodim hali ochmagan' : '⏳ hali taklif havolasi olinmagan';

async function show(token: string, chat: number, text: string, markup: unknown, editId?: number) {
  if (editId) {
    const r: any = await tg(token, 'editMessageText', { chat_id: chat, message_id: editId, text, parse_mode: 'HTML', reply_markup: markup, disable_web_page_preview: true });
    if (r && (r.ok || /not modified/.test(String(r.description || '')))) return;
  }
  await send(token, chat, text, { reply_markup: markup });
}

export async function staffMenu(token: string, chat: number, link: Link, editId?: number) {
  const list = (await call<Staff[]>('staff_list', link.shop)) || [];
  const text = '👥 <b>Xodimlar — ' + esc(link.shopName) + '</b>\n\n' +
    (list.length ? list.map((s, i) => (i + 1) + '. <b>' + esc(s.name) + '</b> — ' + status(s)).join('\n') : 'Hali xodim yoʻq.') +
    '\n\n<i>Xodim ilovaga oʻz Telegrami orqali alohida kiradi. Savdo va Tovar kirimi unga doim ochiq, qolgan boʻlimlarni siz ochib berasiz.</i>';
  const rows = list.map((s) => [{ text: (s.joined ? '👤 ' : '⏳ ') + s.name, callback_data: 'sv:' + s.id }]);
  rows.push([{ text: '➕ Kassir taklif qilish', callback_data: 'sa' }]);
  await show(token, chat, text, { inline_keyboard: rows }, editId);
}

function card(s: Staff) {
  const on = (t: string) => (s.perms || []).includes(t);
  const text = '👤 <b>' + esc(s.name) + '</b>\nHolati: ' + status(s) + '\n\n' +
    '<b>Ilovada ochiq boʻlimlar</b> (tugmani bosib yoqing / oʻchiring):\n' +
    '🔒 Savdo — doim ochiq\n🔒 Tovar kirimi — doim ochiq\n' +
    STAFF_TABS.map(([t, l]) => (on(t) ? '✅ ' : '⬜ ') + l).join('\n') +
    '\n\n<i>«Hisobotlar va foyda» ochilmasa, xodim foydani ilovada ham, botda ham koʻrmaydi. Oʻzgarish xodimning ilovasida 1 daqiqa ichida qoʻllanadi.</i>';
  const rows: any[] = [];
  for (let i = 0; i < STAFF_TABS.length; i += 2) rows.push(STAFF_TABS.slice(i, i + 2).map(([t, l]) => ({ text: (on(t) ? '✅ ' : '⬜ ') + l, callback_data: 'sp:' + s.id + ':' + t })));
  rows.push([{ text: s.joined ? '🔗 Yangi taklif havolasi (qayta ulash)' : '🔗 Taklif havolasini olish', callback_data: 'si:' + s.id }]);
  rows.push([{ text: '✏️ Nomini oʻzgartirish', callback_data: 'sr:' + s.id }, { text: '🗑 Oʻchirish', callback_data: 'sd:' + s.id }]);
  rows.push([{ text: '⬅️ Xodimlar roʻyxati', callback_data: 'sl' }]);
  return { text, markup: { inline_keyboard: rows } };
}
async function showCard(token: string, chat: number, s: Staff, editId?: number) { const c = card(s); await show(token, chat, c.text, c.markup, editId); }

// Faqat do'kon egasi chaqiradi (tekshiruv chaqiruvchida). true — callback shu yerda ishlandi
export async function staffCallback(token: string, cq: any, link: Link, data: string): Promise<boolean> {
  const chat = cq.message.chat.id, mid = cq.message.message_id;
  const ans = (text?: string, alert = false) => tg(token, 'answerCallbackQuery', Object.assign({ callback_query_id: cq.id }, text ? { text, show_alert: alert } : {}));
  if (data === 'sl') { await ans(); await staffMenu(token, chat, link, mid); return true; }
  if (data === 'sa') {
    await ans();
    await setState(chat, { step: 'staff_name' });
    await send(token, chat, '➕ <b>Yangi xodim</b>\n\nXodimga nom bering — masalan: <b>Kassir 1</b>, <b>Kassir 2</b>, <b>Menejer</b>.\n\nNomni shu yerga yozing:',
      { reply_markup: { force_reply: true, input_field_placeholder: 'Kassir 1' } });
    return true;
  }
  const [cmd, id, tab] = data.split(':');
  if (!['sv', 'sp', 'si', 'sr', 'sd', 'sx'].includes(cmd)) return false;
  if (!UUID.test(id || '')) { await ans('Notoʻgʻri tugma'); return true; }
  if (cmd === 'sx') {
    const r: any = await call('staff_remove', link.shop, id);
    if (!r) { await ans('Xodim topilmadi'); await staffMenu(token, chat, link, mid); return true; }
    if (r.user) await deleteUser(r.user);
    if (r.chat) await send(token, r.chat, 'ℹ️ Siz <b>' + esc(link.shopName) + '</b> doʻkonidan chiqarildingiz. Ilovaga endi kira olmaysiz.', { reply_markup: { remove_keyboard: true } });
    await ans('Oʻchirildi');
    await staffMenu(token, chat, link, mid);
    return true;
  }
  let s: Staff | null = null;
  if (cmd === 'sp') s = await call<Staff | null>('staff_toggle', link.shop, id, tab || '').catch(() => null);
  else s = await call<Staff | null>('staff_get', link.shop, id);
  if (!s) { await ans('Xodim topilmadi'); await staffMenu(token, chat, link, mid); return true; }
  if (cmd === 'sv' || cmd === 'sp') {
    if (cmd === 'sp') { const lbl = (STAFF_TABS.find((x) => x[0] === tab) || ['', ''])[1]; await ans((s.perms || []).includes(tab) ? '✅ ' + lbl + ' ochildi' : '⬜ ' + lbl + ' yopildi'); } else await ans();
    await showCard(token, chat, s, mid);
    return true;
  }
  if (cmd === 'si') {
    const inv: any = await call('staff_invite', link.shop, id);
    const bot = await secret('tg_bot');
    if (!inv || !bot) { await ans('Havola yaratib boʻlmadi', true); return true; }
    await ans();
    const url = 'https://t.me/' + bot + '?start=' + inv.code;
    const share = 'https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent('«' + link.shopName + '» doʻkoniga «' + s.name + '» sifatida qoʻshilish uchun havolani oching');
    await send(token, chat, '🔗 <b>' + esc(s.name) + '</b> uchun taklif havolasi:\n\n' + esc(url) +
      '\n\nShu havolani xodimga yuboring. U havolani ochib «Start»ni bossa — doʻkoningizga <b>' + esc(s.name) + '</b> sifatida ulanadi va ilovaga oʻz Telegrami bilan kiradi.' +
      (s.joined ? '\n\n<i>Xodim hozir ulangan. Yangi havola bilan ulansa (masalan, yangi telefon), eski Telegrami uziladi.</i>' : '') +
      '\n\n⏳ 24 soat amal qiladi, faqat bir marta ishlaydi.',
      { reply_markup: { inline_keyboard: [[{ text: '📤 Xodimga yuborish', url: share }], [{ text: '⬅️ ' + s.name, callback_data: 'sv:' + s.id }]] } });
    return true;
  }
  if (cmd === 'sr') {
    await ans();
    await setState(chat, { step: 'staff_rename', id: s.id });
    await send(token, chat, '✏️ <b>' + esc(s.name) + '</b> uchun yangi nomni yozing:', { reply_markup: { force_reply: true, input_field_placeholder: s.name } });
    return true;
  }
  if (cmd === 'sd') {
    await ans();
    await show(token, chat, '🗑 <b>' + esc(s.name) + '</b>ni oʻchirasizmi?\n\nU ilovadan darhol chiqariladi va botdan hisobot olmaydi. Uning qilgan savdolari saqlanib qoladi.',
      { inline_keyboard: [[{ text: '🗑 Ha, oʻchirish', callback_data: 'sx:' + s.id }, { text: '⬅️ Bekor qilish', callback_data: 'sv:' + s.id }]] }, mid);
    return true;
  }
  return false;
}

// Egasining yozgan matni (xodim nomi): true — shu yerda ishlandi
export async function staffText(token: string, chat: number, link: Link, st: any, text: string): Promise<boolean> {
  if (st.step !== 'staff_name' && st.step !== 'staff_rename') return false;
  const name = cleanName(text);
  if (!name) { await send(token, chat, 'Nom boʻsh boʻlmasin — masalan: <b>Kassir 1</b>.', { reply_markup: { force_reply: true } }); return true; }
  await setState(chat, {});
  const s = st.step === 'staff_name'
    ? await call<Staff>('staff_create', link.shop, name).catch(() => null)
    : UUID.test(st.id || '') ? await call<Staff | null>('staff_rename', link.shop, st.id, name).catch(() => null) : null;
  if (!s) { await send(token, chat, 'Saqlab boʻlmadi — qayta urinib koʻring.'); await staffMenu(token, chat, link); return true; }
  if (st.step === 'staff_name') await send(token, chat, '✅ <b>' + esc(s.name) + '</b> qoʻshildi. Endi unga qaysi boʻlimlar ochiq boʻlishini belgilang va taklif havolasini oling:');
  await showCard(token, chat, s);
  return true;
}

// Xodim taklif havolasini ochdi: /start st_XXXX
export async function staffJoin(token: string, chat: number, code: string, tgName: string, appBtn: () => Promise<unknown>) {
  if (!/^st_[0-9A-F]{16}$/.test(code)) { await send(token, chat, '❌ Taklif havolasi notoʻgʻri. Doʻkon egasidan yangi havola soʻrang.'); return; }
  const p: any = await call('staff_peek', code, chat);
  if (!p) { await send(token, chat, '❌ Taklif havolasi notoʻgʻri yoki muddati oʻtgan (24 soat amal qiladi). Doʻkon egasidan yangi havola soʻrang.'); return; }
  if (p.isOwner) { await send(token, chat, 'Bu sizning doʻkoningiz — oʻzingizni xodim qilib qoʻsha olmaysiz. Havolani xodimingizga yuboring.'); return; }
  if (p.other) { await send(token, chat, 'Siz <b>' + esc(p.shopName) + '</b> doʻkonida allaqachon <b>' + esc(p.other) + '</b> sifatida ulangansiz.'); return; }
  let uid: string | null = p.user, made = false;
  if (!uid) { uid = await createStaffUser(p.id); made = true; }
  if (!uid) { await send(token, chat, 'Hisob ochib boʻlmadi — birozdan keyin havolani qayta oching.'); return; }
  let r: any = null;
  try { r = await call('staff_join', code, chat, tgName, uid); } catch (e) { console.error('staff_join', e); }
  if (!r || !r.ok) {
    if (made) await deleteUser(uid);
    await send(token, chat, r && r.why === 'owner' ? 'Bu sizning doʻkoningiz — oʻzingizni xodim qilib qoʻsha olmaysiz.' : '❌ Havola muddati oʻtgan yoki ishlatilgan. Doʻkon egasidan yangi havola soʻrang.');
    return;
  }
  await setState(chat, {});
  await send(token, chat, '✅ <b>' + esc(r.shopName) + '</b> doʻkoniga <b>' + esc(r.name) + '</b> sifatida ulandingiz.\n\n' +
    '<b>Ilovaga kirish:</b>\n• Telegram ichida — pastdagi «📱 Ilovani ochish» tugmasi\n• Telefon ilovasi (APK) yoki brauzerda — «Telegram orqali kirish»ni bosing va shu yerda «Ha, kirish»ni tasdiqlang.\n\n' +
    'Ilovada sizga Savdo, Tovar kirimi va doʻkon egasi ochib bergan boʻlimlar koʻrinadi.', { reply_markup: KB });
  const btn = await appBtn();
  if (btn) await send(token, chat, 'Ilovani shu yerdan oching — parol soʻralmaydi:', { reply_markup: btn });
  for (const o of r.owners || []) await send(token, o, '✅ <b>' + esc(r.name) + '</b> doʻkoningizga ulandi' + (tgName ? ' (' + esc(tgName) + ')' : '') + '.\n\nBoʻlimlarini «👥 Kassir taklif qilish» orqali oʻzgartirasiz.');
}
