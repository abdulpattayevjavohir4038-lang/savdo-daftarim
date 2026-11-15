// Botdan va ilovadan foydalanish qo'llanmasi (yozma). /start bosilganda darhol ko'rsatiladi,
// keyin «📖 Qo'llanma» orqali istalgan vaqtda: bo'limlar bir xabar ichida almashadi (chat to'lib ketmaydi).
import { send, tg, secret, setSecret } from './tg.ts';

const TOPICS: [string, string][] = [
  ['start', '🚀 Boshlash'], ['app', '📱 Ilovaga kirish'], ['sell', '🛒 Savdo (kassa)'], ['kirim', '📦 Tovar kirimi'],
  ['qarz', '📒 Qarz daftari'], ['report', '📊 Hisobotlar'], ['staff', '👥 Kassir qoʻshish'], ['pay', '💳 Obuna'], ['bot', '🤖 Bot tugmalari'],
  ['hamyon', '👛 Hamyon nazorat'],
];

const PAGES: Record<string, string> = {
  menu:
    '📖 <b>Qoʻllanma — mundarija</b>\n\nKerakli boʻlimni tanlang. Har birida qisqa, qadam-baqadam tushuntirish bor.\n\n🎬 Videoda koʻrmoqchi boʻlsangiz — yuqoridagi <b>video dars</b> tugmalari (ekranda yozma subtitr bilan).',
  start:
    '🚀 <b>Boshlash — 3 qadam</b>\n\n' +
    '1️⃣ Botda <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing. Hisobingiz shu raqamga ochiladi, parol kerak emas.\n\n' +
    '2️⃣ <b>Doʻkoningiz nomini</b> yozing (masalan: <i>Baraka market</i>).\n\n' +
    '3️⃣ <b>«📱 Ilovani ochish»</b> tugmasini bosing — ilova ochiladi.\n\n' +
    'Keyin ilovada: <b>Mahsulotlar → Yangi mahsulot</b> (yoki <b>Kirim qilish</b>) orqali tovarlarni kiriting va <b>Savdo</b> boʻlimida sotishni boshlang.\n\n' +
    '🎁 Birinchi <b>30 kun bepul</b>.',
  app:
    '📱 <b>Ilovaga kirish</b>\n\n' +
    '<b>1. Telegram ichida (eng oson)</b>\nChap pastdagi <b>«Ilovalar»</b> tugmasi → <b>Minimarket POS</b> yoki <b>Hisobchi</b> — parol soʻralmaydi.\n\n' +
    '<b>2. Android ilova (APK)</b>\nIlovani oʻrnating, <b>«Telegram orqali kirish»</b>ni bosing → bot ochiladi → <b>«✅ Ha, kirish»</b>ni bosing → ilovaga oʻzi qaytadi.\n\n' +
    '<b>3. Brauzer (kompyuter, planshet)</b>\nIlova havolasini oching va xuddi shunday <b>«Telegram orqali kirish»</b>.\n\n' +
    '☁️ Maʼlumotlar serverda saqlanadi: doʻkondagi hamma telefon va kompyuterda bir xil koʻrinadi. Internet uzilsa ham ilova ishlayveradi, internet kelganda oʻzi sinxronlanadi.',
  sell:
    '🛒 <b>Savdo (kassa)</b>\n\n' +
    '1️⃣ Ilovada <b>Savdo</b> boʻlimini oching.\n' +
    '2️⃣ Tovarni topish: nomini yozing, <b>📷 kamera</b> bilan shtrix-kodni skanerlang yoki <b>🎤 ovoz</b> bilan ayting.\n' +
    '3️⃣ Tovar savatga tushadi — sonini oʻzgartirish mumkin.\n' +
    '4️⃣ Toʻlov turini tanlang: <b>Naqd</b>, <b>Plastik karta</b>, <b>Aralash</b> yoki <b>Qarzga (nasiya)</b>.\n' +
    '5️⃣ <b>«Toʻlovni yakunlash»</b>ni bosing — chek tayyor, qoldiq oʻzi kamayadi.\n\n' +
    '🧺 Bir vaqtda 4 ta savat (4 ta mijoz) ochish mumkin.\n' +
    '↩️ Mijoz tovarni qaytarsa: <b>Savdo → «Tovar qaytarish»</b> — tovarni skanerlang yoki nomini yozing, ilova chekni oʻzi topadi. Qoldiq va tushum toʻgʻri qoladi (hammaga, kassirga ham ochiq). Video: <b>4-dars</b>.\n' +
    '🔒 Kun oxirida <b>«Smenani yopish»</b> — kassadagi pulni sanaysiz, doʻkon egasiga Z-hisobot keladi.',
  kirim:
    '📦 <b>Tovar kirimi (prixod)</b>\n\n' +
    '1️⃣ <b>Mahsulotlar → Kirim qilish</b> (kassirda — <b>Tovar kirimi</b> boʻlimi).\n' +
    '2️⃣ Taʼminotchini tanlang (ixtiyoriy).\n' +
    '3️⃣ Tovarlarni qoʻshing: <b>soni</b>, <b>kelish narxi</b> va <b>sotish narxi</b>. Ustama foizini tanlasangiz, sotish narxi oʻzi hisoblanadi.\n' +
    '4️⃣ <b>«Toʻlandi»</b> maydoniga bergan pulingizni yozing — qolgani taʼminotchiga qarz boʻlib yoziladi.\n' +
    '5️⃣ <b>«Kirim qilish»</b> tugmasini bosing — qoldiq oʻzi koʻpayadi.\n\n' +
    '🤖 Vaqtni tejash: <b>«Nakladnoy rasmidan toʻldirish (AI)»</b> — nakladnoyni suratga olsangiz, tovarlar roʻyxati oʻzi toʻldiriladi, siz faqat tekshirasiz.',
  qarz:
    '📒 <b>Qarz daftari</b>\n\n' +
    '• Savdoda toʻlov turini <b>«Qarzga (nasiya)»</b> qilib, mijozni tanlasangiz — qarz oʻzi yoziladi.\n' +
    '• Mijoz qarzini toʻlasa: <b>Qarzdorlar</b> → mijoz → <b>«Toʻlov qabul qilish»</b>.\n' +
    '• Taʼminotchilarga qarzingiz ham shu yerda — kirimda toʻlanmagan summa oʻzi qoʻshiladi.\n\n' +
    'Botdagi <b>«📒 Qarzlar»</b> tugmasi — kim qancha qarzdorligini darhol koʻrsatadi.',
  report:
    '📊 <b>Hisobotlar</b>\n\n' +
    '<b>Botda (tugmalar):</b>\n' +
    '📊 Bugun · 📅 Kecha · 🗓 Hafta · 📆 Oy — tushum, cheklar, naqd/karta, foyda\n' +
    '📦 Ombor — kam qolgan va tugagan tovarlar\n' +
    '📒 Qarzlar — qarzdor mijozlar\n' +
    '🏆 Top tovarlar — eng koʻp sotilganlar\n\n' +
    '<b>Oʻzi keladigan xabarlar:</b>\n' +
    '• Har kuni kechqurun — kunlik hisobot\n' +
    '• Dushanba ertalab — oʻtgan hafta\n' +
    '• Smena yopilganda — Z-hisobot\n' +
    '• Qaytarish yoki katta chegirma boʻlsa — darhol xabar\n\n' +
    'Ilovada <b>Hisobotlar</b> boʻlimi — grafiklar va batafsil tahlil.',
  staff:
    '👥 <b>Kassir (xodim) qoʻshish</b> — faqat doʻkon egasi uchun\n\n' +
    '1️⃣ Botda <b>«👥 Kassir taklif qilish»</b> → <b>«➕ Kassir taklif qilish»</b>.\n' +
    '2️⃣ Xodimga nom bering: <i>Kassir 1</i>, <i>Kassir 2</i>, <i>Menejer</i>…\n' +
    '3️⃣ Unga ochiq boʻladigan boʻlimlarni belgilang (✅ ochiq / ⬜ yopiq). <b>Savdo</b> va <b>Tovar kirimi</b> doim ochiq.\n' +
    '4️⃣ <b>«🔗 Taklif havolasi»</b>ni oling va xodimga yuboring (24 soat amal qiladi).\n' +
    '5️⃣ Xodim havolani ochib «Start»ni bosadi — u ulanadi, sizga xabar keladi.\n\n' +
    '🔒 «Hisobotlar va foyda» ochilmasa, xodim foydani hech qayerda koʻrmaydi. Boʻlimlarni keyin ham istalgan vaqtda oʻzgartirasiz yoki xodimni oʻchirasiz.\n\n🎬 Videoda: <b>3-dars — Kassir taklif qilish</b>.',
  pay:
    '💳 <b>Obuna</b>\n\n' +
    '🎁 Birinchi 30 kun bepul. Muddat tugashidan 7, 3 va 1 kun oldin botda eslatma keladi.\n\n' +
    '<b>Toʻlash:</b>\n' +
    '1️⃣ Botda <b>«💳 Obuna»</b>ni bosing va tarifni tanlang.\n' +
    '2️⃣ Koʻrsatilgan kartaga pul oʻtkazing.\n' +
    '3️⃣ Toʻlov chekini (skrinshot) <b>rasm qilib</b> shu botga yuboring.\n' +
    '4️⃣ Sotuvchi tasdiqlashi bilan obuna oʻzi uzayadi va sizga xabar keladi.\n\n' +
    'Muddat tugasa ham maʼlumotlaringiz oʻchmaydi.',
  bot:
    '🤖 <b>Bot tugmalari</b>\n\n' +
    '📊 Bugun · 📅 Kecha · 🗓 Hafta · 📆 Oy — savdo hisobotlari\n' +
    '📦 Ombor — kam qolgan tovarlar\n' +
    '📒 Qarzlar — qarzdorlar roʻyxati\n' +
    '🏆 Top tovarlar — oxirgi 7 kunda eng koʻp sotilgan\n' +
    '👥 Kassir taklif qilish — xodim qoʻshish (doʻkon egasi)\n' +
    '💳 Obuna — muddat va toʻlov\n' +
    '👛 Hamyon nazorat — shaxsiy kunlik xarajatlaringiz (bepul)\n\n' +
    '💬 <b>Savol bering:</b> doʻkon egasi botga oddiy matn bilan yozishi mumkin, masalan <i>«Bu hafta qancha foyda qildim?»</i> yoki <i>«Qaysi tovarlar tugayapti?»</i> — AI doʻkoningiz maʼlumoti asosida javob beradi.\n\n' +
    '❓ Qoʻllanma kerak boʻlsa — istalgan vaqtda <b>/yordam</b>, video darslik — <b>/video</b> yozing.',
  hamyon:
    '👛 <b>Hamyon nazorat</b> — shaxsiy kunlik xarajatlar\n\n' +
    'Doʻkon hisobidan butunlay alohida: ilovaga ham, doʻkon hisobotlariga ham taʼsir qilmaydi. <b>Bepul</b>, obuna va roʻyxatdan oʻtish shart emas.\n\n' +
    '1️⃣ Pastdagi <b>«👛 Hamyon nazorat»</b> tugmasini bosing.\n' +
    '2️⃣ Xarajatni oddiy yozing: <i>kofe 38000</i>, <i>taksi 25 ming</i>, <i>obed 45k</i>. Bot toifani oʻzi aniqlaydi (Ovqat, Kofe, Transport…), notoʻgʻri boʻlsa — tugma bilan almashtirasiz, keyingi safar bot eslab qoladi.\n' +
    '3️⃣ Kirim: <i>+5 mln oylik</i> yoki «➕ Kirim» tugmasi.\n\n' +
    '📊 <b>Bugun hisobi</b> va 📆 <b>Shu oy</b> — qayerga qancha ketgani (%), oy oxiriga prognoz.\n' +
    '🎯 <b>Byudjet</b> — toifaga oylik limit; oshib ketishi mumkin boʻlsa ogohlantiradi.\n' +
    '📒 <b>Qarz daftari</b> — kim sizga, siz kimga qarz; qisman toʻlov va yopish.\n' +
    '👥 <b>Hisobni boʻlish</b> — restoranda siz toʻladingiz: ulushingizni yozasiz, qolgani qarzga oʻzi yoziladi.\n' +
    '💰 <b>Balans</b> kiritsangiz — «pul kuniga ~X bilan N kunga yetadi» deb koʻrsatadi.\n' +
    '🔔 Har kuni <b>21:00</b> da kunlik hisobot keladi (oʻchirish mumkin).\n\n' +
    '🧮 <b>Hisobchi ilovasi</b> — shu maʼlumotlar ilova koʻrinishida: kirim-chiqim, qarz oldi-berdi, grafiklar va toifalar. Chap pastdagi <b>«Ilovalar»</b> tugmasi → <b>Hisobchi</b>.',
};

