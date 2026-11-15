#!/usr/bin/env python3
"""Video darsliklarni yig'ish: Playwright sahna (stage.html) + haqiqiy ilova + Madina ovozi (tools/tts -> GitHub Actions).

Ishlatish:
  python3 tools/video/make.py dars1 [dars2 ...]  --tts /yo'l/tts  --out /yo'l/natija
  (tts papkasida dars1/01.mp3, 01.srt ... bo'ladi — «Video ovozi (TTS)» workflow'i natijasi, tts/<nom> shoxi)

Sahna 540x960 CSS piksel (DPR 2 -> 1080x1920). Kadrlar Chrome screencast orqali yoziladi, ovoz sahna vaqtiga qo'yiladi.
"""
import argparse, asyncio, base64, json, os, random, re, shutil, subprocess, sys, threading, time, functools, http.server
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DOCS = os.path.join(REPO, 'docs')
DAY = 864e5
TZ = 5 * 3600e3

# ---------------------------------------------------------------- mahalliy server (ilova + sahna bir manbada)
def build_site(root):
    if os.path.exists(root): shutil.rmtree(root)
    os.makedirs(root)
    s = open(os.path.join(DOCS, 'index.html'), encoding='utf-8').read()
    s = re.sub(r'/\*CLOUD_CFG\*/.*?/\*END\*/', '/*CLOUD_CFG*/null/*END*/', s, flags=re.S)  # serversiz (shu qurilmada) rejim
    open(os.path.join(root, 'index.html'), 'w', encoding='utf-8').write(s)
    for d in ('hisobchi', 'ilovalar', 'ishlab'): shutil.copytree(os.path.join(DOCS, d), os.path.join(root, d))
    for f in ('favicon.png', 'icon-192.png', 'icon-512.png', 'manifest.webmanifest'): shutil.copy(os.path.join(DOCS, f), root)
    for f in ('stage.html', 'tg.html'): shutil.copy(os.path.join(HERE, f), root)

class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

def serve(root, port):
    h = functools.partial(_Quiet, directory=root)
    srv = http.server.ThreadingHTTPServer(('127.0.0.1', port), h)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    return srv

# ---------------------------------------------------------------- namunaviy ma'lumotlar
def now_ms(): return int(time.time() * 1000)
def day_ts(days_ago, hour, minute=0):
    t = now_ms() + TZ; d0 = t - t % DAY
    return int(d0 - days_ago * DAY + (hour * 60 + minute) * 60e3 - TZ)

PRODUCTS = [
    ('pnon', 'Non (patir)', '4780000000011', 'Non mahsulotlari', 'dona', 3000, 4000, 46, 10),
    ('pcola', 'Coca-Cola 1,5 litr', '5449000000439', 'Ichimliklar', 'dona', 9500, 12000, 24, 8),
    ('pfanta', 'Fanta 1,5 litr', '5449000011527', 'Ichimliklar', 'dona', 9000, 11500, 18, 6),
    ('psuv', 'Suv «Hydrolife» 1 litr', '4780000000101', 'Ichimliklar', 'dona', 2500, 3500, 60, 12),
    ('pshakar', 'Shakar', '4780000000028', 'Bakaleya', 'kg', 11500, 13500, 25, 5),
    ('pguruch', 'Guruch (lazer)', '4780000000059', 'Bakaleya', 'kg', 17000, 20000, 30, 10),
    ('pyog', "Paxta yog'i 1 litr", '4780000000035', 'Bakaleya', 'dona', 19000, 23000, 18, 6),
    ('pchoy', 'Choy «Ahmad» 100 g', '4780000000118', 'Bakaleya', 'dona', 18000, 22000, 14, 4),
    ('psut', 'Sut 1 litr', '4780000000125', 'Sut mahsulotlari', 'dona', 9000, 11000, 16, 6),
    ('ptuxum', 'Tuxum', '4780000000066', 'Sut mahsulotlari', 'dona', 1300, 1600, 90, 30),
    ('pqatiq', 'Qatiq 0,5 litr', '4780000000132', 'Sut mahsulotlari', 'dona', 6500, 8000, 12, 4),
    ('psnick', 'Snickers 50 g', '5000159461122', 'Shirinliklar', 'dona', 7000, 9000, 30, 8),
    ('ppech', 'Pechenye «Yubileynoe»', '4600000000149', 'Shirinliklar', 'dona', 8000, 10000, 20, 5),
    ('pkukun', 'Kir yuvish kukuni 3 kg', '4780000000156', 'Maishiy kimyo', 'dona', 38000, 45000, 8, 2),
]

