// PlayerController (harakat va voqealar): tryStep/arrive/onEnterTile, buyum olish, tangalar, kalitlar, qaroqchi/qamoq, portal, jon yo‘qotish/tirilish, finish.
import { Ads } from './ads.js';
import { Sound, buzz } from './audio.js';
import { beastFlee, caught, land, pickTarget, teleportTo, updateSlide, updateTele } from './beasts.js';
import { BOT_SKILL, botCardUpdate, botInit, botKeyHint, botSay, botStep, botTools, botTraps, botWalls, ears, nearMe } from './bots.js';
import { cardDir, finishCard, openCard } from './cards.js';
import { duelReset } from './combat.js';
import { BEASTS, CHEST, ECON, ITEMS, MIRROR_S, PLACE_KEYS, PORTAL, PTRAPS, T, TOOLS, TRAPS, beastFloor, walk } from './content.js';
import { beastCard, chestCard, jumpCard, trapCard } from './encounters.js';
import { endGame } from './endgame.js';
import { guardCard } from './events.js';
import { toast } from './hud.js';
import { inputVec, quant } from './input.js';
import { addTool, applyFx, endAmnesia, feed, feedShow, mapPickClose, rivalTargets, scrVec } from './magic.js';
import { bfs, generate } from './maze.js';
import { netDirty } from './net-room.js';
import { emit, floatText, mmInit, mmSet, mmSetAll } from './render.js';
import { G, NET, freeP, freshBag, freshFx, freshTools, makePlayer, me, remoteList } from './state.js';
import { pipsClear } from './toolsui.js';
import { PWALL, bombTick, dropWalls, placedHit } from './traps.js';
import { LEVELS } from './tutorial.js';
import { pickRand, reduceMotion } from './util.js';
function markExplored(p, x, y) {
  const N = G.N;
  if (x < 0 || y < 0 || x >= N || y >= N) return;
  const i = y * N + x;
  if (p.explored[i]) return;
  p.explored[i] = 1;
  if (walk(G.g[i])) p.exploredPath++;
  mmSet(p, i);
}
function markVisited(p, i) {
  if (!p.visited[i]) { p.visited[i] = 1; mmSet(p, i); }
  p.lastMove = G.time;
  if (G.scent && p.cloak <= 0) { G.scent[i] = G.time; G.scentWho[i] = p.id; }   // hayvonlar shu izdan hid oladi
}
function histPush(p, i) { p.hist.push(i); if (p.hist.length > 800) p.hist.splice(0, 200); }
const REV = (() => {
  const a = [];
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) if ((dx || dy) && dx * dx + dy * dy <= 10) a.push([dx, dy]);
  return a.sort((p, q) => Math.abs(p[0]) + Math.abs(p[1]) - Math.abs(q[0]) - Math.abs(q[1]));
})();
function reveal(p) {
  const N = G.N, cx = p.px, cy = p.py, R2 = p.fever > 0 ? 2 : p.torch > 0 ? 10 : p.fogT > 0 ? 2 : p.look === 0 ? 8 : p.look === 3 ? 4 : 5, vis = new Uint8Array(49);
  const open = (x, y) => x >= 0 && y >= 0 && x < N && y < N && G.g[y * N + x] !== T.WALL;
  vis[24] = 1; markExplored(p, cx, cy);
  for (const [dx, dy] of REV) {
    if (dx * dx + dy * dy > R2) continue;
    const sx = Math.sign(dx), sy = Math.sign(dy);
    let ok = false;
    if (sx && vis[(dy + 3) * 7 + (dx - sx + 3)] && open(cx + dx - sx, cy + dy)) ok = true;
    if (!ok && sy && vis[(dy - sy + 3) * 7 + (dx + 3)] && open(cx + dx, cy + dy - sy)) ok = true;
    if (ok) { vis[(dy + 3) * 7 + (dx + 3)] = 1; markExplored(p, cx + dx, cy + dy); }
  }
}

