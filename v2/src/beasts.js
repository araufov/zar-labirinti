// Dunyo jonzotlari va harakat effektlari: hayvonlar (patrul/ov/qochish), ovchi mashinalar, sirpanish, teleport, orqaga surish.
import { Sound } from './audio.js';
import { ears, nearXY } from './bots.js';
import { FX } from './cards.js';
import { BEASTS, DIFFS, T, beastFloor, walk } from './content.js';
import { toast } from './hud.js';
import { bfs } from './maze.js';
import { netDirty } from './net-room.js';
import { encounter, histPush, loseLife, markVisited, onEnterTile, playerDown, reveal } from './player.js';
import { beastMs, emit, floatText } from './render.js';
import { G, freeP, mapLvl } from './state.js';
import { clamp, pickRand } from './util.js';
function land(p) {
  const j = p.jump;
  p.jump = null;
  p.px = j.tx; p.py = j.ty; p.mfx = p.px; p.mfy = p.py; p.moving = false; p.moveT = 1;
  p.dist += G.tileM * (j.w + 1);
  const i = p.py * G.N + p.px;
  markVisited(p, i);
  p.trail = [i];
  histPush(p, i);
  reveal(p);
  emit(p.px, p.py + 0.2, 8, j.river ? 'splash' : 'dust');
  if (j.river) Sound.splash();
  onEnterTile(p, i);
}

/* ---- sirpanish (orqaga), teleport ---- */
function startSlide(p, path, kind) {
  if (!path.length) return;
  p.slide = { path, i: 0, acc: 0, ms: kind === 'rewind' ? 32 : 60, kind };
  p.moving = false;
  if (kind === 'rewind') { Sound.rewind(); if (!p.bot) document.body.classList.add('rewind'); }
}
function updateSlide(p, dt) {
  const s = p.slide;
  s.acc += dt * 1000;
  while (s.acc >= s.ms) {
    s.acc -= s.ms;
    const i = s.path[s.i++];
    p.mfx = p.px; p.mfy = p.py; p.px = i % G.N; p.py = (i / G.N) | 0;
    p.ph += 1.2;
    reveal(p); markVisited(p, i);
    emit(p.px, p.py + 0.2, 1, s.kind === 'water' ? 'splash' : s.kind === 'rewind' ? 'rewind' : 'dust');
    if (s.i >= s.path.length) {
      p.slide = null; p.mfx = p.px; p.mfy = p.py;
      histPush(p, i);
      if (!p.bot) document.body.classList.remove('rewind');
      netDirty(p);
      return;
    }
  }
}
function pushBack(p, n, kind) {
  const tr = p.trail;
  if (tr.length < 2) return;
  const k = Math.max(0, tr.length - 1 - n), path = tr.slice(k, tr.length - 1).reverse();
  tr.length = k + 1;
  startSlide(p, path, kind);
  p.shake = 0.3;
}
function rewind(p, n) {
  const h = p.hist;
  if (h.length < 2) return;
  const k = Math.max(0, h.length - 1 - n), path = h.slice(k, h.length - 1).reverse();
  h.length = k + 1;
  p.trail = [h[k]];
  startSlide(p, path, 'rewind');
}
function teleportTo(p, i, kind) {
  if (i < 0) return;
  if (p.slide && p.slide.kind === 'rewind' && !p.bot) document.body.classList.remove('rewind');
  p.jump = null; p.slide = null;
  p.tele = { phase: 'out', t: 0, to: i, kind };
  p.moving = false;
  Sound.portal();
  emit(p.px, p.py, 26, kind === 'vines' ? 'leaf' : 'spark');
}
function updateTele(p, dt) {
  const tl = p.tele;
  tl.t += dt / 0.5;
  if (tl.phase === 'out' && tl.t >= 1) {
    p.px = tl.to % G.N; p.py = (tl.to / G.N) | 0; p.mfx = p.px; p.mfy = p.py;
    reveal(p); markVisited(p, tl.to);
    p.trail = [tl.to]; histPush(p, tl.to);
    tl.phase = 'in'; tl.t = 0;
    emit(p.px, p.py, 26, tl.kind === 'vines' ? 'leaf' : 'spark');
    netDirty(p);
  } else if (tl.phase === 'in' && tl.t >= 1) {
    p.tele = null;
  }
}
function pickTarget(p, mode) {
  const N = G.N, g = G.g, here = G.distExit[p.py * N + p.px];
  const ok = (i) => g[i] === T.PATH && !(G.trap[i] >= 0 && !p.spent[i]) && G.item[i] < 0 && !G.chest[i] && !G.coin[i] && G.keyAt[i] < 0 && G.distExit[i] > 0 &&
    !G.beasts.some((b) => Math.abs(b.x - (i % N)) + Math.abs(b.y - ((i / N) | 0)) <= 3);
  const collect = (m) => {
    const c = [];
    for (let i = 0; i < N * N; i++) {
      if (!ok(i)) continue;
      const d = G.distExit[i];
      if (m === 'closer' && !(d < here * 0.6 && d > 4)) continue;
      if (m === 'any' && d < 25) continue;
      if (m === 'back' && !(d > here * 1.25 + 10)) continue;
      if (m === 'random' && (i === p.py * N + p.px || d < 25)) continue;   // tasodifiy, lekin eshik oldiga tushmaydi
      if (m !== 'back' && m !== 'random' && p.explored[i]) continue;
      c.push(i);
    }
    return c;
  };
  let c = collect(mode);
  if (!c.length && mode !== 'any') c = collect('any');
  if (!c.length) for (let i = 0; i < N * N; i++) if (ok(i)) c.push(i);
  return c.length ? pickRand(c) : -1;
}
function dragTarget(p) {
  const N = G.N, dist = bfs(N, G.g, p.py * N + p.px, beastFloor), fresh = [], any = [];
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d < 6 || d > 20 || G.g[i] !== T.PATH || (G.trap[i] >= 0 && !p.spent[i]) || G.item[i] >= 0 || G.chest[i]) continue;
    any.push(i);
    if (d >= 8 && !p.explored[i]) fresh.push(i);
  }
  const pool = fresh.length ? fresh : any;
  return pool.length ? pickRand(pool) : -1;
}

