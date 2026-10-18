# Zar Labirinti — texnik audit va refaktoring hisoboti (2026-10-18)

## 1. Audit natijalari (asl `index.html`, v1.4.4)

**Hajm.** 10 012 satr: 760 satr CSS, 270 satr HTML, 8 950 satr JS — bitta IIFE ichida. 692 ta yuqori darajali nom
(443 funksiya, 237 konstanta, 12 ta o‘zgaruvchan `let`). Eng katta funksiyalar: `generate` (266 satr), `onPeers` (99), `drawPerson` (87), `updateHUD` (73).

**Global holat.** `G` (dunyo) 743 joyda, `ui` 188, `NET` 137, `VOICE` 167 joyda ishlatiladi — hamma tizimlar bitta ob’ekt orqali bog‘langan.
12 ta `let` global: `viewers, drumStep, fogImg, DPR, vigCache, mapOn, zarEl, replayRaf, fbP, pubT, gamesRun, lastT/fpsAcc`.

**O‘lik kod (3 ta).** `RB`, `DVEC`, `botPass` hech qayerda ishlatilmaydi. (Olib tashlanmadi — qoidaga ko‘ra mavjud kod buzilmaydi; keyingi bosqichda o‘chirish xavfsiz.)

**Takrorlanish (2 ta).** `bfs`/`bfsMulti` ichki BFS halqasi; `drawTiles`/`drawTilesLite` suv/jarlik plitkalari chizish (5 satr). Ishlashga ta’sir qilmaydi.

**Xavfli bog‘liqliklar.**
- `cards.js` ↔ `games.js` halqasi: karta mini-o‘yin fabrikasini, fabrika kartani chaqiradi (yechildi — `GAME_REG`).
- Boshqa modulning `let` iga yozish: `DPR` (resize), `pubT` (ism o‘zgarganda), `lastT` (boot) — 3 joy (yechildi).
- `Sound` ↔ `me()`/`G` (ovoz dunyo holatini o‘qiydi) — qoldi, funksiya darajasida, xavfsiz.

**Xavfsizlik.** 27 ta `innerHTML` — birortasi foydalanuvchi matnini (ism, chat) qo‘ymaydi; ismlar `textContent`/`append` orqali. XSS yo‘q.
Firebase apiKey va TURN login/parol mijoz kodida — statik sayt uchun muqarrar; TURN uchun keyinroq qisqa muddatli kalitlar tavsiya etiladi.

**Resurslar.** 4 `setInterval` / 2 `clearInterval`: ijtimoiy «onlayn» pulsi (30 s) va localRoom broadcast sahifa umri davomida ishlaydi — tashlab yuborilmaydi, lekin to‘xtatilmaydi ham (yashirin xato emas).
99 `addEventListener` / 1 `removeEventListener`: har o‘yinda viewport DOM lari qayta quriladi (`ui.stage.innerHTML = ''`), eski tinglovchilar DOM bilan birga ketadi.

**Qisman yozilgan / sinalmagan.**
- Reklama: `ADS.mode = 'demo'` ishlaydi; `h5` va `admob` shoxlari haqiqiy hisob bo‘lmagani uchun sinalmagan.
- Firebase qoidalari: baza test rejimida (2026-11-17 gacha), `database.rules.json` konsolda qo‘llanmagan.
- iOS Safari «bosh ekranga qo‘shish» rejimida ovozli suhbat — real qurilmada tekshirilmagan.
- Onlayn 2×2 jamoa chiqishi faqat local adapterda sinalgan (Firebase bilan 2 brauzer sinovi qo‘lda bir marta o‘tgan).

## 2. Nima qilindi

1. **Regression to‘plami** (`tests/run.js`, 12 ssenariy, Playwright) — asl o‘yinda 12/12 o‘tadi; shu to‘plam refaktoringning har bosqichidan keyin qayta yurgizildi.
2. **Unit testlar** (`tests/unit.mjs`, 8 ta, brauyzersiz): maze (75 urug‘), util, content, state.
3. **Modullarga ajratish** 3 bosqichda (`dev/split.js` — scope tahlili bilan, qo‘lda emas):
   - 1-bosqich: util, save, content, maze, state, audio, config, net-adapters → 11/11.
   - 2-bosqich: games, cards, render, voice, social, tutorial, ads, input, combat, hud → 11/11.
   - 3-bosqich: player, magic, traps, toolsui, bots, beasts, encounters, engine, events, endgame, menu, net-room → 12/12 (+offline).
   Har bosqichda TDZ (halqali yuklanish) va «chet `let` ga yozish» tekshiruvi avtomatik.
4. **Service worker**: `src/*` modullar precache ro‘yxatida; modullar sahifa bilan bir versiyada bo‘lishi uchun tarmoq-birinchi strategiya; oflayn yuklanish testi qo‘shildi.
5. O‘yin qoidalari, grafika, ovoz, boshqaruv (sensor/klaviatura/gamepad), PWA — **o‘zgarmadi**.

## 3. Sinovdan o‘tgan mexanikalar (v2, 12/12 + 8/8)

boot/SW/manifest, oflayn yuklanish, labirint generatori (7 qiyinlik × 3 urug‘ + 75 urug‘ unit), sarguzasht 1–3 avto-o‘yin, 10-bosqich qo‘riqchisi,
kunlik labirint, kalit tushishi + arvoh + reklama bilan tirilish, 2×2 (kalit → darvoza → jamoa g‘alabasi), 16 mini-o‘yinning tugashi (45 s avto-yutqazish),
reklama chastotasi, yakka do‘kon (faqat xaritalar), onlayn (lobby, ovoz `connected`, pozitsiya sinxron), do‘stlar (so‘rov → qabul → zal → taklif → boshlash).

## 4. Saqlanib qolgan xavflar

- Modullar orasida funksiya darajasidagi halqalar bor (masalan `player` ↔ `magic` ↔ `traps`). Ishlashga ta’sir qilmaydi, lekin keyingi bosqichda
  «hodisa shinasi» (event bus) yoki aniq interfeyslar bilan kamaytirish kerak.
- `window.__jl` sinov ilgagi ishlab chiqarish nusxasida ham turibdi (o‘yinchi konsoldan holatni o‘zgartira oladi — yakka o‘yinda zarari yo‘q, onlayn reyting bo‘lsa olib tashlash kerak).
- Real telefon FPS, iOS PWA ovozi, haqiqiy reklama — faqat qurilmada tekshiriladi.
- Firebase test-rejim muddati (2026-11-17).

## 5. Keyingi bosqichga tayyormi?

Ha — v2 asl o‘yin bilan bir xil ishlaydi va test to‘plami bilan himoyalangan. Tavsiya: 1–2 kun `/v2/` manzilida do‘stlar bilan sinab,
muammo chiqmasa asosiy manzilni v2 ga o‘tkazish. Shundan keyin: o‘lik kodni olib tashlash, `main.js` dagi `bindUI` ni `menu.js` ga ko‘chirish,
`G` ni kichik holat ob’ektlariga bo‘lish (world / session / settings), TURN uchun qisqa muddatli kalitlar.
