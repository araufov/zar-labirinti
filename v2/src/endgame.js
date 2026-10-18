// O‘yin yakuni: endGame, natijalar jadvali, statistikalar, yakuniy xarita.
import { Sound, buzz } from './audio.js';
import { DIFFS, T } from './content.js';
import { setMode } from './engine.js';
import { achCheck } from './events.js';
import { keysDown } from './input.js';
import { netDirty } from './net-room.js';
import { avatarURL, makeCanvas } from './render.js';
import { store } from './save.js';
import { G, NET, me, remoteList, ui } from './state.js';
import { pipsClear } from './toolsui.js';
import { dailyEnd, tutEnd } from './tutorial.js';
import { TAU, fmtDist, fmtPct, fmtTime } from './util.js';
function endGame(winner) {
  if (G.mode === 'over' || G.mode === 'won') return;
  G.vans = [];
  for (const p of G.players) pipsClear(p);
  for (const p of G.players) { if (p.ui) p.ui.out.hidden = true; if (p.card) { p.card = null; if (p.ui) { p.ui.cardwrap.hidden = true; p.ui.cardwrap.innerHTML = ''; } } p.pending = null; p.jump = null; p.slide = null; p.tele = null; p.moving = false; }
  keysDown.clear();
  document.body.classList.remove('rewind');
  G.winner = winner;
  const mine = !!winner && (winner === me() || (!!G.teams && winner.team !== undefined && winner.team === me().team));
  setMode(winner ? 'won' : 'over');
  if (mine) buzz([60, 40, 140]);
  if (mine) Sound.win(); else Sound.lose();
  const D = DIFFS[G.diff], local = winner && G.players.includes(winner), total = G.players.length + G.remotes.size;
  ui.eKicker.textContent = `Labirint №${G.seed} · ${D.name}` + (total > 1 ? ` · ${total} o‘yinchi` : '') + (G.online ? ' · onlayn' : '');
  ui.eTitle.textContent = G.teams ? (mine ? 'Jamoang yutdi!' : winner ? 'Raqib jamoa yutdi' : 'O‘yin tugadi') : mine ? 'Ozodsan!' : winner ? 'Ortda qolding' : 'O‘yin tugadi';
  if (total === 1) ui.eVerse.textContent = winner ? 'Oxirgi zar tashlandi, o‘rmon jim bo‘ldi — sen labirintdan chiqding.' : 'Tuman seni o‘z bag‘riga oldi. Labirint yana kimnidir kutmoqda…';
  else if (mine) ui.eVerse.textContent = 'Sen labirintdan birinchi bo‘lib chiqding — zar oxirgi marta jaranglab, o‘rmon jim bo‘ldi.';
  else if (winner) ui.eVerse.textContent = `${winner.name} labirintdan birinchi bo‘lib chiqdi. Keyingi safar sen birinchi bo‘l!`;
  else ui.eVerse.textContent = 'Hech kim chiqa olmadi. Labirint hammani o‘z bag‘riga oldi…';
  ui.eBody.innerHTML = '';
  if (total === 1) soloStats(winner); else standings(winner);
  ui.eShare.hidden = true;
  if (G.tut) tutEnd(winner);
  else if (G.daily) dailyEnd(winner);
  else { ui.eNew.textContent = 'Yangi labirint'; ui.eSame.textContent = 'Shu labirintni qaytadan'; }
  G.endBase = null;
  drawEndMap();
  achCheck(winner);
  const host = !G.online || NET.host;
  ui.eNew.hidden = !host; ui.eSame.hidden = !host || (!!G.tut && !winner) || !!G.daily;
  ui.eNote.hidden = host;
  ui.eNote.textContent = 'Xona egasi yangi o‘yinni boshlasa, sizda ham avtomatik boshlanadi.';
  if (local && G.online) netDirty(winner, true);
  setTimeout(() => (host ? ui.eNew : ui.eMenu).focus({ preventScroll: true }), 50);
}
function addRow(dl, k, v, cls) {
  const div = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
  dt.textContent = k; dd.textContent = v; if (cls) dd.className = cls; div.append(dt, dd); dl.appendChild(div);
}
function remainingFrom(x, y) {
  const d = G.distExit[Math.round(y) * G.N + Math.round(x)];   // eng yaqin darvozagacha
  return d > 0 ? d * G.tileM : 0;
}
function soloStats(winner) {
  const p = G.players[0], dl = document.createElement('dl');
  dl.className = 'stats';
  let record = '';
  if (winner && !G.tut && !G.daily) {
    const key = 'jl_best_' + G.diff, prev = parseFloat(store.get(key));
    if (!(prev > 0) || G.time < prev) { store.set(key, String(G.time)); record = prev > 0 ? 'Yangi rekord!' : 'Birinchi g‘alaba — rekord!'; }
  }
  addRow(dl, 'Vaqt', fmtTime(G.time));
  addRow(dl, 'Yurilgan masofa', fmtDist(p.dist));
  addRow(dl, 'Ochilgan maydon', fmtPct(G.walkTotal ? (p.exploredPath / G.walkTotal) * 100 : 0));
  addRow(dl, 'Qolgan jon', `${p.lives} / 3`);
  if (p.stats.deaths) addRow(dl, 'Halok bo‘lib, boshidan boshlagan', `${p.stats.deaths} marta`);
  addRow(dl, 'Yutilgan sinovlar', String(p.stats.dodged));
  addRow(dl, 'Yutqazilgan sinovlar', String(p.stats.caught));
  addRow(dl, 'Sakrash · girdob · sandiq', `${p.stats.jumps} · ${p.stats.portals} · ${p.stats.chests}`);
  addRow(dl, 'Topilmalar', String(p.stats.items));
  addRow(dl, 'Pul · qamoq', `${p.coins} 💰 (jami ${p.stats.coins}) · ${p.stats.jailed} marta`);
  if (p.stats.sabotage || p.stats.hit) addRow(dl, 'Xalaqit: berdingiz · oldingiz', `${p.stats.sabotage} · ${p.stats.hit}`);
  addRow(dl, 'Eng qisqa yo‘l', fmtDist((G.sol.length - 1) * G.tileM));
  if (!winner) { const r = remainingFrom(p.px, p.py); if (r > 0) addRow(dl, 'Chiqishgacha qolgan yo‘l', fmtDist(r)); }
  if (record) addRow(dl, 'Rekord', record, 'record');
  ui.eBody.appendChild(dl);
}
function standings(winner) {
  const rows = [];
  const tb = (x) => (G.teams && x.team !== undefined ? (x.team === 0 ? '🟧 ' : '🟦 ') : '');
  for (const p of G.players) rows.push({ name: tb(p) + p.name + (p.bot ? ' 🤖' : ' (sen)'), look: p.look, color: p.color, alive: p.alive, fin: p.finished, lives: p.lives, dist: p.dist, rem: p.finished ? 0 : remainingFrom(p.px, p.py), me: p === winner, extra: `${p.stats.dodged} sinov yutildi` + (p.stats.deaths ? ` · ☠ ${p.stats.deaths}` : '') });
  for (const r of remoteList()) rows.push({ name: tb(r) + r.name + (r.isBot ? ' 🤖' : ''), look: r.look, color: r.color, alive: r.alive, fin: r.fin, lives: r.lives, dist: r.dist, rem: r.fin ? 0 : remainingFrom(r.x, r.y), me: r === winner, extra: (r.isBot ? 'bot' : 'onlayn') + (r.deaths ? ` · ☠ ${r.deaths}` : '') });
  rows.sort((a, b) => (a.me ? -1 : b.me ? 1 : a.rem === b.rem ? 0 : a.rem - b.rem));
  const ol = document.createElement('ol');
  ol.className = 'stand';
  rows.forEach((r, k) => {
    const li = document.createElement('li');
    li.style.setProperty('--pc', r.color);
    if (r.me) li.className = 'win';
    const rank = document.createElement('span'); rank.className = 'rank'; rank.textContent = String(k + 1);
    const img = document.createElement('img'); img.src = avatarURL(r.look); img.alt = '';
    const box = document.createElement('div');
    const b = document.createElement('b'); b.textContent = r.name;
    const sm = document.createElement('small');
    sm.textContent = (r.me ? 'Chiqdi — g‘olib' : !r.alive ? 'Qayta tug‘ilmoqda' : `Chiqishgacha ${fmtDist(r.rem)}`) + ` · ${fmtDist(r.dist)} yurdi · ${r.extra}`;
    box.append(b, sm);
    const lv = document.createElement('span'); lv.className = 'lv'; lv.textContent = r.alive ? '❤'.repeat(r.lives) : '—';
    li.append(rank, img, box, lv);
    ol.appendChild(li);
  });
  ui.eBody.appendChild(ol);
}
function drawEndMap() {
  const N = G.N, base = makeCanvas(N, N), bg = base.getContext('2d'), img = bg.createImageData(N, N), d = img.data;
  const onSol = new Uint8Array(N * N), seen = new Uint8Array(N * N), owner = new Int8Array(N * N).fill(-1);
  for (const sl of G.sols) for (const i of sl) onSol[i] = 1;
  const order = G.players.slice().sort((a, b) => (a === G.winner ? 1 : b === G.winner ? -1 : 0));
  for (const p of order) for (let i = 0; i < N * N; i++) { if (p.explored[i]) seen[i] = 1; if (p.visited[i]) owner[i] = p.id; }
  const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  const many = G.players.length > 1;
  const pc = G.players.map((p) => (many ? hex(p.color) : [236, 206, 140]));
  for (let i = 0; i < N * N; i++) {
    const t = G.g[i], e = seen[i];
    let c;
    if (t === T.WALL) c = e ? [34, 74, 44] : [18, 38, 25];
    else if (t === T.CHASM) c = [6, 6, 6];
    else if (t === T.RIVER) c = [44, 110, 124];
    else if (t === T.ENTRY) c = [140, 92, 45];
    else if (t === T.EXIT) c = [255, 220, 120];
    else if (t === T.PORTAL) c = [160, 100, 255];
    else if (G.trap[i] >= 0) c = [190, 70, 50];
    else if (G.chest[i]) c = [255, 170, 40];
    else if (owner[i] >= 0) c = pc[owner[i]];
    else if (onSol[i]) c = [244, 190, 64];
    else c = e ? [150, 140, 112] : [62, 58, 48];
    const k = i * 4;
    d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255;
  }
  bg.putImageData(img, 0, 0);
  const sc = Math.max(2, Math.floor(600 / N)), c = ui.endMap;
  c.width = c.height = N * sc;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(base, 0, 0, N * sc, N * sc);
  const dot = (x, y, col) => { g.fillStyle = col; g.strokeStyle = '#fff'; g.lineWidth = Math.max(1, sc * 0.4); g.beginPath(); g.arc((x + 0.5) * sc, (y + 0.5) * sc, Math.max(4, sc * 1.4), 0, TAU); g.fill(); g.stroke(); };
  for (const p of G.players) dot(p.px, p.py, many ? p.color : '#ff3b1f');
  for (const r of remoteList()) dot(r.x, r.y, r.color);
  const legend = many ? G.players.map((p) => [p.color, p.bot ? p.name : 'Sen']) : [['#ecce8c', 'Sen yurgan yo‘l']];
  legend.push(['#f4be40', 'Eng qisqa yo‘l'], ['#be4632', 'Tuzoqlar'], ['#ffaa28', 'Sandiqlar'], ['#a064ff', 'Girdoblar']);
  ui.eLegend.innerHTML = '';
  for (const [col, label] of legend) { const sp = document.createElement('span'), i = document.createElement('i'); i.style.background = col; sp.append(i, label); ui.eLegend.appendChild(sp); }
}

/* ================= Menyu: o‘yinchilar va kitob ================= */
export { endGame, addRow, remainingFrom, soloStats, standings, drawEndMap };