function setupWorld(seed, diff, cfg) {
  const w = generate(seed, diff);
  Object.assign(G, w, { seed, diff, vans: [], parts: [], floats: [], pops: [], time: 0, winner: null, encounters: 0, ptraps: [], rptraps: [], walls: [], rwalls: [], wallRef: new Map() });
  NET.dl = null; NET.duelPrompt = null;
  NET.pdone.clear();   // yangi o‘yin: oldingi o‘yindagi «allaqachon bosilgan» belgilari qolmasin
  G.players = cfg.map((c, k) => { const p = makePlayer(k, c.name, c.look); if (c.bot) botInit(p, c.skill); return p; });
  G.scent = new Float32Array(w.N * w.N).fill(-1e9);
  G.scentWho = new Int8Array(w.N * w.N).fill(-1);
  G.beasts = w.beastSpawns.map((b, k) => {
    const x = b.i % w.N, y = (b.i / w.N) | 0;
    // Hudud markazi: yaqin atrofdagi xazina (yoki pul xaltasi) — hayvon uni qo‘riqlaydi; bo‘lmasa tug‘ilgan joyi.
    const sb = bfs(w.N, w.g, b.i, beastFloor);
    let home = b.i, hs = 1e9;
    for (let i = 0; i < w.N * w.N; i++) {
      if (!(w.chest[i] || w.coin[i]) || sb[i] < 0 || sb[i] > 14) continue;
      const sc = sb[i] + (w.chest[i] ? 0 : 4);
      if (sc < hs) { hs = sc; home = i; }
    }
    return { type: b.type, x, y, fx: x, fy: y, acc: 0, state: 'wander', timer: 0, cool: 0, prev: -1, faceX: -1, pounce: 0, dir: 0, seed: k * 1.7, target: -1,
      home, hd: bfs(w.N, w.g, home, beastFloor), mem: new Map(), alert: '', alertT: 0, last: -1, sd: null, fd: null, flankAt: -1, role: '', lunge: 0, leapAt: -99, sensT: 0 };
  });
  for (const p of G.players) if (!p.bot) mmInit(p);
  document.body.classList.remove('rewind');
}

function tryStep(p, dx, dy) {
  const N = G.N, nx = p.px + dx, ny = p.py + dy;
  if ((!dx && !dy) || nx < 0 || ny < 0 || nx >= N || ny >= N) return false;
  const t = G.g[ny * N + nx];
  if (t === T.WALL) return false;
  p.face = { x: dx, y: dy };
  p.lastMove = G.time;
  if (t === T.ENTRY) { toast(p, 'Ortga yo‘l yo‘q. O‘yinni oxiriga yetkaz!'); return true; }
  if (t === T.EXIT && hasKey(p) && !p.guardOk && !(G.tut && G.tut.n < LEVELS.length)) { guardCard(p); return true; }
  if (t === T.EXIT && !hasKey(p)) { toast(p, G.teams ? '🔒 Darvoza qulflangan! Sen yoki sherigingdan biri kalitni topishi kerak.' : '🔒 Darvoza qulflangan! Labirintda yashirilgan kalitingni top.'); return true; }
  if (t === T.CHASM || t === T.RIVER) { jumpCard(p, dx, dy); return true; }
  p.mfx = p.px; p.mfy = p.py; p.px = nx; p.py = ny;
  p.moving = true; p.moveT = 0; p.stepMs = (p.fever > 0 ? 336 : p.boots > 0 ? 118 : 186) * (p.bot ? p.bot.K.step : 1) * (p.slow > 0 ? 1.9 : 1) * (p.look === 3 ? 0.85 : 1);
  reveal(p);
  if (Math.random() < 0.5) emit(p.mfx, p.mfy + 0.25, 1, 'dust');
  netDirty(p);
  for (const v of G.vans) if (G.players[v.target] === p && v.x === nx && v.y === ny) { caught(p, v); break; }
  return true;
}
function stepFromInput(p) {
  const v = scrVec(p, inputVec(p)), ax = Math.abs(v.x), ay = Math.abs(v.y);
  if (Math.max(ax, ay) < 0.35) return false;
  const prim = ax >= ay ? [Math.sign(v.x), 0] : [0, Math.sign(v.y)];
  const sec = ax >= ay ? (ay >= 0.3 ? [0, Math.sign(v.y)] : null) : (ax >= 0.3 ? [Math.sign(v.x), 0] : null);
  if (tryStep(p, prim[0], prim[1])) return true;
  if (sec && tryStep(p, sec[0], sec[1])) return true;
  p.face = { x: prim[0], y: prim[1] };
  const now = performance.now();
  if (now - p.bumpAt > 320) { p.bumpAt = now; Sound.bump(); }
  return false;
}