def pos_db(kind):
    """kind: 'empty' — yangi do'kon; 'demo' — 30 kunlik savdo tarixi bilan"""
    db = {'v': 1, 'names': {}, 'settings': {'shopName': 'Baraka market'}, 'products': [], 'customers': [], 'suppliers': [], 'sales': [],
          'moves': [], 'expenses': [], 'ledger': [], 'shifts': [], 'cashops': [], 'returns': [], 'counts': [], 'audit': [], 'seq': 1}
    if kind == 'empty': return db
    rnd = random.Random(11)
    t0 = day_ts(40, 9)
    db['products'] = [dict(id=i, name=n, barcode=b, category=c, unit=u, cost=co, price=pr, stock=st, min=mi, created=t0) for i, n, b, c, u, co, pr, st, mi in PRODUCTS]
    db['customers'] = [{'id': 'cdil', 'name': 'Dilnoza opa', 'phone': '+998 90 123 45 67', 'created': t0}, {'id': 'csar', 'name': 'Sardor aka', 'phone': '+998 93 555 12 12', 'created': t0}]
    db['suppliers'] = [{'id': 'scola', 'name': 'Coca-Cola Ichimliklar', 'phone': '+998 71 200 00 00', 'created': t0}, {'id': 'sopt', 'name': 'Optom ombor', 'phone': '+998 90 777 00 11', 'created': t0}]
    P = {p['id']: p for p in db['products']}
    weights = {'pnon': 9, 'pcola': 5, 'pfanta': 3, 'psuv': 5, 'pshakar': 3, 'pguruch': 2, 'pyog': 2, 'pchoy': 2, 'psut': 4, 'ptuxum': 4, 'pqatiq': 2, 'psnick': 3, 'ppech': 2, 'pkukun': 1}
    ids = list(weights); w = [weights[i] for i in ids]
    for d in range(30, -1, -1):
        n = rnd.randint(30, 44) if d else 18
        for _ in range(n):
            h = rnd.randint(8, 20) if d else rnd.randint(8, 12)
            ts = day_ts(d, h, rnd.randint(0, 59))
            items = []
            for pid in set(rnd.choices(ids, w, k=rnd.randint(1, 4))):
                p = P[pid]; q = rnd.choice([1, 1, 1, 2, 2, 3]) if p['unit'] == 'dona' else rnd.choice([1, 2, 3])
                if pid == 'ptuxum': q = rnd.choice([10, 10, 15, 30])
                items.append({'pid': pid, 'name': p['name'], 'unit': p['unit'], 'qty': q, 'price': p['price'], 'cost': p['cost'], 'sum': q * p['price'], 'disc': 0})
            tot = sum(x['sum'] for x in items); cost = sum(x['qty'] * x['cost'] for x in items)
            pay = rnd.choices(['naqd', 'karta', 'qarz'], [6, 3, 1])[0]
            s = {'id': 's%d' % len(db['sales']), 'no': db['seq'], 'ts': ts, 'items': items, 'subtotal': tot, 'discount': 0, 'total': tot, 'costTotal': cost, 'profit': tot - cost,
                 'payType': pay, 'cash': tot if pay == 'naqd' else 0, 'card': tot if pay == 'karta' else 0, 'debt': tot if pay == 'qarz' else 0,
                 'customerId': rnd.choice(['cdil', 'csar']) if pay == 'qarz' else None, 'given': 0, 'shiftId': None, 'dev': 'demo'}
            db['seq'] += 1; db['sales'].append(s)
            if pay == 'qarz': db['ledger'].append({'id': 'l%d' % len(db['ledger']), 'ts': ts, 'type': 'customer', 'partyId': s['customerId'], 'kind': 'debt', 'amount': tot, 'saleId': s['id'], 'note': 'Chek №%d' % s['no']})
    # bugun: 15 daqiqa oldin Coca-Cola sotilgan (qaytarish darsi uchun)
    p = P['pcola']; ts = now_ms() - 15 * 60e3
    db['sales'].append({'id': 'scola1', 'no': db['seq'], 'ts': int(ts), 'items': [{'pid': 'pcola', 'name': p['name'], 'unit': 'dona', 'qty': 2, 'price': 12000, 'cost': 9500, 'sum': 24000, 'disc': 0},
        {'pid': 'pnon', 'name': 'Non (patir)', 'unit': 'dona', 'qty': 2, 'price': 4000, 'cost': 3000, 'sum': 8000, 'disc': 0}], 'subtotal': 32000, 'discount': 0, 'total': 32000,
        'costTotal': 25000, 'profit': 7000, 'payType': 'naqd', 'cash': 32000, 'card': 0, 'debt': 0, 'customerId': None, 'given': 50000, 'shiftId': None, 'dev': 'demo'})
    db['seq'] += 1
    for d, cat, a in [(14, 'Ijara', 1500000), (3, 'Sotuvchi oyligi', 1500000), (5, 'Transport', 150000)]:
        db['expenses'].append({'id': 'e%d' % len(db['expenses']), 'ts': day_ts(d, 12), 'category': cat, 'amount': a, 'note': '', 'method': 'naqd'})
    return db

