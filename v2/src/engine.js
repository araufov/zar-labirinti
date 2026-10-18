// GameEngine: newGame/startLocal/preview, rejimlar (setMode/pause/resume/toMenu), stepWorld, frame tsikli, avto-sifat (FPS), viewers, startLoop.
import { launch } from './ads.js';
import { Sound } from './audio.js';
import { updateBeasts, updateVans } from './beasts.js';
import { cfg, playerCfg, teamCfg } from './config.js';
import { DIFFS, walk } from './content.js';
import { buildAch, zarEvent } from './events.js';
import { buildViewports, layout, toast, updateHUD } from './hud.js';
import { assignKeys, keysDown, pollPads } from './input.js';
import { mapPickClose, updateLeader } from './magic.js';
import { bfs } from './maze.js';
import { chatOpen, leaveRoom, netDirty, netFlush, updateRemotes } from './net-room.js';
import { markExplored, markVisited, refreshKeys, reveal, setupWorld, updatePlayer } from './player.js';
import { FXQ, drawMinimap, render, updateAmbient, updateParts } from './render.js';
import { store } from './save.js';
import { G, NET, me, ui } from './state.js';
import { expireTraps, expireWalls } from './traps.js';
import { buildDaily, buildTut, tutSetup } from './tutorial.js';
import { $, clamp, fmtTime, randSeed } from './util.js';
import { voiceUI } from './voice.js';
let viewers = [];   // kimning ko‘zi bilan chiziladi (menyuda — ko‘rgazma o‘yinchi)

let mapOn = store.get('jl_map') !== '0';
function newGame(seed, diff, cfg, opts = {}) {
  Sound.init();
  for (const p of G.players) if (p.ui) clearTimeout(p.ui.toastTimer);
  G.online = !!opts.online;
  G.tut = opts.tut || null;
  G.daily = opts.daily || null;
  G.teams = !!opts.teams && !opts.tut && !opts.daily;
  G.gateOpen = [false, false];
  G.reviveUsed = false;
  G.nextZar = 100; G.zarN = 0; G.sleepT = 0;
  G.remotes = new Map();
  NET.fx = []; NET.seen = {}; NET.slotSeed = -1; NET.pdone = new Set();
  setupWorld(seed, diff, cfg);
  for (const p of G.players) { reveal(p); markVisited(p, G.start); }
  for (const p of G.players) { p.cam = { x: p.px, y: p.py }; p.face = { x: 0, y: -1 }; p.route = [G.start]; p.keyDropAt = -1; p.guardOk = false; p.ghostUsed = false; }
  if (G.teams && !G.online) G.players.forEach((p, k) => { p.team = k < 2 ? 0 : 1; });
  refreshKeys();
  viewers = G.players.filter((q) => !q.bot).slice(0, 1);   // ekran faqat o‘yinchining o‘ziga qaraydi (botlarning ko‘zi bilan emas)
  assignKeys();
  keysDown.clear();
  G.mode = 'play';
  buildViewports();
  layout();
  setMode('play');
  const rivals = G.players.length - 1;
  if (G.teams && !G.online) toast(me(), `🟧 2×2: sen va ${G.players[1] ? G.players[1].name : 'sherik'} bir jamoasiz. Kalitni topgan sherik darvozaga olib borib ochadi — keyin ikkalangiz ham chiqasiz!`, 6000);
  if (G.tut) { tutSetup(); voiceUI(); return; }
  if (G.daily) { toast(me(), `📅 Kunlik labirint #${G.daily.no}. Bugun hamma aynan shu labirintni o‘ynaydi — tezroq chiq va natijangni do‘stlaringga yubor!`, 5200); voiceUI(); return; }
  toast(me(), `Kirish yopildi.${rivals ? ` ${rivals} ta raqib ham yo‘lga chiqdi.` : ''} 🔑 Kalitni top (ko‘pincha boshi berk yo‘lakda) → 🚪 darvozani och. Darvoza labirint ichida yashiringan — 🧭 kompas ko‘rsatadi.`, 5000);
  if (rivals || G.online) {
    const m = me();
    setTimeout(() => { if (G.mode === 'play' && me() === m && !m.card) toast(m, '🪄 Do‘kon — o‘ng tepada: raqibga sehr, tuzoq va xaritalar.', 4200); }, 7200);
  }
  voiceUI();
  if (G.online) netDirty(me(), true);
}
function startLocal() { leaveRoom(); launch(() => newGame(randSeed(), selDiff(), cfg.team ? teamCfg() : playerCfg(cfg.bots), { teams: !!cfg.team })); }
function preview() {
  setupWorld(424242, 'medium', [{ name: '', look: cfg.look }]);
  const p = G.players[0], dist = bfs(G.N, G.g, G.start, walk);
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < 0 || dist[i] > 9) continue;
    const x = i % G.N, y = (i / G.N) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) markExplored(p, x + dx, y + dy);
  }
  p.cam = { x: p.px, y: p.py - 2 };
  viewers = [p];
  G.players = [];
  ui.stage.innerHTML = '';
}