// video darsliklar (ekranda yozma subtitr + ovozli tushuntirish). Fayl GitHub Pages'da; Telegram bir marta yuklab oladi, keyin file_id bilan bir zumda
const VIDEO_BASE = 'https://abdulpattayevjavohir4038-lang.github.io/savdo-daftarim/video/';
const VIDEOS: Record<string, { file: string; dur: number; caption: string; btn: string }> = {
  '1': { file: 'minimarket-boshlash.mp4', dur: 92, btn: '🎬 1-dars: Noldan boshlash',
    caption: '🎬 <b>1-dars: Noldan boshlash</b> (1:32)\n\nBotda roʻyxatdan oʻtish → «Ilovalar» → Minimarket POS → tovar qoʻshish → birinchi savdo.\nMadina ovozida, ekranda yozma subtitr bilan.' },
  '2': { file: 'minimarket-qollanma.mp4', dur: 92, btn: '🎬 2-dars: Narx, ustama va foyda',
    caption: '🎬 <b>2-dars: Narx, ustama va foyda</b> (1:32)\n\nKelish narxi va ustama, tovar kirimi va taʼminotchi qarzi, chek foydasi, xarajatlar va sof foyda.\nMadina ovozida, ekranda yozma subtitr bilan.' },
  '3': { file: 'minimarket-kassir.mp4', dur: 95, btn: '🎬 3-dars: Kassir taklif qilish',
    caption: '🎬 <b>3-dars: Kassir taklif qilish</b> (1:35)\n\nXodimga nom berish, boʻlimlarni ochish, taklif havolasi. Kassir «Ilovalar» orqali oʻz Telegrami bilan kiradi, foyda unga koʻrinmaydi.\nMadina ovozida, ekranda yozma subtitr bilan.' },
  '4': { file: 'minimarket-qaytarish.mp4', dur: 67, btn: '🎬 4-dars: Tovar qaytarish',
    caption: '🎬 <b>4-dars: Tovar qaytarish</b> (1:07)\n\nTovarni skanerlaysiz yoki nomini yozasiz — ilova chekni oʻzi topadi, tovar omborga, pul hisobdan qaytadi.\nMadina ovozida, ekranda yozma subtitr bilan.' },
  '5': { file: 'hisobchi.mp4', dur: 89, btn: '🎬 5-dars: Hisobchi ilovasi',
    caption: '🎬 <b>5-dars: Hisobchi ilovasi</b> (1:29)\n\nKirim-chiqim, «taksi 25 ming» deb tez yozish, qarz berdim/oldim, hisobot va byudjet. Bepul.\nMadina ovozida, ekranda yozma subtitr bilan.' },
};
const VORDER = ['1', '2', '3', '4', '5'];
// barcha video darslar tugmalari (2 tadan qator)
export const videoRows = () => [[{ text: '🎬 1-dars: Boshlash', callback_data: 'v:1' }, { text: '🎬 2-dars: Foyda', callback_data: 'v:2' }], [{ text: '🎬 3-dars: Kassir', callback_data: 'v:3' }, { text: '🎬 4-dars: Qaytarish', callback_data: 'v:4' }], [{ text: '🎬 5-dars: Hisobchi', callback_data: 'v:5' }]];