/* ---- Burgut (har o‘yinchiga o‘z ovchisi) ---- */
function startHunt(p) {
  const N = G.N, pi = p.py * N + p.px, dist = bfs(N, G.g, pi, walk), cands = [];
  let far = -1;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d <= 0) continue;
    if (d >= 10 && d <= 14) cands.push(i);
    if (far < 0 || d > dist[far]) far = i;
  }
  const at = cands.length ? pickRand(cands) : far;
  if (at < 0) return;
  G.vans = G.vans.filter((v) => v.target !== p.id);
  const x = at % N, y = (at / N) | 0;
  G.vans.push({ x, y, fx: x, fy: y, acc: 0, timer: FX().hunt, dist, mapFor: pi, step: DIFFS[G.diff].vanStep, target: p.id });
}
function updateVans(dt) {
  for (const v of G.vans.slice()) {
    const p = G.players[v.target];
    if (!p || !p.alive || p.finished) { G.vans.splice(G.vans.indexOf(v), 1); continue; }
    if (p.card || p.pending) continue;
    const N = G.N, pi = p.py * N + p.px;
    if (v.mapFor !== pi) { v.dist = bfs(N, G.g, pi, walk); v.mapFor = pi; }
    v.age = (v.age || 0) + dt;
    // Yaqin bo‘lsa izni yo‘qotmaydi (60 soniyagacha davom etadi)
    const near = v.dist[v.y * N + v.x];
    if (near >= 0 && near <= 12 && v.age < FX().hunt * 2) v.timer = Math.max(v.timer, 6);
    v.timer -= dt;
    if (v.timer <= 0) { G.vans.splice(G.vans.indexOf(v), 1); toast(p, 'Burgut izingni yo‘qotdi.'); continue; }
    v.acc += dt * 1000;
    while (v.acc >= v.step) {
      v.acc -= v.step;
      const ci = v.y * N + v.x, d = v.dist[ci];
      v.fx = v.x; v.fy = v.y;
      // Burchakni kesish: o‘yinchi borayotgan joyga yo‘l qisqaroq bo‘lsa — shu tomonga
      let map = v.dist, dd = d;
      if (d > 6) {
        const at = aheadCell(p, 5);
        if (at !== v.aheadAt) { v.aheadAt = at; v.ahead = bfs(N, G.g, at, walk); }
        if (v.ahead[ci] >= 0 && v.ahead[ci] <= d) { map = v.ahead; dd = v.ahead[ci]; }
      }
      if (dd > 0) for (const n of [ci - 1, ci + 1, ci - N, ci + N]) if (map[n] === dd - 1) { v.x = n % N; v.y = (n / N) | 0; break; }
      if (v.x === p.px && v.y === p.py && freeP(p)) { ears(p, () => caught(p, v)); break; }
    }
  }
}
function caught(p, v) {
  G.vans = G.vans.filter((q) => q !== v);
  if (p.shield > 0) { p.shield = 0; toast(p, 'Burgut seni tutdi, lekin qalqon saqladi!'); floatText(p.px, p.py, 'Qalqon!', '#9fe3ff'); return; }
  loseLife(p);
  toast(p, 'Burgut seni tutdi! −1 jon');
  if (!p.alive) playerDown(p);
}

