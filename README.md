# Zar Labirinti (PWA)

Tumanli labirint o‘yini: botlar yoki do‘stlar bilan poyga, duel, bomba, devor va hazil sehrlari.
Bitta `index.html` — kutubxonalarsiz; PWA sifatida o‘rnatiladi va oflayn ishlaydi.

## Yangilanish (v1.5)
- **16 ta yangi mini-o‘yin:** Yugurish (3 yo‘lak), Uchtalik, G‘isht sindirish, Birlashtirish, Sudoku 4×4, Konchi, Tosh-qaychi-qog‘oz, Raqamlar jadvali, Blok jumbog‘i, Girdob minora, Olomon darvozalari, Tepalik poygasi, Mergan, Qora tuynuk, Bilyard, Sakrovchi to‘p (jami 42 xil). Mashina, bilyard, minora, to‘p, yugurish, Mergan, Qora tuynuk, olomon va g‘isht sindirish — haqiqiy fizika bilan.
- **Darvoza qo‘riqchisi** endi faqat eng qiyin savollarni beradi (3–4 ta matematika, mantiq, ehtimol, ilm, tarix; 1 ta xato kechiriladi).
- Mini-o‘yinda «bo‘sh turish» hisobi klaviatura va canvas o‘yinlarida ham to‘g‘ri nolga qaytadi.
- 16 ta yangi o‘yin endi haqiqatda chiqadi (avval «oddiy o‘yinlar» filtri ularni o‘chirib qo‘yardi); Uchtalik’da chetdagi gemni tashqariga surganda chiqadigan xato tuzatildi.

## Rejimlar
- **🎓 Sarguzasht** — 10 ta qisqa o‘rgatuvchi bosqich (yurish → kalit → kompas → tuzoq → hayvon → sandiq → do‘kon → poyga → zar bilan sakrash → yakuniy sinov). Har bosqichda 3 ta yulduz: chiqish, hamma vazifalar, jon yo‘qotmaslik. Keyingi bosqich oldingisi o‘tilganda ochiladi.
- **📅 Kunlik labirint** — har kuni hamma uchun bitta labirint (sana bo‘yicha). Natija va seriya (🔥) saqlanadi, «Ulashish» tugmasi natijani matn qilib yuboradi.
- **Erkin o‘yin** — avvalgidek: qiyinlik, botlar soni va kuchi.

## Do‘stlar va zallar (Firebase)
- Har o‘yinchiga ID: `Ism#1234` (Firebase anonim kirish — ro‘yxatdan o‘tish shart emas).
- Do‘st qo‘shish (ID yoki ism bo‘yicha qidirish), so‘rov → qabul, onlayn holati, «Chaqirish» taklifi.
- «🏠 Zal ochish» (ochiq yoki faqat do‘stlar uchun), «⚡ Tez o‘yin», ochiq zallar ro‘yxati.
- Firebase konsolida: Realtime Database (test mode) + Authentication → Anonymous yoqilgan bo‘lishi kerak.
- Ko‘p foydalanuvchi bo‘lganda Rules ga indeks qo‘shing: `"users": { ".indexOn": ["nl"] }`.

## Reklama (o‘yin oldidan va ko‘rib davom etish)
- O‘yin oldidan: yuklanish ekrani (0–100%) paytida. Birinchi o‘yinda chiqmaydi, keyin 3 daqiqada ko‘pi bilan bir marta (`ADS.gapMs`). 1–3 o‘rgatish bosqichi va onlayn o‘yinda chiqmaydi.

Jonlar tugaganda bir o‘yinda bir marta «📺 Reklama ko‘rib, shu joydan davom et» taklifi chiqadi.
`index.html` ichida `const ADS = { mode: 'demo', ... }`:
- `demo` — hozirgi holat: 5 soniyalik sinov oynasi (haqiqiy reklama yo‘q).
- `h5` — Google H5 Games Ads (AdSense) skripti sahifaga qo‘shilgandan keyin.
- `admob` — ilova Capacitor bilan o‘ralib, @capacitor-community/admob o‘rnatilganda; `admobRewardId` ga o‘z ID ingizni yozing.
- `off` — taklif umuman chiqmaydi.
`h5` va `admob` qismlari haqiqiy reklama hisobisiz sinab ko‘rilmagan — ulashda bir marta tekshirish kerak.