function arrive(p) {
  const i = p.py * G.N + p.px;
  if (p === me()) { p.stepK = !p.stepK; Sound.step(p.stepK); }
  p.dist += G.tileM;
  markVisited(p, i);
  p.trail.push(i);
  if (p.route && p.route.length < 60000) p.route.push(i);
  if (p.trail.length > 240) p.trail.splice(0, 40);
  histPush(p, i);
  onEnterTile(p, i);
}
function onEnterTile(p, i) {
  netDirty(p);
  if (G.g[i] === T.EXIT) { finish(p); return; }
  // Tanga, kalit va topilmalar hayvon uchrashuvidan oldin olinadi (uchrashuv kartasi ularni qoldirib ketmasin)
  if (G.coin[i]) takeCoins(p, i);
  if (G.keyAt[i] === p.keySlot && !p.gkey) takeGateKey(p, i);
  if (G.item[i] >= 0) pickup(p, i);
  const b = G.beasts.find((q) => q.x === p.px && q.y === p.py && q.cool <= 0);
  if (b && p.cloak <= 0) { encounter(b, p); return; }
  if (G.chest[i] && !p.spent[i]) { G.pops.push({ x: p.px, y: p.py, icon: CHEST.icon, t: 0 }); holdThen(p, 0.45, () => chestCard(p, i)); return; }
  if (G.trap[i] >= 0 && !p.spent[i]) { triggerTrap(p, i); return; }
  if ((G.ptraps.length || G.rptraps.length) && placedHit(p, i)) return;   // begona qo‘yilgan tuzoq
  if (G.g[i] === T.PORTAL) portalStep(p);
}
function holdThen(p, sec, fn) { p.pending = { t: reduceMotion ? 0.05 : sec, fn }; }
function triggerTrap(p, i) {
  if (!p.bot) buzz(45);
  G.pops.push({ x: p.px, y: p.py, icon: TRAPS[G.trap[i]].icon, t: 0 });
  Sound.sting();
  p.shake = 0.25;
  holdThen(p, 0.6, () => trapCard(p, i));
}
function encounter(b, p) {
  if (!freeP(p) || b.cool > 0 || p.cloak > 0) return;
  G.encounters++;
  const bandit = !!BEASTS[b.type].bandit;
  b.pounce = 0.6;
  b.state = 'rest'; b.timer = 99; b.cool = 99;
  G.pops.push({ x: b.x, y: b.y, icon: BEASTS[b.type].icon, t: 0 });
  ears(p, () => (bandit ? Sound.growl() : Sound.roar()));
  p.shake = 0.4;
  holdThen(p, bandit ? 0.5 : 0.6, () => (bandit ? banditCatch(p, b) : beastCard(p, b)));
}
function pickup(p, i) {
  const it = ITEMS[G.item[i]];
  if (it.key === 'fruit' && p.lives >= 3) { toast(p, 'Joning to‘la — olma shu yerda qoldi.'); return; }
  G.item[i] = -1;
  mmSetAll(i);
  p.stats.items++;
  const solo = !!(TOOLS[it.key] || it.key === 'mirror' || it.key === 'trapkit') && !rivalTargets(p).length;
  applyGift(p, it.key);
  emit(p.px, p.py, 18, 'gold');
  Sound.pickup();
  toast(p, solo ? 'Raqib yo‘q — sehr tangaga aylandi!' : it.text);
}
function giveCoins(p, n) {
  p.coins += n; p.stats.coins += n;
  floatText(p.px, p.py, `+${n} 💰`, '#ffd56e');
}
function applyGift(p, key) {
  if (key === 'torch') { p.torch = 60; reveal(p); floatText(p.px, p.py, 'Mash’al', '#ffd56e'); }
  else if (key === 'compass') { p.compass = 75; floatText(p.px, p.py, 'Kompas', '#ffd56e'); }
  else if (key === 'boots') { p.boots = 20; floatText(p.px, p.py, 'Tezlik!', '#9fe3ff'); }
  else if (key === 'shield') { p.shield = 1; floatText(p.px, p.py, 'Qalqon', '#9fe3ff'); }
  else if (key === 'fruit' || key === 'life') { p.lives = Math.min(3, p.lives + 1); floatText(p.px, p.py, '+1 ❤', '#ff7a6a'); netDirty(p); }
  else if (key === 'gold') teleportTo(p, pickTarget(p, 'closer'), 'portal');
  else if (key === 'mirror') {
    if (!rivalTargets(p).length) { giveCoins(p, ECON.pouch); return; }   // yolg‘iz o‘yinda foyda yo‘q
    p.mirror = MIRROR_S; floatText(p.px, p.py, '🪞 Ko‘zgu', '#cfe9ff'); netDirty(p);
  }
  else if (key === 'trapkit') {
    if (!rivalTargets(p).length) { giveCoins(p, ECON.pouch); return; }
    const k = pickRand(PLACE_KEYS), d = k === 'wall' ? PWALL : PTRAPS[k]; p.tbag[k]++;
    floatText(p.px, p.py, `${d.icon} ${d.name}`, '#e7b3ff');
    toast(p, `${d.icon} ${d.name} sumkangga tushdi! 🪄 do‘kon → «Tuzoq» varag‘idan qo‘y.`, 3600);
  }
  else if (key === 'coins') giveCoins(p, ECON.chest);
  else if (key === 'jackpot') giveCoins(p, ECON.jackpot);
  else if (key === 'map') revealArea(p, 13);
  else if (key === 'cloak') { p.cloak = 30; floatText(p.px, p.py, 'Plash', '#cfe9ff'); netDirty(p); }
  else if (key === 'wings') { p.wings = 1; floatText(p.px, p.py, 'Qanotlar', '#cfe9ff'); }
  else if (key === 'luck') { p.luck = 1; floatText(p.px, p.py, 'Omadli zar', '#ffe07a'); }
  else if (key === 'key') { p.key = Math.min(2, p.key + 1); floatText(p.px, p.py, 'Qamoq kaliti', '#ffd56e'); }
  else if (key === 'keymap') learnKeyMap(p);
  else if (key === 'chestmap') learnChestMap(p);
  else if (TOOLS[key]) addTool(p, key);
}

