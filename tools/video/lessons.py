# Video darsliklar ssenariysi: har bir sahna = (sarlavha, harakatlar). Sahnalar soni tools/tts/<dars>.json qatorlari bilan teng.
# Sahna ichidagi harakatlar ovoz davomida bajariladi (sahna ovoz tugaguncha davom etadi).

def card(logo, title, sub, items, foot=None, done=False):
    li = ''.join('<div class="li%s"><span class="n">%s</span><span>%s</span></div>' % (' ok' if done else '', '✓' if done else i + 1, t) for i, t in enumerate(items))
    return ('<div class="ch"><div class="lg">%s</div><div><div class="t">%s</div><div class="s">%s</div></div></div><div style="height:6px"></div>%s%s'
            % (logo, title, sub, li, '<div class="foot">%s</div>' % foot if foot else ''))

async def show_card(c, html, n=4, gap=650, first=900):
    await c.js('h => S.card(h)', html); await c.wait(first)
    for i in range(n):
        await c.js('i => S.cardItem(i)', i); await c.wait(gap)

OWNER_KB = [['📊 Bugun', '📅 Kecha'], ['🗓 Hafta', '📆 Oy'], ['📦 Ombor', '📒 Qarzlar', '🏆 Top tovarlar'], ['👥 Kassir taklif qilish', '💳 Obuna'], ['👛 Hamyon nazorat']]
STAFF_KB = [['📊 Bugun', '📅 Kecha'], ['🗓 Hafta', '📆 Oy'], ['📦 Ombor', '📒 Qarzlar', '🏆 Top tovarlar'], ['💳 Obuna', '👛 Hamyon nazorat']]

async def phone_tg(c, kb=None, menu=True, msgs=None):
    await c.js('S.phone(true)'); await c.tg_open(); await c.wait(300)
    await c.tg('m => TG.menu(m)', menu)
    for m in msgs or []: await c.tg('h => TG.bot(h)', m)
    if kb: await c.tg('k => TG.kb(k)', kb)

async def mark(c, text, up=1, id='vk'):
    """matni shu so'z bilan boshlanadigan ko'rinadigan element (yoki uning up-darajali ota-elementi)ga id beradi"""
    for _ in range(6):
        ok = await c.fr().evaluate("""([t, up, id]) => { const o = document.getElementById(id); if (o) o.removeAttribute('id'); t = t.toLowerCase();
          const el = [...document.querySelectorAll('#main *, #modal-root *')].filter((e) => e.children.length === 0 && e.textContent.trim().toLowerCase().startsWith(t) && e.getClientRects().length)[0];
          if (!el) return false; let b = el; for (let i = 0; i < up; i++) b = b.parentElement || b; b.id = id; return true; }""", [text, up, id])
        if ok: return '#' + id
        await c.wait(300)
    return None

async def ring_text(c, text, up=1, pad=6, hold=1800):
    sel = await mark(c, text, up)
    if sel: await c.ring(sel, pad=pad); await c.wait(hold); await c.unring()
    else: print('   topilmadi:', text)

async def bot(c, html, rows=None, wait=700):
    await c.wait(350); await c.tg('a => TG.bot(a[0], a[1])', [html, rows]); await c.wait(wait)

# ======================================================================= 1-dars: noldan boshlash
async def d1_1(c):
    await show_card(c, card('M', 'Noldan boshlash', 'Minimarket POS · 1-dars', [
        'Telegram botda <b>roʻyxatdan oʻtish</b> — parolsiz', '<b>«Ilovalar»</b> → Minimarket POS', '<b>Tovar qoʻshish</b>: narx va qoldiq', '<b>Birinchi savdo</b> va chek'],
        '🎁 Birinchi 30 kun — bepul'), 4, gap=1100)