## v1.4
- Bitta darvoza — labirint ichida yashiringan (chetda emas), kirishdan uzoq, boshi berk yo‘lak oxirida.
- 2×2: kalitni topgan sherik uni darvozaga olib borib ochadi; jamoa ikkala sherik ham chiqqanda yutadi (onlayn jamoada: sherik kalit bilan chiqqan bo‘lsa darvoza ochiq).
- Fon ovozi: chigirtka olib tashlandi, shamol juda yengil, menyuda o‘chirgich.

## Sifat (v1.2)
- Ovoz: kompressor + reverb zanjiri, bir xil ovoz 50 ms ichida takrorlanmaydi, fon rejimida butunlay to‘xtaydi, o‘rmon atrof-muhiti (shamol, chigirtka, qush), qadam/tanga/karta ovozlari.
- Grafika: devor soyalari, o‘t tutamlari, mox bosgan toshlar, quyosh dog‘lari, uch qatlamli tuman, issiq mash’al nuri, vinyetka. Zaif telefonda (3 s davomida <40 FPS) qimmat effektlar o‘zi o‘chadi (`jl_lowfx`).
- Mini-o‘yin 45 soniya bosilmasa — yutqaziladi (karta ochiq qolib ketmaydi).
- Botlar kalit joyini «bilib qolmaydi»: puli yetsa do‘kondan kalit xaritasini oladi.

## Fayllar
- `index.html` — o‘yin
- `manifest.webmanifest` — ilova nomi, rangi, ikonkalari
- `sw.js` — oflayn kesh (service worker)
- `icons/` — ikonkalar (192, 512, maskable 512, iOS 180, favicon)

## GitHub Pages orqali joylash
1. Bu fayllarni (papkani emas, ichidagilarni) yangi ombor ildiziga yuklang.
2. Ombor sozlamalari → **Pages** → *Deploy from a branch* → `main` / `(root)` → Save.
3. 1–2 daqiqadan keyin `https://<login>.github.io/<ombor-nomi>/` ishlaydi (HTTPS — PWA uchun shart).

## O‘rnatish
- **Android (Chrome):** menyu ⋮ → «Ilovani o‘rnatish» (yoki pastdagi taklif).
- **iPhone/iPad (Safari):** Ulashish → «Bosh ekranga qo‘shish».
- **Kompyuter (Chrome/Edge):** manzil qatoridagi o‘rnatish belgisi.

## Yangilash
O‘yinni o‘zgartirgach `sw.js` ichidagi `VERSION` ni oshiring (`jl-v6` → `jl-v7`), aks holda eski nusxa keshda qolishi mumkin.

## Eslatma
Onlayn xona va ovozli suhbat:
- claude.ai ichida — o‘z serveri bilan, sozlash shart emas.
- GitHub Pages / PWA da — Firebase loyihasi `zar-labirinti` ulangan (`NET_CFG.firebase`). Baza test rejimida: qoidalar 2026-11-17 da yopiladi — ungacha konsolda Rules → `database.rules.json` dagi qoidalarni joylang.
- Sinov: `?guest=1` — shu brauzerda ikkinchi alohida foydalanuvchi (xotirasiz kirish).
- Ovoz mobil internetda ham ulanishi uchun `NET_CFG.turn` ga TURN (masalan, metered.ca) login/parolini yozing.
- Sinov: `index.html?net=local` — bitta brauzerdagi ikki oyna o‘zaro o‘ynaydi (serversiz).
Botlarga qarshi o‘yin va bitta qurilmada bir necha kishi bilan o‘ynash to‘liq ishlaydi.