/* ---- Kalitlar: har kimga bittadan; raqib kalitlari ko‘rinadi (ololmaysan), halok bo‘lsang kaliting o‘sha joyda qoladi ---- */
G.keyLive = new Int8Array(8);   // 0 — egasi yo‘q yoki olib bo‘lgan; 1 — yerda yotibdi (egasi bor)
function keyOwners() {
  const out = [];
  for (const q of G.players) out.push({ slot: q.keySlot, got: q.gkey, team: q.team });
  for (const r of remoteList()) if (r.ks >= 0) out.push({ slot: r.ks, got: !!r.gk, team: r.team });
  return out;
}
function refreshKeys() {
  G.keyLive.fill(0);
  for (const o of keyOwners()) if (o.slot >= 0 && o.slot < 8 && !o.got) G.keyLive[o.slot] = 1;
}
// Jamoada: sherikdan biri kalit topsa — darvoza ikkalasiga ochiq.
// Jamoada: kalit egasi darvozaga yetib, uni ochadi — shundan keyin sherigi ham o‘tadi (onlaynda: sherik kalit bilan chiqqan bo‘lsa)
const hasKey = (p) => !!p && (p.gkey || (!!G.teams && p.team !== undefined && ((G.gateOpen && G.gateOpen[p.team]) || remoteList().some((r) => r.team === p.team && r.gk && r.fin))));
const sameTeam = (p, x) => !!G.teams && !!p && !!x && p.team !== undefined && p.team === x.team;
function placeKey(slot, cell) {
  const old = G.keyCells[slot];
  if (old === cell) return;
  if (old >= 0 && G.keyAt[old] === slot) { G.keyAt[old] = -1; mmSetAll(old); }
  G.keyCells[slot] = cell;
  if (cell >= 0) { G.keyAt[cell] = slot; mmSetAll(cell); }
}
function dropKey(p) {
  if (!p.gkey) return;
  const N = G.N, here = p.py * N + p.px;
  let cell = -1;
  if (G.g[here] === T.PATH && G.keyAt[here] < 0) cell = here;
  else { const d = bfs(N, G.g, here, walk); let bd = 1e9; for (let i = 0; i < N * N; i++) if (d[i] >= 0 && d[i] < bd && G.g[i] === T.PATH && G.keyAt[i] < 0) { bd = d[i]; cell = i; } }
  if (cell < 0) return;
  placeKey(p.keySlot, cell);
  p.gkey = false; p.keyDropAt = cell;
  netDirty(p, true);
}

