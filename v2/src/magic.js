// MagicSystem + InventorySystem: do‘kon (TOOLS/MAPS narxlari), sehrlarni otish (fireTool/applyFx), tozalash, maskalar, xarita tanlash (mapPick), yetakchi, lenta (feed), EFFECTS/amneziya.
import { Sound } from './audio.js';
import { dragTarget, pickTarget, pushBack, rewind, startHunt, teleportTo } from './beasts.js';
import { botSay, ears } from './bots.js';
import { FX } from './cards.js';
import { AMNESIA_S, BOMB_PASS_LOCK, BOMB_S, DIFFS, ECON, FLIP_S, FOE_KEYS, LIAR_S, MASKS, MASK_S, PICK_MIN, PTRAPS, PTRAP_KEYS, RADAR_S, REVENGE_S, SHUT_S, STEAL_R, T, TAX_S, TOOLS, walk } from './content.js';
import { toast } from './hud.js';
import { bfs } from './maze.js';
import { netDirty, netFlush } from './net-room.js';
import { callBandit, giveCoins, learnChestMap, learnKeyMap, reveal, sameTeam } from './player.js';
import { DPR, emit, floatText, makeCanvas, mmInit, mmSet, mmSetAll, popSprite } from './render.js';
import { G, NET, freeP, mapLvl, me, remoteList } from './state.js';
import { pipOpen, sabEl, toolsOpen } from './toolsui.js';
import { destOk } from './traps.js';
import { TAU, clamp, pickRand, shuffle, touchUI } from './util.js';
// Juda qimmat xaritalar: labirintda yashirin ham (1 tadan), do‘kondan sotib ham olsa bo‘ladi.
const MAPS = {
  keymap: { icon: '📜', name: 'Kalit xaritasi', text: 'Darvoza kaliting qayerdaligini minixaritada va ekranda ko‘rsatadi.', price: () => [25, 40, 70][mapLvl()], has: (p) => p.knowKey, useless: (p) => p.gkey, learn: (p) => learnKeyMap(p) },
  chestmap: { icon: '🗺️', name: 'Xazina xaritasi', text: 'Hamma ochilmagan sandiqlar joyini minixaritada va ekranda ko‘rsatadi.', price: () => [15, 25, 50][mapLvl()], has: (p) => p.knowChest, useless: () => false, learn: (p) => learnChestMap(p) },
};
const MAP_KEYS = Object.keys(MAPS);
function buyMap(p, key) {
  const def = MAPS[key], price = priceOf(p, def.price());
  if (def.has(p)) return { ok: false, msg: 'Bu xarita sendan bor.' };
  if (def.useless(p)) return { ok: false, msg: 'Kalitingni allaqachon topgansan — kerak emas.' };
  if (p.shutT > 0) return { ok: false, msg: `🏪 Do‘kon yopiq: ${Math.ceil(p.shutT)} soniya.` };
  if (p.coins < price) return { ok: false, msg: `Pul yetmaydi: ${price} 💰 kerak.` };
  p.coins -= price; p.stats.spent += price;
  def.learn(p); Sound.pickup();
  return { ok: true };
}
// Do‘kon narxi: «Do‘konni yopish» ta’siridan keyin narxlar 2 baravar; yopiq paytda faqat sumkadagini ishlatish mumkin.
const priceOf = (p, base) => Math.ceil(base * (p.taxT > 0 ? 2 : 1));
const canPay = (p, cost) => p.coins >= cost && !(p.shutT > 0);
const revengeOn = (p, id) => !!(p.revenge && p.revenge.id === id && G.time < p.revenge.until);
// Do‘kon qatorlari (faol varaqdagilar): raqib bo‘lsa «Xalaqit» varag‘i bor; «Xaritalar» varag‘i har doim.
const shopTab = (p) => (rivalTargets(p).length ? (p.sab.tab || 'tool') : 'map');
function shopRows(p) {
  const rows = [], tab = shopTab(p);
  if (tab === 'tool') for (const k of FOE_KEYS) rows.push({ type: 'tool', key: k });
  else if (tab === 'trap') { for (const k of PTRAP_KEYS) rows.push({ type: 'trap', key: k }); rows.push({ type: 'wall', key: 'wall' }); }
  else for (const k of MAP_KEYS) rows.push({ type: 'map', key: k });
  return rows;
}
// Joystik yo‘nalishlarini aralashtirish: har safar tasodifiy bittasi (aylantirish yoki ko‘zgu), 60 soniya.
const SCRAMBLES = [
  (x, y) => [-y, x],    // ↑ = →, → = ↓, ↓ = ←, ← = ↑
  (x, y) => [y, -x],    // ↑ = ←, ← = ↓, ↓ = →, → = ↑
  (x, y) => [-x, -y],   // ↑ = ↓, ← = →
  (x, y) => [y, x],     // ↑ = ←, ↓ = →
  (x, y) => [-y, -x],   // ↑ = →, ↓ = ←
  (x, y) => [-x, y],    // ← = →
  (x, y) => [x, -y],    // ↑ = ↓
];
const DIRV = [[0, -1, '↑'], [1, 0, '→'], [0, 1, '↓'], [-1, 0, '←']];
const arrowOf = (x, y) => (Math.abs(x) > Math.abs(y) ? (x > 0 ? '→' : '←') : y > 0 ? '↓' : '↑');
const scrDesc = (m) => DIRV.map(([x, y, a]) => { const [nx, ny] = SCRAMBLES[m](x, y), b = arrowOf(nx, ny); return a === b ? null : `${a}=${b}`; }).filter(Boolean).join(' ');
const scrVec = (p, v) => { if (!(p.scramble > 0)) return v; const [x, y] = SCRAMBLES[p.scMap](v.x, v.y); return { x, y }; };
const IMMUNE = 12;   // zarba yegandan keyin shuncha soniya yana tegib bo‘lmaydi
const myDist = (p) => G.distExit[p.py * G.N + p.px];
// Boshqarish mumkin bo‘lgan raqiblar: shu qurilmadagi botlar, onlayn do‘stlar va xona egasining botlari.
function rivalTargets(p) {
  const N = G.N, out = [];
  for (const q of G.players) if (q !== p && q.alive && !q.finished && !sameTeam(p, q)) out.push({ kind: 'local', q, name: q.name, idx: q.py * N + q.px });
  for (const r of remoteList()) if (r.alive && !r.fin && r.peer && !sameTeam(p, r)) out.push({ kind: 'remote', r, name: r.name, peer: r.peer, bi: r.bi, idx: Math.round(r.y) * N + Math.round(r.x) });
  for (const t of out) t.d = G.distExit[t.idx];
  return out.filter((t) => t.d >= 0);
}
// Sumkaga sehr tushdi (yolg‘iz o‘yinda sehrdan foyda yo‘q — tanga beriladi).
function addTool(p, key) {
  if (!rivalTargets(p).length) { giveCoins(p, ECON.pouch); return; }   // yolg‘iz o‘yinda sehrdan foyda yo‘q: standart xalta tangaga aylanadi
  p.tools[key]++;
  floatText(p.px, p.py, `${TOOLS[key].icon} ${TOOLS[key].name}`, '#e7b3ff');
  toast(p, `${TOOLS[key].icon} ${TOOLS[key].name} sumkangda! 🪄 tugmadan raqibga ishlat.`);
}
// Vosita uchun raqiblar. Tartib barqaror (ro‘yxat joyidan siljimaydi); chiqishga yaqinlik o‘rni — `rank`; tanlab bo‘lmasa sababi — `why`.
function toolTargets(p, key) {
  const list = rivalTargets(p), mine = myDist(p);
  list.slice().sort((a, b) => a.d - b.d).forEach((t, k) => { t.rank = k + 1; });
  for (const t of list) {
    const q = t.kind === 'local' ? t.q : null;
    t.id = q ? 'L' + q.id : `R${t.peer}#${t.bi === undefined ? '' : t.bi}`;
    t.why = '';
    if (q && q.cloak > 0) t.why = 'ko‘rinmas plashda';
    else if (q && q.immune > 0) t.why = `himoyada (${Math.ceil(q.immune)} s)`;
    else if (q && q.fxq.length) t.why = 'oldingi sehr kutmoqda';
    else if (q && q.jail && key !== 'glue' && key !== 'fogbomb') t.why = 'qamoqda';
    else if (q && key === 'freeze' && q.frozen > 2) t.why = 'allaqachon muzlagan';
    else if (q && key === 'glue' && q.slow > 8) t.why = 'allaqachon yelimda';
    else if (q && key === 'scramble' && q.scramble > 20) t.why = 'allaqachon aralash';
    else if (q && key === 'amnesia' && q.amnesia > 20) t.why = 'allaqachon akleroz';
    else if (q && key === 'flip' && q.flip > 10) t.why = 'allaqachon teskari';
    else if (q && key === 'mask' && q.mask > 20) t.why = 'allaqachon maskalangan';
    else if (q && key === 'liar' && !(q.compass > 0 || (q.knowKey && !q.gkey) || q.knowChest)) t.why = 'yo‘naltirgichi yo‘q';
    else if (q && key === 'kmove' && (q.gkey || G.keyCells[q.keySlot] < 0)) t.why = 'kaliti qo‘lida';
    else if (q && key === 'shut' && q.shutT > 8) t.why = 'do‘koni allaqachon yopiq';
    else if (q && key === 'sic' && G.vans.some((v) => v.target === q.id)) t.why = 'ovchi allaqachon quvyapti';
    else if (key === 'bomb' && ((q && q.bomb > 0) || (t.kind === 'remote' && t.r.bm > 0))) t.why = 'bomba allaqachon unda';
    else if (key === 'steal' && Math.hypot((t.idx % G.N) - p.px, ((t.idx / G.N) | 0) - p.py) > STEAL_R) t.why = `uzoqda (${STEAL_R} katak ichida bo‘lsin)`;
    else if (q && key === 'steal' && q.coins <= 0) t.why = 'puli yo‘q';
    else if (t.kind === 'remote' && t.r.im) t.why = 'himoyada, plashda yoki band';
    else if (key === 'swap' && !(t.d < mine)) t.why = 'u sendan ortda';
  }
  return list;
}
// Yetakchi (chiqishga eng yaqin) tanlash mumkin bo‘lgan raqib.
const leaderTarget = (p, key) => toolTargets(p, key).filter((t) => !t.why).sort((a, b) => a.rank - b.rank)[0] || null;
// Sehr narxi: «Do‘konni yopish» ta’siridan keyin 2 baravar; xalaqit qilgan raqibga javob qaytarish (qasos) — yarim narx.
function toolCost(p, key, t) {
  const c = priceOf(p, TOOLS[key].price);
  return t && revengeOn(p, t.id) ? Math.max(1, Math.ceil(c / 2)) : c;
}
// To‘lov: avval sumkadagisi, bo‘lmasa pul (do‘kon yopiq bo‘lsa — faqat sumkadagisi).
function payTool(p, key, cost) {
  if (p.tools[key] > 0) { p.tools[key]--; return null; }
  if (p.shutT > 0) return `🏪 Do‘kon yopiq (${Math.ceil(p.shutT)} s): faqat sumkadagi sehrlarni ishlata olasan.`;
  if (p.coins < cost) return `Pul yetmaydi: ${cost} 💰 kerak.`;
  p.coins -= cost; p.stats.spent += cost;
  return null;
}
// Sehrni ishlatish: avval sumkadagisi, bo‘lmasa pulga sotib olinadi.
function fireTool(p, key, t) {
  const def = TOOLS[key];
  if (!def) return { ok: false, msg: 'Bunday sehr yo‘q.' };
  if (def.self) return fireSelf(p, key);
  if (def.all) return fireChaos(p, key);
  if (!t) return { ok: false, msg: 'Raqib topilmadi.' };
  if (t.why) return { ok: false, msg: `${t.name}: ${t.why}.` };
  const err = payTool(p, key, toolCost(p, key, t));
  if (err) return { ok: false, msg: err };
  p.stats.sabotage++;
  const myIdx = p.py * G.N + p.px;
  if (key === 'swap') teleportTo(p, t.idx, 'portal');
  const arg = key === 'swap' ? myIdx : key === 'mask' ? (Math.random() * MASKS.length) | 0 : undefined;
  const mir = t.kind === 'local' && t.q.mirror > 0;
  const lead = !!(t.kind === 'local' ? t.q.leader : t.r && t.r.leader);   // 👑 yetakchiga zarba — mukofot
  if (t.kind === 'local') applyFx(t.q, key, arg, p);
  else sendFx(t, key, arg, p);
  feed(key, p, t, key === 'mask' ? arg : undefined);
  if (lead) { giveCoins(p, ECON.bounty); floatText(p.px, p.py - 0.5, '🎯 Yetakchiga zarba!', '#ffd56e'); }
  const refl = mir && t.q.mirror === 0;   // ko‘zgu sehrni qaytardi
  floatText(p.px, p.py, `${def.icon} ${def.name}`, '#e7b3ff');
  const busy = key !== 'swap' && t.kind === 'local' && !freeP(t.q);
  pipOpen(p, t, key, busy, refl);
  if (p.bot && t.kind === 'local' && t.q === me()) botSay(p, 7, false);
  toast(p, `${def.icon} ${def.name}: ${t.name}${busy ? ' — band, karta tugagach tegadi' : ''}${lead ? ` · 🎯 +${ECON.bounty} 💰` : ''}`);
  Sound.pickup();
  return { ok: true, target: t };
}
// Senda tozalanadigan xalaqit bormi?
const hasBad = (p) => p.frozen > 0 || p.slow > 0 || p.scramble > 0 || p.stun > 0 || p.flip > 0 || p.mask > 0 || p.amnesia > 0 || p.liar > 0 || p.shutT > 0 || p.taxT > 0 || p.fxq.length > 0;
function cleanse(p) {
  p.frozen = 0; p.slow = 0; p.scramble = 0; p.stun = 0; p.flip = 0; p.mask = 0; p.liar = 0; p.shutT = 0; p.taxT = 0; p.fxq.length = 0;
  if (p.amnesia > 0) { p.amnesia = 0; endAmnesia(p); }
  p.immune = Math.max(p.immune, 3);
  emit(p.px, p.py, 22, 'spark');
  floatText(p.px, p.py, '🧼 Tozalandi!', '#bfffd8');
  netDirty(p, true);
}
// O‘ziga ishlatiladigan sehrlar: tozalash va radar.
function fireSelf(p, key) {
  if (key === 'cleanse' && !hasBad(p)) return { ok: false, msg: 'Senda tozalanadigan xalaqit yo‘q.' };
  if (key === 'radar' && p.radar > 0) return { ok: false, msg: 'Radar allaqachon yoniq.' };
  const err = payTool(p, key, priceOf(p, TOOLS[key].price));
  if (err) return { ok: false, msg: err };
  if (key === 'cleanse') { cleanse(p); toast(p, '🧼 Hamma xalaqit tozalandi!', 2800); feed('cleanse', p); }
  else { p.radar = RADAR_S; floatText(p.px, p.py, '📡 Radar', '#bfffd8'); toast(p, `📡 Radar yoqildi (${RADAR_S} s): yashirin tuzoqlar ko‘rinadi, ustiga bossang zararsizlanadi.`, 3600); }
  ears(p, () => Sound.ok());
  return { ok: true };
}
// Tartibsizlik: hamma (mos kelganlar) joylari tasodifan almashadi — hech kim o‘z joyida qolmaydi.
function fireChaos(p, key) {
  const N = G.N, list = toolTargets(p, key).filter((t) => !t.why);
  if (!list.length) return { ok: false, msg: 'Almashtirish uchun mos raqib yo‘q (himoyada, plashda yoki band).' };
  const err = payTool(p, key, priceOf(p, TOOLS[key].price));
  if (err) return { ok: false, msg: err };
  p.stats.sabotage++;
  const cells = [p.py * N + p.px].concat(list.map((t) => t.idx)), n = cells.length;
  let perm;
  do { perm = shuffle(Array.from({ length: n }, (_, i) => i)); } while (perm.some((v, i) => v === i));
  const mine = cells[perm[0]];
  teleportTo(p, validSpot(mine) ? mine : pickTarget(p, 'random'), 'portal');
  list.forEach((t, k) => { const cell = cells[perm[k + 1]]; if (t.kind === 'local') applyFx(t.q, 'chaos', cell, p); else sendFx(t, 'chaos', cell, p); });
  p.shake = 0.5;
  floatText(p.px, p.py, '🌪️ TARTIBSIZLIK!', '#ffd56e');
  toast(p, '🌪️ TARTIBSIZLIK! Hamma joyi almashdi — kim qayerga tushganini ko‘ramiz!', 4200);
  ears(p, () => Sound.horn());
  feed('chaos', p);
  return { ok: true };
}
// Avtomatik: yetakchi raqibga (botlar va sinovlar uchun).
function sabotage(p, key) {
  const t = leaderTarget(p, key);
  if (!t) return null;
  const r = fireTool(p, key, t);
  return r.ok ? t.name : null;
}
// Sehr yuboruvchisi: shu qurilmadagi o‘yinchi (p) yoki onlayn odam / uning boti (peer, sb). `reflected` — ko‘zgudan qaytgan sehr (qayta qaytmaydi).
function fxSrc(from) {
  if (!from) return { name: 'Raqib' };
  if (from.px !== undefined) return { name: from.name, p: from };
  return { name: from.name || 'Raqib', p: from.p || null, peer: from.peer || '', sb: from.sb, reflected: !!from.reflected };
}
// Sehr tegdi: `from` — kim ishlatgani. Raqib band bo‘lsa (karta ochiq) — karta tugagach tegadi. Ko‘zgusi bo‘lsa — sehr yuboruvchining o‘ziga qaytadi.
function applyFx(q, kind, arg, from) {
  if (!q || !q.alive || q.finished) return false;
  if (kind === 'loot') {   // o‘g‘irlangan tanga qaytib keldi: o‘g‘rining o‘ziga beriladi
    const n = clamp(arg | 0, 0, ECON.steal);   // begona odam yuborgan qiymat: eng ko‘pi bilan o‘g‘irlik miqdori
    giveCoins(q, n); Sound.pickup();
    toast(q, `🤏 ${fxSrc(from).name || 'Raqib'}dan ${n} tanga o‘g‘irlading!`, 3200);
    return true;
  }
  if (!(TOOLS[kind] || kind === 'tport')) return false;
  const src = fxSrc(from);
  if ((q.cloak > 0 || q.immune > 0) && !(kind === 'bomb' && src.reflected)) return false;   // qaytgan bomba yo‘qolib ketmasin
  if (src.reflected && src.peer) pipReflected(src, kind);
  if (q.mirror > 0 && !src.reflected && kind !== 'chaos') { reflectFx(q, kind, arg, src); return true; }
  if (kind !== 'swap' && !freeP(q)) { q.fxq.push({ kind, arg, from: src, t: G.time }); netDirty(q); return true; }
  q.stats.hit++;
  q.immune = IMMUNE; netDirty(q);
  mapPickClose(q, false);
  const who = src.name || 'Raqib', say = (m, ms) => toast(q, (src.reflected ? '🪞 Qaytdi! ' : '') + m, ms);
  if (!src.reflected && (src.p || src.peer)) q.revenge = { id: src.p ? 'L' + src.p.id : `R${src.peer}#${src.sb === undefined ? '' : src.sb}`, until: G.time + REVENGE_S, name: who };
  emit(q.px, q.py, 16, 'spark');
  floatText(q.px, q.py, (TOOLS[kind] || PTRAPS.tport).icon, '#e7b3ff');
  if (kind === 'freeze') { q.frozen = 8; say(`${who} seni muzlatdi! 8 soniya qimirlay olmaysan.`); }
  else if (kind === 'fogbomb') { forgetArea(q, 14); say(`${who} tuman bombasi otdi — xaritang yana tumanga burkandi!`); }
  else if (kind === 'glue') { q.slow = 20; say(`${who} yelim sepdi — 20 soniya sekin yurasan.`); ears(q, () => Sound.boing()); }
  else if (kind === 'bandit') { callBandit(q); say(`${who} qaroqchini senga yubordi — qoch!`); }
  else if (kind === 'scramble') { q.scMap = (Math.random() * SCRAMBLES.length) | 0; q.scramble = 30; say(`${who} boshqaruvingni aralashtirdi (30 s): ${scrDesc(q.scMap)}`, 5200); }
  else if (kind === 'amnesia') { startAmnesia(q, AMNESIA_S); say(`${who} senga akleroz yubordi — ${AMNESIA_S} soniya ochgan joylaring ko‘rinmaydi!`, 4200); }
  else if (kind === 'flip') { q.flip = FLIP_S; say(`${who} dunyoni teskari ag‘dardi — ${FLIP_S} soniya! Joystik esa o‘sha-o‘sha 😄`, 4200); ears(q, () => Sound.boing()); }
  else if (kind === 'mask') { startMask(q, arg); const mk = MASKS[q.maskK]; say(`${who} seni ${mk.to} aylantirdi ${mk.e} — hamma senga qarab kulyapti!`, 4200); ears(q, () => Sound.cluck()); }
  else if (kind === 'liar') { q.liar = LIAR_S; q.liarA = 3 + ((Math.random() * 3) | 0); say(`${who} kompasingni buzdi — ${LIAR_S} soniya noto‘g‘ri tomonni ko‘rsatadi 🥴`, 4200); }
  else if (kind === 'kmove') { say(moveKey(q) ? `${who} darvoza kalitingni boshqa joyga ko‘chirdi! 🔑` : `${who} kalitingni ko‘chirmoqchi bo‘ldi — omading keldi.`, 4200); }
  else if (kind === 'steal') {
    const n = Math.min(ECON.steal, q.coins);
    if (n > 0) {
      q.coins -= n; floatText(q.px, q.py, `−${n} 💰`, '#ff9a6a');
      if (src.p && src.p !== q) { giveCoins(src.p, n); toast(src.p, `🤏 ${q.name}dan ${n} tanga o‘g‘irlading!`, 3200); }
      else if (src.peer && G.online && NET.named) sendFx({ peer: src.peer, bi: src.sb }, 'loot', n, { name: q.name });
    }
    say(n > 0 ? `${who} cho‘ntagingdan ${n} tanga o‘g‘irladi! 🤏` : `${who} cho‘ntagingni kovladi — puling yo‘q ekan 😅`, 3600);
  }
  else if (kind === 'shut') { q.shutT = SHUT_S; q.taxT = TAX_S; toolsOpen(q, false); say(`${who} do‘koningni yopdi — ${SHUT_S} soniya hech narsa sotib ololmaysan, keyin narxlar 2 baravar!`, 4600); }
  else if (kind === 'sic') { startHunt(q); say(`${who} ovchi Burgut’ni izingdan yubordi — qoch! 🚐`, 4000); }
  else if (kind === 'bomb') {
    const secs = arg > 0 ? clamp(arg / 10, 1, BOMB_S) : BOMB_S;
    q.bomb = secs; q.bombFrom = src.p ? 'L' + src.p.id : `R${src.peer}#${src.sb === undefined ? '' : src.sb}`; q.bombAt = G.time; q.bombLock = BOMB_PASS_LOCK; q.immune = BOMB_PASS_LOCK;
    say(`${who} senga 💣 BOMBA berdi — ${Math.ceil(secs)} soniya ichida boshqa o‘yinchiga tegib topshir!`, 4600);
    ears(q, () => Sound.sting());
    netDirty(q, true);
  }
  else if (kind === 'chaos') { teleportTo(q, validSpot(arg) ? arg : pickTarget(q, 'random'), 'portal'); say(`${who} TARTIBSIZLIK qildi — hamma joyi almashdi! 🌪️`, 4000); ears(q, () => Sound.horn()); }
  else if (kind === 'swap' && validSpot(arg)) { teleportTo(q, arg, 'portal'); say(`${who} sen bilan joy almashtirdi!`); }
  else if (kind === 'tport' && arg >= 0) { teleportTo(q, validDest(q, arg), 'portal'); say(`${who} tuzog‘iga tushding — boshqa joyga uloqtirilding!`, 3600); }
  return true;
}
// Kalitni boshqa uzoq boshi berk yo‘lakka ko‘chiradi (faqat egasining qurilmasida: kalit faqat o‘zi uchun ko‘rinadi).
function moveKey(q) {
  const N = G.N, slot = q.keySlot, old = G.keyCells[slot];
  if (q.gkey || old < 0) return false;
  const dist = bfs(N, G.g, q.py * N + q.px, walk), sx = G.start % N, sy = (G.start / N) | 0;
  const pool = (strict) => {
    const out = [];
    for (let i = N + 1; i < N * N - N; i++) {
      if (G.g[i] !== T.PATH || i === old || dist[i] < 18) continue;
      if (G.trap[i] >= 0 || G.chest[i] || G.coin[i] || G.item[i] >= 0 || G.keyAt[i] >= 0) continue;
      if (Math.abs((i % N) - sx) + Math.abs(((i / N) | 0) - sy) < 12) continue;
      let nb = 0; for (const d of [1, -1, N, -N]) if (walk(G.g[i + d])) nb++;
      if (nb === 1 || (!strict && nb === 2)) out.push(i);
    }
    return out;
  };
  let c = pool(true);
  if (!c.length) c = pool(false);
  if (!c.length) return false;
  const nw = pickRand(c);
  G.keyAt[old] = -1; G.keyCells[slot] = nw; G.keyAt[nw] = slot;
  mmSetAll(old); mmSetAll(nw);
  netDirty(q);
  return true;
}
function startMask(q, k) {
  q.mask = MASK_S; q.maskK = k >= 0 && k < MASKS.length ? k : (Math.random() * MASKS.length) | 0;
  netDirty(q, true);
}
// Tartibsizlik uchun yaroqli joy (tosh yo‘lak yoki kirish).
const validSpot = (i) => i >= 0 && i < G.N * G.N && (G.g[i] === T.PATH || G.g[i] === T.ENTRY);
// Onlayn raqib ko‘zgusi sehrni qaytardi: oynachada u «tushgan» ko‘rinmasin, «qaytarildi» deb yozilsin.
function pipReflected(src, kind) {
  const m = me();
  if (!m || !m.pips) return;
  for (const pp of m.pips) if (pp.rkey === src.peer || pp.rkey === src.peer + '#' + src.sb) { delete pp.fx[kind]; pp.fx.refl = { at: G.time, wait: false }; }
}
// Ko‘zgu: sehr uni yuborgan odamning o‘ziga qaytadi (shu qurilmadagi bo‘lsa — darhol, onlayn bo‘lsa — hodisa orqali).
function reflectFx(q, kind, arg, src) {
  q.mirror = 0; q.stats.reflected++;
  floatText(q.px, q.py, '🪞 Qaytdi!', '#cfe9ff');
  emit(q.px, q.py, 22, 'spark');
  ears(q, () => Sound.portal());
  toast(q, `🪞 Ko‘zgu ${src.name} sehrini o‘ziga qaytardi!`, 3400);
  feed('reflect', q, src);
  const back = { name: q.name, p: q, reflected: true };
  if (src.p && src.p !== q) { applyFx(src.p, kind, arg, back); toast(src.p, `🪞 ${q.name} ko‘zgusi sehringni o‘zingga qaytardi!`, 3400); }
  else if (src.peer && G.online && NET.named) sendFx({ peer: src.peer, bi: src.sb }, kind, arg, back);
  netDirty(q);
}
// Teleport tuzog‘i manzili: yo‘l bo‘lmasa (yoki yaroqsiz bo‘lsa) tasodifiy yaroqli joy.
function validDest(q, i) {
  return i >= 0 && i < G.N * G.N && G.g[i] === T.PATH ? i : pickTarget(q, 'random');
}
function sendFx(t, kind, arg, from) {
  if (!G.online || !NET.named) return;
  const sp = from && (from.px !== undefined ? from : from.p);
  const e = { to: t.peer, k: kind, n: ++NET.fxn, s: G.seed, f: ((from && from.name) || '').slice(0, 14) };
  if (t.bi !== undefined) e.b = t.bi;
  if (arg !== undefined) e.a = arg;
  if (from && from.reflected) e.rf = 1;
  if (sp && sp.bot) e.sb = G.players.filter((q) => q.bot).indexOf(sp);
  NET.fx = NET.fx.slice(-3).concat(e);
  NET.dirty = true; netFlush();
}