// /video — barcha darslar ro'yxati
export async function sendVideoMenu(token: string, chat: number) {
  await send(token, chat, '🎬 <b>Video darsliklar</b> (oʻzbek tilida, ekranda yozma subtitr bilan)\n\n' + VORDER.map((k) => VIDEOS[k].caption.split('\n')[0].replace('🎬 ', '')).join('\n') + '\n\nKerakli darsni tanlang:', { reply_markup: { inline_keyboard: [...videoRows(), [{ text: '📖 Yozma qoʻllanma', callback_data: 'g:menu' }]] } });
}
export async function sendVideoLesson(token: string, chat: number, id: string) {
  if (id === 'menu') { await sendVideoMenu(token, chat); return; }
  const v = VIDEOS[id]; if (!v) return;
  // video ostida: keyingi dars + qolgan darslar + yozma qo'llanma
  const i = VORDER.indexOf(id), next = VORDER[(i + 1) % VORDER.length];
  const rest = VORDER.filter((x) => x !== id && x !== next);
  const markup = { inline_keyboard: [[{ text: '▶️ Keyingi: ' + VIDEOS[next].btn.replace('🎬 ', ''), callback_data: 'v:' + next }],
    rest.map((x) => ({ text: '🎬 ' + x + '-dars', callback_data: 'v:' + x })), [{ text: '📖 Yozma qoʻllanma', callback_data: 'g:menu' }]] };
  const key = 'tgvid2:' + v.file, cached = await secret(key);
  await tg(token, 'sendChatAction', { chat_id: chat, action: 'upload_video' });
  const params = (video: string) => ({ chat_id: chat, video, caption: v.caption, parse_mode: 'HTML', supports_streaming: true, width: 1080, height: 1920, duration: v.dur, reply_markup: markup });
  let r: any = cached ? await tg(token, 'sendVideo', params(cached)) : null;
  if (!r || !r.ok) {
    r = await tg(token, 'sendVideo', params(VIDEO_BASE + v.file + '?v=2'));
    const fid = r && r.ok && r.result && r.result.video && r.result.video.file_id;
    if (fid) await setSecret(key, fid);
  }
  if (!r || !r.ok) { console.error('sendVideo', r && r.description); await send(token, chat, v.caption + '\n\n▶️ Videoni ochish: ' + VIDEO_BASE + v.file, { reply_markup: markup }); }
}

