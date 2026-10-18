// TrapSystem: qo‘yib ketiladigan tuzoqlar (trapPlace/placedHit/expireTraps), devorlar (wallPlace/wallCheck), bomba (bombTick/bombExplode).
import { Sound } from './audio.js';
import { teleportTo } from './beasts.js';
import { ears } from './bots.js';
import { BOMB_BACK_S, BOMB_R, ECON, PTRAPS, PTRAP_KEYS, PT_LIFE, PT_MAX, T, trapFx, walk } from './content.js';
import { toast } from './hud.js';
import { applyFx, canPay, feed, mapPickOpen, priceOf, sendFx, toolTargets } from './magic.js';
import { netDirty, netFlush } from './net-room.js';
import { giveCoins } from './player.js';
import { emit, floatText, mmSetAll } from './render.js';
import { G, NET, freeP, remoteList } from './state.js';
import { pipOpen, toolsOpen } from './toolsui.js';
const pkey = (kind) => (PTRAPS[kind].fx === 'tport' ? 'swap' : PTRAPS[kind].fx);   // oynachada qaysi ta’sir ko‘rinishi
const myTraps = (p) => G.ptraps.filter((t) => t.owner === p);
// Teleport manzili sifatida yaroqli katak (tosh yo‘lak, bo‘sh, tuzoq/sandiq/topilma yo‘q).
const destOk = (i) => G.g[i] === T.PATH && G.trap[i] < 0 && !G.chest[i] && G.keyAt[i] < 0 && G.item[i] < 0 && !G.coin[i] && G.distExit[i] > 0;
// Turgan joyga tuzoq qo‘yish mumkinmi? '' — mumkin, aks holda sababi.
function trapSpot(p) {
  const N = G.N, i = p.py * N + p.px;
  if (!freeP(p) || p.moving) return 'Yurib turib tuzoq qo‘yib bo‘lmaydi — to‘xta.';
  if (G.g[i] !== T.PATH) return 'Tuzoq faqat oddiy tosh yo‘lakka qo‘yiladi.';
  if (G.trap[i] >= 0 || G.chest[i] || G.item[i] >= 0 || G.coin[i] || G.keyAt[i] >= 0) return 'Bu katakda boshqa narsa bor.';
  if (Math.abs(p.px - (G.start % N)) + Math.abs(p.py - ((G.start / N) | 0)) <= 4) return 'Kirish yaqiniga tuzoq qo‘yib bo‘lmaydi.';
  if (G.ptraps.some((t) => t.cell === i && t.owner === p)) return 'Bu yerda allaqachon tuzoq bor.';
  if (myTraps(p).length >= PT_MAX) return `Bir vaqtda ko‘pi bilan ${PT_MAX} ta tuzoq turishi mumkin.`;
  return '';
}
function trapCommit(p, key, dest) {
  const def = PTRAPS[key], why = trapSpot(p);
  if (!def) return false;
  if (why) { toast(p, why); return false; }
  const cost = priceOf(p, def.price);
  if (p.tbag[key] > 0) p.tbag[key]--;
  else if (p.shutT > 0) { toast(p, `🏪 Do‘kon yopiq (${Math.ceil(p.shutT)} s): faqat sumkadagisini qo‘ya olasan.`); return false; }
  else if (p.coins >= cost) { p.coins -= cost; p.stats.spent += cost; }
  else { toast(p, `Pul yetmaydi: ${cost} 💰 kerak.`); return false; }
  G.ptraps.push({ id: ++p.trapSeq, owner: p, name: p.name, cell: p.py * G.N + p.px, kind: key, dest, t0: G.time });
  p.stats.traps++;
  emit(p.px, p.py, 14, 'dust');
  floatText(p.px, p.py, `${def.icon} Tuzoq qo‘yildi`, '#e7b3ff');
  Sound.pickup();
  toast(p, `${def.icon} ${def.name} qo‘yildi. Raqib bossa ishlaydi — uni faqat sen ko‘rasan.`, 3400);
  netDirty(p, true);
  return true;
}
// Do‘kondan yoki sumkadan: teleport tuzog‘ida avval manzil tanlanadi.
function trapPlace(p, key) {
  const def = PTRAPS[key];
  if (!def) return;
  const why = trapSpot(p);
  if (why) { toast(p, why); return; }
  if (!(p.tbag[key] > 0) && !canPay(p, priceOf(p, def.price))) { toast(p, p.shutT > 0 ? `🏪 Do‘kon yopiq (${Math.ceil(p.shutT)} s): faqat sumkadagisini qo‘ya olasan.` : `Pul yetmaydi: ${priceOf(p, def.price)} 💰 kerak.`); return; }
  if (key === 'tport') { if (mapPickOpen(p, (dest) => trapCommit(p, key, dest))) toolsOpen(p, false); return; }
  if (trapCommit(p, key, -1)) toolsOpen(p, false);
}
// Radar yoniq: tuzoq ustiga bosganda u zararsizlanadi va mukofot beriladi.
function disarmed(p, ownerName) {
  giveCoins(p, ECON.disarm);
  floatText(p.px, p.py, '✂️ Zararsizlandi!', '#bfffd8');
  toast(p, `✂️ ${ownerName}ning tuzog‘ini zararsizlantirding! +${ECON.disarm} 💰`, 3400);
  emit(p.px, p.py, 14, 'spark'); Sound.ok();
}
// Ayni katakdagi begona tuzoq bosildimi? (shu qurilmadagilar — darhol; onlayn begona tuzoq — o‘zimizda qo‘llanadi va egasiga xabar ketadi.)
function placedHit(p, i) {
  if (!p.alive || p.finished || p.immune > 0 || p.cloak > 0) return false;
  const t = G.ptraps.find((x) => x.cell === i && x.owner !== p);
  if (t) {
    G.ptraps.splice(G.ptraps.indexOf(t), 1);
    netDirty(t.owner);
    const me2 = { kind: 'local', q: p, id: 'L' + p.id, name: p.name };
    if (p.radar > 0) { disarmed(p, t.name); ptNotify(t.owner, me2, t.kind, 'off'); return true; }
    const fxk = trapFx(t.kind);
    applyFx(p, fxk, t.dest, { name: t.name, p: t.owner });
    ptNotify(t.owner, me2, t.kind, t.kind === 'tbait' ? fxk : undefined);
    return true;
  }
  const r = G.rptraps.find((x) => x.cell === i && !NET.pdone.has(x.key + '/' + x.id));
  if (r) {
    NET.pdone.add(r.key + '/' + r.id);
    if (p.radar > 0) { disarmed(p, r.name); sendTrapHit(r, p, 'off'); return true; }
    const fxk = trapFx(r.kind);
    applyFx(p, fxk, r.dest, { name: r.name, peer: r.peer, sb: r.bi });
    sendTrapHit(r, p, r.kind === 'tbait' ? fxk : undefined);
    return true;
  }
  return false;
}
// Tuzoq egasiga: kim tushdi (xabar, statistika va — egasi odam bo‘lsa — oynacha).
function ptNotify(owner, target, kind, how) {
  const def = PTRAPS[kind];
  if (how === 'off') { toast(owner, `✂️ ${target.name} sening ${def.icon} tuzog‘ingni zararsizlantirdi!`, 3400); feed('disarm', target, owner); return; }
  owner.stats.sabotage++;
  toast(owner, `${def.icon} ${target.name} sening ${def.name}ga tushdi!`, 3400);
  if (target.kind === 'remote' ? !!(target.r && target.r.leader) : !!(target.q && target.q.leader)) { giveCoins(owner, ECON.bounty); floatText(owner.px, owner.py - 0.5, '🎯 Yetakchiga zarba!', '#ffd56e'); }
  feed(kind === 'tbait' ? 'bait' : 'trap', owner, target);
  if (owner.ui && target.kind !== 'none') pipOpen(owner, target, how || pkey(kind), false, false);
}
function sendTrapHit(r, victim, how) {
  if (!G.online || !NET.named) return;
  const e = { to: r.peer, k: how ? 'tr:' + how : 'tr', n: ++NET.fxn, s: G.seed, f: victim.name.slice(0, 14), a: r.id };
  if (r.bi !== undefined) e.b = r.bi;
  if (victim.bot) e.vb = G.players.filter((q) => q.bot).indexOf(victim);
  NET.fx = NET.fx.slice(-3).concat(e);
  NET.dirty = true; netFlush();
}
// Onlayn odam mening tuzog‘imga tushdi: tuzoq olib tashlanadi, egasiga xabar beriladi.
function trapTaken(owner, id, who, how) {
  const t = G.ptraps.find((x) => x.owner === owner && x.id === id);
  if (!t) return;
  G.ptraps.splice(G.ptraps.indexOf(t), 1);
  netDirty(owner);
  const key = who.vb === undefined ? who.peer : who.peer + '#' + who.vb, r = G.remotes.get(key);
  ptNotify(owner, r ? { kind: 'remote', r, peer: who.peer, bi: who.vb, name: r.name, id: `R${who.peer}#${who.vb === undefined ? '' : who.vb}` } : { kind: 'none', name: who.name, id: 'X' }, t.kind, how);
}
function expireTraps() {
  for (let k = G.ptraps.length - 1; k >= 0; k--) {
    const t = G.ptraps[k];
    if (G.time - t.t0 < PT_LIFE) continue;
    G.ptraps.splice(k, 1);
    toast(t.owner, `${PTRAPS[t.kind].icon} Tuzog‘ing eskirdi.`);
    netDirty(t.owner);
  }
}
const ptList = (owner) => G.ptraps.filter((t) => t.owner === owner).map((t) => [t.id, t.cell, PTRAP_KEYS.indexOf(t.kind), t.dest]);
// Egasi ko‘radigan tuzoqlar: belgi va nur halqasi.
const PW_LIFE = 20, PW_MAX = 2;
const PWALL = { icon: '🚧', name: 'Devor', price: ECON.price.common, text: `Oldingdagi yo‘lakni ${PW_LIFE} soniya to‘sib qo‘yasan — hamma uni ko‘radi, aylanib o‘tishga majbur. Boshqa yo‘l bo‘lmasa qo‘yib bo‘lmaydi.` };
const myWalls = (p) => G.walls.filter((w) => w.owner === p);
const wallList = (owner) => G.walls.filter((w) => w.owner === owner).map((w) => [w.id, w.cell]);
// Katakni devorga aylantiradi / qaytaradi (bir katakda ikkita devor bo‘lsa — sanaladi).
function wallSet(cell, on) {
  const ref = G.wallRef;
  if (on) {
    if (!ref.has(cell)) { if (G.g[cell] !== T.PATH) return false; G.g[cell] = T.WALL; ref.set(cell, 1); }
    else ref.set(cell, ref.get(cell) + 1);
  } else if (ref.has(cell)) {
    const n = ref.get(cell) - 1;
    if (n <= 0) { ref.delete(cell); G.g[cell] = T.PATH; } else ref.set(cell, n);
  } else return false;
  mmSetAll(cell);
  return true;
}
// Devor uchun katak yaroqlimi? '' — mumkin, aks holda sababi.
function wallCheck(p, i) {
  const N = G.N, x = i % N, y = (i / N) | 0;
  if (i < 0 || x < 1 || y < 1 || x >= N - 1 || y >= N - 1) return 'Bu yerga devor qo‘yib bo‘lmaydi.';
  if (G.g[i] !== T.PATH) return 'Devor faqat oddiy tosh yo‘lakka qo‘yiladi.';
  if (G.trap[i] >= 0 || G.chest[i] || G.item[i] >= 0 || G.coin[i] || G.keyAt[i] >= 0) return 'Bu katakda boshqa narsa bor.';
  if (Math.abs(x - (G.start % N)) + Math.abs(y - ((G.start / N) | 0)) <= 4) return 'Kirish yaqiniga devor qo‘yib bo‘lmaydi.';
  if (G.ptraps.some((t) => t.cell === i && t.owner === p)) return 'Bu yerda sening tuzog‘ing bor.';
  const occ = (q) => (q.px === x && q.py === y) || (q.mfx === x && q.mfy === y);
  if (G.players.some((q) => q.alive && !q.finished && occ(q)) || remoteList().some((r) => Math.round(r.x) === x && Math.round(r.y) === y) || G.beasts.some((b) => (b.x === x && b.y === y) || (b.fx === x && b.fy === y))) return 'Bu katakda kimdir turibdi.';
  const cn = wallConnected(i);
  if (cn === 'dead') return 'Tupik yo‘lakka devor qo‘yib bo‘lmaydi.';
  if (cn) return 'Bu yerda devor qo‘yib bo‘lmaydi: boshqa yo‘l yo‘q — kimdir qamalib qoladi.';
  return '';
}
// Devorsiz ham qo‘shni yo‘laklar bir-biriga yetib borishi kerak (aylanma yo‘l ≤ 160 qadam). '' — yaroqli; 'dead' — tupik; boshqa — yo‘l yopilib qoladi.
function wallConnected(i) {
  const N = G.N, nb = [i - 1, i + 1, i - N, i + N].filter((j) => j >= 0 && j < N * N && walk(G.g[j]));
  if (nb.length < 2) return 'dead';
  const seen = new Set([i, nb[0]]), need = new Set(nb.slice(1));
  let frontier = [nb[0]], depth = 0;
  while (frontier.length && need.size && depth < 160) {
    const next = [];
    for (const c of frontier) for (const d of [1, -1, N, -N]) { const j = c + d; if (j < 0 || j >= N * N || seen.has(j) || !walk(G.g[j])) continue; seen.add(j); need.delete(j); next.push(j); }
    frontier = next; depth++;
  }
  return need.size ? 'cut' : '';
}
const wallFront = (p) => { const f = p.face && (p.face.x || p.face.y) ? p.face : { x: 0, y: -1 }; return (p.py + f.y) * G.N + p.px + f.x; };
function wallPlace(p, cell) {
  if (!freeP(p) || p.moving) { toast(p, 'Yurib turib devor qo‘yib bo‘lmaydi — to‘xta.'); return false; }
  const i = cell === undefined ? wallFront(p) : cell;
  const why = myWalls(p).length >= PW_MAX ? `Bir vaqtda ko‘pi bilan ${PW_MAX} ta devor turishi mumkin.` : wallCheck(p, i);
  if (why) { toast(p, why); return false; }
  const own = p.tbag.wall > 0, cost = priceOf(p, PWALL.price);
  if (!own) {
    if (p.shutT > 0) { toast(p, `🏪 Do‘kon yopiq (${Math.ceil(p.shutT)} s): faqat sumkadagisini qo‘ya olasan.`); return false; }
    if (p.coins < cost) { toast(p, `Pul yetmaydi: ${cost} 💰 kerak.`); return false; }
  }
  if (!wallSet(i, true)) { toast(p, 'Bu yerga devor qo‘yib bo‘lmaydi.'); return false; }
  if (own) p.tbag.wall--; else { p.coins -= cost; p.stats.spent += cost; }
  G.walls.push({ id: ++p.trapSeq, owner: p, cell: i, t0: G.time });
  emit(i % G.N, (i / G.N) | 0, 16, 'dust'); ears(p, () => Sound.drum(0.8, 0.8));
  floatText(i % G.N, (i / G.N) | 0, '🚧 Devor!', '#ffd56e');
  toast(p, `🚧 Devor qo‘yildi (${PW_LIFE} s). Raqib aylanib o‘tishga majbur!`, 3200);
  feed('wall', p);
  netDirty(p, true);
  return true;
}
function expireWalls() {
  for (let k = G.walls.length - 1; k >= 0; k--) {
    const w = G.walls[k];
    if (G.time - w.t0 < PW_LIFE) continue;
    G.walls.splice(k, 1);
    wallSet(w.cell, false);
    netDirty(w.owner);
  }
}
function dropWalls(p) {
  for (const w of G.walls.filter((x) => x.owner === p)) wallSet(w.cell, false);
  G.walls = G.walls.filter((x) => x.owner !== p);
}
// Devor belgisi: tuman tagida ham ko‘rinib turadi (o‘zing ochgan joylarda).
function bombTick(p, dt) {
  const prev = Math.ceil(p.bomb);
  p.bomb -= dt;
  if (p.bombLock > 0) p.bombLock -= dt;
  if (p.bomb <= 0) {
    if (p.alive && !p.finished && (p.card || p.pending || p.tele || p.slide || p.jump)) { p.bomb = 0.05; return; }   // karta/slayd tugagach portlaydi (teleport buzilmasin)
    bombExplode(p); return;
  }
  if (Math.ceil(p.bomb) !== prev) { netDirty(p); if (p.bomb < 10) ears(p, () => Sound.fuse()); }
  if (p.bombLock > 0 || !freeP(p)) return;
  // yaqin turgan (BOMB_R katak ichida) mos raqibga tegib topshiradi; o‘zini yuborganga bir necha soniya qaytarmaydi
  let best = null, bd = BOMB_R;
  for (const t of toolTargets(p, 'bomb')) {
    if (t.why || (t.id === p.bombFrom && G.time - p.bombAt < BOMB_BACK_S)) continue;
    const d = Math.hypot((t.idx % G.N) - p.px, ((t.idx / G.N) | 0) - p.py);
    if (d <= bd) { bd = d; best = t; }
  }
  if (best) bombPass(p, best);
}
function bombPass(p, t) {
  const left = p.bomb, arg = Math.max(1, Math.round(left * 10));
  p.bomb = 0; netDirty(p, true);
  let ok = true;
  if (t.kind === 'local') ok = applyFx(t.q, 'bomb', arg, p); else sendFx(t, 'bomb', arg, p);
  if (!ok) { p.bomb = left; return; }   // qabul qilinmadi (himoyada) — bomba o‘zida qoladi
  if (p.bomb === 0) {   // ko‘zgu qaytarmagan bo‘lsa
    floatText(p.px, p.py, '💣 → ' + t.name, '#ffb48a');
    toast(p, `💣 Bomba ${t.name}ga o‘tdi — rahmat, endi senda emas! 😄`, 3000);
    feed('bomb', p, t);
  }
}
function bombExplode(p) {
  p.bomb = 0;
  emit(p.px, p.py, 44, 'spark'); emit(p.px, p.py, 22, 'dust');
  floatText(p.px, p.py, '💥 PORTLADI!', '#ff8a5a');
  p.shake = 0.7;
  ears(p, () => Sound.boom());
  const lost = Math.min(ECON.bomb, p.coins);
  p.coins -= lost;
  if (lost > 0) floatText(p.px, p.py - 0.6, `−${lost} 💰`, '#ff9a6a');
  if (p.alive && !p.finished) { teleportTo(p, G.start, 'storm'); p.stun = Math.max(p.stun, 2); p.stunIcon = '💫'; }
  toast(p, `💥 Bomba portladi! Labirint boshiga uloqtirilding${lost ? ` va ${lost} tanga yo‘qotding` : ''}.`, 4200);
  feed('boom', p);
  netDirty(p, true);
}
export { pkey, myTraps, destOk, trapSpot, trapCommit, trapPlace, disarmed, placedHit, ptNotify, sendTrapHit, trapTaken, expireTraps, ptList, PW_LIFE, PW_MAX, PWALL, myWalls, wallList, wallSet, wallCheck, wallConnected, wallFront, wallPlace, expireWalls, dropWalls, bombTick, bombPass, bombExplode };
