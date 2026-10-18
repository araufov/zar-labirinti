// BotAI: yo‘l tanlash (botNext/botStep), kartalarni yechish ehtimoli, do‘kondan xarid, tuzoq/devor qo‘yish, kalit xaritasi sotib olish.
import { Sound } from './audio.js';
import { ITEM_IX, PICK_MIN, PTRAPS, PTRAP_KEYS, T, TARGET_KEYS, TOOLS, walk } from './content.js';
import { GAMES } from './games.js';
import { toast } from './hud.js';
import { MAPS, SCRAMBLES, canPay, fireChaos, fireSelf, fireTool, hasBad, leaderTarget, myDist, priceOf, rivalTargets, toolTargets } from './magic.js';
import { SAYS, SAY_S } from './net-room.js';
import { freeFromJail, hasKey, learnKeyMap, playerDown, tryStep } from './player.js';
import { floatText, nearestGate } from './render.js';
import { G, freeP, lvl, me } from './state.js';
import { PWALL, destOk, myTraps, myWalls, trapCommit, trapSpot, wallCheck, wallPlace } from './traps.js';
import { clamp, hash2, lerp, pickRand } from './util.js';
function botWalls(p, dt) {
  const B = p.bot;
  if (B.wallWant > 0) {
    B.wallWant -= dt;
    if (B.wallWant <= 0 || !freeP(p) || p.jail || p.moving) return;
    const tr = p.trail, i = tr.length >= 2 ? tr[tr.length - 2] : -1;
    const why = i < 0 ? 'x' : wallCheck(p, i);
    if (why && why.includes('turibdi')) return;   // quvib kelayotgan raqib aynan shu katakda — keyingi to‘xtashda qayta urinadi
    B.wallWant = 0;
    if (!why) wallPlace(p, i);
    return;
  }
  B.wallT = (B.wallT === undefined ? 35 + Math.random() * 30 : B.wallT) - dt;
  if (B.wallT > 0) return;
  B.wallT = 25 + Math.random() * 25;
  if (Math.random() > B.K.sab || myWalls(p).length >= 1 || p.jail) return;
  const mine = myDist(p);
  if (!rivalTargets(p).some((t) => t.d > mine && Math.hypot((t.idx % G.N) - p.px, ((t.idx / G.N) | 0) - p.py) < 20)) return;
  if (!(p.tbag.wall > 0) && p.coins < priceOf(p, PWALL.price) + 1) return;
  B.wallWant = 9;
}