# Hisobchi (server o'rniga namunaviy javoblar)
HB_CATS = [('ovqat', '🍽', 'Ovqat', 'out'), ('kofe', '☕️', 'Kofe', 'out'), ('transport', '🚕', 'Transport', 'out'), ('xarid', '🛒', 'Xaridlar', 'out'), ('uy', '🏠', 'Uy', 'out'),
           ('kommunal', '💡', 'Kommunal', 'out'), ('aloqa', '📱', 'Aloqa', 'out'), ('sogliq', '💊', 'Sogʻliq', 'out'), ('kiyim', '👕', 'Kiyim', 'out'), ('talim', '🎓', 'Taʼlim', 'out'),
           ('obuna', '🔁', 'Obunalar', 'out'), ('dam', '🎉', 'Dam olish', 'out'), ('sovga', '🎁', 'Sovgʻa', 'out'), ('ish', '💼', 'Ish / biznes', 'out'), ('boshqa', '📦', 'Boshqa', 'out'),
           ('oylik', '💼', 'Oylik', 'in'), ('savdo', '💰', 'Savdo / biznes', 'in'), ('sovgain', '🎁', 'Sovgʻa', 'in'), ('boshqain', '📦', 'Boshqa kirim', 'in')]

class HbMock:
    def __init__(self):
        rnd = random.Random(5); self.id = 100; self.tx = []; self.debts = []
        notes = {'ovqat': ['tushlik', 'osh', 'lavash', 'somsa'], 'kofe': ['kofe', 'latte'], 'transport': ['taksi', 'benzin', 'metro'], 'xarid': ['korzinka', 'bozor'],
                 'aloqa': ['beeline'], 'kommunal': ['svet', 'gaz'], 'dam': ['kino'], 'sogliq': ['dorixona']}
        for d in range(45, 0, -1):
            for _ in range(rnd.randint(1, 3)):
                c = rnd.choice(list(notes)); a = rnd.choice([12000, 18000, 25000, 38000, 45000, 60000, 120000])
                self.add('out', a, c, rnd.choice(notes[c]), day_ts(d, rnd.randint(9, 20), rnd.randint(0, 59)))
            if d in (40, 10): self.add('in', 6500000, 'oylik', 'oylik', day_ts(d, 10))
            if d % 6 == 2: self.add('in', 900000, 'savdo', 'mebel zakaz', day_ts(d, 16))
        self.debt('i', 'Bobur', 300000, 0, 6)
        self.user = {'name': 'Javohir', 'username': '', 'balance': 2400000, 'balanceAt': day_ts(20, 9), 'budgets': {'ovqat': 1500000, 'transport': 500000}, 'daily': True}
    def nid(self): self.id += 1; return self.id
    def add(self, kind, amount, cat, note, ts, debt=None):
        x = {'id': self.nid(), 'kind': kind, 'amount': amount, 'cat': cat, 'note': note, 'debt': debt, 'ts': int(ts)}; self.tx.append(x); return x
    def debt(self, dirr, name, amount, paid, days, note=''):
        i = self.nid(); at = day_ts(days, 13) if days else now_ms()
        f = self.add('out' if dirr == 'me' else 'in', amount, 'qarz', ('Qarz berildi: ' if dirr == 'me' else 'Qarz olindi: ') + name, at, i)
        d = {'id': i, 'dir': dirr, 'name': name, 'amount': amount, 'paid': paid, 'closed': False, 'note': note, 'flow': f['id'], 'split': False, 'at': int(at), 'closedAt': None}
        self.debts.append(d); return d
    def load(self):
        u = dict(self.user)
        u['balanceNow'] = u['balance'] + sum((x['amount'] if x['kind'] == 'in' else -x['amount']) for x in self.tx if x['ts'] >= u['balanceAt'])
        u['avgDaily'] = sum(x['amount'] for x in self.tx if x['kind'] == 'out' and x['cat'] != 'qarz' and x['ts'] > now_ms() - 30 * DAY) / 30
        return {'ok': True, 'now': now_ms(), 'today': time.strftime('%Y-%m-%d', time.gmtime((now_ms() + TZ) / 1000)), 'bot': 'minimarketkassabot', 'user': u,
                'cats': [{'id': a, 'e': b, 'n': c, 'kind': d} for a, b, c, d in HB_CATS], 'tx': sorted(self.tx, key=lambda x: -x['ts']), 'more': False,
                'debts': sorted(self.debts, key=lambda x: -x['at'])}
    def handle(self, b):
        a = b.get('action')
        if a == 'load': return self.load()
        if a == 'quick':
            t = b.get('text', ''); m = re.search(r'(\d+[.,]?\d*)\s*(ming|mln)?', t); v = float(m.group(1).replace(',', '.')) if m else 0
            v = v * (1e6 if m and m.group(2) == 'mln' else 1e3 if m and (m.group(2) == 'ming' or v < 1000) else 1)
            note = re.sub(r'[+]?\s*\d+[.,]?\d*\s*(ming|mln)?', '', t).strip(); kind = 'in' if t.strip().startswith('+') else 'out'
            cat = {'taksi': 'transport', 'oylik': 'oylik', 'kofe': 'kofe'}.get(note.split(' ')[0] if note else '', 'boshqain' if kind == 'in' else 'boshqa')
            x = self.add(kind, int(v), cat, note, now_ms()); return {'ok': True, 'id': x['id'], 'kind': kind, 'amount': int(v), 'cat': cat, 'note': note, 'x1000': False}
        if a == 'tx_add':
            cat = b.get('cat') or ('boshqain' if b['kind'] == 'in' else 'boshqa'); x = self.add(b['kind'], b['amount'], cat, b.get('note', ''), now_ms()); return {'ok': True, 'id': x['id'], 'cat': cat}
        if a == 'debt_add': d = self.debt(b['dir'], b['name'], b['amount'], 0, 0, b.get('note', '')); return {'ok': True, 'id': d['id']}
        if a == 'debt_pay':
            d = next(x for x in self.debts if x['id'] == b['id']); v = min(d['amount'] - d['paid'], b.get('amount') or 10 ** 15); d['paid'] += v
            d['closed'] = d['paid'] >= d['amount']; d['closedAt'] = now_ms() if d['closed'] else None
            self.add('in' if d['dir'] == 'me' else 'out', v, 'qarz', ('Qarz qaytdi: ' if d['dir'] == 'me' else 'Qarz toʻlandi: ') + d['name'], now_ms(), d['id'])
            return {'ok': True, 'v': v, 'closed': d['closed']}
        return {'ok': True}