async def d1_2(c):
    await phone_tg(c, kb=[['BOSHLASH']], menu=False)
    await c.wait(600); await c.tg_tap_kb('BOSHLASH', after=200)
    await c.tg('() => { TG.kb(null); TG.me("/start"); }')
    await bot(c, '👋 <b>Assalomu alaykum! Bu — Minimarket POS boti.</b><br><br>Doʻkoningiz uchun: <b>kassa</b>, <b>ombor</b>, <b>qarz daftari</b> va <b>hisobotlar</b> — hammasi telefonda, parolsiz.<br><br>🎁 Birinchi 30 kun — <b>bepul</b>.', wait=500)
    await bot(c, '👇 Boshlash uchun telefon raqamingizni yuboring:')
    await c.tg('k => TG.kb(k)', [['📱 Telefon raqamni yuborish'], ['👛 Hamyon nazorat']])
    await c.wait(1200)
    await c.tg_tap_kb('📱 Telefon raqamni yuborish', after=200)
    await c.tg('() => { TG.kb(null); TG.contact("Javohir", "+998 97 662 01 98"); }')

async def d1_3(c):
    await bot(c, 'Rahmat! Endi <b>doʻkoningiz nomini</b> yozing (masalan: Baraka market).', wait=900)
    await c.tg_type_send('Baraka market')
    await bot(c, '🎉 <b>Baraka market</b> doʻkoni ochildi!<br><br><b>30 kun bepul</b> — keyin «💳 Obuna» orqali toʻlaysiz. Pastdagi tugmalar — hisobotlar, «👥 Kassir taklif qilish» — xodim qoʻshish.', wait=300)
    await c.tg('k => TG.kb(k)', OWNER_KB)
    await c.tg('() => TG.menu(true)')
    await c.off()

async def d1_4(c):
    await c.wait(300)
    await c.open_app('pos')
    await c.ring('#topbar'); await c.wait(1200); await c.off()

async def d1_5(c):
    await c.tap('#bnav [data-tab=ombor]', after=600)
    await c.tap('#o-new', ring=True, after=700)
    await c.type('#p-name', 'Coca-Cola 1,5 litr')
    await c.type('#p-cat', 'Ichimliklar')
    await c.fr().evaluate("() => document.activeElement && document.activeElement.blur()")
    await c.type('#p-cost', '9500')

async def d1_6(c):
    await c.tap('#modal-root button:has-text("+20%")', ring=True, after=300)
    await c.ring('#p-price'); await c.wait(1300); await c.unring()
    await c.type('#p-stock', '24')
    await c.tap('#p-save', ring=True, after=600)
    await c.off()

async def d1_7(c):
    await c.tap('#bnav [data-tab=kassa]', after=700)
    await c.tap('.tile', after=500)
    await c.tap('.tile', after=500)
    await c.ring('#cartbar-btn'); await c.wait(900)

async def d1_8(c):
    await c.tap('#cartbar-btn', after=800)
    await c.tap('.paybtn:has-text("Naqd")', after=500)
    await c.tap('#k-checkout', ring=True, after=1500)
    await c.off()

async def d1_9(c):
    await show_card(c, card('M', 'Tayyor!', 'Siz hozir oʻrgandingiz', [
        'Botda roʻyxatdan oʻtdingiz — <b>parolsiz</b>', '<b>«Ilovalar»</b> → Minimarket POS', 'Tovar qoʻshdingiz: <b>9 500 → 11 400 soʻm</b>', 'Birinchi savdo — chek tayyor'],
        'Keyingi darslar: foyda · kassir · qaytarish', done=True), 4, gap=900)

# ======================================================================= 2-dars: narx, ustama va foyda
async def d2_1(c):
    await show_card(c, card('M', 'Narx, ustama va foyda', 'Minimarket POS · 2-dars', [
        '<b>Kelish narxi + ustama</b> = sotish narxi', '<b>Kirim qilish</b> — yangi partiya', 'Har bir chekning <b>foydasi</b>', '<b>Xarajatlar</b> va <b>sof foyda</b>']), 4, gap=1000)

async def d2_2(c):
    await c.js('S.phone(true)'); await c.load('index.html'); await c.wait(400)
    await c.tap('#bnav [data-tab=ombor]', after=500)
    await c.tap('#o-new', after=600)
    await c.type('#p-name', 'Pepsi 1 litr')
    await c.type('#p-cost', '9000', ring=True); await c.unring()
    await c.type('#p-pct', '20', ring=True); await c.unring()
    await c.ring('#p-price'); await c.wait(1500); await c.unring()

async def d2_3(c):
    await c.tap('#modal-root button:has-text("+25%")', after=900)
    await c.tap('#modal-root button:has-text("+20%")', after=500)
    await ring_text(c, 'Har biridan foyda', up=2, hold=2200)
    await c.type('#p-stock', '30')
    await c.tap('#p-save', ring=True, after=400)
    await c.off()

