# Zar Labirinti — modulli arxitektura (v2)

Bu papka o‘yinning **ES-modullarga ajratilgan** nusxasi. O‘yin qoidalari, grafika, ovoz, onlayn va PWA — hammasi
asl `index.html` bilan bir xil; faqat kod 30 ta modulga bo‘lingan va har bir modul faqat o‘ziga kerak narsani `import` qiladi.
Global o‘zgaruvchilar yo‘q: hamma narsa modul doirasida, sinov uchun faqat `window.__jl` qoldirilgan.

## Modullar

| Modul | Vazifa (prompt bo‘yicha nom) |
|---|---|
| `src/main.js` | Kirish nuqtasi: `bindUI`, `boot` |
| `src/engine.js` | **GameEngine** — newGame, rejimlar, `stepWorld`, kadr tsikli, avto-sifat |
| `src/maze.js` | **MazeGenerator** — `generate(seed, diff)`, `bfs` |
| `src/player.js` + `src/input.js` | **PlayerController** — harakat, voqealar, buyumlar, kalitlar; klaviatura/joystik/gamepad |
| `src/bots.js` | **BotAI** |
| `src/traps.js` | **TrapSystem** — qo‘yiladigan tuzoqlar, devorlar, bomba |
| `src/combat.js` | **CombatSystem** — duel |
| `src/magic.js` | **MagicSystem + InventorySystem** — sehrlar, do‘kon, xaritalar, effektlar |
| `src/beasts.js` | Hayvonlar, ovchilar, sirpanish/teleport |
| `src/encounters.js` | Tuzoq/hayvon/sandiq kartalari, mukofotlar |
| `src/render.js` | **Renderer** — Canvas |
| `src/audio.js` | **AudioManager** |
| `src/hud.js`, `src/cards.js`, `src/toolsui.js`, `src/menu.js`, `src/endgame.js` | **UIManager** — HUD, kartalar, sehr paneli, menyu, yakun |
| `src/save.js`, `src/config.js` | **SaveManager** — `store`, `cfg` |
| `src/net-adapters.js`, `src/net-room.js`, `src/voice.js`, `src/social.js` | **NetworkManager** — Firebase/local xona, WebRTC ovoz, do‘stlar/zallar |
| `src/games.js` | 16+ mini-o‘yin |
| `src/content.js` | Sof ma’lumotlar (konstantalar, jumboqlar, tuzoq/hayvon/buyum jadvallari) |
| `src/state.js` | Umumiy holat: `G`, `ui`, `NET`, `makePlayer`, `hasKey`, `GAME_REG` |
| `src/util.js` | Yordamchilar |
| `src/tutorial.js`, `src/ads.js`, `src/events.js` | Sarguzasht + kunlik, reklama, zar hodisalari/yutuqlar |

Bog‘liqlik qoidalari (avtomatik tekshiriladi, `dev/split.js`):
- `util`, `save`, `content` hech kimga bog‘liq emas; `maze`, `state`, `config`, `audio` faqat ularga.
- Modul darajasida (yuklanish paytida) boshqa moduldan hech narsa **o‘qilmaydi** — shuning uchun halqali importlar xavfsiz (TDZ tekshiruvi).
- Boshqa modulning `let` o‘zgaruvchisiga **yozish taqiqlangan** (import bindinglari faqat o‘qiladi) — tekshiruv buni ushlaydi.
- Mini-o‘yin fabrikasi `GAME_REG` (state.js) orqali ro‘yxatga olinadi: `cards.js` ↔ `games.js` halqasi yo‘q.

## Ishga tushirish

Statik server yetarli (modullar `file://` da ishlamaydi):

```
python3 -m http.server 8080
# http://localhost:8080/
```

GitHub Pages: `v2/` papkasini yuklang → `https://<login>.github.io/<repo>/v2/`.

## Sinovlar

```
node tests/unit.mjs                      # sof modullar: maze (75 urug‘), util, content, state — brauzersiz
node tests/run.js --url http://localhost:8080/index.html   # 12 ta regression ssenariy (Playwright)
```

Regression ssenariylari: boot (SW + manifest), offline (SW keshidan yuklanish), maze (1 ichki darvoza, yechiladi, kalitlar yetiladi, deterministik),
tutorial (1–3 bosqich avto-o‘yin + 10-bosqich qo‘riqchisi), daily, keydrop (o‘lgan joyda kalit + arvoh + reklama), team (2×2: kalit → darvoza → «Jamoang yutdi!»),
minigames (hamma mini-o‘yin tugaydi), ads (1-o‘yinda yo‘q, 2-da bor), shop (yakka — faqat xaritalar), online (2 oyna: lobby, ovoz `connected`, pozitsiya sinxron),
social (ID → so‘rov → qabul → zal → taklif → boshlash).

## Yangilash

`sw.js` ichidagi `VERSION` ni oshiring (`zl-v2-4` → `zl-v2-5`). `src/` fayllari tarmoqdan birinchi olinadi (sahifa bilan bir versiyada),
oflayn bo‘lsa keshdan.

## Qanday yaratilgan

`dev/split.js` + `dev/map3.json`: asl `index.html` satr oraliqlari modullarga taqsimlanadi, `acorn` + `eslint-scope` bilan
haqiqiy erkin identifikatorlar topilib, `import`/`export` lar avtomatik yoziladi. Ikkita kichik patch: `GAME_REG` (halqa) va `socPublishSoon`/`startLoop`
(boshqa modulning `let` iga yozishni olib tashlash).