/* ---- Pul, qaroqchi, qamoq ---- */
// Darvoza kaliti: har kimning o‘zi uchun alohida; olgach boshqa kalit ko‘rinmaydi.
function setKeySlot(p, slot) {
  const old = G.keyCells[p.keySlot];
  p.keySlot = slot;
  if (old >= 0 && p.explored[old]) mmSet(p, old);
  const nw = G.keyCells[slot];
  if (nw >= 0 && p.explored[nw]) mmSet(p, nw);
}
function takeGateKey(p, i) {
  p.gkey = true; mmSet(p, i); p.guardOk = false;
  if (!p.bot) buzz(60);
  if (p.bot) botSay(p, 5, true);
  emit(p.px, p.py, 22, 'gold'); Sound.pickup();
  floatText(p.px, p.py, '🔑 Kalit!', '#9fe3ff');
  toast(p, '🔑 Darvoza kaliti sendan! Endi istalgan darvozani ocha olasan — kompas yo‘lni ko‘rsatadi.', 4200);
  netDirty(p);
}
function learnKeyMap(p) {
  p.knowKey = true;
  floatText(p.px, p.py, '📜 Kalit xaritasi', '#9fe3ff');
  toast(p, p.gkey ? '📜 Kalit xaritasi — lekin kalitingni allaqachon topgansan.' : '📜 Kalitingning joyi belgilandi: minixaritaga va tepadagi yo‘nalishga qara!', 4200);
}
function learnChestMap(p) {
  p.knowChest = true;
  floatText(p.px, p.py, '🗺️ Xazina xaritasi', '#ffd56e');
  toast(p, '🗺️ Hamma sandiqlar joyi belgilandi: minixaritaga va tepadagi yo‘nalishga qara!', 4200);
}
function takeCoins(p, i) {
  ears(p, () => Sound.coin());
  const n = G.coin[i];
  G.coin[i] = 0; mmSetAll(i);
  p.coins += n; p.stats.coins += n;
  if (p.ui && !p.hintTools && p.coins >= 4 && rivalTargets(p).length) { p.hintTools = true; setTimeout(() => { if (G.mode === 'play' && !p.card) toast(p, 'Pul bilan 🪄 do‘kondan raqibga xalaqit sehri sotib olsa bo‘ladi!', 4200); }, 1800); }
  emit(p.px, p.py, 14, 'gold'); Sound.pickup();
  floatText(p.px, p.py, `+${n} 💰`, '#ffd56e');
  toast(p, `Pul xaltasi: +${n} tanga!`);
}
// Qaroqchi tutdi: 5–10 tanga tortib oladi; puling shundan kam bo‘lsa — qamoqqa tashlaydi.
function banditCatch(p, b) {
  const amt = 5 + ((Math.random() * 6) | 0);
  if (p.coins >= amt) {
    p.coins -= amt;
    floatText(p.px, p.py, `−${amt} 💰`, '#ff9a6a');
    toast(p, `Qaroqchi ${amt} ta tangani tortib olib qochdi. Qamoqdan qutulding!`);
    beastFlee(b, p);
    return;
  }
  if (p.shield > 0) {
    p.shield = 0; floatText(p.px, p.py, 'Qalqon!', '#9fe3ff');
    toast(p, `Puling yetmadi (${amt} 💰 kerak edi), lekin qalqon seni qamoqdan saqladi!`);
    beastFlee(b, p);
    return;
  }
  beastFlee(b, p);
  toast(p, `Puling yetmadi (${amt} 💰 kerak edi) — qaroqchi seni qamoqqa tashladi!`);
  sendToJail(p);
}
function sendToJail(p) {
  if (p.jail) return;
  p.jail = true; p.stats.jailed++;
  duelReset(p);
  feed('jail', p);
  floatText(p.px, p.py, 'Qamoq!', '#ff9a8a'); emit(p.px, p.py, 10, 'dust');
  Sound.drum(1, 0.6); Sound.bump();
  netDirty(p, true);
  jailCard(p);
}
function freeFromJail(p, viaKey) {
  p.jail = false;
  floatText(p.px, p.py, viaKey ? '🗝️ Ozod!' : 'Ozod!', '#9be38a');
  toast(p, viaKey ? 'Kalit bilan qamoqdan chiqding!' : 'Qamoqdan chiqding!');
  netDirty(p, true);
}
function jailCard(p) {
  const key = p.key > 0;
  openCard(p, { kind: 'jail', icon: '⛓️', kicker: 'Qamoq', title: 'Qamoqqa tushding', rhyme: 'Temir panjara, sovuq devor,\nIkki bir xil zar — yagona yo‘l.',
    shart: 'Zar tashla: ikkita bir xil zar (1-1, 2-2 … 6-6) tushmaguncha qamoqdan chiqolmaysan. Urinishlar cheksiz.',
    xus: 'Boshqalar shu orada yuraveradi. Qamoq kaliti bo‘lsa — darhol chiqasan.',
    info: 'Chiqish uchun ikkita bir xil zar kerak', prompt: 'Zar tashla — ikkita bir xil zar kerak.',
    back: key, onBack: () => { p.key--; freeFromJail(p, true); },
    game: { type: 'dice', tries: 99, resolve: (a, b) => (a === b
      ? { ok: true, cls: 'good', msg: `Ikkita ${a}! Qulf ochildi — qamoqdan chiqding.` }
      : { done: false, msg: `${a} va ${b} — har xil. Yana tashla!` }) },
    onClose: () => { if (p.jail) freeFromJail(p, false); } });
  if (key && p.card && p.card.el) p.card.el.back.textContent = 'Qamoq kaliti ishlat 🗝️';
}
function callBandit(q) {
  const bs = G.beasts.filter((b) => BEASTS[b.type].bandit);
  if (!bs.length) return false;
  const N = G.N, dist = bfs(N, G.g, q.py * N + q.px, beastFloor), cands = [];
  for (let i = 0; i < dist.length; i++) if (dist[i] >= 6 && dist[i] <= 9 && G.g[i] === T.PATH) cands.push(i);
  if (!cands.length) return false;
  bs.sort((a, b) => Math.hypot(a.x - q.px, a.y - q.py) - Math.hypot(b.x - q.px, b.y - q.py));
  const b = bs[0], at = pickRand(cands);
  b.x = at % N; b.y = (at / N) | 0; b.fx = b.x; b.fy = b.y; b.prev = -1; b.acc = 0; b.cool = 0;
  b.state = 'chase'; b.timer = BEASTS.bandit.chaseTime + 3; b.target = q.id;
  return true;
}
function revealArea(p, R) {
  const N = G.N, R2 = R * R;
  for (let y = Math.max(0, p.py - R); y <= Math.min(N - 1, p.py + R); y++)
    for (let x = Math.max(0, p.px - R); x <= Math.min(N - 1, p.px + R); x++) if ((x - p.px) ** 2 + (y - p.py) ** 2 <= R2) markExplored(p, x, y);
  emit(p.px, p.py, 20, 'spark');
}
function portalStep(p) {
  G.pops.push({ x: p.px, y: p.py, icon: PORTAL.icon, t: 0 });
  holdThen(p, 0.35, () => {
    p.stats.portals++;
    toast(p, 'Sehrli girdob seni tasodifiy joyga uloqtirdi!');
    teleportTo(p, pickTarget(p, 'random'), 'portal');
  });
}