/* ---- Qo‘yib ketiladigan tuzoqlar ---- */
function mapPickOpen(p, cb) {
  if (!p.ui || !p.ui.mappick || !p.mm) return false;
  mapPickClose(p, false);
  const N = G.N, valid = [];
  let x0 = N, y0 = N, x1 = -1, y1 = -1;
  for (let i = 0; i < N * N; i++) {
    if (!p.explored[i]) continue;
    const x = i % N, y = (i / N) | 0;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (destOk(i) && Math.max(Math.abs(x - p.px), Math.abs(y - p.py)) > PICK_MIN) valid.push(i);
  }
  if (!valid.length) { toast(p, 'Manzil tanlash uchun xaritaning boshqa joylarini ham och — hozircha yaroqli joy yo‘q.', 3200); return false; }
  const full = Math.min(N, Math.max(x1 - x0, y1 - y0) + 9);
  const ov = makeCanvas(N, N), og = ov.getContext('2d'), img = og.createImageData(N, N);
  for (const i of valid) { const k = i * 4; img.data[k] = 120; img.data[k + 1] = 255; img.data[k + 2] = 150; img.data[k + 3] = 95; }
  og.putImageData(img, 0, 0);
  const P = p.ui.mappick;
  P.textContent = '';
  const head = sabEl('div', 'sab-head'), xb = sabEl('button', 'sab-x', '✕');
  xb.type = 'button'; xb.setAttribute('aria-label', 'Bekor qilish');
  head.append(sabEl('b', 'sab-title', '🌀 Teleport tuzog‘i — qayerga uloqtirsin?'), xb);
  const sub = sabEl('p', 'sab-sub', 'Raqib tuzoqni bossa, shu joyga tushadi. Faqat o‘zing ochgan joylarni tanlay olasan — yashil joylardan birini bos' + (touchUI ? '.' : ' (yoki ← ↑ ↓ → bilan tanla, Shift — tezroq, +/− — yaqinlashtirish, Enter — qo‘y, Esc — bekor).'));
  const cv = sabEl('canvas', 'pk-cv');
  cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Ochilgan joylar xaritasi: tuzoq manzilini tanlash');
  const foot = sabEl('div', 'pk-foot'), info = sabEl('p', 'pk-info', ''), zi = sabEl('button', 'sab-go pk-z', '＋'), zo = sabEl('button', 'sab-go pk-z', '－');
  const no = sabEl('button', 'sab-go sab-back', 'Bekor'), ok = sabEl('button', 'sab-go', 'Shu yerga');
  for (const b of [zi, zo, no, ok]) b.type = 'button';
  zi.setAttribute('aria-label', 'Yaqinlashtirish'); zo.setAttribute('aria-label', 'Uzoqlashtirish');
  foot.append(zo, zi, sabEl('span', 'sp'), no, ok);
  P.append(head, sub, cv, info, foot);
  P.hidden = false;
  const rh = p.ui.root.clientHeight, short = rh < 520;   // yotiq telefonda: tepadagi tugmalar ostidan boshlanadi, matn yashiriladi
  const side = Math.floor(Math.max(120, Math.min(P.clientWidth - 24, short ? rh - 190 : rh * 0.5, 480)));
  cv.style.width = side + 'px'; cv.style.height = side + 'px';
  cv.width = cv.height = Math.round(side * DPR);
  const K = { cb, sel: -1, valid, full, span: full, bx: 0, by: 0, ov, cv, g: cv.getContext('2d'), info, ok, drag: false };
  K.bx = clamp(Math.round((x0 + x1 + 1) / 2 - full / 2), 0, N - full); K.by = clamp(Math.round((y0 + y1 + 1) / 2 - full / 2), 0, N - full);
  p.pick = K;
  const at = (e) => {
    const r = cv.getBoundingClientRect(), sc = r.width / K.span;
    mapPickSnap(p, K.bx + (e.clientX - r.left) / sc - 0.5, K.by + (e.clientY - r.top) / sc - 0.5, Math.max(1.5, 26 / sc));
  };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (_) { /* eski brauzer */ } K.drag = true; at(e); });
  cv.addEventListener('pointermove', (e) => { if (K.drag) at(e); });
  const up = () => { K.drag = false; };
  cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('wheel', (e) => { e.preventDefault(); const r = cv.getBoundingClientRect(); mapPickZoom(p, e.deltaY < 0 ? 1.4 : 1 / 1.4, (e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height); }, { passive: false });
  xb.addEventListener('click', () => mapPickClose(p, true));
  no.addEventListener('click', () => mapPickClose(p, true));
  zi.addEventListener('click', () => mapPickZoom(p, 1.5));
  zo.addEventListener('click', () => mapPickZoom(p, 1 / 1.5));
  ok.addEventListener('click', () => mapPickConfirm(p));
  mapPickSet(p, -1);
  return true;
}
function mapPickClose(p, reopen) {
  const K = p.pick;
  if (!K) return;
  p.pick = null;
  if (p.ui && p.ui.mappick) { p.ui.mappick.hidden = true; p.ui.mappick.textContent = ''; }
  if (reopen) { p.sab.tab = 'trap'; toolsOpen(p, true); }
}
// Bosilgan nuqtaga eng yaqin tanlash mumkin bo‘lgan (ochilgan, bo‘sh) katak.
function mapPickSnap(p, cx, cy, R) {
  const K = p.pick, N = G.N;
  if (!K) return;
  let best = -1, bd = R * R;
  for (const i of K.valid) {
    const dx = (i % N) - cx, dy = ((i / N) | 0) - cy, d = dx * dx + dy * dy;
    if (d <= bd) { bd = d; best = i; }
  }
  if (best >= 0) mapPickSet(p, best);
}
function mapPickSet(p, i) {
  const K = p.pick, N = G.N;
  if (!K) return;
  K.sel = i;
  if (i >= 0) {
    const dx = (i % N) - p.px, dy = ((i / N) | 0) - p.py;   // tanlangan joy ko‘rinish chetida qolsa — markazga olinadi
    const fx = ((i % N) - K.bx) / K.span, fy = (((i / N) | 0) - K.by) / K.span;
    if (fx < 0.08 || fx > 0.92 || fy < 0.08 || fy > 0.92) { K.bx = clamp(Math.round((i % N) - K.span / 2), 0, N - K.span); K.by = clamp(Math.round(((i / N) | 0) - K.span / 2), 0, N - K.span); }
    K.info.textContent = `📍 Tanlandi: sendan ${Math.abs(dx) + Math.abs(dy)} katak ${arrowOf(dx, dy)}`;
  } else K.info.textContent = 'Xaritadan yashil joyni tanla.';
  K.ok.disabled = i < 0;
  mapPickDraw(p);
}
function mapPickMove(p, dx, dy, step) {
  const K = p.pick, N = G.N;
  if (!K) return;
  const b = K.sel >= 0 ? K.sel : p.py * N + p.px, bx = b % N, by = (b / N) | 0;
  let best = -1, bs = 1e9;
  for (const i of K.valid) {
    if (i === b) continue;
    const x = (i % N) - bx, y = ((i / N) | 0) - by, along = x * dx + y * dy, perp = Math.abs(y * dx - x * dy);
    if (along <= 0 || perp > along * 1.2 + 1) continue;
    const sc = Math.abs(along - step) + perp * 1.5;
    if (sc < bs) { bs = sc; best = i; }
  }
  if (best >= 0) mapPickSet(p, best);
}
function mapPickZoom(p, f, fx, fy) {
  const K = p.pick, N = G.N;
  if (!K) return;
  if (fx === undefined) {   // tugma yoki klaviatura: tanlangan joy (bo‘lmasa markaz) atrofida
    fx = 0.5; fy = 0.5;
    if (K.sel >= 0) { const sx = ((K.sel % N) - K.bx + 0.5) / K.span, sy = (((K.sel / N) | 0) - K.by + 0.5) / K.span; if (sx >= 0 && sx <= 1 && sy >= 0 && sy <= 1) { fx = sx; fy = sy; } }
  }
  const span = clamp(Math.round(K.span / f), Math.min(15, K.full), K.full);
  if (span === K.span) return;
  const cx = K.bx + fx * K.span, cy = K.by + fy * K.span;
  K.bx = clamp(Math.round(cx - fx * span), 0, N - span); K.by = clamp(Math.round(cy - fy * span), 0, N - span); K.span = span;
  mapPickDraw(p);
}
function mapPickConfirm(p) {
  const K = p.pick;
  if (!K) return;
  if (K.sel < 0) { toast(p, 'Avval xaritadan yashil joyni tanla.'); return; }
  if (!p.explored[K.sel] || !destOk(K.sel)) { toast(p, 'Bu joy endi yaroqsiz — boshqasini tanla.'); K.valid = K.valid.filter((i) => i !== K.sel); mapPickSet(p, -1); return; }
  const cb = K.cb, dest = K.sel;
  mapPickClose(p, false);
  cb(dest);
}
function mapPickDraw(p) {
  const K = p.pick, m = p.mm;
  if (!K || !m) return;
  if (m.dirty) { m.base.getContext('2d').putImageData(m.img, 0, 0); m.dirty = false; }
  const g = K.g, S = K.cv.width, N = G.N, sc = S / K.span, t = performance.now() / 1000;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = '#0a110c'; g.fillRect(0, 0, S, S);
  g.drawImage(m.base, K.bx, K.by, K.span, K.span, 0, 0, S, S);
  g.drawImage(K.ov, K.bx, K.by, K.span, K.span, 0, 0, S, S);
  const at = (i) => [((i % N) - K.bx + 0.5) * sc, (((i / N) | 0) - K.by + 0.5) * sc];
  const dot = (i, col, r, ring) => {
    const [x, y] = at(i);
    if (x < -r || y < -r || x > S + r || y > S + r) return;
    g.fillStyle = col; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
    if (ring) { g.strokeStyle = 'rgba(255,255,255,.85)'; g.lineWidth = DPR * 1.5; g.beginPath(); g.arc(x, y, r * 1.8, 0, TAU); g.stroke(); }
  };
  const r0 = Math.max(3 * DPR, sc * 0.4);
  for (const tr of G.ptraps) if (tr.owner === p) dot(tr.cell, '#e7b3ff', r0 * 0.75, false);
  dot(p.py * N + p.px, p.color, r0, true);
  if (K.sel >= 0) {
    const [x, y] = at(K.sel), pulse = 0.5 + 0.5 * Math.sin(t * 6), R = Math.max(11 * DPR, sc * 0.9);
    g.fillStyle = 'rgba(40,16,60,.8)'; g.beginPath(); g.arc(x, y, R * (1 + 0.12 * pulse), 0, TAU); g.fill();
    g.strokeStyle = '#e7b3ff'; g.lineWidth = 2.2 * DPR; g.stroke();
    const spr = popSprite('🌀'), w = R * 1.5;
    g.drawImage(spr, x - w / 2, y - w / 2, w, (w * spr.height) / spr.width);
  }
}