async def d2_4(c):
    await c.tap('#o-prix', ring=True, after=700)
    await c.point('#iv-sup')
    await c.fr().select_option('#iv-sup', label='Coca-Cola Ichimliklar'); await c.wait(500)
    await c.type('#iv-q', 'coca')
    await c.tap('#modal-root button:has-text("Coca-Cola 1,5 litr")', after=600)
    await c.page.keyboard.type('48', delay=120); await c.wait(400)

async def d2_5(c):
    await c.type('#iv-paid', '300000', ring=True); await c.unring()
    await c.wait(600)
    await c.tap('#iv-ok', ring=True, after=900)
    await c.off()

async def d2_6(c):
    await c.tap('#bnav [data-tab=kassa]', after=600)
    await c.tap('.tile:has-text("Coca-Cola")', after=400)
    await c.tap('.tile:has-text("Non (patir)")', after=400)
    await c.tap('#cartbar-btn', after=900)
    await ring_text(c, 'Taxminiy foyda', up=1, pad=8, hold=2200); await c.off()

async def d2_7(c):
    await c.tap('#bn-more', after=350)
    await c.tap('#modal-root [data-tab=xarajat]', after=500)
    await c.tap('#main [data-ec="Elektr/Gaz"]', after=200)
    await c.type('#e-a', '380000', delay=60)
    await c.tap('#e-ok', ring=True, after=400)
    await c.off()

async def d2_8(c):
    await c.tap('#bn-more', after=600)
    await c.tap('#modal-root [data-tab=moliya]', after=900)
    await c.tap('#main button:text-is("Oy")', after=800)
    await ring_text(c, 'SOF FOYDA', up=2, pad=4, hold=2600); await c.off()

# ======================================================================= 3-dars: kassir taklif qilish
STAFF_TABS = [('bosh', 'Bosh sahifa'), ('ombor', 'Mahsulotlar'), ('qarz', 'Qarzdorlar'), ('xarajat', 'Xarajatlar'), ('moliya', 'Hisobotlar va foyda'), ('sozlama', 'Sozlamalar')]
def staff_card(on, joined=False):
    txt = ('👤 <b>Kassir 1</b><br>Holati: ' + ('✅ ulangan (Aziz)' if joined else '⏳ hali taklif havolasi olinmagan') + '<br><br><b>Ilovada ochiq boʻlimlar</b> (tugmani bosib yoqing / oʻchiring):<br>'
           '🔒 Savdo — doim ochiq<br>🔒 Tovar kirimi — doim ochiq<br>' + '<br>'.join(('✅ ' if t in on else '⬜ ') + l for t, l in STAFF_TABS))
    rows = [[[('✅ ' if t in on else '⬜ ') + l, 'sp:' + t] for t, l in STAFF_TABS[i:i + 2]] for i in range(0, 6, 2)]
    rows += [[['🔗 Taklif havolasini olish', 'si']], [['✏️ Nomini oʻzgartirish', 'sr'], ['🗑 Oʻchirish', 'sd']], [['⬅️ Xodimlar roʻyxati', 'sl']]]
    return txt, rows

async def d3_1(c):
    await show_card(c, card('M', 'Kassir taklif qilish', 'Minimarket POS · 3-dars', [
        'Botda <b>«👥 Kassir taklif qilish»</b>', 'Xodimga nom bering — <b>Kassir 1</b>', 'Unga ochiq <b>boʻlimlarni</b> belgilang', '<b>Taklif havolasini</b> xodimga yuboring'],
        '🔒 Savdo va Tovar kirimi — doim ochiq'), 4, gap=1300)

async def d3_2(c):
    await phone_tg(c, kb=OWNER_KB, msgs=['📊 <b>Baraka market</b><br>🗓 Bugun<br><br>💰 Tushum: <b>1 245 000</b> soʻm<br>🧾 Cheklar: 38 ta<br>✅ <b>Sof foyda: 214 300</b> soʻm'])
    await c.wait(500)
    await c.tg_tap_kb('👥 Kassir taklif qilish', after=200)
    await c.tg('() => TG.me("👥 Kassir taklif qilish")')
    await bot(c, '👥 <b>Xodimlar — Baraka market</b><br><br>Hali xodim yoʻq.<br><br><i>Xodim ilovaga oʻz Telegrami orqali alohida kiradi. Savdo va Tovar kirimi unga doim ochiq, qolgan boʻlimlarni siz ochib berasiz.</i>', [[['➕ Kassir taklif qilish', 'sa']]])

