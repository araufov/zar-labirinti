// Sarguzasht (10 o‘rgatuvchi bosqich: LEVELS/TASKS) va Kunlik labirint (daily).
import { launch } from './ads.js';
import { Sound } from './audio.js';
import { cfg, playerCfg } from './config.js';
import { BOT_NAMES, DIFFS } from './content.js';
import { addRow } from './endgame.js';
import { newGame } from './engine.js';
import { toast } from './hud.js';
import { leaveRoom } from './net-room.js';
import { emit, floatText } from './render.js';
import { store } from './save.js';
import { G, me, ui } from './state.js';
import { $, clamp, fmtTime, shuffle } from './util.js';
DIFFS.daily = { name: 'Kunlik', cells: 18, traps: 9, obstacles: 3, pathObs: 1, portals: 2, items: 6, coins: 6, chests: 3, beasts: [1, 0, 1, 1], vanStep: 480, monkeyR: 12, lvl: 0, fx: DIFFS.easy.fx };
const DAILY_EPOCH = Date.UTC(2026, 9, 17);   // 2026-10-18 — #1
['dailyNo', 'dailyLead', 'dailyGo', 'dailyShare', 'eShare'].forEach((id) => { ui[id] = $(id); });
function dailyNo() { const d = new Date(); return Math.round((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY_EPOCH) / 864e5); }
const dailySeed = (n) => 100000 + (Math.imul(n + 7, 2654435761) >>> 0) % 900000;
function dailyLoad() { try { const o = JSON.parse(store.get('jl_daily') || 'null'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function startDaily() {
  leaveRoom();
  const n = dailyNo();
  launch(() => newGame(dailySeed(n), 'daily', playerCfg(0), { daily: { no: n } }), { title: `Kunlik labirint #${n}` });
}
function dailyEnd(winner) {
  const p = me(), n = G.daily.no, won = !!winner && winner === p, st = dailyLoad();
  let best = false;
  if (won) {
    if (st.day !== n) { st.streak = st.last === n - 1 ? (st.streak | 0) + 1 : 1; st.last = n; st.day = n; st.best = G.time; st.lives = p.lives; st.deaths = p.stats.deaths; best = true; }
    else if (G.time < st.best) { st.best = G.time; st.lives = p.lives; st.deaths = p.stats.deaths; best = true; }
    store.set('jl_daily', JSON.stringify(st));
  }
  ui.eKicker.textContent = `Kunlik labirint #${n}`;
  ui.eTitle.textContent = won ? (best ? 'Bugungi natija!' : 'Yana chiqding!') : 'O‘yin tugadi';
  ui.eVerse.textContent = won ? `⏱ ${fmtTime(G.time)}` + (st.day === n && !best ? ` · bugungi eng yaxshisi ${fmtTime(st.best)}` : '') + ` · 🔥 seriya: ${st.streak | 0} kun. Ertaga yangi labirint!` : 'Ertaga yangi labirint chiqadi — qaytib kel!';
  ui.eNew.textContent = 'Yana o‘ynash';
  ui.eShare.hidden = !(st.day === n);
}
function dailyText() {
  const st = dailyLoad(), n = dailyNo();
  if (st.day !== n) return '';
  const hearts = '❤️'.repeat(st.lives | 0) + '🖤'.repeat(3 - (st.lives | 0));
  const url = /^https?:/.test(location.protocol) ? '\n' + location.origin + location.pathname.replace(/index\.html$/, '') : '';
  return `🎲 Zar Labirinti — Kunlik #${n}\n⏱ ${fmtTime(st.best)} · ${hearts}${st.deaths ? ' · ☠ ' + st.deaths : ''}\n🔥 Seriya: ${st.streak | 0} kun${url}`;
}
function dailyShare() {
  const text = dailyText(), m = me();
  if (!text) return;
  const done = (msg) => { if (m && m.ui && (G.mode === 'play')) toast(m, msg); else { ui.dailyLead.textContent = msg; ui.eNote.hidden = false; ui.eNote.textContent = msg; } };
  if (navigator.share) { navigator.share({ text }).catch(() => {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done('📋 Natija nusxalandi — Telegram yoki istalgan joyga joylang!'), () => done(text));
  else done(text);
}
function buildDaily() {
  if (!ui.dailyGo) return;
  const n = dailyNo(), st = dailyLoad(), played = st.day === n;
  const alive = st.last === n || st.last === n - 1, streak = alive ? st.streak | 0 : 0;
  const d = new Date(), left = Math.max(0, Math.round((new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1) - d) / 60000));
  ui.dailyNo.textContent = `#${n}` + (streak ? ` · 🔥 ${streak}` : '');
  ui.dailyLead.textContent = played
    ? `Bugungi natijang: ⏱ ${fmtTime(st.best)}. Yangi labirintgacha ${Math.floor(left / 60)} soat ${left % 60} daqiqa.`
    : 'Bugun hamma aynan bitta labirintni o‘ynaydi. Tez chiq, natijangni do‘stlaringga yubor' + (streak ? ` va ${streak} kunlik seriyani uzma!` : '!');
  ui.dailyGo.textContent = played ? '↻ Yana o‘ynash' : '▶ Bugungi labirint';
  ui.dailyShare.hidden = !played;
}

/* ================= Sarguzasht: o‘ynab o‘rgatadigan bosqichlar ================= */
// Har bir vazifa: ro‘yxatdagi qisqa nomi, navbati kelganda chiqadigan maslahat va bajarilganini tekshirish.
const TASKS = {
  move: { t: '👣 Yurib ko‘r', tip: '👣 Ekranni bosib suring — joystik chiqadi (kompyuterda WASD yoki strelkalar). Yurgan joying tumandan ochiladi.', ok: (p) => p.dist >= 8 * G.tileM },
  key: { t: '🔑 Kalitingni top', tip: '🔑 Darvoza qulflangan. Kalitingni top — u ko‘pincha boshi berk yo‘lakda yotadi.', ok: (p) => p.gkey },
  compass: { t: '🧭 Kompasni ol', tip: '🧭 Yo‘lda kompas yotibdi — ustidan o‘t. Tepada eng yaqin darvoza tomoni strelka bilan chiqadi.', ok: (p) => p.compass > 0 },
  trap: { t: '⚠️ Tuzoq sinovini yut', tip: '⚠️ Yo‘lda yashirin tuzoq bor. Ustiga bossang kichik o‘yin chiqadi — yutsang tanga olasan.', ok: (p) => p.stats.dodged >= 1 },
  beast: { t: '🐆 Yaguar bilan to‘qnash', tip: '🐆 Bu yerda yaguar yuradi. U yetib kelsa sinov chiqadi. Senda 3 ❤ bor — hammasi tugasa boshidan boshlaysan.', ok: () => G.encounters >= 1 },
  chest: { t: '🧰 Sandiqni och', tip: '🧰 Sandiqqa bor: topishmoq yoki o‘yinni yechsang — sovg‘a chiqadi.', ok: (p) => p.stats.chests >= 1 },
  coins10: { t: '💰 10 tanga yig‘', tip: '💰 Yerdagi pul xaltalarini yig‘ — har biri 5 tanga.', ok: (p) => p.stats.coins >= 10 },
  coins5: { t: '💰 5 tanga yig‘', tip: '💰 Pul xaltasini top — do‘kondan sehr olish uchun tanga kerak.', ok: (p) => p.stats.coins >= 5 },
  shop: { t: '🪄 Raqibga sehr ishlat', tip: '🪄 O‘ng tepadagi «Do‘kon» tugmasini bos, sehr tanla va raqibga ishlat.', ok: (p) => p.stats.sabotage >= 1 },
  leader: { t: '👑 Yetakchi bo‘l', tip: '👑 Chiqishga eng yaqin o‘yinchi — yetakchi. Raqiblardan oldinga o‘t!', ok: (p) => !!p.leader },
  jump: { t: '🎲 Zar bilan sakra', tip: '🎲 Jarlik yoki daryoga yetganda zar tashlaysan: yetarli son tushsa — narigi tomonga sakraysan.', ok: (p) => p.stats.jumps >= 1 },
  exit: { t: '🚪 Darvozadan chiq', tip: '🚪 Endi darvozani top va undan chiq!', ok: (p) => p.finished },
};
const BASE_L = { traps: 0, obstacles: 0, pathObs: 0, portals: 0, items: 0, coins: 0, chests: 0, beasts: [0, 0, 0, 0], vanStep: 500, monkeyR: 10, lvl: 0, fx: DIFFS.easy.fx, noMaps: true };
const LEVELS = [
  { t: 'Birinchi qadam', cells: 5, seed: 31415, freeKey: true, tasks: ['move', 'exit'], tips: { exit: '🚪 Endi darvozani top va undan chiq. Bu safar kalit allaqachon senda.' },
    intro: 'Labirint tuman ichida — yurgan sari yo‘l ochiladi.' },
  { t: 'Kalit', cells: 6, seed: 27182, tasks: ['key', 'exit'], intro: 'Darvozalar qulflangan — avval o‘z kalitingni top.' },
  { t: 'Kompas', cells: 8, seed: 16180, onPath: { item: [['compass', 0.1]] }, tasks: ['compass', 'key', 'exit'], intro: 'Darvoza qayerdaligini faqat kompas ko‘rsatadi.' },
  { t: 'Tuzoq', cells: 8, seed: 14142, traps: 3, trapPool: ['monsoon', 'vines'], onPath: { trap: [0.2, 0.5] }, tasks: ['trap', 'key', 'exit'],
    intro: 'Ba’zi kataklarda yashirin tuzoq bor — ular oldindan ko‘rinmaydi.' },
  { t: 'Hayvon va jon', cells: 9, seed: 17320, items: 2, itemPool: ['fruit'], onPath: { beast: [['jaguar', 0.4]] }, tasks: ['beast', 'key', 'exit'],
    intro: 'Senda 3 ❤. Hayvon sinovini yutsang — u qochib ketadi.' },
  { t: 'Sandiq va tanga', cells: 9, seed: 22360, chests: 2, coins: 4, onPath: { chest: [0.3], coin: [0.12, 0.45] }, tasks: ['chest', 'coins10', 'key', 'exit'],
    intro: 'Labirintda xazina sandiqlari va pul xaltalari bor.' },
  { t: 'Do‘kon', cells: 9, seed: 26457, coins: 4, onPath: { coin: [0.1, 0.22] }, bots: 1, botWait: 30, tasks: ['coins5', 'shop', 'key', 'exit'],
    intro: 'Bu safar bitta raqib bor. Tangalaringga do‘kondan unga xalaqit sehri ol!' },
  { t: 'Poyga', cells: 10, seed: 30000, coins: 3, bots: 2, botWait: 6, tasks: ['leader', 'key', 'exit'], tips: { exit: '🏁 Birinchi bo‘lib chiq — raqib oldinroq chiqsa, bosqich qaytadan.' },
    intro: 'Ikki raqib bilan poyga: kim birinchi chiqsa — o‘sha g‘olib.' },
  { t: 'Jarlik va daryo', cells: 9, seed: 33166, obstacles: 3, pathObs: 2, tasks: ['jump', 'key', 'exit'],
    intro: 'Ba’zi yo‘laklarni jarlik yoki daryo kesib o‘tadi — ulardan faqat zar bilan o‘tiladi.' },
  { t: 'Yakuniy sinov', cells: 12, seed: 36055, traps: 6, items: 5, coins: 5, chests: 2, obstacles: 2, pathObs: 1, portals: 2, beasts: [1, 0, 0, 1], noMaps: false,
    bots: 1, botSkill: 1, botWait: 4, tasks: ['key', 'chest', 'exit'], intro: 'Hammasi birga: tuzoq, hayvon, sandiq, girdob va raqib. Omad!' },
];
LEVELS.forEach((L, k) => { DIFFS['L' + (k + 1)] = Object.assign({}, BASE_L, L, { name: `${k + 1}-bosqich` }); });
['tutGrid', 'tutSum', 'tutLead', 'tutGo'].forEach((id) => { ui[id] = $(id); });

function tutLoad() { try { const a = JSON.parse(store.get('jl_tut') || '[]'); return Array.isArray(a) ? a.map((v) => clamp(v | 0, 0, 3)) : []; } catch (e) { return []; } }
function tutSave(a) { store.set('jl_tut', JSON.stringify(a)); }
function startTut(n, seed) {
  leaveRoom();
  const L = LEVELS[n - 1], conf = playerCfg(0);
  const names = shuffle(BOT_NAMES.slice()), looks = shuffle([0, 1, 2, 3].filter((k) => k !== cfg.look));
  for (let k = 0; k < (L.bots || 0); k++) conf.push({ name: names[k], look: looks[k % looks.length], bot: true, skill: L.botSkill || 0 });
  launch(() => newGame(seed || L.seed, 'L' + n, conf, { tut: { n, L, done: L.tasks.map(() => false), cur: -2, tipAt: 0, dirty: true } }), { ad: n > 3, title: `Sarguzasht · ${n}-bosqich` });
}
function tutSetup() {
  const T_ = G.tut, L = T_.L;
  for (const p of G.players) {
    if (L.freeKey) p.gkey = true;
    if (p.bot) p.bot.wait = L.botWait || 0;
  }
  T_.tipAt = G.time + 4.6;
  toast(me(), `🎓 ${T_.n}-bosqich · ${L.t}. ${L.intro}`, 4400);
  tutRender();
}
const tutTip = (k) => (G.tut.L.tips && G.tut.L.tips[k]) || TASKS[k].tip;
function tutTick() {
  const T_ = G.tut, p = me();
  if (!T_ || !p || !p.ui || G.mode !== 'play') return;
  T_.L.tasks.forEach((k, i) => {
    if (T_.done[i] || k === 'exit' || !TASKS[k].ok(p)) return;
    T_.done[i] = true; T_.dirty = true;
    floatText(p.px, p.py, '✅', '#9be58a'); emit(p.px, p.py, 14, 'spark'); Sound.ok();
  });
  const cur = T_.done.indexOf(false);
  if (cur !== T_.cur && G.time >= T_.tipAt && !p.card && !p.pending && p.alive) {
    const first = T_.cur === -2;
    T_.cur = cur; T_.dirty = true;
    if (cur >= 0) toast(p, (first ? '' : '✅ Bajarildi! ') + tutTip(T_.L.tasks[cur]), 5200);
  }
  if (T_.dirty) tutRender();
}
function tutRender() {
  const T_ = G.tut, p = me();
  if (!T_ || !p || !p.ui) return;
  T_.dirty = false;
  const box = p.ui.tutbox;
  box.hidden = false;
  box.innerHTML = '';
  const b = document.createElement('b'); b.textContent = `🎓 ${T_.n}/${LEVELS.length} · ${T_.L.t}`;
  const ul = document.createElement('ul');
  T_.L.tasks.forEach((k, i) => {
    const li = document.createElement('li');
    li.className = T_.done[i] ? 'tok' : i === T_.done.indexOf(false) ? 'tcur' : '';
    li.textContent = (T_.done[i] ? '✅ ' : i === T_.done.indexOf(false) ? '▶ ' : '▫️ ') + TASKS[k].t.replace(/^\S+\s/, '');
    ul.appendChild(li);
  });
  box.append(b, ul);
}
function tutEnd(winner) {
  const T_ = G.tut, p = me(), n = T_.n, won = !!winner && winner === p;
  if (won) T_.done[T_.L.tasks.indexOf('exit')] = true;
  const all = T_.done.every(Boolean), noLoss = p.stats.deaths === 0 && p.lives === 3;
  const stars = won ? 1 + (all ? 1 : 0) + (noLoss ? 1 : 0) : 0;
  const prog = tutLoad(), prev = prog[n - 1] | 0;
  if (stars > prev) { while (prog.length < n) prog.push(0); prog[n - 1] = stars; tutSave(prog); }
  const last = n === LEVELS.length;
  ui.eKicker.textContent = `Sarguzasht · ${n}/${LEVELS.length} · ${T_.L.t}`;
  ui.eTitle.textContent = won ? (last ? 'Sarguzasht tugadi!' : 'Bosqich o‘tildi!') : 'Raqib oldinroq chiqdi';
  ui.eVerse.textContent = won
    ? '⭐'.repeat(stars) + '☆'.repeat(3 - stars) + '  ' + (last ? 'Sen hammasini o‘rganding. Endi katta labirint seni kutmoqda!' : stars < 3 ? 'Uchala yulduz uchun qaytadan o‘ynab ko‘r.' : 'Ajoyib — uchala yulduz!')
    : 'Bu safar raqib tezroq bo‘ldi. Qaytadan urinib ko‘r — endi yo‘lni bilasan.';
  const dl = document.createElement('dl');
  dl.className = 'stats tutstars';
  addRow(dl, '⭐ Labirintdan chiqding', won ? '✓' : '✗', won ? 'record' : '');
  addRow(dl, '⭐ Hamma vazifalar bajarildi', all ? '✓' : `✗ (${T_.done.filter(Boolean).length}/${T_.done.length})`, all ? 'record' : '');
  addRow(dl, '⭐ Bitta ham jon yo‘qotmading', noLoss ? '✓' : '✗', noLoss ? 'record' : '');
  ui.eBody.prepend(dl);
  ui.eNew.textContent = won ? (last ? 'Erkin o‘yinni boshlash' : `Keyingi: ${n + 1}-bosqich ▶`) : 'Qaytadan';
  ui.eSame.textContent = 'Shu bosqichni qaytadan';
}
function buildTut() {
  if (!ui.tutGrid) return;
  const prog = tutLoad(), done = LEVELS.filter((_, k) => prog[k] > 0).length, sum = prog.reduce((a, v) => a + (v | 0), 0);
  let next = LEVELS.findIndex((_, k) => !(prog[k] > 0));
  ui.tutGrid.innerHTML = '';
  LEVELS.forEach((L, k) => {
    const b = document.createElement('button'), s = prog[k] | 0, open = k === 0 || prog[k - 1] > 0;
    b.type = 'button'; b.className = 'tl' + (k === next ? ' next' : '') + (open ? '' : ' locked');
    b.disabled = !open;
    b.title = `${k + 1}-bosqich: ${L.t}`;
    b.setAttribute('aria-label', `${k + 1}-bosqich: ${L.t}` + (open ? (s ? `, ${s} yulduz` : '') : ', yopiq'));
    const nb = document.createElement('b'); nb.textContent = String(k + 1);
    const sm = document.createElement('small'); sm.textContent = open ? '★'.repeat(s) + '☆'.repeat(3 - s) : '🔒';
    b.append(nb, sm);
    b.addEventListener('click', () => startTut(k + 1));
    ui.tutGrid.appendChild(b);
  });
  ui.tutSum.textContent = `${done}/${LEVELS.length} · ⭐ ${sum}/${LEVELS.length * 3}`;
  ui.tutLead.textContent = done === 0 ? 'Yangi o‘yinchimisiz? 10 ta qisqa bosqichda hammasini o‘ynab o‘rganasiz — har biri 1–2 daqiqa.'
    : next >= 0 ? `Keyingi bosqich: «${LEVELS[next].t}».` : 'Hammasi o‘tildi! Yulduzlarni to‘ldirish uchun istalgan bosqichni qayta o‘ynang.';
  ui.tutGo.textContent = done === 0 ? '🎓 O‘rganishni boshlash' : next >= 0 ? `▶ Davom: ${next + 1}-bosqich` : '🎓 Bosqichlarni qayta o‘ynash';
  ui.tutGo.className = 'btn tut-go ' + (next >= 0 ? 'primary' : 'ghost');
  ui.tutGo.onclick = () => startTut(next >= 0 ? next + 1 : 1);
}

/* ================= Natija ================= */
export { DAILY_EPOCH, dailyNo, dailySeed, dailyLoad, startDaily, dailyEnd, dailyText, dailyShare, buildDaily, TASKS, BASE_L, LEVELS, tutLoad, tutSave, startTut, tutSetup, tutTip, tutTick, tutRender, tutEnd, buildTut };