from icmock import IcMock  # noqa: E402  (Ishlab chiqarish namunasi: tools/video/icmock.py)

# ---------------------------------------------------------------- yozib olish va boshqarish
class Studio:
    def __init__(self, page, outdir):
        self.page = page; self.out = outdir; self.n = 0; self.frames = []; self.lock = asyncio.Lock()
    async def start(self):
        self.cdp = await self.page.context.new_cdp_session(self.page)
        self.cdp.on('Page.screencastFrame', self._frame)
        await self.cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 90, 'maxWidth': 1080, 'maxHeight': 1920, 'everyNthFrame': 1})
        self.t0 = time.time()
    def _frame(self, p):
        fn = os.path.join(self.out, 'f%06d.jpg' % self.n); self.n += 1
        with open(fn, 'wb') as f: f.write(base64.b64decode(p['data']))
        self.frames.append((p['metadata'].get('timestamp') or time.time(), fn))
        asyncio.ensure_future(self.cdp.send('Page.screencastFrameAck', {'sessionId': p['sessionId']}))
    async def stop(self):
        await self.cdp.send('Page.stopScreencast'); self.t1 = time.time()

class Ctx:
    """Bitta dars davomida sahna va telefon ichidagi ilova bilan ishlash"""
    def __init__(self, page): self.page = page; self.pw = 750  # kursor nishonga borgach kutish (ms)
    async def js(self, code, arg=None): return await self.page.evaluate(code, arg)
    def fr(self): return self.page.frame(name='fr')
    async def wait(self, ms): await asyncio.sleep(ms / 1000)
    async def load(self, path):
        await self.js('u => S.load(u)', path); await self.wait(700)
    async def tg(self, code, arg=None): return await self.fr().evaluate(code, arg)
    async def _el(self, sel, nth=0):
        loc = self.fr().locator(sel)
        await loc.nth(nth).wait_for(state='visible', timeout=6000)
        return loc.nth(nth)
    async def box(self, sel, nth=0, scroll=True):
        loc = await self._el(sel, nth)
        if scroll:
            moved = await loc.evaluate("""e => { const r = e.getBoundingClientRect(), H = innerHeight;
              if (r.top < 70 || r.bottom > H - 80) { e.scrollIntoView({ behavior: 'smooth', block: 'center' }); return true; } return false; }""")
            if moved: await self.wait(700)
        b = await loc.evaluate("e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }")
        return await self.js('b => S.rectOf(b)', b), loc
    async def point(self, sel, nth=0, ring=False):
        b, loc = await self.box(sel, nth)
        await self.js('([x, y]) => S.cursorTo(x, y)', [b['x'] + b['w'] / 2, b['y'] + b['h'] / 2])
        if ring: await self.js('b => S.ring(b)', b)
        await self.wait(self.pw)
        return b, loc
    async def tap(self, sel, nth=0, ring=False, after=500):
        b, loc = await self.point(sel, nth, ring)
        await self.js('([x, y]) => S.tapFx(x, y)', [b['x'] + b['w'] / 2, b['y'] + b['h'] / 2])
        await self.wait(150)
        try: await loc.click(timeout=2500)
        except Exception: await loc.evaluate('e => e.click()')
        if ring: await self.wait(250); await self.unring()
        await self.wait(after)
    async def type(self, sel, text, nth=0, delay=85, clear=True, ring=False):
        b, loc = await self.point(sel, nth, ring)
        await self.js('([x, y]) => S.tapFx(x, y)', [b['x'] + b['w'] / 2, b['y'] + b['h'] / 2])
        await loc.focus()
        if clear: await loc.fill('')
        await loc.press_sequentially(text, delay=delay)
        await self.wait(250)
    async def ring(self, sel, nth=0, pad=5):
        b, _ = await self.box(sel, nth); await self.js('([b, p]) => S.ring(b, p)', [b, pad])
    async def unring(self): await self.js('S.ring(null)')
    async def off(self): await self.js('S.cursorOff()'); await self.unring()
    async def scroll_to(self, sel, nth=0):
        loc = await self._el(sel, nth); await loc.evaluate("e => e.scrollIntoView({ behavior: 'smooth', block: 'center' })"); await self.wait(800)
    # Telegram namunasi
    async def tg_open(self, dark=False):
        await self.js('S.webapp(false)'); await self.load('tg.html')
    async def tg_tap_kb(self, label, after=400): await self.tap('#kb button[data-k="%s"]' % label, after=after)
    async def tg_tap_inline(self, label, after=400): await self.tap('.ik button[data-b="%s"]' % label, nth=-1 if False else 0, after=after)
    async def tg_type_send(self, text):
        await self.point('#inp')
        for i in range(1, len(text) + 1):
            await self.tg('t => TG.inp(t)', text[:i]); await self.wait(70)
        await self.wait(250); await self.tap('#snd', after=150)
        await self.tg('t => { TG.inp(""); TG.me(t); }', text)
    async def open_list(self):
        """Telegram namunasidan: «Ilovalar» tugmasi -> ilovalar ro'yxati"""
        await self.tap('#menu', ring=True, after=200)
        await self.js("S.webapp(true, 'Ilovalar')"); await self.load('ilovalar/'); await self.wait(500)
    async def switch_app(self, path, title):
        """reklama: bir ilovadan boshqasiga tez o'tish (xira o'tish bilan)"""
        await self.off()
        await self.js("() => { document.getElementById('fr').style.transition = 'opacity .25s'; document.getElementById('fr').style.opacity = 0; }"); await self.wait(280)
        await self.js("t => S.webapp(true, t)", title); await self.load(path)
        await self.fr().wait_for_load_state('load')
        try: await self.fr().wait_for_function("() => { const m = document.getElementById('main'); return m && m.innerText.length > 120; }", timeout=6000)
        except Exception: pass
        await self.wait(250)
        await self.js("() => { document.getElementById('fr').style.opacity = 1; }"); await self.wait(350)
    async def open_app(self, which, prep=None, from_list=False):
        """Telegram namunasidan: «Ilovalar» -> ilova tanlash. prep — ilova ko'rinishidan oldin (yashirin holda) bajariladi"""
        if not from_list: await self.open_list()
        sel = {'pos': '#go-pos', 'hb': '#go-hb', 'ic': '#go-ic'}[which]
        b, loc = await self.point(sel, ring=True)
        await self.js('([x, y]) => S.tapFx(x, y)', [b['x'] + b['w'] / 2, b['y'] + b['h'] / 2]); await self.wait(250)
        await self.unring(); await self.js("() => { document.getElementById('fr').style.opacity = 0; }"); await self.wait(320)
        await loc.click()
        await self.js("t => S.webapp(true, t)", {'pos': 'Minimarket POS', 'hb': 'Hisobchi', 'ic': 'Ishlab chiqarish'}[which])
        await self.wait(350)
        await self.fr().wait_for_load_state('load')
        if prep: await prep(self)
        await self.wait(150)
        await self.js("() => { document.getElementById('fr').style.opacity = 1; }")
        await self.wait(700)

