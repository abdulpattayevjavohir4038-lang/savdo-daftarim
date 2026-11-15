# Hisobchi ilovasini yig'ish: src.html + Minimarket ilovasining (docs/index.html) dizayn uslublari -> docs/hisobchi/index.html
# Ishlatish: python3 tools/hisobchi/build.py
import os
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
pos = open(os.path.join(ROOT, 'docs/index.html'), encoding='utf-8').read()
a = pos.index('  /* ---------- Dizayn tokenlari'); b = pos.index('  /* Mahsulot plitkasi')
css = '\n'.join(l for l in pos[a:b].split('\n') if 'html.land' not in l and '#app-root' not in l and '#sidebar {' not in l)
css += "\n  @keyframes pop { from { transform: translateY(10px); opacity: 0; } to { transform: none; opacity: 1; } }\n  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }\n"
src = open(os.path.join(ROOT, 'tools/hisobchi/src.html'), encoding='utf-8').read()
assert src.count('/*POS_CSS*/') == 1
out = os.path.join(ROOT, 'docs/hisobchi/index.html')
open(out, 'w', encoding='utf-8').write(src.replace('/*POS_CSS*/', css))
print('ok', out)
