// NetworkManager (xona mantiqi): xonaga kirish/chiqish, host boshlashi, peer holatini o‘qish (readPeer/onPeers), netDirty/netFlush, tezkor gaplar (chat).
import { duelNet } from './combat.js';
import { cfg, playerCfg } from './config.js';
import { DIFFS, PCOLORS, PTRAP_KEYS, PT_MAX, T } from './content.js';
import { endGame } from './endgame.js';
import { newGame, selDiff } from './engine.js';
import { toast } from './hud.js';
import { applyFx, feedShow } from './magic.js';
import { firebaseRoom, localRoom } from './net-adapters.js';
import { placeKey, setKeySlot } from './player.js';
import { avatarURL } from './render.js';
import { SOC, socLobby, socRender, socRoomJoined, socRoomLeft, socialInit } from './social.js';
import { G, NET, me, remoteList, ui } from './state.js';
import { toolsOpen } from './toolsui.js';
import { PW_MAX, ptList, trapTaken, wallConnected, wallList, wallSet } from './traps.js';
import { clamp, randSeed } from './util.js';
import { VOICE, voiceLeave, voiceUI } from './voice.js';
const okCode = (s) => /^[a-z0-9]{3,8}$/.test(s);
async function initRoom() {
  try {
    if (window.claude && typeof window.claude.use === 'function') {
      const room = await window.claude.use('room');
      if (room) { NET.room = room; ui.online.hidden = false; return; }
    }
  } catch (e) { /* claude.ai xonasi yo‘q */ }
  try {
    const local = /[?&]net=local\b/.test(location.search) && typeof BroadcastChannel === 'function';
    const room = local ? localRoom() : await firebaseRoom();
    if (room) { NET.room = room; ui.online.hidden = false; socialInit(local); }
  } catch (e) { /* onlayn imkoniyat yo‘q */ }
}
function onlineStatus(msg) { ui.oStatus.textContent = msg; }
async function enterRoom(code, host) {
  if (!NET.room) return;
  leaveRoom();
  onlineStatus('Ulanmoqda…');
  try {
    const named = await NET.room.join('jl-' + code);
    NET.named = named; NET.code = code; NET.host = host;
    ui.oLobby.hidden = false; ui.oCodeShow.textContent = code; ui.oStart.hidden = !host;
    const me = playerCfg(1)[0];
    named.presence({ v: 4, name: me.name, look: me.look, host, phase: 'lobby', diff: selDiff(), nb: host ? cfg.bots : 0 }).catch(() => {});
    NET.unsub.push(named.onPeers(onPeers, () => onlineStatus('Xona bilan aloqa uzildi.')));
    onlineStatus(host ? (SOC.db ? 'Zal ochildi. Do‘stlaringni «Chaqirish» bilan taklif qil yoki kodni ayt. Hamma kirgach — «Hammaga boshlash».' : 'Do‘stlaringizga kodni ayting. Hamma kirgach — «Hammaga boshlash».') : 'Xona egasi o‘yinni boshlashini kuting.');
    socRoomJoined(code, host);
    voiceUI();
  } catch (e) {
    onlineStatus('Xonaga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.');
  }
}
function leaveRoom() {
  if (NET.code) socRoomLeft(NET.code, NET.host);
  voiceLeave();
  NET.unsub.forEach((u) => { try { u(); } catch (e) { /* ignore */ } });
  NET.unsub = [];
  if (NET.named) { NET.named.leave().catch(() => {}); NET.named = null; }
  NET.host = false; NET.code = '';
  ui.oLobby.hidden = true;
  G.online = false;
  setTimeout(socRender, 0);
  G.remotes = new Map();
  voiceUI();
}
function createRoom() {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let code = '';
  for (let k = 0; k < 4; k++) code += abc[(Math.random() * abc.length) | 0];
  enterRoom(code, true);
}
function joinRoom() {
  const code = (ui.oCode.value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (!okCode(code)) { onlineStatus('Kod 3–8 ta lotin harfi yoki raqamdan iborat bo‘ladi.'); return; }
  enterRoom(code, false);
}
function hostStart() {
  if (!NET.named || !NET.host) return;
  const seed = randSeed(), diff = selDiff();
  NET.named.presence({ phase: 'play', seed, diff, nb: cfg.bots, tmode: cfg.team ? 1 : 0 }).catch(() => {});
  socLobby({ phase: 'play' });
  newGame(seed, diff, playerCfg(cfg.bots), { online: true, teams: !!cfg.team });
}
const peerColor = (peer) => PCOLORS[(Array.from(peer).reduce((s, ch) => s + ch.charCodeAt(0), 0) + 1) % 4];
function readPeer(pr) {
  const s = pr.presence || {};
  const num = (v, a, b) => (typeof v === 'number' && isFinite(v) ? clamp(Math.round(v), a, b) : null);
  const wlArr = (v) => (Array.isArray(v) ? v.slice(0, PW_MAX) : []).filter(Array.isArray).map((e) => ({ id: num(e[0], 0, 1e6), cell: num(e[1], 0, 160000) })).filter((e) => e.id !== null && e.cell !== null);
  const ptArr = (v) => (Array.isArray(v) ? v.slice(0, PT_MAX) : []).filter(Array.isArray).map((e) => ({ id: num(e[0], 0, 1e6), cell: num(e[1], 0, 160000), k: num(e[2], 0, PTRAP_KEYS.length - 1), dest: num(e[3], -1, 160000) ?? -1 })).filter((e) => e.id !== null && e.cell !== null && e.k !== null);
  const kfields = (o) => ({ ks: num(o.ks, -1, 7) ?? -1, gk: o.gk === 1, kc: num(o.kc, -1, 160000) ?? -1, team: num(o.tm, -1, 1) ?? -1 });
  return {
    ...kfields(s), tmode: s.tmode === 1,
    name: (typeof s.name === 'string' ? s.name : 'Mehmon').slice(0, 14) || 'Mehmon', look: num(s.look, 0, 3) ?? 0, host: s.host === true,
    phase: s.phase, seed: num(s.seed, 0, 999999), diff: DIFFS[s.diff] ? s.diff : 'medium',
    x: num(s.x, 0, 400), y: num(s.y, 0, 400), f: num(s.f, 0, 3) ?? 2, lives: num(s.lives, 0, 3) ?? 3,
    alive: s.alive !== false, fin: s.fin === true, finAt: num(s.finAt, 0, 9e15) || 0, dist: num(s.dist, 0, 1e7) || 0, nb: num(s.nb, 0, 3) || 0, jail: s.j === 1, im: s.im === 1, deaths: num(s.dc, 0, 99) || 0, pt: ptArr(s.pt), wl: wlArr(s.wl), ds: num(s.ds, 0, 20) || 0, bm: num(s.bm, 0, 99) || 0,
    dl: s.dl && typeof s.dl === 'object' ? { to: typeof s.dl.to === 'string' ? s.dl.to.slice(0, 40) : '', id: num(s.dl.id, 0, 1e9), st: typeof s.dl.st === 'string' ? s.dl.st.slice(0, 4) : '', n: num(s.dl.n, 0, 9999) || 0 } : null,
    fd: (Array.isArray(s.fd) ? s.fd.slice(0, 3) : []).filter(Array.isArray).map((e) => ({ n: num(e[0], 0, 1e9), t: typeof e[1] === 'string' ? e[1].slice(0, 100) : '' })).filter((e) => e.n !== null && e.t),
    say: s.say && typeof s.say === 'object' ? { n: num(s.say.n, 0, 1e9), i: num(s.say.i, 0, 99) } : null,
    fx: (Array.isArray(s.fx) ? s.fx.slice(0, 4) : []).filter((e) => e && typeof e === 'object').map((e) => ({
      to: typeof e.to === 'string' ? e.to.slice(0, 40) : '', k: typeof e.k === 'string' ? e.k.slice(0, 12) : '', f: typeof e.f === 'string' ? e.f.slice(0, 14) : '', n: num(e.n, 0, 1e9) ?? 0,
      s: num(e.s, 0, 999999), b: e.b === undefined ? undefined : num(e.b, 0, 3), a: e.a === undefined ? undefined : num(e.a, 0, 1e6),
      sb: e.sb === undefined ? undefined : num(e.sb, 0, 3), vb: e.vb === undefined ? undefined : num(e.vb, 0, 3), rf: e.rf === 1 ? 1 : 0 })),
    bots: (Array.isArray(s.bots) ? s.bots.slice(0, 3) : []).filter((b) => b && typeof b === 'object').map((b) => ({
      ...kfields(b), name: (typeof b.n === 'string' ? b.n : 'Bot').slice(0, 14) || 'Bot', look: num(b.l, 0, 3) ?? 0, x: num(b.x, 0, 400), y: num(b.y, 0, 400), f: num(b.f, 0, 3) ?? 2,
      lives: num(b.lv, 0, 3) ?? 3, alive: b.a !== false, fin: b.fin === true, finAt: num(b.fa, 0, 9e15) || 0, dist: num(b.d, 0, 1e7) || 0, jail: b.j === 1, im: b.im === 1, deaths: num(b.dc, 0, 99) || 0, pt: ptArr(b.pt), wl: wlArr(b.wl), ds: num(b.ds, 0, 20) || 0, bm: num(b.bm, 0, 99) || 0,
    })),
  };
}
function onPeers(change) {
  const peers = change.peers, others = peers.filter((pr) => !pr.sameTab);
  if (NET.host && SOC.db && peers.length !== NET.lastN) { NET.lastN = peers.length; socLobby({ n: peers.length }); }
  // lobbi ro‘yxati
  ui.oPeers.innerHTML = '';
  for (const pr of peers) {
    const s = readPeer(pr), li = document.createElement('li');
    VOICE.names[pr.peer] = s.name;
    li.style.setProperty('--pc', pr.sameTab ? PCOLORS[0] : peerColor(pr.peer));
    const img = document.createElement('img'); img.src = avatarURL(s.look); img.alt = '';
    const nm = document.createElement('span'); nm.textContent = s.name;
    const sm = document.createElement('small'); sm.textContent = [pr.sameTab ? 'siz' : '', s.host ? 'xona egasi' : '', s.host && s.nb ? `+${s.nb} bot` : '', s.phase === 'play' ? 'o‘ynamoqda' : ''].filter(Boolean).join(' · ');
    li.append(img, nm, ' ', sm); ui.oPeers.appendChild(li);
  }
  // xona egasi boshlagan bo‘lsa — biz ham boshlaymiz
  const hostPeer = others.find((pr) => readPeer(pr).host);
  if (!NET.host && hostPeer) {
    const h = readPeer(hostPeer);
    if (h.phase === 'play' && h.seed !== null && (G.mode === 'menu' || ((G.mode === 'over' || G.mode === 'won') && h.seed !== G.seed))) {
      newGame(h.seed, h.diff, playerCfg(0), { online: true, teams: h.tmode });
    }
  }
  if (!G.online || !G.g) return;
  const seen = new Set(), FACES = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
  const mine = peers.find((pr) => pr.sameTab);
  if (mine) NET.me = mine.peer;
  // Onlayn: har bir odamga o‘z kalit joyi (xona a’zolari tartibi bo‘yicha); xona egasining botlari — oxirgi joylar
  if (G.online && NET.me && NET.slotSeed !== G.seed && G.keyCells) {
    NET.slotSeed = G.seed;
    const ids = peers.map((pr) => pr.peer).sort(), k = ids.indexOf(NET.me);
    if (k >= 0) setKeySlot(me(), Math.min(k, 4));
    if (G.teams && k >= 0) { me().team = k % 2; G.players.filter((q) => q.bot).forEach((q, bi) => { q.team = (ids.length + bi) % 2; }); }
    if (NET.host) G.players.filter((q) => q.bot).forEach((q, bi) => setKeySlot(q, 5 + bi));
  }
  const upsert = (key, s, color, isBot, peerId, bi) => {
    if (s.x === null || s.y === null) return;
    seen.add(key);
    let r = G.remotes.get(key);
    if (!r) { r = { id: 10, rx: s.x, ry: s.y, color }; G.remotes.set(key, r); }
    Object.assign(r, { name: s.name, look: s.look, isBot, peer: peerId, bi, jail: s.jail, im: s.im, x: clamp(s.x, 0, G.N - 1), y: clamp(s.y, 0, G.N - 1), face: FACES[s.f], lives: s.lives, alive: s.alive, fin: s.fin, finAt: s.finAt, dist: s.dist, deaths: s.deaths, disguise: s.ds, bm: s.bm, ks: s.ks, gk: s.gk, team: s.team >= 0 ? s.team : undefined });
    if (s.ks >= 0 && s.kc >= 0 && G.keyCells && G.keyCells[s.ks] !== s.kc && !G.players.some((q) => q.keySlot === s.ks)) placeKey(s.ks, s.kc);   // raqib kaliti ko‘chdi (halok bo‘ldi yoki sehr)
    if (!isBot) hearSay(r, s.say);
  };
  for (const pr of others) {
    const s = readPeer(pr);
    if (s.phase !== 'play' || s.seed !== G.seed) continue;
    upsert(pr.peer, s, peerColor(pr.peer), false, pr.peer, undefined);
    s.bots.forEach((b, k) => upsert(pr.peer + '#' + k, b, PCOLORS[(k + 1 + Array.from(pr.peer).length) % 4], true, pr.peer, k));
  }
  // Begona odamlarning qo‘ygan tuzoqlari (ularning presence'idan): shu qurilmadagi o‘yinchilar bossa ishga tushadi
  const rp = [];
  for (const pr of others) {
    const s = readPeer(pr);
    if (s.phase !== 'play' || s.seed !== G.seed) continue;
    {   // boshqalarning lentasi: yangi yozuvlar ko‘rsatiladi (birinchi ko‘rganda eski yozuvlar o‘tkazib yuboriladi)
      const prev = NET.feedSeen[pr.peer];
      if (prev !== undefined) for (const e of s.fd) if (e.n > prev) feedShow(e.t);
      if (s.fd.length) NET.feedSeen[pr.peer] = Math.max(prev === undefined ? 0 : prev, ...s.fd.map((e) => e.n));
      else if (prev === undefined) NET.feedSeen[pr.peer] = 0;
    }
    duelNet(pr.peer, s.dl);
    for (const e of s.pt) rp.push({ key: pr.peer, peer: pr.peer, bi: undefined, id: e.id, cell: e.cell, kind: PTRAP_KEYS[e.k], dest: e.dest, name: s.name });
    s.bots.forEach((b, k) => { for (const e of b.pt) rp.push({ key: pr.peer + '#' + k, peer: pr.peer, bi: k, id: e.id, cell: e.cell, kind: PTRAP_KEYS[e.k], dest: e.dest, name: b.name }); });
  }
  G.rptraps = rp;
  {   // begonalarning devorlari: hamma qurilmada bir xil yo‘lak yopiladi
    const rw = [];
    for (const pr of others) {
      const s = readPeer(pr);
      if (s.phase !== 'play' || s.seed !== G.seed) continue;
      for (const e of s.wl) rw.push({ key: pr.peer, id: e.id, cell: e.cell });
      s.bots.forEach((b, k) => { for (const e of b.wl) rw.push({ key: pr.peer + '#' + k, id: e.id, cell: e.cell }); });
    }
    const kk = (w) => w.key + '/' + w.id + '/' + w.cell, prevM = new Map(G.rwalls.map((w) => [kk(w), w])), nextM = new Map(rw.map((w) => [kk(w), w]));
    for (const [k, w] of prevM) if (!nextM.has(k)) wallSet(w.cell, false);
    G.rwalls = rw.filter((w) => prevM.has(kk(w)) || (w.cell > 0 && w.cell < G.N * G.N && G.g[w.cell] === T.PATH && !wallConnected(w.cell) && wallSet(w.cell, true)));   // begona devor ham yo‘lni butunlay yopib qo‘ymasligi tekshiriladi
  }
  const live = new Set(rp.map((t) => t.key + '/' + t.id));
  for (const k of Array.from(NET.pdone)) if (!live.has(k)) NET.pdone.delete(k);
  // Boshqalar yuborgan xalaqit sehrlari (muzlatish, yelim…): menga yoki (xona egasi bo‘lsam) botimga qaratilgan bo‘lsa — qo‘llanadi
  if (G.mode === 'play' && NET.me) {
    for (const pr of others) {
      const ps = readPeer(pr);
      for (const e of ps.fx) {
        if (e.to !== NET.me || e.s !== G.seed || e.n <= (NET.seen[pr.peer] || 0)) continue;
        NET.seen[pr.peer] = e.n;
        const target = e.b !== undefined ? (NET.host ? G.players.filter((q) => q.bot)[e.b] : null) : me();
        if (!target) continue;
        if (e.k === 'tr' || e.k.startsWith('tr:')) trapTaken(target, e.a, { name: e.f || ps.name, peer: pr.peer, vb: e.vb }, e.k.slice(3));   // mening tuzog‘imga tushdi (yoki zararsizlantirildi)
        else applyFx(target, e.k, e.a, { name: e.f || ps.name, peer: pr.peer, sb: e.sb, reflected: e.rf === 1 });
      }
    }
  }
  for (const k of Array.from(G.remotes.keys())) if (!seen.has(k)) G.remotes.delete(k);
  if (G.mode === 'play') {
    const winner = remoteList().filter((r) => r.fin).sort((a, b) => a.finAt - b.finAt)[0];
    if (winner) endGame(winner);
  }
}
function netDirty(p, now) {
  if (!G.online || !NET.named || !p || (p !== G.players[0] && !(p.bot && NET.host))) return;
  NET.dirty = true;
  if (now) netFlush();
}
function netFlush() {
  if (!NET.dirty || !NET.named || !G.players.length) return;
  const fc = (q) => (q.face.y < 0 ? 0 : q.face.x > 0 ? 1 : q.face.y > 0 ? 2 : 3), p = G.players[0];
  NET.dirty = false; NET.lastSent = performance.now();
  const bots = NET.host ? G.players.filter((q) => q.bot).map((q) => ({ n: q.name, l: q.look, x: q.px, y: q.py, f: fc(q), lv: q.lives, a: q.alive, fin: q.finished, fa: q.finAt || 0, d: Math.round(q.dist), j: q.jail ? 1 : 0, dc: q.stats.deaths, pt: ptList(q), wl: wallList(q), ds: q.mask > 0 ? q.maskK + 1 : 0, bm: q.bomb > 0 ? Math.ceil(q.bomb) : 0, im: q.immune > 0 || q.cloak > 0 || q.fxq.length ? 1 : 0, ks: q.keySlot, gk: q.gkey ? 1 : 0, kc: G.keyCells[q.keySlot], tm: q.team === undefined ? -1 : q.team })) : [];
  NET.named.presence({ phase: 'play', seed: G.seed, diff: G.diff, x: p.px, y: p.py, f: fc(p), lives: p.lives, alive: p.alive, fin: p.finished, finAt: p.finAt || 0, dist: Math.round(p.dist), j: p.jail ? 1 : 0, dc: p.stats.deaths, pt: ptList(p), wl: wallList(p), ds: p.mask > 0 ? p.maskK + 1 : 0, bm: p.bomb > 0 ? Math.ceil(p.bomb) : 0, dl: NET.dl || null, fd: NET.feedOut, ks: p.keySlot, gk: p.gkey ? 1 : 0, kc: G.keyCells[p.keySlot], tm: p.team === undefined ? -1 : p.team, im: p.immune > 0 || p.cloak > 0 || p.fxq.length ? 1 : 0, fx: NET.fx, bots }).catch(() => {});
}
function updateRemotes(dt) {
  const k = 1 - Math.exp(-dt * 12);
  for (const r of G.remotes.values()) {
    if (r.x === undefined) continue;
    const dx = r.x - r.rx, dy = r.y - r.ry;
    if (Math.abs(dx) + Math.abs(dy) > 4) { r.rx = r.x; r.ry = r.y; }
    else { r.rx += dx * k; r.ry += dy * k; }
    r.moving = Math.abs(dx) + Math.abs(dy) > 0.05;
  }
}

/* ================= Tezkor gaplar: mikrofon ishlamasa ham muloqot (presence orqali, tayyor iboralar) ================= */
const SAYS = ['👋 Salom!', '😂 Ha-ha-ha!', '👍 Zo‘r!', '🏃 Tez bo‘l!', '😱 Yordam bering!', '🔑 Kalitni topdim!', '⚠️ Yaqinda hayvon bor!', '😈 Hozir xalaqit beraman!', '🤝 Birga yuramizmi?', '🏆 Men yutaman!'];
const SAY_S = 4;
function chatOpen(p, on) {
  if (!p || !p.ui) return;
  if (on) toolsOpen(p, false);
  p.ui.chatPanel.hidden = !on;
  p.ui.chat.setAttribute('aria-expanded', String(!!on));
}
function chatBuild(p) {
  const host = p.ui.chatPanel;
  host.textContent = '';
  SAYS.forEach((t, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = t;
    b.addEventListener('click', () => sayNow(i));
    host.appendChild(b);
  });
}
function sayNow(i) {
  const m = me();
  chatOpen(m, false);
  if (!m || !m.alive || !G.online || !NET.named || !SAYS[i] || performance.now() - NET.sayAt < 1200) return;
  NET.sayAt = performance.now(); NET.sayn++;
  m.say = { i, until: G.time + SAY_S };
  NET.named.presence({ say: { n: NET.sayn, i } }).catch(() => {});
}
// Bitta yangi gap kelganda: o‘yinchi boshida pufak va (uzoqda bo‘lsa ham ko‘rinsin deb) xabar chiqadi.
function hearSay(r, say) {
  const n = say && say.n !== null && say.i !== null ? say.n : 0;
  if (r.sayN === undefined) { r.sayN = n; return; }   // yangi kelganning eski gapi ko‘rsatilmaydi
  if (n <= r.sayN) return;
  r.sayN = n;
  if (!SAYS[say.i]) return;
  r.say = { i: say.i, until: G.time + SAY_S };
  const m = me();
  if (m && G.mode === 'play') toast(m, `${r.name}: ${SAYS[say.i]}`, 3200);
}
// Gap pufagi (o‘yinchi boshi uzra).
export { okCode, initRoom, onlineStatus, enterRoom, leaveRoom, createRoom, joinRoom, hostStart, peerColor, readPeer, onPeers, netDirty, netFlush, updateRemotes, SAYS, SAY_S, chatOpen, chatBuild, sayNow, hearSay };