function setMode(m) {
  G.mode = m;
  if (m !== 'play') { for (const p of G.players) chatOpen(p, false); document.body.classList.remove('flip'); }
  if (m !== 'play' && m !== 'paused') for (const p of G.players) if (p.ui && p.ui.sabBtn) { p.sab.open = false; p.ui.sabBtn.hidden = true; p.ui.sabPanel.hidden = true; mapPickClose(p, false); }
  document.body.dataset.mode = m;
  const inGame = m === 'play' || m === 'paused';
  ui.tools.hidden = !inGame;
  ui.stage.hidden = !(inGame || m === 'over' || m === 'won');
  ui.menu.hidden = m !== 'menu';
  voiceUI();
  ui.pause.hidden = m !== 'paused';
  ui.end.hidden = !(m === 'over' || m === 'won');
}
function pause() {
  if (G.mode !== 'play') return;
  if (G.online) { const mm = me(); if (mm && (mm.bomb > 0 || G.walls.some((w) => w.owner === mm))) { toast(mm, '⏸ Bomba yoki devor turganda onlayn o‘yinni to‘xtatib bo‘lmaydi.', 3200); return; } }
  keysDown.clear();
  for (const p of G.players) Object.assign(p.joy, { on: false, x: 0, y: 0 });
  ui.pInfo.textContent = `Labirint №${G.seed} · ${DIFFS[G.diff].name}` + (G.online ? ' · onlayn: boshqalar o‘ynashda davom etadi' : '');
  setMode('paused');
  setTimeout(() => ui.pResume.focus({ preventScroll: true }), 30);
}
function resume() { if (G.mode === 'paused') setMode('play'); }
function toMenu() {
  leaveRoom();
  preview();
  refreshBest();
  setMode('menu');
  layout();
  setTimeout(() => ui.bStart.focus({ preventScroll: true }), 30);
}
function selDiff() { const r = document.querySelector('input[name="diff"]:checked'); return r ? r.value : 'medium'; }
function refreshBest() {
  buildTut();
  buildAch();
  buildDaily();
  for (const k of ['easy', 'medium', 'hard']) {
    const v = parseFloat(store.get('jl_best_' + k));
    $('best-' + k).textContent = v > 0 ? 'Rekord: ' + fmtTime(v) : '';
  }
}
function toggleMap() {
  mapOn = !mapOn;
  store.set('jl_map', mapOn ? '1' : '0');
  ui.bMap.setAttribute('aria-pressed', String(mapOn));
  layout();
}
function syncSound() { ui.bSound.setAttribute('aria-pressed', String(!Sound.muted)); }
function setZoom(z) { G.zoom = clamp(z, 0.6, 1.8); store.set('jl_zoom2', String(G.zoom)); layout(); }

/* ================= Zar hodisasi: har 2 daqiqada hammaga bir xil voqea ================= */
let lastT = performance.now(), hudT = 0;
// O‘yin dunyosining bir qadami (chizmasdan): o‘yinchilar, hayvonlar, ovchi.
function stepWorld(dt) {
  G.time += dt;
  for (const p of G.players) updatePlayer(p, dt);
  if (G.mode === 'play') updateBeasts(dt);
  if (G.mode === 'play') updateVans(dt);
  if (G.ptraps.length) expireTraps();
  if (G.walls.length) expireWalls();
  G.leaderT = (G.leaderT || 0) - dt; if (G.leaderT <= 0) { G.leaderT = 0.5; updateLeader(); refreshKeys(); }
  if (G.sleepT > 0) G.sleepT -= dt;
  if (!G.tut && G.time >= G.nextZar) { G.nextZar += 120; zarEvent(); }
}
let fpsAcc = 0, fpsN = 0, fpsT = 0, lowFrames = 0;
function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - lastT) / 1000));
  lastT = now;
  // Avto-sifat: o‘yin paytida 3 soniya davomida o‘rtacha 40 FPS dan past bo‘lsa — qimmat effektlar o‘chadi (keyin yana yoqilmaydi)
  if (G.mode === 'play' && FXQ.auto !== false) {
    fpsAcc += dt; fpsN++;
    if (fpsAcc >= 1) { const fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; lowFrames = fps < 40 ? lowFrames + 1 : 0; if (lowFrames >= 3) { FXQ.dapple = false; FXQ.fog3 = false; FXQ.light2 = false; FXQ.auto = false; store.set('jl_lowfx', '1'); } }
  }
  pollPads();
  if (G.mode === 'play') stepWorld(dt);
  for (const b of G.beasts) if (b.pounce > 0) b.pounce = Math.max(0, b.pounce - dt);
  updateParts(dt);
  updateAmbient(dt);
  updateRemotes(dt);
  if (G.online && NET.dirty && now - NET.lastSent > 120) netFlush();
  render(now / 1000, dt);
  for (const p of G.players) drawMinimap(p, now / 1000);
  if (G.mode === 'play') { hudT -= dt; if (hudT <= 0) { hudT = 0.1; updateHUD(); } }
  requestAnimationFrame(frame);
}

function startLoop() { requestAnimationFrame((t) => { lastT = t; frame(t); }); }
export { viewers, mapOn, newGame, startLocal, preview, setMode, pause, resume, toMenu, selDiff, refreshBest, toggleMap, syncSound, setZoom, lastT, hudT, stepWorld, fpsAcc, fpsN, fpsT, lowFrames, frame, startLoop };