async def d3_3(c):
    await c.tap('.ik button[data-b="sa"]', after=200)
    await bot(c, '➕ <b>Yangi xodim</b><br><br>Xodimga nom bering — masalan: <b>Kassir 1</b>, <b>Kassir 2</b>, <b>Menejer</b>.<br><br>Nomni shu yerga yozing:', wait=400)
    await c.tg('() => TG.kb(null)')
    await c.tg_type_send('Kassir 1')
    t, r = staff_card([])
    await bot(c, '✅ <b>Kassir 1</b> qoʻshildi. Endi unga qaysi boʻlimlar ochiq boʻlishini belgilang va taklif havolasini oling:', wait=200)
    await bot(c, t, r)
    await c.off()

async def d3_4(c):
    on = []
    for tab in ['ombor', 'qarz']:
        await c.tap('.ik button[data-b="sp:%s"]' % tab, after=150)
        on.append(tab); t, r = staff_card(on); await c.tg('a => TG.editLast(a[0], a[1])', [t, r]); await c.wait(700)
    await c.off()

async def d3_5(c):
    await c.ring('.ik button[data-b="sp:moliya"]', pad=4); await c.wait(3500); await c.unring()

async def d3_6(c):
    await c.tap('.ik button[data-b="si"]', after=200)
    await bot(c, '🔗 <b>Kassir 1</b> uchun taklif havolasi:<br><br><a>https://t.me/minimarketkassabot?start=st_9F3A61C0027B4E85</a><br><br>Shu havolani xodimga yuboring. U havolani ochib «Start»ni bossa — doʻkoningizga <b>Kassir 1</b> sifatida ulanadi.<br><br>⏳ 24 soat amal qiladi, faqat bir marta ishlaydi.', [[['📤 Xodimga yuborish', 'share']]])
    await c.ring('.ik button[data-b="share"]'); await c.wait(1500); await c.off()

async def d3_7(c):
    # xodimning telefoni
    await c.tg('() => { TG.clear(); TG.kb([["BOSHLASH"]]); TG.menu(false); }'); await c.wait(500)
    await c.tg_tap_kb('BOSHLASH', after=200)
    await c.tg('() => { TG.kb(null); TG.me("/start"); }')
    await bot(c, '✅ <b>Baraka market</b> doʻkoniga <b>Kassir 1</b> sifatida ulandingiz.<br><br><b>Ilovaga kirish:</b> chap pastdagi <b>«Ilovalar»</b> tugmasi → <b>Minimarket POS</b>.<br><br>Ilovada sizga Savdo, Tovar kirimi va doʻkon egasi ochib bergan boʻlimlar koʻrinadi.', wait=200)
    await c.tg('k => { TG.kb(k); TG.menu(true); }', STAFF_KB)
    await c.wait(400)
    await c.js("h => S.notify(h)", '✅ <b>Kassir 1</b> doʻkoningizga ulandi (Aziz).')
    await c.wait(2600); await c.js('S.notify(null)')

async def cashier_view(c):
    # kassir ko'rinishi: Bosh sahifa yo'q, Savdo ochiladi (ruxsat berilmagan bo'limlar ko'rinmaydi)
    await c.fr().add_style_tag(content='#bnav [data-tab=bosh], #nav [data-tab=bosh] { display: none !important; } #bnav { grid-template-columns: repeat(4, 1fr) !important; }')
    await c.fr().evaluate("() => document.querySelector('#bnav [data-tab=kassa]').click()")

async def d3_8(c):
    await c.open_app('pos', prep=cashier_view)
    await c.ring('#bnav', pad=2); await c.wait(1800); await c.unring()
    await c.tap('.tile', after=300); await c.off()

