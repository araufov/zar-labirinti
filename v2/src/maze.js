// MazeGenerator: generate(seed, diff) — deterministik labirint, bitta ichki darvoza, kalit/sandiq/tuzoq joylashuvi; bfs/bfsMulti masofa xaritalari.
import { BEAST_KINDS, DIFFS, ECON, ITEMS, ITEM_IX, T, TRAPS, TRAP_IX, walk } from './content.js';
import { mulberry32 } from './util.js';
function bfs(N, g, si, pass) {
  const dist = new Int32Array(N * N).fill(-1), q = new Int32Array(N * N);
  let h = 0, t = 0;
  dist[si] = 0; q[t++] = si;
  while (h < t) {
    const c = q[h++], d = dist[c] + 1, x = c % N;
    if (x > 0 && dist[c - 1] < 0 && pass(g[c - 1])) { dist[c - 1] = d; q[t++] = c - 1; }
    if (x < N - 1 && dist[c + 1] < 0 && pass(g[c + 1])) { dist[c + 1] = d; q[t++] = c + 1; }
    if (c >= N && dist[c - N] < 0 && pass(g[c - N])) { dist[c - N] = d; q[t++] = c - N; }
    if (c < N * N - N && dist[c + N] < 0 && pass(g[c + N])) { dist[c + N] = d; q[t++] = c + N; }
  }
  return dist;
}

