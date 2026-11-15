# Server (Supabase Edge Functions)

Bu papkada Telegram bot va Hisobchi ilovasining server kodi turadi (Supabase loyihasi `fgwqodeqfqbagimauulc`).
Maxfiy qiymatlar (bot tokeni, kalitlar) kodda yo'q — ular bazadagi `app_secrets` jadvalida.

| Funksiya | Nima |
|---|---|
| `functions/tg-webhook/` | Telegram bot: ro'yxatdan o'tish, hisobotlar, obuna, xodimlar, «👛 Hamyon nazorat», Hisobchiga kirish tasdig'i |
| `functions/hisobchi/` | «🧮 Hisobchi» ilovasi serveri: kirim-chiqim, qarz oldi-berdi, balans, byudjet (`w_tx`, `w_debt`, `w_user`) |

`tg-webhook` Supabase'ga kichik `index.ts` bilan joylanadi: u shu repozitoriydagi aniq commit'dagi `handler.ts`ni yuklaydi
(`https://raw.githubusercontent.com/abdulpattayevjavohir4038-lang/savdo-daftarim/<commit>/server/functions/tg-webhook/handler.ts`).
Bot kodini o'zgartirganda: shu yerda tahrirlang → commit/push → `index.ts`dagi commit'ni yangilab qayta joylang.