async def d3_9(c):
    await show_card(c, card('M', 'Xulosa', 'Kassir qoʻshish — 1 daqiqalik ish', [
        '<b>«👥 Kassir taklif qilish»</b> → nom berasiz', 'Boʻlimlarni belgilaysiz: ✅ ochiq / ⬜ yopiq', '<b>Taklif havolasi</b> → xodim «Boshlash»ni bosadi', 'Xodim <b>«Ilovalar»</b> orqali oʻz Telegrami bilan kiradi'],
        'Kassirlar soni cheklanmagan', done=True), 4, gap=900)

# ======================================================================= 4-dars: tovar qaytarish
async def d4_1(c):
    await show_card(c, card('M', 'Tovar qaytarish', 'Minimarket POS · 4-dars', [
        '<b>Savdo</b> → «Tovar qaytarish»', 'Tovarni <b>skanerlang</b> yoki nomini yozing', 'Ilova <b>chekni oʻzi topadi</b>', 'Pul qanday qaytgani va <b>sababi</b>'],
        'Hammaga, kassirga ham ochiq'), 4, gap=900)

async def d4_2(c):
    await c.js('S.phone(true)'); await c.load('index.html'); await c.wait(400)
    await c.tap('#bnav [data-tab=kassa]', after=600)
    await c.tap('#k-ret', ring=True, after=600)

async def d4_3(c):
    await c.type('#qr-q', 'coca', ring=True); await c.unring()
    await c.wait(700)
    await c.ring('[data-qp]'); await c.wait(900); await c.unring()

async def d4_4(c):
    await c.tap('[data-qp]', after=900)
    await c.ring('[data-qs]', pad=4); await c.wait(1200)
    await c.tap('[data-qs]', after=900)
    await c.ring('#modal-root input[data-rq], #modal-root input#rq', pad=4); await c.wait(1500); await c.off()

async def d4_5(c):
    await c.point('#rt-m', ring=True); await c.wait(900)
    await c.point('#rt-r', ring=True); await c.wait(900); await c.unring()
    await c.tap('#rt-ok', ring=True, after=1200)
    await c.off()

async def d4_6(c):
    await c.wait(400)
    try:
        await c.tap('#main button:has-text("Sotuvlar tarixi")', after=1000)
        await ring_text(c, 'qaytarilgan', up=0, pad=6, hold=2200)
    except Exception as e: print('   d4_6', str(e)[:120])
    await c.off()

async def d4_7(c):
    await c.js("h => S.notify(h)", '↩️ <b>Qaytarish</b> — Baraka market<br>Coca-Cola 1,5 litr × 1 · −12 000 soʻm (naqd)')
    await c.wait(2600); await c.js('S.notify(null)'); await c.wait(300)
    await show_card(c, card('M', 'Xulosa', 'Qaytarish toʻgʻri hisoblanadi', [
        'Tovar <b>omborga</b> qaytdi', 'Pul <b>tushumdan</b> ayrildi', 'Chekda <b>«qaytarilgan»</b> belgisi', 'Egasiga <b>Telegramda</b> xabar'], done=True), 4, gap=900)

# ======================================================================= 5-dars: Hisobchi
async def d5_1(c):
    await show_card(c, card('H', 'Hisobchi', 'Shaxsiy hisob-kitob · bepul', [
        '<b>Kirim va chiqim</b> — bir tugma bilan', '<b>Tez yozish</b>: «taksi 25 ming»', '<b>Qarz berdim / oldim</b> — qarz daftari', '<b>Hisobot</b>, toifalar va byudjet'],
        '🎁 Hisobchi — bepul'), 4, gap=1100)

async def d5_2(c):
    await phone_tg(c, kb=OWNER_KB, msgs=['👛 <b>Hamyon nazorat</b> — bugun<br><br>📉 Sarflandi: <b>146 000</b> soʻm<br>📈 Tushdi: 0<br>💰 Balans: <b>3 210 000</b> soʻm'])
    await c.wait(500)
    await c.open_app('hb')

async def d5_3(c):
    await c.tap('[data-new=out]', ring=True, after=600)
    await c.type('#f-amt', '45000')
    await c.type('#f-note', 'tushlik')
    await c.tap('[data-cat=ovqat]', after=500)
    await c.tap('[data-save]', ring=True, after=900)
    await c.off()