function nav(key: string) {
  const rows: any[] = [...videoRows()];
  const list = TOPICS.filter(([k]) => k !== key);
  for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2).map(([k, l]) => ({ text: l, callback_data: 'g:' + k })));
  if (key === 'hamyon') rows.unshift([{ text: '👛 Hamyonni ochish', callback_data: 'w:home' }, { text: '🎬 Hisobchi darsi', callback_data: 'v:5' }]);
  if (key !== 'menu') rows.push([{ text: '📖 Mundarija', callback_data: 'g:menu' }]);
  return { inline_keyboard: rows };
}

export const guideBtn = { inline_keyboard: [[{ text: '📖 Qoʻllanmani ochish', callback_data: 'g:menu' }], [{ text: '🎬 Video darsliklar', callback_data: 'v:menu' }], [{ text: '👛 Hamyon nazorat — bepul', callback_data: 'w:home' }]] };

// yangi foydalanuvchi /start bosganda — birinchi xabar
export const WELCOME =
  '👋 <b>Assalomu alaykum! Bu — Minimarket POS boti.</b>\n\n' +
  'Doʻkoningiz uchun: <b>kassa (savdo)</b>, <b>ombor</b> (tovar qoldigʻi), <b>qarz daftari</b> va <b>hisobotlar</b> — hammasi telefonda, parolsiz.\n\n' +
  '<b>Qanday boshlanadi — 3 qadam:</b>\n' +
  '1️⃣ Pastdagi <b>«📱 Telefon raqamni yuborish»</b> tugmasini bosing.\n' +
  '2️⃣ Doʻkoningiz nomini yozing.\n' +
  '3️⃣ <b>«📱 Ilovani ochish»</b> — ilova ochiladi, savdoni boshlaysiz.\n\n' +
  '🎁 Birinchi 30 kun — <b>bepul</b>.\n\n' +
  '👛 <b>Hamyon nazorat</b> — shaxsiy kunlik xarajatlaringizni hisoblab boradi. Roʻyxatdan oʻtmasdan ham, bepul ishlaydi.\n\n' +
  'Ilovada nima qanday ishlashini bilish uchun — <b>📖 Qoʻllanma</b> (yozma) yoki <b>🎬 Video darslik</b> (pastdagi tugmalar).';

export async function sendGuide(token: string, chat: number, key = 'menu') {
  const k = PAGES[key] ? key : 'menu';
  await send(token, chat, PAGES[k], { reply_markup: nav(k) });
}
// callback g:<bo'lim> — shu xabarning o'zida bo'lim almashadi
export async function guideCallback(token: string, cq: any, key: string) {
  const k = PAGES[key] ? key : 'menu';
  const r: any = await tg(token, 'editMessageText', { chat_id: cq.message.chat.id, message_id: cq.message.message_id, text: PAGES[k], parse_mode: 'HTML', reply_markup: nav(k), disable_web_page_preview: true });
  if (!r || (!r.ok && !/not modified/.test(String(r.description || '')))) await sendGuide(token, cq.message.chat.id, k);
  await tg(token, 'answerCallbackQuery', { callback_query_id: cq.id });
}