// Yetakchi: chiqishga eng yaqin tirik o‘yinchi. U hammaning ekranida 👑 bilan ko‘rinadi; unga xalaqit qilganga mukofot (ECON.bounty).
function updateLeader() {
  const N = G.N, all = [];
  for (const q of G.players) if (q.alive && !q.finished) all.push([q, q.py * N + q.px]);
  for (const r of remoteList()) if (r.alive && !r.fin && r.x !== undefined) all.push([r, Math.round(r.y) * N + Math.round(r.x)]);
  let best = null, bd = Infinity, second = Infinity;
  for (const [q, i] of all) { const d = G.distExit[i]; if (d < 0) continue; if (d < bd) { second = bd; bd = d; best = q; } else if (d < second) second = d; }
  const lead = all.length > 1 && best && bd < second && G.distExit[G.start] - bd >= 4 ? best : null;   // yakka va boshlanishdan kamida 4 katak oldinda bo‘lsagina
  for (const [q] of all) q.leader = q === lead;
  G.leaderName = lead ? lead.name : '';
}

/* ---- Jonli lenta: kim kimga nima qildi — hamma ko‘radi (hazil bilan) ---- */
const FEED_Q = {
  freeze: ['{b} muz bo‘lib qoldi 🥶 — haykalga o‘xshab!', '{a} → {b}: ❄️ sovuq tushdi!', '{b} qotib qoldi, {a} esa kulib turibdi 😄'],
  glue: ['{b} yelimga botdi 🍯 — toshbaqadan sekin!', '{b} asalga tushgan pashshaday yuryapti 🍯', '{a} → {b}: 🍯 yelim!'],
  fogbomb: ['{b}ning xaritasi tumanga burkandi 🌫️', '{a} → {b}: 🌫️ nima ko‘rdi, nima?', '{b} qayerdaligini unutdi 🌫️'],
  amnesia: ['{b} hammasini unutdi 🧠 — akleroz!', '{a} → {b}: 🧠 «Men kimman, bu qayer?»'],
  liar: ['{b}ning kompasi mast bo‘ldi 🥴', '{a} → {b}: 🧭 kompas yolg‘on gapiryapti!'],
  scramble: ['{b}ning joystigi aralashdi 🎮 — o‘ngga desa chapga ketadi!', '{a} → {b}: 🎮 boshqaruv chalkashdi'],
  flip: ['{b} uchun dunyo teskari bo‘ldi 🙃', '{a} → {b}: 🙃 boshi bilan yuryapti!'],
  mask: ['{b} endi {m}! {e} — hamma kulyapti', '{a} → {b}: {e} {t} aylandi!'],
  steal: ['{a} {b}ning cho‘ntagini kovladi 🤏', '{a} → {b}: 🤏 tanga o‘g‘irlandi!'],
  kmove: ['{a} {b}ning kalitini yashirib qo‘ydi 🔑', '{a} → {b}: 🔑 kalit qayoqqadir ketdi!'],
  shut: ['{b}ning do‘koni yopildi 🏪 — «Tushlik tanaffusi»!', '{a} → {b}: 🏪 do‘kon qulflandi'],
  bandit: ['{a} qaroqchini {b} ustiga qo‘yib yubordi 📯', '{a} → {b}: 📯 qaroqchi keldi — qoch!'],
  sic: ['{a} ovchi Burgut’ni {b} ustiga yubordi 🚐', '{a} → {b}: 🚐 ovchi izingda!'],
  swap: ['{a} bilan {b} joy almashtirishdi 🔀', '{a} ↔ {b}: 🔀 kim qayerda?'],
  chaos: ['🌪️ {a} hammani chalkashtirib yubordi!', '🌪️ Tartibsizlik! {a} hammaning joyini almashtirdi'],
  cleanse: ['{a} o‘zini tozaladi 🧼 — yangi odamday!'],
  reflect: ['🪞 {a}ning ko‘zgusi {b}ning sehrini qaytardi — o‘zi yeb qoldi!', '🪞 {b} o‘z sehriga o‘zi tushdi!'],
  trap: ['{b} {a}ning tuzog‘iga tushdi 🪤', '🪤 {a} tuzoq qo‘ygan edi — {b} tushdi!'],
  bait: ['{b} soxta tangaga aldandi 🪙😂', '🪙 {a}ning o‘ljasiga {b} tushdi!'],
  disarm: ['{a} {b}ning tuzog‘ini zararsizlantirdi ✂️', '✂️ {a} radar bilan {b}ning tuzog‘ini topdi'],
  death: ['☠️ {a} halok bo‘ldi — hamma narsasini yo‘qotdi 😂', '☠️ {a} 0 dan boshlaydi — hamdardlik bildiramiz'],
  jail: ['⛓️ {a} qamoqqa tushdi — ikkita bir xil zar tushsin!', '⛓️ {a} panjara ortida 😅'],
  bomb: ['💣 {a} {b}ga bomba berdi — tezroq birovga ber!', '💣 {b}da bomba bor! Qochinglar!'],
  boom: ['💥 {a}ning qo‘lida bomba portladi!', '💥 {a} bomba bilan birga uchib ketdi!'],
  duelwin: ['⚔️ {a} duelda {b}ni yengdi!', '⚔️ {a} g‘olib, {b} orqaga uchdi'],
  wall: ['🧱 {a} yo‘lakni to‘sib qo‘ydi!', '🧱 {a} devor qurdi — aylanib o‘tinglar'],
};
function feedShow(text) {
  for (const p of G.players) {
    if (!p.ui || !p.ui.feed) continue;
    const box = p.ui.feed, el = document.createElement('p');
    el.textContent = text; box.appendChild(el);
    while (box.children.length > 4) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 7000); setTimeout(() => el.remove(), 7600);
  }
}
// kind — FEED_Q kaliti; a, b — ism yoki {name}; mk — maska tartibi. Shu qurilmada ko‘rsatiladi va onlayn xonaga yuboriladi.
function feed(kind, a, b, mk) {
  const list = FEED_Q[kind];
  if (!list) return;
  const nm = (x) => (x && typeof x === 'object' ? x.name : x) || 'Kimdir', M = MASKS[mk] || MASKS[0];
  const text = pickRand(list).replace(/\{a\}/g, nm(a)).replace(/\{b\}/g, nm(b)).replace(/\{m\}/g, M.n).replace(/\{t\}/g, M.to).replace(/\{e\}/g, M.e);
  feedShow(text);
  if (G.online && NET.named) { NET.feedN++; NET.feedOut = NET.feedOut.slice(-1).concat([[NET.feedN, Array.from(text).slice(0, 90).join('')]]); NET.dirty = true; netFlush(); }
}