async def d5_4(c):
    await c.type('#q-in', 'taksi 25 ming', ring=True); await c.unring()
    await c.tap('#quick button', after=1600)
    await c.type('#q-in', '+5 mln oylik')
    await c.tap('#quick button', after=1200)
    await c.off()

async def d5_5(c):
    await c.tap('[data-newdebt=me]', ring=True, after=600)
    await c.type('#d-name', 'Alisher')
    await c.type('#d-amt', '300000')
    await c.tap('[data-save]', ring=True, after=1000)
    await c.off()

async def d5_6(c):
    await c.tap('#bnav [data-tab=debt]', after=700)
    await c.tap('[data-debt]', after=900)
    await c.type('#p-amt', '100000', ring=True); await c.unring()
    await c.tap('[data-pay]', after=1300)
    await c.ring('[data-close-debt]'); await c.wait(1600); await c.off()

async def d5_7(c):
    await c.tap('[data-close]', after=400)
    await c.tap('#bnav [data-tab=rep]', after=900)
    await c.scroll_to('.bars'); await c.ring('.bars', pad=10); await c.wait(1800); await c.unring()
    await c.scroll_to('[data-budget=""]'); await c.ring('[data-budget=""]'); await c.wait(1400); await c.off()

async def d5_8(c):
    await show_card(c, card('H', 'Xulosa', 'Pulingiz doim nazoratda', [
        '<b>«Ilovalar»</b> → Hisobchi', 'Chiqim, kirim va <b>tez yozish</b>', '<b>Qarz daftari</b> — kim qancha qaytardi', '<b>Hisobot</b> va oylik limitlar'],
        'Botdagi «👛 Hamyon nazorat» bilan bir xil maʼlumot', done=True), 4, gap=900)

LESSONS = {
    'dars1': {'file': 'minimarket-boshlash', 'brand': 'Minimarket POS · 1-dars', 'db': 'empty', 'scenes': [
        ('Boshlash', d1_1), ('Roʻyxatdan oʻtish', d1_2), ('Doʻkon nomi', d1_3), ('Ilovani ochish', d1_4), ('Tovar qoʻshish', d1_5),
        ('Narx va qoldiq', d1_6), ('Sotish', d1_7), ('Toʻlov va chek', d1_8), ('Xulosa', d1_9)]},
    'dars2': {'file': 'minimarket-qollanma', 'brand': 'Minimarket POS · 2-dars', 'scenes': [
        ('Narx, ustama, foyda', d2_1), ('Ustama', d2_2), ('Foyda hisobi', d2_3), ('Kirim qilish', d2_4), ('Taʼminotchiga toʻlov', d2_5),
        ('Chek foydasi', d2_6), ('Xarajatlar', d2_7), ('Hisobotlar', d2_8)]},
    'dars3': {'file': 'minimarket-kassir', 'brand': 'Minimarket POS · 3-dars', 'scenes': [
        ('Kassir taklif qilish', d3_1), ('Botda tugmani bosing', d3_2), ('Xodimga nom bering', d3_3), ('Boʻlimlarni belgilang', d3_4), ('Foyda yashirin qoladi', d3_5),
        ('Taklif havolasi', d3_6), ('Xodim ulanadi', d3_7), ('Xodim ilovasi', d3_8), ('Xulosa', d3_9)]},
    'dars4': {'file': 'minimarket-qaytarish', 'brand': 'Minimarket POS · 4-dars', 'scenes': [
        ('Tovar qaytarish', d4_1), ('Qaytarish tugmasi', d4_2), ('Tovarni toping', d4_3), ('Chek oʻzi topiladi', d4_4), ('Pul va sabab', d4_5),
        ('Tayyor', d4_6), ('Xulosa', d4_7)]},
    'dars5': {'file': 'hisobchi', 'brand': 'Hisobchi · 5-dars', 'hb': True, 'scenes': [
        ('Hisobchi', d5_1), ('Ilovani ochish', d5_2), ('Chiqim yozish', d5_3), ('Tez yozish', d5_4), ('Qarz berdim / oldim', d5_5),
        ('Qarz qaytdi', d5_6), ('Hisobot', d5_7), ('Xulosa', d5_8)]},
}