// Bir nechta boshlang‘ich nuqtadan (masalan, ikkala darvozadan) eng yaqiniga masofa.
function bfsMulti(N, g, starts, pass) {
  const dist = new Int32Array(N * N).fill(-1), q = new Int32Array(N * N);
  let h = 0, t = 0;
  for (const si of starts) { dist[si] = 0; q[t++] = si; }
  while (h < t) {
    const c = q[h++], d = dist[c] + 1, x = c % N;
    if (x > 0 && dist[c - 1] < 0 && pass(g[c - 1])) { dist[c - 1] = d; q[t++] = c - 1; }
    if (x < N - 1 && dist[c + 1] < 0 && pass(g[c + 1])) { dist[c + 1] = d; q[t++] = c + 1; }
    if (c >= N && dist[c - N] < 0 && pass(g[c - N])) { dist[c - N] = d; q[t++] = c - N; }
    if (c < N * N - N && dist[c + N] < 0 && pass(g[c + N])) { dist[c + N] = d; q[t++] = c + N; }
  }
  return dist;
}
const SIDE_DX = [0, 1, 0, -1], SIDE_DY = [-1, 0, 1, 0];   // shimol, sharq, janub, g‘arb tomonga qarab
function generate(seed, dk) {
  const D = DIFFS[dk], r = mulberry32(seed), C = D.cells, N = C * 2 + 1;
  const g = new Uint8Array(N * N);
  const DX = [1, -1, 0, 0], DY = [0, 0, 1, -1];

  // 1) Mukammal labirint (iterativ backtracker).
  const seen = new Uint8Array(C * C), stack = new Int32Array(C * C), opts = [0, 0, 0, 0];
  let sp = 0;
  const c0 = (r() * C * C) | 0;
  seen[c0] = 1; stack[sp++] = c0;
  g[(((c0 / C) | 0) * 2 + 1) * N + (c0 % C) * 2 + 1] = T.PATH;
  while (sp) {
    const c = stack[sp - 1], cx = c % C, cy = (c / C) | 0;
    let n = 0;
    for (let k = 0; k < 4; k++) {
      const nx = cx + DX[k], ny = cy + DY[k];
      if (nx >= 0 && ny >= 0 && nx < C && ny < C && !seen[ny * C + nx]) opts[n++] = k;
    }
    if (!n) { sp--; continue; }
    const k = opts[(r() * n) | 0], nx = cx + DX[k], ny = cy + DY[k];
    seen[ny * C + nx] = 1;
    g[(cy * 2 + 1 + DY[k]) * N + cx * 2 + 1 + DX[k]] = T.PATH;
    g[(ny * 2 + 1) * N + nx * 2 + 1] = T.PATH;
    stack[sp++] = ny * C + nx;
  }

  // 2) Ko‘p yo‘llar: boshi berk yo‘llarning yarmini ochamiz va qo‘shimcha aylanma yo‘llar qo‘shamiz.
  for (let cy = 0; cy < C; cy++) for (let cx = 0; cx < C; cx++) {
    const x = cx * 2 + 1, y = cy * 2 + 1;
    let open = 0;
    for (let k = 0; k < 4; k++) if (g[(y + DY[k]) * N + x + DX[k]]) open++;
    if (open !== 1 || r() >= 0.45) continue;
    const cand = [];
    for (let k = 0; k < 4; k++) {
      const wx = x + DX[k], wy = y + DY[k];
      if (wx > 0 && wy > 0 && wx < N - 1 && wy < N - 1 && !g[wy * N + wx]) cand.push(wy * N + wx);
    }
    if (cand.length) g[cand[(r() * cand.length) | 0]] = T.PATH;
  }
  const extra = Math.floor(C * C * 0.07);
  for (let k = 0, tries = 0; k < extra && tries < extra * 30; tries++) {
    const cx = (r() * C) | 0, cy = (r() * C) | 0, dir = (r() * 4) | 0;
    const wx = cx * 2 + 1 + DX[dir], wy = cy * 2 + 1 + DY[dir];
    if (wx <= 0 || wy <= 0 || wx >= N - 1 || wy >= N - 1 || g[wy * N + wx]) continue;
    g[wy * N + wx] = T.PATH; k++;
  }

  // 3) Bitta kirish (janub) va ikkita qulfli darvoza (chiqish): darvozalar istalgan tomonda bo‘lishi mumkin (sir).
  const ex = ((r() * C) | 0) * 2 + 1;
  g[(N - 1) * N + ex] = T.ENTRY;
  const start = (N - 2) * N + ex;
  const d0 = bfs(N, g, start, (t) => t === T.PATH);
  const gates = [];
  const pickGate = (tries, scoreOf) => {
    let best = null, bs = -1;
    for (let k = 0; k < tries; k++) {
      const sd = (r() * 4) | 0, pos = ((r() * C) | 0) * 2 + 1;
      const x = sd === 1 ? N - 1 : sd === 3 ? 0 : pos, y = sd === 0 ? 0 : sd === 2 ? N - 1 : pos;
      if (sd === 2 && x === ex) continue;
      if (gates.some((q) => q.x === x && q.y === y)) continue;
      const inner = (y - SIDE_DY[sd]) * N + (x - SIDE_DX[sd]), d = d0[inner];
      if (d < 0) continue;
      const sc = scoreOf(x, y, sd, d);
      if (sc > bs) { bs = sc; best = { side: sd, x, y, inner }; }
      if (sc >= 1) break;
    }
    if (!best) {   // zaxira: chegaradagi birinchi mos katak
      for (let k = 1; k < N - 1 && !best; k += 2) for (const [x, y, sd] of [[k, 0, 0], [N - 1, k, 1], [k, N - 1, 2], [0, k, 3]]) {
        if ((sd === 2 && x === ex) || gates.some((q) => q.x === x && q.y === y)) continue;
        const inner = (y - SIDE_DY[sd]) * N + (x - SIDE_DX[sd]);
        if (d0[inner] >= 0) { best = { side: sd, x, y, inner }; break; }
      }
    }
    return best;
  };
  // Bitta darvoza — labirintning ICHIDA, kirishdan uzoq, boshi berk yo‘lak oxirida (chetda emas: qayerdaligini faqat kompas ko‘rsatadi)
  {
    let maxD = 0; for (let i = 0; i < N * N; i++) if (d0[i] > maxD) maxD = d0[i];
    const nbrs = (i) => [i - 1, i + 1, i - N, i + N].filter((j) => g[j] === T.PATH);
    const inner = (i) => (i % N) > 0 && (i % N) < N - 1 && i >= N && i < N * N - N;
    const pool = (frac, deadOnly) => { const out = []; for (let i = 0; i < N * N; i++) { if (g[i] !== T.PATH || !inner(i) || d0[i] < maxD * frac) continue; const nb = nbrs(i); if (!nb.length || (deadOnly && nb.length !== 1)) continue; if (Math.abs((i % N) - ex) + Math.abs(((i / N) | 0) - (N - 1)) < N * 0.3) continue; out.push(i); } return out; };
    let cand = pool(0.62, true); if (!cand.length) cand = pool(0.5, true); if (!cand.length) cand = pool(0.5, false); if (!cand.length) cand = pool(0.2, false);
    const gi = cand[(r() * cand.length) | 0], nb = nbrs(gi), from = nb[(r() * nb.length) | 0];
    const dx = (gi % N) - (from % N), dy = ((gi / N) | 0) - ((from / N) | 0);
    gates.push({ side: dy < 0 ? 0 : dx > 0 ? 1 : dy > 0 ? 2 : 3, x: gi % N, y: (gi / N) | 0, inner: from });
    void pickGate;
  }
  for (const q of gates) g[q.y * N + q.x] = T.EXIT;
  const exitIdx = gates[0].y * N + gates[0].x, exitX = gates[0].x, exitY = gates[0].y, exitSide = gates[0].side;
  const pathTo = (q) => {
    const out = [];
    for (let c = q.inner; c !== start;) {
      out.push(c);
      const d = d0[c];
      let nxt = -1;
      for (const n of [c - 1, c + 1, c - N, c + N]) if (d0[n] === d - 1) { nxt = n; break; }
      if (nxt < 0) break;
      c = nxt;
    }
    out.push(start); out.reverse();
    out.push(q.y * N + q.x);
    return out;
  };
  const sols = gates.map(pathTo), sol = sols[0];

  // 4) To‘siqlar, girdoblar, tuzoqlar, sandiqlar, topilmalar va hayvonlar.
  const feat = new Uint8Array(N * N), trap = new Int8Array(N * N).fill(-1), item = new Int8Array(N * N).fill(-1), chest = new Uint8Array(N * N);
  const near = (i, R) => {
    const x = i % N, y = (i / N) | 0;
    for (let yy = Math.max(0, y - R); yy <= Math.min(N - 1, y + R); yy++)
      for (let xx = Math.max(0, x - R); xx <= Math.min(N - 1, x + R); xx++) if (feat[yy * N + xx]) return true;
    return false;
  };
  const farFromEnds = (i) => d0[i] > 5 && gates.every((q) => Math.abs((i % N) - q.x) + Math.abs(((i / N) | 0) - q.y) > 3);
  const straight = (i) => {
    if (g[i] !== T.PATH) return 0;
    const L = g[i - 1] === T.PATH, R = g[i + 1] === T.PATH, U = g[i - N] === T.PATH, B = g[i + N] === T.PATH;
    if (L && R && !U && !B) return 1;
    if (U && B && !L && !R) return N;
    return 0;
  };
  let obstacles = 0;
  const tryObstacle = (i) => {
    const step = straight(i);
    if (!step) return false;
    let w = r() < 0.35 ? 2 : 1;
    if (w === 2 && straight(i + step) !== step) w = 1;
    if (g[i - step] !== T.PATH || g[i + step * w] !== T.PATH) return false;
    for (let k = -1; k <= w; k++) { const t = i + step * k; if (!farFromEnds(t) || near(t, 3)) return false; }
    const type = r() < 0.55 ? T.CHASM : T.RIVER;
    for (let k = 0; k < w; k++) g[i + step * k] = type;
    for (let k = -1; k <= w; k++) feat[i + step * k] = 1;
    obstacles++;
    return true;
  };
  for (let placed = 0, tries = 0; placed < D.pathObs && tries < 400; tries++) {
    const sl = sols[placed % sols.length], lo = Math.floor(sl.length * 0.2), hi = Math.floor(sl.length * 0.9);   // to‘siqlar ikkala darvozaga boradigan yo‘lda ham
    if (tryObstacle(sl[lo + ((r() * (hi - lo)) | 0)])) placed++;
  }
  const randCell = () => (1 + ((r() * (N - 2)) | 0)) + (1 + ((r() * (N - 2)) | 0)) * N;
  for (let tries = 0; obstacles < D.obstacles && tries < D.obstacles * 200; tries++) {
    const i = randCell();
    if (g[i] === T.PATH) tryObstacle(i);
  }
  const dead = [];
  for (let i = N; i < N * N - N; i++) {
    if (g[i] !== T.PATH) continue;
    const o = walk(g[i - 1]) + walk(g[i + 1]) + walk(g[i - N]) + walk(g[i + N]);
    if (o === 1) dead.push(i);
  }
  for (let k = dead.length - 1; k > 0; k--) { const j = (r() * (k + 1)) | 0; const tmp = dead[k]; dead[k] = dead[j]; dead[j] = tmp; }
  let portals = 0;
  for (const i of dead) {
    if (portals >= Math.ceil(D.portals / 2)) break;
    if (feat[i] || !farFromEnds(i) || d0[i] < 12 || near(i, 4)) continue;
    g[i] = T.PORTAL; feat[i] = 1; portals++;
  }
  // Girdob yo‘lakni ikkiga bo‘lib qo‘ymasin: uning o‘rniga qo‘yilganda qolgan yo‘llar hamon bir-biriga ulangan bo‘lishi shart.
  let pathCount = 0;
  for (let k = 0; k < N * N; k++) if (g[k] === T.PATH) pathCount++;
  const splits = (i) => {
    g[i] = T.PORTAL;
    const dd = bfs(N, g, start, (t) => t === T.PATH || t === T.CHASM || t === T.RIVER);
    let reach = 0;
    for (let k = 0; k < N * N; k++) if (dd[k] >= 0 && g[k] === T.PATH) reach++;
    g[i] = T.PATH;
    return reach < pathCount - 1;
  };
  for (let tries = 0; portals < D.portals && tries < 4000; tries++) {
    const i = randCell();
    if (g[i] !== T.PATH || feat[i] || !farFromEnds(i) || d0[i] < 12 || near(i, 4) || splits(i)) continue;
    g[i] = T.PORTAL; feat[i] = 1; portals++; pathCount--;
  }
  const wsum = TRAPS.reduce((s, t) => s + t.w, 0), OP = D.onPath || {}, tpool = D.trapPool ? D.trapPool.map((k) => TRAP_IX[k]) : null;
  const pick = () => { if (tpool) return tpool[(r() * tpool.length) | 0]; let x = r() * wsum; for (let k = 0; k < TRAPS.length; k++) { x -= TRAPS[k].w; if (x < 0) return k; } return 0; };
  // Bosqichlar uchun: narsani eng qisqa yo‘lning ma’lum qismiga (0..1) qo‘yish — o‘yinchi albatta duch keladi.
  const onSol = (frac, ok) => { const L0 = sol.length; for (let k = Math.max(3, Math.floor(L0 * frac)), e = Math.min(L0 - 3, k + 16); k < e; k++) { const i = sol[k]; if (g[i] === T.PATH && !feat[i] && ok(i)) return i; } return -1; };
  const tryTrap = (i, type) => {
    if (g[i] !== T.PATH || feat[i] || !farFromEnds(i) || near(i, 3)) return false;
    trap[i] = type; feat[i] = 1;
    return true;
  };
  let traps = 0;
  for (const f of OP.trap || []) { const i = onSol(f, farFromEnds); if (i >= 0) { trap[i] = pick(); feat[i] = 1; traps++; } }
  const intro = r() < 0.5 ? TRAP_IX.quicksand : TRAP_IX.monsoon;
  if (D.traps > 0 && !OP.trap) for (let k = 9; k < Math.min(sol.length - 4, 40); k++) if (tryTrap(sol[k], tpool ? tpool[0] : intro)) { traps++; break; }
  for (let tries = 0; traps < D.traps && tries < D.traps * 200; tries++) if (tryTrap(randCell(), pick())) traps++;
  let chests = 0;
  for (const f of OP.chest || []) { const i = onSol(f, () => true); if (i >= 0) { chest[i] = 1; feat[i] = 1; chests++; } }
  for (let tries = 0; chests < D.chests && tries < D.chests * 300; tries++) {
    const i = randCell();
    if (g[i] !== T.PATH || feat[i] || d0[i] < 10 || near(i, 3)) continue;
    chest[i] = 1; feat[i] = 1; chests++;
  }
  const isum = ITEMS.reduce((s, t) => s + t.w, 0);
  let items = 0;
  for (const [key, f] of OP.item || []) { const i = onSol(f, () => true); if (i >= 0) { item[i] = ITEM_IX[key]; feat[i] = 1; items++; } }
  for (let tries = 0; items < D.items && tries < D.items * 200; tries++) {
    const i = randCell();
    if (g[i] !== T.PATH || feat[i] || d0[i] < 8 || near(i, 2)) continue;
    let x = r() * isum, k = 0;
    if (D.itemPool) k = ITEM_IX[D.itemPool[(x / isum * D.itemPool.length) | 0]];
    else for (; k < ITEMS.length - 1; k++) { x -= ITEMS[k].w; if (x < 0) break; }
    item[i] = k; feat[i] = 1; items++;
  }
  // Pul xaltalari: xazinalar kabi turli joylarda yotadi.
  const coin = new Uint8Array(N * N);
  let placedCoins = 0;
  for (const f of OP.coin || []) { const i = onSol(f, () => true); if (i >= 0) { coin[i] = ECON.pouch; feat[i] = 1; placedCoins++; } }
  for (let coins = placedCoins, tries = 0; coins < D.coins && tries < D.coins * 300; tries++) {
    const i = randCell();
    if (g[i] !== T.PATH || feat[i] || d0[i] < 6 || near(i, 2)) continue;
    r(); coin[i] = ECON.pouch; feat[i] = 1; coins++;   // (r() chaqiruvi labirint tuzilishi o‘zgarmasligi uchun qoladi)
  }
  // Darvoza kalitlari: har bir odamga bittadan (8 ta joy). Boshi berk yo‘laklarda yashiringan; faqat egasiga ko‘rinadi.
  // Ikkita yashirin xarita (kalit xaritasi va xazina xaritasi) — yanada uzoqroq, boshi berk yo‘laklarda.
  const KEYS = 8, keyAt = new Int8Array(N * N).fill(-1), keyCells = new Int32Array(KEYS).fill(-1), L = sol.length;
  const manh = (a, b) => Math.abs((a % N) - (b % N)) + Math.abs(((a / N) | 0) - ((b / N) | 0));
  const spot = (count, lo, hi, minSep, avoid) => {
    const out = [];
    const okAt = (i, dl, dh, sep, nr) => !feat[i] && g[i] === T.PATH && d0[i] >= dl && d0[i] <= dh && farFromEnds(i) && (nr === 0 || !near(i, nr)) &&
      avoid.every((j) => manh(i, j) >= sep) && out.every((j) => manh(i, j) >= sep);
    const take = (i) => { out.push(i); feat[i] = 1; };
    // [d0 dan, d0 gacha, bir-biridan masofa, faqat boshi berk yo‘lak, atrofda boshqa narsa bo‘lmasin radiusi]
    const passes = [[lo, hi, minSep, true, 2], [lo * 0.6, hi * 1.4, minSep / 2, true, 2], [8, 1e9, Math.ceil(minSep / 3), true, 1], [8, 1e9, 0, true, 0],
      [8, 1e9, Math.ceil(minSep / 3), false, 1], [6, 1e9, 0, false, 0]];
    for (const [dl, dh, sep, deadOnly, nr] of passes) {
      if (out.length >= count) break;
      if (deadOnly) {
        for (const i of dead) { if (out.length >= count) break; if (okAt(i, dl, dh, sep, nr)) take(i); }
      } else {
        for (let tries = 0; out.length < count && tries < 4000; tries++) { const i = randCell(); if (okAt(i, dl, dh, sep, nr)) take(i); }
        for (let i = N + 1; i < N * N - N && out.length < count; i++) if (okAt(i, dl, dh, sep, nr)) take(i);   // zaxira: hamma katakni ketma-ket ko‘rib chiqamiz
      }
    }
    return out;
  };
  const klo = Math.min(Math.max(10, L * 0.12), 40), khi = Math.max(klo + 15, Math.min(L * 0.4, 75));
  spot(KEYS, klo, khi, 10, []).forEach((i, k) => { keyAt[i] = k; keyCells[k] = i; });
  if (!D.noMaps) {
    const mp = spot(2, L * 0.3, L * 0.85, 18, Array.from(keyCells).filter((v) => v >= 0));
    if (mp[0] !== undefined) item[mp[0]] = ITEM_IX.keymap;
    if (mp[1] !== undefined) item[mp[1]] = ITEM_IX.chestmap;
  }
  const beasts = [];
  for (const [type, f] of OP.beast || []) { const i = onSol(f, () => true); if (i >= 0) beasts.push({ type, i }); }
  BEAST_KINDS.forEach((kind, ki) => {
    for (let c = 0, tries = 0; c < D.beasts[ki] && tries < 5000; tries++) {
      const i = randCell();
      if (g[i] !== T.PATH || feat[i] || d0[i] < 25) continue;
      if (beasts.some((b) => Math.abs((b.i % N) - (i % N)) + Math.abs(((b.i / N) | 0) - ((i / N) | 0)) < 8)) continue;
      beasts.push({ type: kind, i }); c++;
    }
  });

  let walkTotal = 0;
  for (let i = 0; i < g.length; i++) if (walk(g[i])) walkTotal++;
  const distExit = bfsMulti(N, g, gates.map((q) => q.y * N + q.x), (t) => walk(t) || t === T.EXIT);   // eng yaqin darvozagacha masofa
  const chestCells = [];
  for (let i = 0; i < N * N; i++) if (chest[i]) chestCells.push(i);
  return { N, g, trap, item, chest, coin, keyAt, keyCells, chestCells: Int32Array.from(chestCells), beastSpawns: beasts, start,
    exits: gates.map((q) => ({ idx: q.y * N + q.x, x: q.x, y: q.y, side: q.side })), exitIdx, exitX, exitY, exitSide,
    sol: Int32Array.from(sol), sols: sols.map((q) => Int32Array.from(q)), walkTotal, tileM: 1000 / N, distExit };
}

/* ================= Holat ================= */
export { bfs, bfsMulti, SIDE_DX, SIDE_DY, generate };