# ---------------------------------------------------------------- matn: subtitr va kartochkalar
def sentences(text):
    parts = re.split(r'(?<=[.!?])\s+(?=[«A-ZʻOʼQGShCh0-9])', text.strip())
    return [p for p in parts if p]
def cap_html(s):
    s = s.replace('&', '&amp;').replace('<', '&lt;')
    return re.sub(r'«([^»]+)»', r'<b>«\1»</b>', s)
def srt_times(path):
    if not os.path.exists(path): return []
    out = []
    for m in re.finditer(r'(\d+):(\d+):(\d+),(\d+)\s+-->\s+(\d+):(\d+):(\d+),(\d+)', open(path, encoding='utf-8').read()):
        g = [int(x) for x in m.groups()]
        out.append((g[0] * 3600 + g[1] * 60 + g[2] + g[3] / 1000, g[4] * 3600 + g[5] * 60 + g[6] + g[7] / 1000))
    return out
def dur(path): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]).decode().strip())

def card_html(logo, title, sub, items, foot=None, done=False):
    li = ''.join('<div class="li%s"><span class="n">%s</span><span>%s</span></div>' % (' on ok' if done else '', '✓' if done else i + 1, t) for i, t in enumerate(items))
    return ('<div class="ch"><div class="lg">%s</div><div><div class="t">%s</div><div class="s">%s</div></div></div><div style="height:6px"></div>%s%s'
            % (logo, title, sub, li, '<div class="foot">%s</div>' % foot if foot else ''))