# ======================================================================= 6-dars: Ishlab chiqarish
async def d6_1(c):
    await show_card(c, card('IC', 'Ishlab chiqarish', 'Pishiriq va boshqa ishlab chiqaruvchilar · bepul', [
        '<b>Xomashyo</b>: nechta va qanchadan olindi', '<b>Sotuv</b>: necha kg yoki dona sotildi', '<b>Xarajatlar</b>: gaz, ijara, ish haqi', '<b>Oylik foyda-ziyon</b> va tannarx'],
        '🎁 Ilova — bepul'), 4, gap=1300)

async def d6_2(c):
    await phone_tg(c, kb=OWNER_KB)
    await c.wait(600)
    await c.open_app('ic')

async def d6_3(c):
    await c.tap('[data-new=buy]', ring=True, after=700)
    await c.tap('.catb:has-text("Un")', after=400)
    await c.type('#f-qty', '50', ring=True); await c.unring()
    await c.wait(300); await c.ring('#f-amt', pad=6); await c.wait(1500); await c.unring()
    await c.tap('[data-save]', ring=True, after=900)
    await c.off()

async def d6_4(c):
    await c.tap('[data-new=sale]', ring=True, after=700)
    await c.tap('.catb:has-text("Pechenye")', after=400)
    await c.type('#f-qty', '12', ring=True); await c.unring()
    await c.wait(500)
    await c.tap('[data-save]', ring=True, after=900)
    await c.off()

async def d6_5(c):
    await c.tap('[data-new=sale]', after=500)
    await c.tap('.catb:has-text("Tort")', after=200)
    await c.type('#f-qty', '2,5', delay=60)
    await c.tap('[data-credit="1"]', ring=True, after=300)
    await c.type('#f-cust', 'Baraka doʻkoni', delay=40)
    await c.type('#f-paid', '100000', delay=60)
    await c.tap('[data-save]', after=700)
    await c.off()

async def d6_6(c):
    await c.tap('[data-new=exp]', ring=True, after=700)
    await c.tap('.catb:has-text("Gaz")', after=300)
    await c.type('#f-amt', '900000', ring=True); await c.unring()
    await c.tap('[data-save]', ring=True, after=900)
    await c.off()

async def d6_7(c):
    await c.tap('#bnav [data-tab=rep]', after=900)
    await c.off()
    await ring_text(c, 'Foyda-ziyon hisobi', up=2, pad=4, hold=3200)
    await c.js("() => { const m = document.getElementById('fr').contentDocument.getElementById('main'); m.scrollTo({ top: 0, behavior: 'smooth' }); }"); await c.wait(800)
    await ring_text(c, 'Tushum', up=2, pad=4, hold=1500)
    await ring_text(c, 'Oy oxiriga', up=2, pad=4, hold=1800)

async def d6_8(c):
    await c.tap('#bnav [data-tab=home]', after=900)
    await c.off()
    sel = await mark(c, '1 kg tannarxi', up=2)
    if sel:
        await c.fr().evaluate("() => document.getElementById('vk').scrollIntoView({ block: 'center' })"); await c.wait(500)
        await c.ring(sel, pad=4); await c.wait(2600); await c.unring()
    else: print('   topilmadi: tannarx')
    await c.tap('[data-debts]', ring=True, after=1200)
    await c.ring('[data-payall]'); await c.wait(1500); await c.off()

async def d6_9(c):
    await show_card(c, card('IC', 'Xulosa', 'Foyda-ziyon doim koʻz oldingizda', [
        '<b>«Ilovalar»</b> → Ishlab chiqarish', '<b>Xomashyo</b> va <b>xarajat</b> yozing', '<b>Sotuv</b>: naqd yoki qarzga', '<b>Foyda-ziyon</b> oʻzi hisoblanadi'],
        'Hisobchi va Minimarketdan alohida, bepul', done=True), 4, gap=900)

LESSONS['dars6'] = {'file': 'ishlab', 'brand': 'Ishlab chiqarish · 6-dars', 'ic': True, 'scenes': [
    ('Ishlab chiqarish', d6_1), ('Ilovani ochish', d6_2), ('Xomashyo oldim', d6_3), ('Sotdim', d6_4), ('Qarzga sotish', d6_5),
    ('Xarajat', d6_6), ('Foyda-ziyon', d6_7), ('Tannarx va qarzlar', d6_8), ('Xulosa', d6_9)]}