/* ---- Bomba (qaynoq kartoshka): boshqa o‘yinchiga tegib topshiriladi; portlasa — boshiga qaytadi va tanga yo‘qotadi ---- */
function botKeyHint(p, dt) {
  const B = p.bot;
  if (hasKey(p) || p.knowKey) return;
  B.keyT = (B.keyT === undefined ? 20 : B.keyT) - dt;
  if (B.keyT > 0) return;
  B.keyT = 6 + Math.random() * 6;
  const price = priceOf(p, MAPS.keymap.price());
  if (p.coins >= price && p.shutT <= 0 && Math.random() < [0.4, 0.7, 0.95][BOT_SKILL.indexOf(B.K)]) { p.coins -= price; p.stats.spent += price; learnKeyMap(p); botSay(p, 5, false); }
}
// Botlar ham gapiradi (o‘yinchi boshida pufak): sehr ishlatganda, kalit topganda, qayta tug‘ilganda, oldinda ketayotganda maqtanadi.
function botSay(p, i, loud) {
  if (!p.bot || G.mode !== 'play' || G.time - (p.sayAt === undefined ? -99 : p.sayAt) < 12) return;
  p.sayAt = G.time; p.say = { i, until: G.time + SAY_S };
  const m = me();
  if (loud && m && m.ui && nearMe(p)) toast(m, `${p.name}: ${SAYS[i]}`, 2600);
}
// Botlar ham sehrlardan foydalanadi: topgani yoki pulga sotib olgani — yetakchi raqibga.
function botTools(p, dt) {
  const B = p.bot;
  B.talkT = (B.talkT === undefined ? 40 + Math.random() * 40 : B.talkT) - dt;
  if (B.talkT <= 0) {
    B.talkT = 60 + Math.random() * 60;
    const m = me();
    if (m && !m.bot && m.alive && freeP(p) && G.distExit[p.py * G.N + p.px] < G.distExit[m.py * G.N + m.px]) botSay(p, pickRand([9, 3]), true);
  }
  if (B.sabCool > 0) B.sabCool -= dt;
  B.toolT = (B.toolT === undefined ? 8 + Math.random() * 10 : B.toolT) - dt;
  if (B.toolT > 0) return;
  B.toolT = 3 + Math.random() * 4;
  if (hasBad(p) && freeP(p) && Math.random() < 0.55 && (p.tools.cleanse > 0 || canPay(p, priceOf(p, TOOLS.cleanse.price) + 2))) { fireSelf(p, 'cleanse'); return; }
  if (B.sabCool > 0 || !freeP(p) || p.jail || Math.random() > B.K.sab) return;
  const mine = myDist(p), behind = rivalTargets(p).some((t) => t.d < mine);
  let key = TARGET_KEYS.find((k) => p.tools[k] > 0 && k !== 'swap') || (p.tools.swap > 0 ? 'swap' : null);
  if (!key && p.tools.chaos > 0 && behind && Math.random() < 0.5) key = 'chaos';
  if (!key && p.coins >= 8) key = pickRand(BOT_BUY.filter((k) => priceOf(p, TOOLS[k].price) + 3 <= p.coins));
  if (!key) return;
  if (key === 'chaos') { if (fireChaos(p, key).ok) B.sabCool = 30 + Math.random() * 20; return; }
  const t = key === 'steal' ? toolTargets(p, key).filter((x) => !x.why).sort((x, y) => x.d - y.d)[0] || null : leaderTarget(p, key);
  if (!t) return;
  if (fireTool(p, key, t).ok) B.sabCool = 22 + Math.random() * 20;
}
const BOT_BUY = ['freeze', 'glue', 'fogbomb', 'bandit', 'amnesia', 'flip', 'mask', 'liar', 'sic', 'bomb'];   // botlar pulga sotib oladigan sehrlar
// Botlar ham tuzoq qo‘yadi: orqasida raqib kelayotgan bo‘lsa, to‘xtagan zahoti turgan joyiga. Teleportda manzil — o‘zi ochgan joylarning chiqishdan eng uzog‘i.
function botTraps(p, dt) {
  const B = p.bot;
  if (B.trapWant > 0) {   // niyat bor: bot to‘xtagan zahoti qo‘yadi (yurib turib bo‘lmaydi)
    B.trapWant -= dt;
    if (B.trapWant <= 0 || !freeP(p) || p.jail || p.moving || trapSpot(p)) return;
    B.trapWant = 0;
    botPlaceTrap(p);
    return;
  }
  B.trapT = (B.trapT === undefined ? 20 + Math.random() * 25 : B.trapT) - dt;
  if (B.trapT > 0) return;
  B.trapT = 12 + Math.random() * 14;
  if (Math.random() > B.K.sab * 0.8 || myTraps(p).length >= 2 || p.jail) return;
  const mine = myDist(p);
  if (!rivalTargets(p).some((t) => t.d > mine)) return;   // orqada hech kim bo‘lmasa — tuzoq kerak emas
  if (!PTRAP_KEYS.some((k) => p.tbag[k] > 0) && p.coins < 9) return;
  B.trapWant = 9;
}
function botPlaceTrap(p) {
  let key = PTRAP_KEYS.find((k) => p.tbag[k] > 0);
  if (!key) key = pickRand(PTRAP_KEYS.filter((k) => PTRAPS[k].price + 4 <= p.coins));
  if (!key) return;
  let dest = -1;
  if (key === 'tport') {
    let far = 0;
    const cand = [];
    for (let i = 0; i < G.N * G.N; i++) if (p.explored[i] && destOk(i)) { const d = G.distExit[i]; if (d > far) far = d; cand.push(i); }
    const pool = cand.filter((i) => G.distExit[i] >= far * 0.85 && Math.max(Math.abs((i % G.N) - p.px), Math.abs(((i / G.N) | 0) - p.py)) > PICK_MIN);
    if (!pool.length) return;
    dest = pickRand(pool);
  }
  trapCommit(p, key, dest);
}
const nearXY = (x, y) => { const m = me(); return !!m && Math.abs(m.px - x) + Math.abs(m.py - y) <= 8; };
const nearMe = (p) => nearXY(p.px, p.py);
// Botning ovozi faqat u yaqin bo‘lsa eshitiladi.
function ears(p, fn) {
  const q = Sound.quiet;
  Sound.quiet = q || (!!p && !!p.bot && !nearMe(p));
  try { return fn(); } finally { Sound.quiet = q; }
}
// Bot kuchi: 0 — oson, 1 — o‘rta, 2 — kuchli.
const BOT_SKILL = [
  { step: 1.5, bias: [0.3, 0.55], noise: 16, pause: 0.12, odds: -0.12, think: 1.4, loot: 0.35, sab: 0.5 },
  { step: 1.3, bias: [0.5, 0.8], noise: 9, pause: 0.08, odds: 0, think: 1.15, loot: 0.6, sab: 0.8 },
  { step: 1.12, bias: [0.85, 1.25], noise: 4, pause: 0.05, odds: 0.08, think: 0.9, loot: 0.85, sab: 1 },
];
const distToSide = (c, sd, N) => { const x = c % N, y = (c / N) | 0; return sd === 0 ? y : sd === 1 ? N - 1 - x : sd === 2 ? N - 1 - y : x; };
function botInit(p, skill) {
  const n = G.N * G.N, K = BOT_SKILL[clamp(skill | 0, 0, 2)];
  // Chiqish qaysi tomonda ekanini bot bilmaydi: bir tomonni taxmin qiladi; kompas topsa — yo‘nalishni biladi va eslab qoladi.
  p.bot = { K, target: -1, wait: 0.6 + Math.random() * 1.2, bias: lerp(K.bias[0], K.bias[1], Math.random()), salt: (Math.random() * 1e9) | 0,
    side: pickRand([0, 1, 3]), done: [false, false, false, false], minD: [1e9, 1e9, 1e9, 1e9], know: null, loot: Math.random() < K.loot,
    prev: new Int32Array(n), dist: new Int32Array(n), q: new Int32Array(n) };
}
const botPass = (t) => walk(t) || t === T.EXIT;
const botCan = (p, t) => walk(t) || (t === T.EXIT && hasKey(p));   // qulfli darvozadan faqat kalit bilan o‘tadi
function isFrontier(p, c) {
  const N = G.N, E = p.explored, x = c % N;
  return (x > 0 && !E[c - 1]) || (x < N - 1 && !E[c + 1]) || (c >= N && !E[c - N]) || (c < N * N - N && !E[c + N]);
}
// Ochilgan joylar bo‘ylab BFS: chiqish ko‘rinsa — unga; ko‘rilgan kompas bo‘lsa — ba’zan unga;
// aks holda taxmin qilingan tomonga (yoki kompas ko‘rsatgan joyga) eng yaqin «chegara» katagiga.
function botNext(p) {
  const N = G.N, g = G.g, E = p.explored, B = p.bot, si = p.py * N + p.px, dist = B.dist, prev = B.prev, q = B.q;
  if (p.compass > 0 && !B.know) { const ng = nearestGate(p.px, p.py); B.know = { x: ng.x, y: ng.y }; }
  const kc = !hasKey(p) && p.knowKey ? G.keyCells[p.keySlot] : -1, kx = kc >= 0 ? kc % N : -1, ky = kc >= 0 ? (kc / N) | 0 : -1;
  for (let sd = 0; sd < 4; sd++) B.minD[sd] = Math.min(B.minD[sd], distToSide(si, sd, N));
  const wantLoot = B.loot;
  dist.fill(-1);
  let h = 0, t = 0, exit = -1, keyC = -1, loot = -1, best = -1, bestS = Infinity, band = false;
  dist[si] = 0; prev[si] = -1; q[t++] = si;
  while (h < t) {
    const c = q[h++], d = dist[c];
    if (g[c] === T.EXIT) { exit = c; break; }
    if (keyC < 0 && !hasKey(p) && G.keyAt[c] === p.keySlot) keyC = c;
    if (wantLoot && loot < 0 && d <= 45 && ((!B.know && G.item[c] === ITEM_IX.compass) || (G.coin[c] > 0 && p.coins < 8))) loot = c;
    if (c !== si && isFrontier(p, c)) {
      let guide = 0;
      if (!hasKey(p)) { if (kx >= 0) guide = (Math.abs((c % N) - kx) + Math.abs(((c / N) | 0) - ky)) * Math.max(0.9, B.bias); }   // kalitsiz: kalit tomonga yoki eng yaqin chegaradan boshlab
      else if (B.know) guide = (Math.abs((c % N) - B.know.x) + Math.abs(((c / N) | 0) - B.know.y)) * Math.max(0.9, B.bias);
      else if (B.side >= 0) { const ds = distToSide(c, B.side, N); guide = ds * B.bias; if (ds <= 3) band = true; }
      const s = d + guide + (hash2(c, B.salt) % 100) * B.K.noise * 0.01 + (c === B.target ? -6 : 0);
      if (s < bestS) { bestS = s; best = c; }
    }
    const x = c % N;
    for (const n of [x > 0 ? c - 1 : -1, x < N - 1 ? c + 1 : -1, c - N, c + N]) {
      if (n < 0 || n >= N * N || dist[n] >= 0 || !E[n] || !botCan(p, g[n])) continue;
      dist[n] = d + 1; prev[n] = c; q[t++] = n;
    }
  }
  // taxmin qilingan tomon to‘liq tekshirib bo‘lingan bo‘lsa — boshqa tomonni taxmin qiladi
  if (hasKey(p) && exit < 0 && !B.know && B.side >= 0 && B.minD[B.side] <= 4 && !band) {
    B.done[B.side] = true;
    const left = [0, 1, 3, 2].filter((sd) => !B.done[sd]);
    B.side = left.length ? pickRand(left) : -1;
  }
  const goal = exit >= 0 ? exit : keyC >= 0 ? keyC : loot >= 0 ? loot : best;
  B.target = goal;
  if (goal < 0) return -1;
  let c = goal;
  while (prev[c] !== si && prev[c] >= 0) c = prev[c];
  return prev[c] === si ? c : -1;
}
function botStep(p) {
  const B = p.bot;
  if (B.wait > 0) return false;
  const N = G.N;
  let n = botNext(p);
  if (n < 0) {
    const opts = [p.py * N + p.px - 1, p.py * N + p.px + 1, (p.py - 1) * N + p.px, (p.py + 1) * N + p.px].filter((i) => i >= 0 && botCan(p, G.g[i]) && G.g[i] !== T.ENTRY);
    if (!opts.length) return false;
    n = pickRand(opts);
  }
  if (Math.random() < B.K.pause) B.wait = 0.4 + Math.random() * 1.0;
  let dx = (n % N) - p.px, dy = ((n / N) | 0) - p.py;
  if (p.scramble > 0) { const [sx, sy] = SCRAMBLES[p.scMap](dx, dy); dx = sx; dy = sy; }   // aralashgan boshqaruv botni ham adashtiradi
  if (tryStep(p, dx, dy)) return true;
  if (p.scramble > 0) {   // adashgan yo‘nalish devorga urilsa — bot qotib qolmaydi, tasodifiy yo‘l topib yuradi
    const opts = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([ox, oy]) => botCan(p, G.g[(p.py + oy) * N + p.px + ox]) && G.g[(p.py + oy) * N + p.px + ox] !== T.ENTRY);
    if (opts.length) { const [ox, oy] = pickRand(opts); return tryStep(p, ox, oy); }
  }
  return false;
}
// Bot karta (tuzoq, hayvon, zar…) oldida: bir oz «o‘ylaydi», keyin natija.
function botCard(p, o) {
  const spec = o.game, c = Object.assign({}, o, { p, bot: true, stage: 'play', ok: false, saved: false });
  c.wait = (spec.type === 'dice' ? 1 + Math.random() * 0.8 : spec.type === 'riddle' ? 4 + Math.random() * 5 : 3 + Math.random() * 4) * p.bot.K.think;
  p.card = c;
}
function botOdds(p, spec) {
  const base = (GAMES[spec.type] || GAMES.riddle).bot;
  return clamp(base - lvl() * 0.04 + p.bot.K.odds, 0.3, 0.88);
}
function botCardUpdate(p, dt) {
  const c = p.card;
  c.wait -= dt;
  if (c.wait > 0) return;
  const spec = c.game;
  if (c.kind === 'jail') {
    // Qamoq: har safar bitta zar; kalit bo‘lsa — darhol chiqadi
    if (p.key > 0) { p.key--; p.card = null; freeFromJail(p, true); p.bot.wait = 0.4; return; }
    let a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0);
    if (p.luck > 0) { a = 6; b = 6; p.luck--; }
    floatText(p.px, p.py, `🎲 ${a}+${b}`, a === b ? '#9be38a' : '#ff8a7a');
    if (a === b) { p.card = null; freeFromJail(p, false); p.bot.wait = 0.5; }
    else c.wait = (1.1 + Math.random() * 1.2) * p.bot.K.think;
    return;
  }
  let ok = false, label = '';
  if (spec.type === 'dice') {
    const max = spec.tries || 1;
    for (let att = 0; att < max; att++) {
      let a = 1 + ((Math.random() * 6) | 0), b = 1 + ((Math.random() * 6) | 0);
      if (p.luck > 0) { a = 6; b = 6; p.luck--; }
      label = `🎲 ${a + b}`;
      if (spec.resolve) { ok = !!spec.resolve(a, b, c).ok; break; }
      ok = a + b >= spec.need;
      if (ok) break;
    }
  } else ok = Math.random() < botOdds(p, spec);
  c.ok = ok; c.stage = 'result';
  if (c.onResult) c.onResult(ok, c);
  p.card = null;
  floatText(p.px, p.py, label || (ok ? '✓' : '✗'), ok ? '#9be38a' : c.saved ? '#9fe3ff' : '#ff8a7a');
  p.bot.wait = 0.3 + Math.random() * 0.4;
  if (c.onClose) c.onClose(ok, c);
  if (!p.alive) playerDown(p);
}

/* ================= O‘yin oqimi ================= */
export { botWalls, botKeyHint, botSay, botTools, BOT_BUY, botTraps, botPlaceTrap, nearXY, nearMe, ears, BOT_SKILL, distToSide, botInit, botPass, botCan, isFrontier, botNext, botStep, botCard, botOdds, botCardUpdate };
