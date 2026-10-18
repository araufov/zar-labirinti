// Zar hodisalari (ZAR_EV), arvoh, qo‘riqchi, yo‘lni qayta ko‘rsatish (replay), yutuqlar (ACH).
import { Sound, buzz } from './audio.js';
import { pushBack } from './beasts.js';
import { BOT_SKILL } from './bots.js';
import { openCard } from './cards.js';
import { ECON, T, V } from './content.js';
import { kick } from './encounters.js';
import { addRow } from './endgame.js';
import { describe } from './games.js';
import { applyFx, feed, feedShow, rivalTargets, sendFx } from './magic.js';
import { reveal } from './player.js';
import { makeCanvas, mmSetAll } from './render.js';
import { store } from './save.js';
import { G, lvl, me, ui } from './state.js';
import { LEVELS, dailyLoad, tutLoad } from './tutorial.js';
import { $, TAU, hash2, pickRand, shuffle } from './util.js';
const ZAR_EV = [
  { i: '💰', t: 'Tanga yomg‘iri', d: 'Hammaning yoniga pul xaltalari tushdi!', f: (p) => coinRain(p) },
  { i: '🌫️', t: 'Qalin tuman', d: '20 soniya hamma faqat yonini ko‘radi.', f: (p) => { p.fogT = 20; } },
  { i: '😴', t: 'Hayvonlar uxladi', d: '25 soniya hayvonlar qimirlamaydi — fursatdan foydalan!', g: () => { G.sleepT = 25; } },
  { i: '💨', t: 'Shamol', d: '15 soniya hamma ikki baravar tez yuradi.', f: (p) => { p.boots = Math.max(p.boots, 15); } },
  { i: '🧭', t: 'Kompas', d: '20 soniya hammaga kompas — darvoza qayerda?', f: (p) => { p.compass = Math.max(p.compass, 20); } },
  { i: '🐢', t: 'Yetakchiga to‘siq', d: 'Yetakchi 15 soniya sekin yuradi!', f: (p) => { if (p.leader) p.slow = Math.max(p.slow, 15); } },
  { i: '🔥', t: 'Mash’al', d: '30 soniya hamma uzoqni ko‘radi.', f: (p) => { p.torch = Math.max(p.torch, 30); reveal(p); } },
];
function coinRain(p) {
  const N = G.N, c = [];
  for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
    const x = p.px + dx, y = p.py + dy, i = y * N + x;
    if (x < 1 || y < 1 || x >= N - 1 || y >= N - 1 || (dx === 0 && dy === 0)) continue;
    if (G.g[i] === T.PATH && !G.coin[i] && G.trap[i] < 0 && G.item[i] < 0 && !G.chest[i] && G.keyAt[i] < 0) c.push(i);
  }
  shuffle(c).slice(0, 2).forEach((i) => { G.coin[i] = ECON.pouch; mmSetAll(i); });
}
let zarEl = null;
function zarEvent() {
  const ev = ZAR_EV[hash2(G.seed, G.zarN++) % ZAR_EV.length];
  if (ev.g) ev.g();
  for (const p of G.players) if (p.alive && !p.finished && ev.f) ev.f(p);
  for (const p of G.players) if (p.alive && ev.f === undefined) reveal(p);
  for (const p of G.players) reveal(p);
  feedShow(`🎲 Zar hodisasi: ${ev.i} ${ev.t} — ${ev.d}`);
  if (!zarEl) { zarEl = document.createElement('div'); zarEl.className = 'zarban'; zarEl.setAttribute('role', 'status'); document.body.appendChild(zarEl); }
  const m = me();
  if (m && (m.card || m.pending)) return;   // karta ochiq: faqat lentada ko‘rinadi
  zarEl.innerHTML = '<span class="zd">🎲</span><b></b><span></span>';
  zarEl.querySelector('b').textContent = 'Zar tashlanmoqda…';
  zarEl.classList.add('show', 'roll');
  buzz(30); Sound.ok();
  setTimeout(() => {
    zarEl.classList.remove('roll');
    zarEl.querySelector('.zd').textContent = ev.i;
    zarEl.querySelector('b').textContent = ev.t;
    zarEl.querySelectorAll('span')[1].textContent = ev.d;
  }, 900);
  setTimeout(() => zarEl.classList.remove('show'), 5200);
}