# ---------------------------------------------------------------- darslar
from lessons import LESSONS  # noqa: E402  (tools/video/lessons.py)

async def run_lesson(pw, key, ttsdir, outdir, port):
    L = LESSONS[key]
    texts = json.load(open(os.path.join(REPO, 'tools/tts', key + '.json'), encoding='utf-8'))
    scenes = L['scenes']; assert len(scenes) == len(texts), (key, len(scenes), len(texts))
    work = os.path.join(outdir, key + '_frames'); shutil.rmtree(work, ignore_errors=True); os.makedirs(work)
    br = await pw.chromium.launch(args=['--autoplay-policy=no-user-gesture-required'])
    ctx = await br.new_context(viewport={'width': 540, 'height': 960}, device_scale_factor=2, color_scheme='light', locale='uz-UZ', timezone_id='Asia/Tashkent')
    await ctx.route('**/fonts.googleapis.com/**', lambda r: r.abort()); await ctx.route('**/fonts.gstatic.com/**', lambda r: r.abort())
    await ctx.route('**/telegram.org/**', lambda r: r.abort())
    hb = HbMock()
    async def hb_route(r):
        body = hb.handle(json.loads(r.request.post_data or '{}'))
        await r.fulfill(status=200, content_type='application/json', body=json.dumps(body), headers={'Access-Control-Allow-Origin': '*'})
    await ctx.route('**/functions/v1/hisobchi', hb_route)
    ic = IcMock()
    async def ic_route(r):
        code, body = ic.handle(json.loads(r.request.post_data or '{}'))
        await r.fulfill(status=code, content_type='application/json', body=json.dumps(body), headers={'Access-Control-Allow-Origin': '*'})
    await ctx.route('**/functions/v1/ishlab', ic_route)
    page = await ctx.new_page()
    page.on('pageerror', lambda e: print('  pageerror:', e))
    base = 'http://127.0.0.1:%d/' % port
    await page.goto(base + 'stage.html')
    # ilova holati: do'kon ma'lumotlari, mavzu, Hisobchi kaliti
    await page.evaluate("""([db, extra]) => { localStorage.clear(); localStorage.setItem('minimarket_pos_v1', JSON.stringify(db)); localStorage.setItem('minimarket_pos_theme', 'light');
        localStorage.setItem('hisobchi_token', '1.2.x'); localStorage.setItem('hisobchi_theme', 'light'); localStorage.setItem('ishlab_token', '1.2.x'); localStorage.setItem('ishlab_theme', 'light'); for (const k in extra) localStorage.setItem(k, extra[k]); }""",
        [pos_db(L.get('db', 'demo')), L.get('ls', {})])
    await page.evaluate("o => S.setup(o)", {'hb': L.get('hb', False), 'ic': L.get('ic', False), 'brand': L['brand'], 'steps': len(scenes)})
    c = Ctx(page)
    st = Studio(page, work)
    if L.get('prep'): await L['prep'](c)
    await st.start()
    await c.wait(300)
    timeline = []
    for i, (title, fn) in enumerate(scenes):
        clip = os.path.join(ttsdir, key, '%02d.mp3' % (i + 1))
        d = dur(clip)
        t_scene = time.time()
        await page.evaluate("a => S.head(a[0], a[1], a[2])", [i + 1, len(scenes), title])
        sents = sentences(texts[i]['text']); times = srt_times(clip[:-4] + '.srt')
        if len(times) != len(sents):  # uzunlik bo'yicha taqsimlash
            tot = sum(len(s) for s in sents); acc = 0; times = []
            for s in sents: times.append((acc / tot * d, (acc + len(s)) / tot * d)); acc += len(s)
        lead = 0.35
        async def captions():
            for (a, _), s in zip(times, sents):
                wait = t_scene + lead + a - time.time()
                if wait > 0: await asyncio.sleep(wait)
                await page.evaluate('h => S.cap(h)', cap_html(s))
        capt = asyncio.ensure_future(captions())
        try: await fn(c)
        except Exception as e: print('  ! sahna', i + 1, 'xato:', str(e).split('\n')[0][:200])
        end = t_scene + lead + d + 0.55
        if time.time() < end: await asyncio.sleep(end - time.time())
        await capt
        timeline.append((t_scene - st.t0 + lead, clip))
        print('  sahna %d/%d: ovoz %.1fs, sahna %.1fs' % (i + 1, len(scenes), d, time.time() - t_scene))
    await c.wait(900)
    await st.stop()
    total = st.t1 - st.t0
    await br.close()
    # ---- video: kadrlar (vaqt bo'yicha) -> 30 fps
    fr = sorted(st.frames)
    lst = os.path.join(work, 'list.txt')
    with open(lst, 'w') as f:
        for j, (ts, fn) in enumerate(fr):
            nxt = fr[j + 1][0] if j + 1 < len(fr) else st.t0 + total
            if j == 0: f.write("file '%s'\nduration %.4f\n" % (fn, max(0.01, nxt - st.t0)))
            else: f.write("file '%s'\nduration %.4f\n" % (fn, max(0.001, nxt - ts)))
        f.write("file '%s'\n" % fr[-1][1])
    # ---- ovoz: har bir gap o'z sahnasi boshida
    inputs, flt = [], []
    for k, (at, clip) in enumerate(timeline):
        inputs += ['-i', clip]; ms = int(at * 1000)
        flt.append('[%d:a]aresample=48000,adelay=%d|%d[a%d]' % (k + 1, ms, ms, k))
    flt.append(''.join('[a%d]' % k for k in range(len(timeline))) + 'amix=inputs=%d:normalize=0:dropout_transition=0,apad,atrim=0:%.3f,loudnorm=I=-16:TP=-1.5:LRA=11[aout]' % (len(timeline), total))
    out = os.path.join(outdir, L['file'] + '.mp4')
    cmd = ['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', lst] + inputs + [
        '-filter_complex', ';'.join(flt), '-map', '0:v', '-map', '[aout]',
        '-vf', 'fps=30,scale=1080:1920:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-tune', 'stillimage',
        '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-movflags', '+faststart', '-t', '%.3f' % total, out]
    subprocess.check_call(cmd)
    print('  tayyor:', out, '%.1fs' % total, '%d kadr' % len(fr))
    shutil.rmtree(work, ignore_errors=True)
    return out

async def main():
    ap = argparse.ArgumentParser(); ap.add_argument('lessons', nargs='+'); ap.add_argument('--tts', required=True); ap.add_argument('--out', required=True); ap.add_argument('--port', type=int, default=8790)
    a = ap.parse_args()
    site = os.path.join(a.out, '_site'); build_site(site); srv = serve(site, a.port)
    sys.path.insert(0, HERE)
    async with async_playwright() as pw:
        for k in a.lessons:
            print('==', k); await run_lesson(pw, k, a.tts, a.out, a.port)
    srv.shutdown()

if __name__ == '__main__':
    sys.path.insert(0, HERE)
    asyncio.run(main())