/* ---- Xavfli hayvonlar: izdan hid oladi, qadam tovushini eshitadi, hududini qo‘riqlaydi, sheriklarini chaqiradi ---- */
function getPDist(p) {
  const pi = p.py * G.N + p.px;
  if (p.pdFor !== pi) { p.pd = bfs(G.N, G.g, pi, beastFloor); p.pdFor = pi; }
  return p.pd;
}
// Qiyinlik bo‘yicha aql: oson — sustroq, qiyin — to‘liq kuch.
const AI_LV = [{ k: 0.5, pack: 0, leap: false, search: 4 }, { k: 0.8, pack: 1, leap: true, search: 6 }, { k: 1, pack: 2, leap: true, search: 8 }];
const aiLv = () => AI_LV[clamp(mapLvl(), 0, 2)];
const around = (N, c) => [c - 1, c + 1, c - N, c + N];
// O‘yinchi yaqin soniyalarda qayerga yetib borishi mumkin: yuzi qaragan tomonga yo‘lak bo‘ylab K katak.
function aheadCell(p, K) {
  const N = G.N;
  let x = p.px, y = p.py, dx = p.face.x, dy = p.face.y, prev = -1;
  for (let k = 0; k < K; k++) {
    let moved = false;
    for (const [ox, oy] of [[dx, dy], [dy, dx], [-dy, -dx]]) {
      const nx = x + ox, ny = y + oy, ni = ny * N + nx;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || ni === prev || !beastFloor(G.g[ni])) continue;
      prev = y * N + x; x = nx; y = ny; dx = ox; dy = oy; moved = true; break;
    }
    if (!moved) break;
  }
  return y * N + x;
}
function updateBeasts(dt) {
  if (G.sleepT > 0) return;   // zar hodisasi: hayvonlar uxlayapti
  for (const b of G.beasts) {
    if (b.cool > 0 && b.cool < 90) b.cool -= dt;
    if (b.alertT > 0) { b.alertT -= dt; if (b.alertT <= 0) b.alert = ''; }
    if (b.state === 'rest') { b.timer -= dt; if (b.timer <= 0) b.state = 'wander'; b.fx = b.x; b.fy = b.y; continue; }
    if (b.state === 'coil') { beastCoil(b, dt); continue; }
    if (b.state === 'chase' || b.state === 'search' || b.state === 'track') {
      b.timer -= dt;
      if (b.timer <= 0) beastGiveUp(b);
    }
    // Sezish qadamdan tez-tez: hayvon yurishini kutmay, o‘yinchini darrov payqaydi.
    if ((b.state === 'wander' || b.state === 'track' || b.state === 'search') && b.cool <= 0) {
      b.sensT -= dt;
      if (b.sensT <= 0) {
        b.sensT = 0.15;
        const D = BEASTS[b.type], hit = beastSense(b, D, b.y * G.N + b.x);
        if (hit && !(b.state === 'track' && hit.how === 'hear' && b.target === hit.p.id)) { beastSpot(b, D, hit); b.acc = 0; }
      }
    }
    b.acc += dt * 1000;
    let ms = beastMs(b);
    while (b.acc >= ms) {
      b.acc -= ms;
      beastStep(b);
      if (b.state === 'rest' || b.state === 'coil') break;
      ms = beastMs(b);
    }
  }
}
// Quvish yoki izdan borish tugadi: oxirgi ko‘rgan joyini qidiradi, topolmasa hududiga qaytadi.
function beastGiveUp(b) {
  const A = aiLv(), was = b.state;
  if ((was === 'chase' || was === 'track') && b.last >= 0 && A.search > 0) { beastSearch(b, b.last, A.search * (BEASTS[b.type].coil ? 0.6 : 1)); return; }
  b.state = 'wander'; b.cool = was === 'search' ? 2 : 3; b.alert = ''; b.role = ''; b.lunge = 0;
}
function beastSearch(b, at, secs) {
  b.state = 'search'; b.timer = secs; b.last = at; b.sd = bfs(G.N, G.g, at, beastFloor); b.alert = '?'; b.alertT = 1.4; b.role = ''; b.lunge = 0;
}
// Ko‘rish va eshitish: harakatlanayotgan o‘yinchining qadamini uzoqroqdan eshitadi.
function beastSense(b, D, ci) {
  const N = G.N, now = G.time, A = aiLv();
  let best = null, bestS = -Infinity;
  for (const p of G.players) {
    if (!freeP(p) || p.cloak > 0) continue;
    const dx = p.px - b.x, dy = p.py - b.y, man = Math.abs(dx) + Math.abs(dy);
    const moving = now - p.lastMove < 1.4;
    const hearR = D.sense + (moving ? Math.round(D.hear * A.k) : 0);
    if (man > hearR) continue;
    let how = null, dir = 0;
    if (b.type === 'rhino') {
      if (man <= D.sense && man > 0 && (dx === 0 || dy === 0)) {
        const st = dx ? Math.sign(dx) : Math.sign(dy) * N, pi = p.py * N + p.px;
        let c = ci + st, ok = true;
        while (c !== pi) { if (!beastFloor(G.g[c])) { ok = false; break; } c += st; }
        if (ok) { how = 'sight'; dir = st; }
      }
    } else if (man <= D.sense) {
      const pd = getPDist(p);
      if (pd[ci] >= 0 && pd[ci] <= D.sense + 2) how = 'sight';
    }
    if (!how && moving) {
      const pd = getPDist(p);
      if (pd[ci] >= 0 && pd[ci] <= hearR * 1.8) how = 'hear';
    }
    if (!how) continue;
    // Qaroqchi puli ko‘p o‘yinchini tanlaydi, qolganlari — eng yaqinini.
    let sc = -man;
    if (D.greedy) sc = p.coins * 3 - man + (G.distExit[p.py * N + p.px] < G.distExit[ci] ? 2 : 0);
    if (how === 'sight') sc += 100;
    if (sc > bestS) { bestS = sc; best = { p, how, dir }; }
  }
  return best;
}
function beastSpot(b, D, hit) {
  const p = hit.p, N = G.N;
  b.last = p.py * N + p.px;
  if (hit.how === 'hear') {
    b.state = 'track'; b.target = p.id; b.timer = 9; b.alert = '?'; b.alertT = 1.2;
    return;
  }
  b.target = p.id;
  if (b.type === 'rhino') {
    b.state = 'charge'; b.dir = hit.dir; b.faceX = Math.sign(p.px - b.x) || b.faceX;
    ears(p, () => Sound.roar()); emit(b.x, b.y, 6, 'dust');
  } else {
    b.state = 'chase'; b.timer = D.chaseTime; b.lunge = D.coil ? 3 : 0; b.role = 'lead'; b.alert = '!'; b.alertT = 1.2;
    ears(p, () => Sound.growl());
    if (D.pack) packAlert(b, p);
  }
}
// Bir tur hayvonlar to‘da bo‘lib ovlaydi: sherigi yo‘lingni oldindan kesadi.
function packAlert(b, p) {
  const A = aiLv();
  let n = 0;
  for (const o of G.beasts) {
    if (o === b || o.type !== b.type || n >= A.pack || o.cool > 0) continue;
    if (!(o.state === 'wander' || o.state === 'track' || o.state === 'search')) continue;
    if (Math.abs(o.x - b.x) + Math.abs(o.y - b.y) > 12 + 2 * mapLvl()) continue;
    o.state = 'chase'; o.target = p.id; o.timer = BEASTS[o.type].chaseTime - 1; o.role = 'flank'; o.lunge = 0; o.acc = 0;
    o.last = p.py * G.N + p.px; o.alert = '!'; o.alertT = 1; n++;
  }
}
function beastCoil(b, dt) {
  b.fx = b.x; b.fy = b.y;
  b.timer -= dt; b.sensT -= dt;
  if (b.timer <= 0) { b.state = 'wander'; return; }
  if (b.sensT > 0 || b.cool > 0) return;
  b.sensT = 0.12;
  const D = BEASTS[b.type], hit = beastSense(b, D, b.y * G.N + b.x);
  if (hit && hit.how === 'sight') {
    b.state = 'chase'; b.target = hit.p.id; b.timer = D.chaseTime; b.lunge = 3; b.acc = 0; b.alert = '!'; b.alertT = 1;
    b.last = hit.p.py * G.N + hit.p.px;
    ears(hit.p, () => Sound.growl());
  }
}
function beastChase(b, D, ci) {
  const N = G.N, tp = G.players[b.target];
  if (!tp || !freeP(tp) || tp.cloak > 0) { b.state = 'wander'; b.cool = 2; b.alert = ''; b.role = ''; b.lunge = 0; b.last = -1; return -1; }
  const pd = getPDist(tp), d = pd[ci];
  if (d < 0 || d > D.sense * 3) { beastGiveUp(b); return -1; }
  b.last = tp.py * N + tp.px;
  if (d === 0) return -1;   // o‘yinchi aynan shu katakda: qadam yo‘q, to‘qnashuv beastStep oxirida tekshiriladi
  if (b.lunge > 0) b.lunge--;
  // Sherik: o‘yinchining oldiga o‘tib, yo‘lini kesadi.
  if (b.role === 'flank' && d > 3) {
    const at = aheadCell(tp, 6);
    if (at !== b.flankAt) { b.flankAt = at; b.fd = bfs(N, G.g, at, beastFloor); }
    const fd = b.fd, dd = fd[ci];
    if (dd > 0) for (const n of around(N, ci)) if (fd[n] === dd - 1) return n;
  }
  let first = -1;
  for (const n of around(N, ci)) if (pd[n] === d - 1) { first = n; break; }
  // Yaguar sakrashi: ikki katak qolganda bir qadamda yetib oladi.
  if (D.leap && aiLv().leap && d === 2 && first >= 0 && G.time - b.leapAt > 5) {
    for (const n of around(N, first)) if (pd[n] === 0) { b.leapAt = G.time; b.pounce = 0.5; return n; }
  }
  return first;
}
// Qadam tovushi yoki iz: o‘yinchiga yaqinlashadi; iz uzilsa — shu yerni qidiradi.
function beastTrack(b, D, ci) {
  const N = G.N, A = aiLv(), now = G.time, tp = G.players[b.target];
  if (tp && freeP(tp) && tp.cloak <= 0) {
    const pd = getPDist(tp), d = pd[ci];
    if (d === 0) return -1;
    if (d > 0 && d <= (D.sense + D.hear) * 2.2 && (now - tp.lastMove < 2.5 || d <= D.sense + 2)) {
      b.last = tp.py * N + tp.px;
      for (const n of around(N, ci)) if (pd[n] === d - 1) return n;
    }
  }
  const life = D.scent * A.k;
  let best = -1, bs = G.scent[ci];
  for (const n of around(N, ci)) if (beastFloor(G.g[n]) && G.scent[n] > bs + 0.05 && now - G.scent[n] < life) { bs = G.scent[n]; best = n; }
  if (best >= 0) return best;
  beastSearch(b, ci, A.search * 0.6);
  return -1;
}
function beastSearchStep(b, D, ci) {
  const N = G.N, sd = b.sd;
  if (sd && sd[ci] > 0) for (const n of around(N, ci)) if (sd[n] === sd[ci] - 1) return n;
  return beastPatrol(b, D, ci, 5, sd);
}
// Hududini qo‘riqlaydi: yaqinda bo‘lgan joyga qaytmaydi (ketma-ket aylanadi), hududdan chiqib ketmaydi, hidga ergashadi.
function beastPatrol(b, D, ci, leash, hd) {
  const N = G.N, A = aiLv(), now = G.time;
  leash = leash || D.leash; hd = hd || b.hd;
  if (b.state === 'wander' && b.cool <= 0) {
    const life = D.scent * A.k;
    let best = -1, bs = G.scent[ci];
    for (const n of around(N, ci)) if (beastFloor(G.g[n]) && G.scent[n] > bs + 0.05 && now - G.scent[n] < life) { bs = G.scent[n]; best = n; }
    if (best >= 0) { b.state = 'track'; b.target = G.scentWho[best]; b.timer = 12; b.alert = '?'; b.alertT = 1; return best; }
    if (D.coil && Math.random() < 0.4) { b.state = 'coil'; b.timer = 3 + Math.random() * 4; b.sensT = 0; return -1; }
  }
  const opts = [], ws = [], h = hd[ci] < 0 ? 0 : hd[ci];
  let tot = 0;
  for (const n of around(N, ci)) {
    if (!beastFloor(G.g[n])) continue;
    let w = 1;
    const seen = b.mem.get(n);
    if (seen !== undefined) w *= clamp((now - seen) / 25, 0.12, 1);
    if (n === b.prev) w *= 0.25;
    const hn = hd[n] < 0 ? h : hd[n];
    if (h > leash) w *= hn < h ? 8 : 0.1;
    else if (hn > leash) w *= 0.15;
    opts.push(n); ws.push(w); tot += w;
  }
  if (!opts.length) return b.prev >= 0 && beastFloor(G.g[b.prev]) ? b.prev : -1;
  let x = Math.random() * tot;
  for (let k = 0; k < opts.length; k++) { x -= ws[k]; if (x < 0) return opts[k]; }
  return opts[opts.length - 1];
}
function beastStep(b) {
  const N = G.N, D = BEASTS[b.type], ci = b.y * N + b.x;
  b.fx = b.x; b.fy = b.y;
  b.mem.set(ci, G.time);
  if (b.mem.size > 500) for (const [k, t] of b.mem) if (G.time - t > 60) b.mem.delete(k);
  let ni = -1;
  if (b.state === 'chase') ni = beastChase(b, D, ci);
  else if (b.state === 'charge') {
    const n = ci + b.dir;
    if (beastFloor(G.g[n])) { ni = n; if (Math.random() < 0.6) emit(b.x, b.y + 0.2, 1, 'dust'); }
    else { b.state = 'rest'; b.timer = 1.6; b.cool = 1.5; b.alert = ''; emit(b.x, b.y, 8, 'dust'); if (nearXY(b.x, b.y)) Sound.bump(); }
  } else if (b.state === 'track') ni = beastTrack(b, D, ci);
  else if (b.state === 'search') ni = beastSearchStep(b, D, ci);
  if (b.state === 'wander' && ni < 0) ni = beastPatrol(b, D, ci);
  if (ni >= 0) {
    b.prev = ci; b.x = ni % N; b.y = (ni / N) | 0;
    if (b.x !== b.fx) b.faceX = Math.sign(b.x - b.fx);
  }
  if (b.cool <= 0) for (const p of G.players) if (freeP(p) && p.cloak <= 0 && b.x === p.px && b.y === p.py) { ears(p, () => encounter(b, p)); break; }
}
function beastFlee(b, p) {
  const N = G.N, dist = bfs(N, G.g, p.py * N + p.px, beastFloor), c = [];
  let far = -1;
  for (let i = 0; i < dist.length; i++) {
    const d = dist[i];
    if (d < 0 || G.g[i] !== T.PATH) continue;
    if (far < 0 || d > dist[far]) far = i;
    if (d >= 12 && d <= 26) c.push(i);
  }
  const at = c.length ? pickRand(c) : far;
  if (at >= 0) { b.x = at % N; b.y = (at / N) | 0; }
  b.fx = b.x; b.fy = b.y; b.prev = -1; b.acc = 0;
  b.state = 'rest'; b.timer = 2; b.cool = 8; b.alert = ''; b.role = ''; b.lunge = 0; b.last = -1;
  // Shu o‘yinchini quvayotgan sheriklar izini yo‘qotib, atrofni qidiradi
  for (const o of G.beasts) if (o !== b && o.state === 'chase' && o.target === p.id) beastSearch(o, p.py * N + p.px, 4);
}

export { land, startSlide, updateSlide, pushBack, rewind, teleportTo, updateTele, pickTarget, dragTarget, startHunt, updateVans, caught, getPDist, AI_LV, aiLv, around, aheadCell, updateBeasts, beastGiveUp, beastSearch, beastSense, beastSpot, packAlert, beastCoil, beastChase, beastTrack, beastSearchStep, beastPatrol, beastStep, beastFlee };