/* ---- raqibga xalaqit beruvchi sehrlar (🪄 tugma: pulga sotib olish yoki sumkadan ishlatish) ---- */
function loseLife(p) {
  if (!p.bot) buzz([90, 40, 90]);
  p.lives = Math.max(0, p.lives - 1);
  p.hurtT = 1.1;
  if (p.lives <= 0) p.alive = false;
  Sound.hurt();
  p.shake = 0.45;
  if (p.ui) { const f = p.ui.flash; f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
  emit(p.px, p.py - 0.2, 12, 'blood');
  floatText(p.px, p.py, '−1 ❤', '#ff6a5a');
  netDirty(p);
}
const RESPAWN_S = 5;        // halok bo‘lgach shuncha soniyadan keyin boshidan tug‘iladi
const RESPAWN_IMMUNE = 5;   // yangi tug‘ilgach shuncha soniya sehr tegmaydi
const respawnVerse = (p) => `Hamma narsang yo‘qoladi: pul, sehrlar, kalit, xaritalar. ${Math.max(1, Math.ceil(p.respawnT))} soniyadan keyin labirintning boshidan, 0 dan boshlaysan.`;
// Uchala jon tugadi: o‘yin tugamaydi — biroz o‘tib o‘yinchi hamma narsasini yo‘qotib, boshidan boshlaydi.
function playerDown(p) {
  if (p.respawnT > 0) return;
  dropKey(p);
  p.respawnT = RESPAWN_S;
  p.stats.deaths++;
  p.moving = false; p.moveT = 1; p.jump = null; p.slide = null; p.tele = null; p.pending = null;
  mapPickClose(p, false);
  duelReset(p);
  feed('death', p); ears(p, () => Sound.sad());
  if (G.ptraps.some((t) => t.owner === p)) G.ptraps = G.ptraps.filter((t) => t.owner !== p);   // 0 dan boshlaydi: qo‘ygan tuzoqlari ham yo‘qoladi
  dropWalls(p);
  const offer = !!p.ui && !G.reviveUsed && Ads.enabled();
  if (offer) p.respawnT = RESPAWN_S + 4;   // reklama haqida o‘ylab olishga vaqt
  if (p.ui) { p.ui.out.hidden = false; p.ui.outTitle.textContent = 'Halok bo‘lding'; p.ui.outVerse.textContent = respawnVerse(p); p.ui.adrev.hidden = !offer; p.ui.ghost.hidden = !rivalTargets(p).length; p.ui.ghost.textContent = '👻 Arvoh bo‘lib yetakchiga tuman pufla'; p.ui.ghost.disabled = false; }
  else if (p.bot) { const m = me(); if (m) toast(m, `${p.name} halok bo‘ldi — hamma narsasini yo‘qotib, boshidan boshlaydi.`); }
  netDirty(p, true);
}
// Boshidan, hech narsasiz: jon, pul, sehrlar, kalit, xaritalar, ochilgan joylar — hammasi yangidan. (Ism, qiyofa va statistika qoladi.)
function respawn(p) {
  const n = G.N * G.N, st = G.start, x = st % G.N, y = (st / G.N) | 0;
  Object.assign(p, {
    px: x, py: y, mfx: x, mfy: y, moving: false, moveT: 1, face: { x: 0, y: -1 }, ph: 0, prevQ: null,
    jump: null, slide: null, tele: null, pending: null, card: null,
    lives: 3, alive: true, respawnT: 0, hurtT: 0, shake: 0,
    coins: 0, key: 0, luck: 0, wings: 0, cloak: 0, frozen: 0, slow: 0, jail: false, immune: RESPAWN_IMMUNE, stun: 0, stunIcon: '', scramble: 0, scMap: 0,
    fever: 0, torch: 0, compass: 0, boots: 0, shield: 0,
    gkey: false, knowKey: false, knowChest: false,
    fxq: [], ...freshFx(), tools: freshTools(), tbag: freshBag(), mirror: 0, amnesia: 0, memE: null, memPath: 0, pick: null,
    explored: new Uint8Array(n), visited: new Uint8Array(n), spent: new Uint8Array(n), exploredPath: 0,
    trail: [st], hist: [st], pdFor: -1, lastMove: -99, cam: { x, y },
  });
  Object.assign(p.sab, { open: false, step: 'tools', key: null, sig: '', ref: null });
  mapPickClose(p, false);
  duelReset(p);
  pipsClear(p);
  if (p.bot) { const old = p.bot; botInit(p, BOT_SKILL.indexOf(old.K)); Object.assign(p.bot, { prev: old.prev, dist: old.dist, q: old.q }); }
  G.vans = G.vans.filter((v) => v.target !== p.id);
  if (!p.bot) mmInit(p);
  const keyLeft = p.keyDropAt >= 0 && G.keyCells[p.keySlot] === p.keyDropAt;
  if (keyLeft) p.knowKey = true;
  p.keyDropAt = -1;
  reveal(p); markVisited(p, st);
  if (p.ui) { p.ui.out.hidden = true; p.ui.adrev.hidden = true; p.ui.ghost.hidden = true; p.ui.cardwrap.hidden = true; p.ui.cardwrap.innerHTML = ''; }
  if (!p.bot) document.body.classList.remove('rewind');
  emit(x, y, 28, 'spark');
  floatText(x, y, 'Qayta tug‘ilding', '#cfe9ff');
  ears(p, () => Sound.portal());
  toast(p, keyLeft ? '3 jon qaytdi. 🔑 Kaliting halok bo‘lgan joyingda qoldi — tepadagi yo‘nalish ko‘rsatadi, uni faqat sen ola olasan.' : 'Hamma narsang yo‘qoldi — labirintni boshidan boshlayapsan. 3 jon qaytdi.', 5200);
  if (p.bot) { const m = me(); if (m && nearMe(p)) toast(m, `${p.name} boshidan boshladi.`); botSay(p, 4, false); }
  netDirty(p, true);
}
function finish(p) {
  p.finished = true;
  p.finAt = Date.now();
  emit(p.px, p.py, 60, 'confetti');
  netDirty(p, true);
  if (G.teams && !G.online && p.team !== undefined) {
    const mates = G.players.filter((q) => q !== p && q.team === p.team);
    if (p.gkey && !G.gateOpen[p.team]) {
      G.gateOpen[p.team] = true;
      for (const q of mates) { q.compass = 9999; toast(q, `🚪 ${p.name} darvozani kalit bilan ochdi! Endi sen ham chiqishing kerak — kompas yo‘lni ko‘rsatadi.`, 5200); if (q.bot) q.bot.know = { x: G.exitX, y: G.exitY }; }
      feedShow(`🚪 ${p.name} jamoasi uchun darvozani ochdi!`);
    }
    if (mates.some((q) => !q.finished)) {
      if (p.ui) { p.ui.out.hidden = false; p.ui.outTitle.textContent = 'Chiqding!'; p.ui.outVerse.textContent = `Sheriging (${mates.filter((q) => !q.finished).map((q) => q.name).join(', ')}) ham chiqishi kerak — jamoa shundagina yutadi.`; p.ui.adrev.hidden = true; p.ui.ghost.hidden = true; }
      Sound.ok();
      return;
    }
  }
  endGame(p);
}

function updatePlayer(p, dt) {
  if (p.bot) { ears(p, () => updatePlayerInner(p, dt)); return; }
  updatePlayerInner(p, dt);
}
const nextStep = (p) => (p.frozen > 0 || p.stun > 0 || p.jail || p.pick ? false : p.bot ? botStep(p) : stepFromInput(p));
function updatePlayerInner(p, dt) {
  if (p.finished) return;
  if (!p.alive) {   // halok bo‘lgan: sanoq tugagach boshidan tug‘iladi
    if (p.adBusy) return;   // reklama ko‘rilayotganda sanoq to‘xtaydi
    if (p.respawnT > 0) { p.respawnT -= dt; if (p.respawnT <= 0) respawn(p); }
    return;
  }
  if (p.bot && p.bot.wait > 0) p.bot.wait -= dt;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.fever > 0) { p.fever -= dt; if (p.fever <= 0) { p.fever = 0; reveal(p); toast(p, 'Isitma tushdi. Ko‘zing yana ravshan.'); } }
  if (p.torch > 0) { p.torch -= dt; if (p.torch <= 0) { p.torch = 0; toast(p, 'Mash’al o‘chdi.'); } }
  if (p.compass > 0) p.compass = Math.max(0, p.compass - dt);
  if (p.fogT > 0) { p.fogT -= dt; if (p.fogT <= 0) { p.fogT = 0; reveal(p); } }
  if (p.boots > 0) p.boots = Math.max(0, p.boots - dt);
  if (p.frozen > 0) { p.frozen = Math.max(0, p.frozen - dt); if (p.frozen === 0) toast(p, 'Muz erib ketdi — yana yurasan.'); }
  if (p.slow > 0) p.slow = Math.max(0, p.slow - dt);
  if (p.scramble > 0) { p.scramble = Math.max(0, p.scramble - dt); if (p.scramble === 0) toast(p, '🎮 Boshqaruv tiklandi.'); }
  if (p.stun > 0) { p.stun = Math.max(0, p.stun - dt); if (p.stun === 0) toast(p, 'Garanglik o‘tdi — yana yurasan.'); }
  if (p.immune > 0) { p.immune = Math.max(0, p.immune - dt); if (p.immune === 0) netDirty(p); }
  if (p.mirror > 0) { p.mirror = Math.max(0, p.mirror - dt); if (p.mirror === 0) toast(p, '🪞 Ko‘zgu xira tortdi.'); }
  if (p.amnesia > 0) { p.amnesia = Math.max(0, p.amnesia - dt); if (p.amnesia === 0) endAmnesia(p); }
  if (p.flip > 0) { p.flip = Math.max(0, p.flip - dt); if (p.flip === 0) toast(p, '🙃 Dunyo yana to‘g‘ri bo‘ldi.'); }
  if (p.mask > 0) { p.mask = Math.max(0, p.mask - dt); if (p.mask === 0) { toast(p, 'Maska tushdi — yana o‘zingsan 😄'); netDirty(p, true); } }
  if (p.liar > 0) { p.liar = Math.max(0, p.liar - dt); if (p.liar === 0) toast(p, '🧭 Kompas tuzaldi.'); }
  if (p.shutT > 0) { p.shutT = Math.max(0, p.shutT - dt); if (p.shutT === 0) toast(p, '🏪 Do‘kon ochildi (narxlar hali 2 baravar).'); }
  if (p.taxT > 0) { p.taxT = Math.max(0, p.taxT - dt); if (p.taxT === 0) toast(p, '🏪 Narxlar odatdagiga qaytdi.'); }
  if (p.radar > 0) { p.radar = Math.max(0, p.radar - dt); if (p.radar === 0) toast(p, '📡 Radar o‘chdi.'); }
  if (p.duelCool > 0) p.duelCool = Math.max(0, p.duelCool - dt);
  if (p.bomb > 0) bombTick(p, dt);
  if (p.bot) { botKeyHint(p, dt); botTools(p, dt); botTraps(p, dt); botWalls(p, dt); }
  if (p.cloak > 0) { p.cloak = Math.max(0, p.cloak - dt); if (p.cloak === 0) { toast(p, 'Plash o‘z kuchini yo‘qotdi.'); netDirty(p); } }
  if (p.moving || p.slide) p.ph += dt * Math.PI * 1000 / (p.slide ? 90 : p.stepMs);
  if (p.pending) { p.pending.t -= dt; if (p.pending.t <= 0) { const f = p.pending.fn; p.pending = null; f(); } return; }
  if (p.card && p.card.bot) { botCardUpdate(p, dt); return; }
  if (p.card) {
    const c = p.card;
    if (c.stage === 'play' && c.g.update) c.g.update(dt);
    // Umumiy chegara: 45 soniya hech narsa bosilmasa — sinov yutqaziladi (karta ochiq holda qolib ketmasin)
    if (c.stage === 'play') { c.idle = (c.idle || 0) + dt; if (c.idle > 45) { c.idle = 0; finishCard(c, false, '⏱ Vaqt tugadi — hech narsa bosmading.'); } }
    const q = quant({ x: (p.joy.on ? p.joy.x : 0) + p.pad.x, y: (p.joy.on ? p.joy.y : 0) + p.pad.y });
    const qs = q ? q.join() : '', ps = p.prevQ ? p.prevQ.join() : '';
    if (q && qs !== ps && p.card === c) cardDir(p, q);
    p.prevQ = q;
    return;
  }
  if (p.fxq.length && freeP(p)) { const f = p.fxq.shift(); if (G.time - f.t < 25 || f.kind === 'bomb') applyFx(p, f.kind, f.arg, f.from); }   // band paytida kelgan sehr endi tegadi
  if (p.jail && freeP(p)) { jailCard(p); return; }   // qamoqda kartasiz qolib ketmasin
  if (p.tele) updateTele(p, dt);
  else if (p.slide) updateSlide(p, dt);
  else if (p.jump) { p.jump.t += dt / p.jump.dur; if (p.jump.t >= 1) land(p); }
  else if (p.moving) {
    p.moveT += (dt * 1000) / p.stepMs;
    if (p.moveT >= 1) {
      const over = (p.moveT - 1) * p.stepMs;
      p.moving = false; p.moveT = 1;
      arrive(p);
      if (G.mode === 'play' && freeP(p) && nextStep(p) && p.moving) p.moveT = Math.min(0.9, over / p.stepMs);
    }
  }
  if (G.mode === 'play' && freeP(p) && !p.moving) nextStep(p);
}

export { markExplored, markVisited, histPush, REV, reveal, setupWorld, tryStep, stepFromInput, arrive, onEnterTile, holdThen, triggerTrap, encounter, pickup, giveCoins, applyGift, keyOwners, refreshKeys, hasKey, sameTeam, placeKey, dropKey, setKeySlot, takeGateKey, learnKeyMap, learnChestMap, takeCoins, banditCatch, sendToJail, freeFromJail, jailCard, callBandit, revealArea, portalStep, loseLife, RESPAWN_S, RESPAWN_IMMUNE, respawnVerse, playerDown, respawn, finish, updatePlayer, nextStep, updatePlayerInner };