/* ---- Devor: yo‘lakni vaqtincha to‘sadi (hamma ko‘radi); hech kim qamalib qolmasligi uchun aylanib o‘tadigan yo‘l bo‘lishi shart ---- */
const EFFECTS = {
  forget(p) { forgetArea(p, DIFFS[G.diff].monkeyR); },
  fever(p) { p.fever = FX().fever; reveal(p); },
  flood(p) { pushBack(p, FX().flood, 'water'); },
  trample(p) { pushBack(p, FX().trample, 'dust'); },
  trample6(p) { pushBack(p, 6, 'dust'); },
  hunt(p) { startHunt(p); toast(p, 'Burgut izingga tushdi — qoch!'); },
  drag(p) { teleportTo(p, dragTarget(p), 'vines'); },
  rewind(p) { rewind(p, FX().rewind); },
  storm(p) { teleportTo(p, pickTarget(p, 'any'), 'storm'); },
};
function forgetArea(p, R) {
  const N = G.N, cx = p.px, cy = p.py, R2 = R * R;
  for (let y = Math.max(0, cy - R); y <= Math.min(N - 1, cy + R); y++)
    for (let x = Math.max(0, cx - R); x <= Math.min(N - 1, cx + R); x++) {
      const d2 = (x - cx) * (x - cx) + (y - cy) * (y - cy);
      if (d2 > R2 || d2 <= 5) continue;
      const i = y * N + x;
      if (p.memE && p.memE[i]) { p.memE[i] = 0; if (walk(G.g[i])) p.memPath--; }   // akleroz paytida ham haqiqiy xotira unutiladi
      if (!p.explored[i]) continue;
      p.explored[i] = 0; p.visited[i] = 0;
      if (walk(G.g[i])) p.exploredPath--;
      mmSet(p, i);
    }
  p.trail = [cy * N + cx];
  emit(cx, cy, 14, 'leaf');
}
// Akleroz: ochgan joylar bir muddat ko‘rinmaydi (xarita va ekranda faqat hozirgi atrof); tugagach xotira qaytadi, shu orada ko‘rilgani ham qo‘shiladi.
function startAmnesia(p, secs) {
  if (p.amnesia > 0) { p.amnesia = Math.max(p.amnesia, secs); return; }
  p.amnesia = secs;
  p.memE = p.explored; p.memPath = p.exploredPath;
  p.explored = new Uint8Array(G.N * G.N); p.exploredPath = 0;
  if (!p.bot) mmInit(p);
  reveal(p);
}
function endAmnesia(p) {
  p.amnesia = 0;
  const mem = p.memE;
  if (!mem) return;
  p.memE = null;
  const cur = p.explored, N = G.N;
  let cnt = 0;
  for (let i = 0; i < cur.length; i++) { if (cur[i]) mem[i] = 1; if (mem[i] && walk(G.g[i])) cnt++; }
  p.explored = mem; p.exploredPath = cnt; p.memPath = 0;
  if (!p.bot) mmInit(p);
  toast(p, '🧠 Xotirang qaytdi — xaritang yana ko‘rinadi.');
}

/* ================= Kartalar va mini-o‘yinlar ================= */
export { MAPS, MAP_KEYS, buyMap, priceOf, canPay, revengeOn, shopTab, shopRows, SCRAMBLES, DIRV, arrowOf, scrDesc, scrVec, IMMUNE, myDist, rivalTargets, addTool, toolTargets, leaderTarget, toolCost, payTool, fireTool, hasBad, cleanse, fireSelf, fireChaos, sabotage, fxSrc, applyFx, moveKey, startMask, validSpot, pipReflected, reflectFx, validDest, sendFx, mapPickOpen, mapPickClose, mapPickSnap, mapPickSet, mapPickMove, mapPickZoom, mapPickConfirm, mapPickDraw, updateLeader, FEED_Q, feedShow, feed, EFFECTS, forgetArea, startAmnesia, endAmnesia };
