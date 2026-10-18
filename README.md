# Minimarket POS — Savdo daftari

Doʻkon uchun kassa, ombor, qarz daftari va hisobotlar. Maʼlumotlar serverda saqlanadi va doʻkondagi barcha qurilmalarga sinxronlanadi; internet uzilsa ham ishlaydi.

- **Ilova (havola):** https://abdulpattayevjavohir4038-lang.github.io/savdo-daftarim/
- **Sotuvchi paneli:** https://abdulpattayevjavohir4038-lang.github.io/savdo-daftarim/panel.html
- **Android ilova (APK):** https://github.com/abdulpattayevjavohir4038-lang/savdo-daftarim/releases/latest/download/minimarket-pos.apk

## Tuzilma

| Papka | Nima |
|---|---|
| `docs/` | Havoladagi ilova (`index.html`), sotuvchi paneli (`panel.html`), oflayn ishlash (`sw.js`), ikonkalar. GitHub Pages shu papkadan ochiladi. |
| `app/` | Android ilova (Capacitor). `docs/index.html` ni oʻz ichiga oladi; ovozli buyurtma telefonning oʻz ovozni tanish xizmati bilan ishlaydi. |
| `.github/workflows/apk.yml` | Har oʻzgarishda APK ni avtomatik yigʻadi va «Releases» boʻlimiga qoʻyadi. |

Server: Supabase (`savdo-daftarim` loyihasi) — hisoblar, doʻkonlar, taklif kodlari, sinxron yozuvlar.