/* ================= Arvoh: halok bo'lgan o'yinchi yetakchiga tuman puflaydi (bir marta) ================= */
function ghostPuff(p) {
  if (p.alive || p.ghostUsed || !p.ui) return;
  const ts = rivalTargets(p).sort((a, b) => a.d - b.d), t = ts[0];
  if (!t) return;
  p.ghostUsed = true;
  if (t.kind === 'local') applyFx(t.q, 'fogbomb', undefined, p); else sendFx(t, 'fogbomb', undefined, p);
  feed('fogbomb', p, t);
  p.ui.ghost.textContent = `👻 ${t.name} tumanga burkandi!`;
  p.ui.ghost.disabled = true;
}

/* ================= Darvoza qo'riqchisi: kalit bilan darvozaga yetganda oxirgi sinov ================= */
const GUARD_GAMES = [V('arrows'), V('simon'), V('memory'), V('redlight'), V('glass'), V('dino'), V('stack'), V('pattern')];
function guardCard(p) {
  const game = pickRand(GUARD_GAMES);
  openCard(p, { kind: 'guard', icon: '🗿', kicker: kick('Darvoza qo‘riqchisi', game), title: 'Oxirgi sinov', rhyme: 'Kalit qo‘lingda, eshik ro‘parangda,\nLekin qo‘riqchi turibdi yo‘lingda.', shart: describe(game, lvl()),
    xus: 'Yutsang — darvoza ochiladi. Yutqazsang — 5 qadam ortga uloqtirilasan va yana urinib ko‘rasan.', game,
    onResult: (ok) => { if (ok) { p.guardOk = true; Sound.ok(); return 'Qo‘riqchi yo‘l berdi — endi darvozaga kir!'; } Sound.hurt(); return 'Qo‘riqchi seni ortga itarib yubordi!'; },
    onClose: (ok) => { if (!ok && p.alive) pushBack(p, 5, 'dust'); } });
}

/* ================= Yo'llarni takrorlash: o'yin oxirida hamma yurgan yo'l 8 soniyada ================= */
let replayRaf = 0;
function replayRoutes() {
  const c = ui.endMap, g = c.getContext('2d'), N = G.N, sc = c.width / N;
  if (!G.endBase) { G.endBase = makeCanvas(c.width, c.height); G.endBase.getContext('2d').drawImage(c, 0, 0); }
  const base = G.endBase, many = G.players.length > 1, dur = 8000, t0 = performance.now();
  const lines = G.players.filter((q) => q.route && q.route.length > 1).map((q) => ({ r: q.route, col: many ? q.color : '#ff3b1f' }));
  cancelAnimationFrame(replayRaf);
  const frame = () => {
    const k = Math.min(1, (performance.now() - t0) / dur);
    g.drawImage(base, 0, 0);
    g.lineWidth = Math.max(1.5, sc * 0.55); g.lineCap = 'round'; g.lineJoin = 'round';
    for (const L of lines) {
      const n = Math.max(1, Math.floor(L.r.length * k));
      g.strokeStyle = L.col; g.beginPath();
      for (let j = 0; j < n; j++) {
        const i = L.r[j], x = ((i % N) + 0.5) * sc, y = (((i / N) | 0) + 0.5) * sc;
        const pr = j ? L.r[j - 1] : -1, jump = pr < 0 || Math.abs((pr % N) - (i % N)) + Math.abs(((pr / N) | 0) - ((i / N) | 0)) > 7;
        if (jump) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
      const h = L.r[n - 1], hx = ((h % N) + 0.5) * sc, hy = (((h / N) | 0) + 0.5) * sc;
      g.fillStyle = L.col; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, sc * 0.4);
      g.beginPath(); g.arc(hx, hy, Math.max(4, sc * 1.4), 0, TAU); g.fill(); g.stroke();
    }
    if (k < 1 && (G.mode === 'won' || G.mode === 'over')) replayRaf = requestAnimationFrame(frame);
  };
  frame();
}

