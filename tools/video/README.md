# Video darsliklar

1. Ovoz matni: `tools/tts/darsN.json` (har qator — bitta sahna).
2. Ovoz (Madina): GitHub Actions → «Video ovozi (TTS)» → `script=darsN`. Natija `tts/darsN` shoxida (mp3 + srt).
3. Video: `python3 tools/video/make.py dars1 dars2 ... --tts <tts papka> --out <natija>`
   (`<tts papka>/darsN/01.mp3 ...`). Sahnalar — `lessons.py`, sahna ko'rinishi — `stage.html`, Telegram namunasi — `tg.html`.
   Ilova haqiqiy: `docs/index.html` (serversiz rejimda, namunaviy «Baraka market» ma'lumotlari bilan) va `docs/hisobchi/`.
4. Tayyor fayllar `docs/video/` ga qo'yiladi; bot (`server/functions/tg-webhook/guide.ts`) va ilova (`docs/index.html` → `VIDEOS`) ro'yxatida.
