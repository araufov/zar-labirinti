// Menyu: o‘yinchilar ro‘yxati (buildSetup), botlar, qo‘llanma (buildCodex).
import { trapXus } from './cards.js';
import { cfg, saveCfg } from './config.js';
import { ABIL, BEASTS, BEAST_KINDS, CHEST, DUEL_S, ECON, ITEMS, LOOKS, OBST, PCOLORS, PORTAL, PT_LIFE, PT_MAX, TRAPS } from './content.js';
import { viewers } from './engine.js';
import { EASY_GAMES, GAMES, poolText } from './games.js';
import { avatarURL } from './render.js';
import { socPublish, socPublishSoon } from './social.js';
import { G, ui } from './state.js';
import { PW_LIFE } from './traps.js';
import { $ } from './util.js';
function buildSetup() {
  ui.setupRoster.innerHTML = '';
  const row = document.createElement('div');
  row.className = 'prow'; row.style.setProperty('--pc', PCOLORS[0]);
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'ava'; btn.setAttribute('aria-label', 'Qahramonni almashtirish');
  const img = document.createElement('img'); img.alt = ''; img.src = avatarURL(cfg.look); btn.appendChild(img);
  const box = document.createElement('div'); box.className = 'pbox';
  const inp = document.createElement('input');
  inp.id = 'pname0'; inp.maxLength = 14; inp.value = cfg.name; inp.autocomplete = 'off'; inp.spellcheck = false;
  inp.setAttribute('aria-label', 'Ismingiz');
  const sm = document.createElement('small');
  const info = () => { sm.textContent = `${LOOKS[cfg.look].title}: ${ABIL[cfg.look]} · rasmga bosib almashtir`; };
  info();
  btn.addEventListener('click', () => {
    cfg.look = (cfg.look + 1) % LOOKS.length; img.src = avatarURL(cfg.look); info(); saveCfg(); socPublish();
    if (G.mode === 'menu' && viewers[0]) viewers[0].look = cfg.look;
  });
  inp.addEventListener('input', () => { cfg.name = inp.value; saveCfg(); socPublishSoon(); });
  box.append(inp, sm); row.append(btn, box);
  ui.setupRoster.appendChild(row);
  syncBots();
}
function syncBots() {
  $('tm' + (cfg.team ? 1 : 0)).checked = true;
  $('botRow').hidden = !!cfg.team;
  $('bc' + cfg.bots).checked = true;
  $('bs' + cfg.skill).checked = true;
  ui.skillRow.hidden = cfg.bots === 0;
  if (cfg.team) { ui.skillRow.hidden = false; ui.pcNote.textContent = `2×2: sen 🟧 + 1 bot sherik — 2 ta ${['oson', 'o‘rta', 'kuchli'][cfg.skill]} bot 🟦 ga qarshi. Kalitni topgan sherik uni darvozaga olib boradi va ochadi — keyin ikkalangiz ham chiqishingiz kerak. Onlayn xonada odamlar navbat bilan jamoalarga bo‘linadi.`; return; }
  ui.pcNote.textContent = cfg.bots === 0 ? 'Yakka o‘yin — faqat sen va labirint.' : `${cfg.bots} ta ${['oson', 'o‘rta', 'kuchli'][cfg.skill]} bot sen bilan bir vaqtda poyga qiladi — har birining o‘z tumani bor.`;
}
function buildCodex() {
  const entry = (host, icon, name, shart, xus) => {
    const e = document.createElement('div'); e.className = 'entry';
    const ic = document.createElement('span'); ic.className = 'ic'; ic.textContent = icon; ic.setAttribute('aria-hidden', 'true');
    const body = document.createElement('div');
    const h = document.createElement('h4'); h.textContent = name;
    const p1 = document.createElement('p'), b1 = document.createElement('b'); b1.textContent = 'Shart: '; p1.append(b1, shart);
    const p2 = document.createElement('p'), b2 = document.createElement('b'); b2.textContent = 'Xususiyat: '; p2.append(b2, xus);
    body.append(h, p1, p2); e.append(ic, body); host.appendChild(e);
  };
  for (const k of BEAST_KINDS) entry(ui.codexBeast, BEASTS[k].icon, BEASTS[k].name, BEASTS[k].games ? poolText(BEASTS[k].games) : BEASTS[k].shart, BEASTS[k].xus);
  entry(ui.codexJump, OBST.chasm.icon, 'Jarlik', '6+ (keng jarlik — 8+). Istalgan juft (1+1 dan boshqa) — albatta sakraysan.', OBST.chasm.xus);
  entry(ui.codexJump, OBST.river.icon, 'Timsohli daryo', OBST.river.shart(1), OBST.river.xus);
  entry(ui.codexJump, PORTAL.icon, PORTAL.name, PORTAL.shart, PORTAL.xus);
  entry(ui.codexJump, '💰', 'Pul xaltasi', 'Ustiga bos.', 'Tanga yig‘asan. Qaroqchi tutsa 5–10 tanga oladi, puling shundan kam bo‘lsa qamaydi.');
  entry(ui.codexJump, '🚪', 'Qulfli darvoza', 'Labirint ichida yashiringan bitta darvoza.', 'Darvozani faqat kalit ochadi. Qayerdaligini faqat kompas ko‘rsatadi. Birinchi bo‘lib chiqqan g‘olib. 2×2 da kalit egasi darvozaga yetsa, u jamoasi uchun ochiladi — sherigi ham chiqishi kerak.');
  entry(ui.codexJump, '🔑', 'Darvoza kaliti', 'Boshi berk yo‘lakda yashirin: ustiga bos.', 'Har bir o‘yinchining o‘z kaliti bor; boshqalarniki ko‘rinmaydi. Kalitni olgach darvoza ochiladi.');
  entry(ui.codexJump, '🪤', 'Qo‘yib ketiladigan tuzoq', '🪄 do‘kon → «Tuzoq» varag‘i (yoki topilgan tuzoq to‘plami).', `Turgan joyingga qo‘yib ketasan, uni faqat o‘zing ko‘rasan; raqib bossa ishlaydi va senga xabar keladi. Bir vaqtda ${PT_MAX} tagacha, ${PT_LIFE / 60} daqiqa turadi. Teleport tuzog‘ida raqib qayerda paydo bo‘lishini o‘zing ochgan joylardan tanlaysan.`);
  entry(ui.codexJump, '🚧', 'Devor', '🪄 do‘kon → «Tuzoq» varag‘i (yoki topilgan to‘plam).', `Oldingdagi yo‘lakni ${PW_LIFE} soniya to‘saydi; hamma ko‘radi, botlar ham aylanib o‘tadi. Boshqa (aylanma) yo‘l bo‘lmasa qo‘yib bo‘lmaydi — hech kim qamalib qolmaydi.`);
  entry(ui.codexJump, '⚔️', 'Duel', 'Raqibdan 3 katak ichida bo‘lsang «Duel» tugmasi (yoki X).', `${DUEL_S} soniya tugmani ko‘p bosish jangi (bot yoki onlayn do‘st bilan). Yutgan ${ECON.duel} tanga oladi, yutqazgan shuncha yo‘qotib orqaga uloqtiriladi.`);
  entry(ui.codexJump, '👑', 'Yetakchi', 'Chiqishga eng yaqin o‘yinchi.', `Hammada ismi oldida 👑 turadi. Unga sehr yoki tuzoq tegsa, xalaqit qilgan +${ECON.bounty} tanga mukofot oladi.`);
  entry(ui.codexJump, '☠️', 'Halok bo‘lish', 'Uchala jon tugasa.', 'O‘yin tugamaydi: 5 soniyadan keyin labirintning boshidan, hech narsasiz (pul, sehr, kalit, xarita, ochilgan joylar yo‘q) 0 dan boshlaysan.');
  entry(ui.codexJump, '⛓️', 'Qamoq', 'Zar tashla: ikkita bir xil zar tushishi kerak.', 'Shunga qadar qamoqdan chiqolmaysan. Qamoq kaliti bo‘lsa — darhol ozod bo‘lasan.');
  entry(ui.codexJump, CHEST.icon, CHEST.name, CHEST.shart, CHEST.xus);
  for (const it of ITEMS) entry(ui.codexItem, it.icon, it.name, it.shart, it.xus);
  for (const t of TRAPS) entry(ui.codexTrap, t.icon, t.name, poolText(t.games), trapXus(t));
  const names = Object.keys(GAMES).filter((k) => k !== 'dice' && k !== 'duel' && EASY_GAMES.has(k)).map((k) => GAMES[k].name);
  ui.codexGames.textContent = `${names.length} xil mini-o‘yin: ${names.join(', ')}. Har tuzoqda sinov har safar tasodifan tanlanadi, shartlari qiyinlikka qarab o‘zgaradi.`;
}

/* ================= Onlayn xona (har kim o‘z qurilmasida) ================= */
// ---- Sozlamalar: GitHub Pages / Play Market versiyasi uchun o‘z serverlarimiz ----
// Firebase konsolidan olingan firebaseConfig ni shu yerga qo‘ying (claude.ai ichida bu ishlatilmaydi — u yerda o‘z serveri bor).
export { buildSetup, syncBots, buildCodex };