/* ================= Yutuqlar ================= */
const ACH = [
  { id: 'win1', i: '🏁', t: 'Birinchi g‘alaba', d: 'Erkin o‘yinda birinchi bo‘lib chiq.' },
  { id: 'clean', i: '❤️', t: 'Toza o‘yin', d: 'Bitta ham jon yo‘qotmasdan yut.' },
  { id: 'hard', i: '🏔️', t: 'Qiyin labirint', d: 'Qiyin labirintda yut.' },
  { id: 'fast', i: '⚡', t: 'Chaqmoq', d: 'O‘rta labirintni 10 daqiqadan tez o‘t.' },
  { id: 'bots3', i: '🤖', t: 'Uchtasini ham', d: '3 ta kuchli botga qarshi yut.' },
  { id: 'team', i: '🤝', t: 'Jamoa ruhi', d: '2×2 rejimda sherik bilan birga chiq.' },
  { id: 'rich', i: '💰', t: 'Boyvachcha', d: 'Bitta o‘yinda 100 tanga yig‘.' },
  { id: 'chest5', i: '🧰', t: 'Xazinachi', d: 'Bitta o‘yinda 5 ta sandiq och.' },
  { id: 'duel3', i: '⚔️', t: 'Duelchi', d: 'Bitta o‘yinda 3 ta duel yut.' },
  { id: 'sab10', i: '🪄', t: 'Sehrgar', d: 'Bitta o‘yinda 10 marta xalaqit ber.' },
  { id: 'phoenix', i: '🔥', t: 'Qaytib keldi', d: 'Halok bo‘lib, baribir yut.' },
  { id: 'tutall', i: '🎓', t: 'Sarguzasht tugadi', d: '10 ta bosqichning hammasini o‘t.' },
  { id: 'tut30', i: '⭐', t: 'Uchala yulduz', d: 'Sarguzashtda 30 ta yulduz to‘pla.' },
  { id: 'daily3', i: '📅', t: 'Uch kun ketma-ket', d: 'Kunlik labirintni 3 kun ketma-ket o‘t.' },
  { id: 'daily7', i: '🔥', t: 'Bir hafta', d: 'Kunlik labirintni 7 kun ketma-ket o‘t.' },
];
['achList', 'achSum', 'eReplay'].forEach((id) => { ui[id] = $(id); });
function achLoad() { try { const o = JSON.parse(store.get('jl_ach') || '{}'); return o && typeof o === 'object' ? o : {}; } catch (e) { return {}; } }
function achCheck(winner) {
  const got = achLoad(), p = me(), now = [];
  const give = (id) => { if (!got[id]) { got[id] = Date.now(); now.push(ACH.find((a) => a.id === id)); } };
  const won = !!winner && (winner === p || (G.teams && winner.team === p.team));
  if (won && !G.tut && !G.daily) give('win1');
  if (won && winner === p && p.stats.deaths === 0 && p.lives === 3 && !G.tut) give('clean');
  if (won && G.diff === 'hard') give('hard');
  if (won && winner === p && G.diff === 'medium' && G.time < 600) give('fast');
  if (won && winner === p && !G.teams && G.players.filter((q) => q.bot && q.bot.K === BOT_SKILL[2]).length >= 3) give('bots3');
  if (won && G.teams) give('team');
  if (won && winner === p && p.stats.deaths > 0) give('phoenix');
  if (p.stats.coins >= 100) give('rich');
  if (p.stats.chests >= 5) give('chest5');
  if (p.stats.duelWins >= 3) give('duel3');
  if (p.stats.sabotage >= 10) give('sab10');
  const tp = tutLoad();
  if (LEVELS.every((_, k) => tp[k] > 0)) give('tutall');
  if (tp.reduce((a, v) => a + (v | 0), 0) >= 30) give('tut30');
  const ds = dailyLoad();
  if ((ds.streak | 0) >= 3) give('daily3');
  if ((ds.streak | 0) >= 7) give('daily7');
  if (now.length) {
    store.set('jl_ach', JSON.stringify(got));
    const dl = document.createElement('dl'); dl.className = 'stats tutstars';
    for (const a of now) addRow(dl, `🏆 Yangi yutuq: ${a.i} ${a.t}`, '✓', 'record');
    ui.eBody.prepend(dl);
  }
}
function buildAch() {
  if (!ui.achList) return;
  const got = achLoad();
  ui.achList.innerHTML = '';
  for (const a of ACH) {
    const li = document.createElement('li'); if (!got[a.id]) li.className = 'off';
    const ic = document.createElement('i'); ic.textContent = a.i;
    const box = document.createElement('div'), b = document.createElement('b'), sm = document.createElement('small');
    b.textContent = a.t; sm.textContent = a.d; box.append(b, sm); li.append(ic, box); ui.achList.appendChild(li);
  }
  ui.achSum.textContent = `${ACH.filter((a) => got[a.id]).length}/${ACH.length}`;
}

/* ================= 2×2: sen + 1 bot sherik, 2 ta bot raqib ================= */
export { ZAR_EV, coinRain, zarEl, zarEvent, ghostPuff, GUARD_GAMES, guardCard, replayRaf, replayRoutes, ACH, achLoad, achCheck, buildAch };
