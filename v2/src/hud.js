// UIManager (HUD): ko‘rinish oynalari (buildViewports/layout), yuqori panel (updateHUD), jonlar, toast xabarlar.
import { adRevive } from './ads.js';
import { duelAccept, duelChallenge, duelDecline, duelUI } from './combat.js';
import { BEASTS, ECON, MASKS, PT_MAX } from './content.js';
import { mapOn, viewers } from './engine.js';
import { ghostPuff } from './events.js';
import { ARR8, HEART } from './games.js';
import { bindJoystick } from './input.js';
import { mapPickDraw, scrDesc } from './magic.js';
import { chatBuild, chatOpen } from './net-room.js';
import { hasKey, respawnVerse } from './player.js';
import { DPR, avatarURL, buildSprites, nearestGate } from './render.js';
import { G, me, remoteList, ui } from './state.js';
import { pipsTick, toolsOpen, toolsRender } from './toolsui.js';
import { PW_MAX, myTraps, myWalls } from './traps.js';
import { tutTick } from './tutorial.js';
import { clamp, fmtDist, fmtPct, fmtTime } from './util.js';
import { VOICE, bindMic, voiceName, voiceStatus } from './voice.js';
function buildViewports() {
  ui.stage.innerHTML = '';
  for (const p of G.players) {
    if (p.bot) continue;
    const root = ui.vpTpl.content.firstElementChild.cloneNode(true);
    const q = (s) => root.querySelector(s);
    p.ui = {
      root, zone: q('.joyzone'), joy: q('.joy'), knob: q('.knob'), ava: q('.who img'), name: q('.pname'), lives: q('.lives'),
      dist: q('.pdist'), exp: q('.pexp'), coin: q('.pcoin'), chips: q('.chips'), pips: q('.rvws'), chipEls: {}, sabBtn: q('.sabbtn'), sabN: q('.sbn'), sabPanel: q('.sabpanel'), mic: q('.vmic'), chat: q('.vchat'), chatPanel: q('.chatpanel'), mappick: q('.mappick'), feed: q('.vfeed'), duelBtn: q('.duelbtn'), duelAsk: q('.duelask'), map: q('.vmap'), toast: q('.vtoast'), flash: q('.vflash'),
      tutbox: q('.tutbox'), adrev: q('.adrev'), ghost: q('.ghostbtn'), out: q('.vout'), outTitle: q('.vout .big'), outVerse: q('.vout .verse'), cardwrap: q('.cardwrap'), toastTimer: 0,
    };
    p.ui.mapCtx = p.ui.map.getContext('2d');
    p.ui.sabBtn.addEventListener('click', () => toolsOpen(p, !p.sab.open));
    p.ui.duelBtn.addEventListener('click', () => duelChallenge(p));
    p.ui.duelAsk.addEventListener('click', (e) => { const a = e.target && e.target.dataset && e.target.dataset.a; if (a === 'y') duelAccept(p); else if (a === 'n') duelDecline(p); });
    chatBuild(p);
    p.ui.chat.addEventListener('click', () => chatOpen(p, p.ui.chatPanel.hidden));
    p.ui.root.addEventListener('pointerdown', (e) => { if (!p.ui.chatPanel.hidden && !p.ui.chatPanel.contains(e.target) && !p.ui.chat.contains(e.target)) chatOpen(p, false); }, true);
    bindMic(p);
    p.ui.ava.src = avatarURL(p.look);
    p.ui.tutbox.hidden = !G.tut;
    p.ui.adrev.addEventListener('click', () => adRevive(p));
    p.ui.ghost.addEventListener('click', () => ghostPuff(p));
    p.ui.name.textContent = p.name;
    root.style.setProperty('--pc', p.color);
    bindJoystick(p);
    ui.stage.appendChild(root);
  }
}
function layout() {
  const W = innerWidth, H = innerHeight, ps = viewers.slice(0, 1), n = ps.length;
  let rects;
  if (n <= 1) rects = [[0, 0, W, H]];
  else if (n === 2) rects = H >= W * 0.9 ? [[0, 0, W, H / 2], [0, H / 2, W, H / 2]] : [[0, 0, W / 2, H], [W / 2, 0, W / 2, H]];
  else if (n === 3) rects = [[0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W, H / 2]];
  else rects = [[0, 0, W / 2, H / 2], [W / 2, 0, W / 2, H / 2], [0, H / 2, W / 2, H / 2], [W / 2, H / 2, W / 2, H / 2]];
  let minDim = Infinity;
  ps.forEach((p, k) => {
    const [rx, ry, rw, rh] = rects[k];
    const x = Math.round(rx), y = Math.round(ry), w = Math.round(rx + rw) - x, h = Math.round(ry + rh) - y;
    p.vp = { x, y, w, h };
    minDim = Math.min(minDim, w, h);
    if (!p.ui) return;
    const s = p.ui.root.style;
    s.left = x + 'px'; s.top = y + 'px'; s.width = w + 'px'; s.height = h + 'px';
    s.setProperty('--st', y <= 0 ? 'env(safe-area-inset-top, 0px)' : '0px');
    s.setProperty('--sb', y + h >= H - 1 ? 'env(safe-area-inset-bottom, 0px)' : '0px');
    s.setProperty('--sl', x <= 0 ? 'env(safe-area-inset-left, 0px)' : '0px');
    s.setProperty('--sr', x + w >= W - 1 ? 'env(safe-area-inset-right, 0px)' : '0px');
    const mm = Math.round(clamp(Math.min(w, h) * 0.27, 84, 168)), corner = y <= 0 && x + w >= W - 1, toolsW = ui.tools.offsetWidth || 210;
    s.setProperty('--mm', mapOn ? mm + 'px' : '0px');
    s.setProperty('--mmTop', corner ? '56px' : '8px');
    s.setProperty('--ct', corner ? '48px' : '0px');
    s.setProperty('--hudR', (corner ? toolsW + 16 : mapOn ? mm + 18 : 18) + 'px');
    const px = Math.round(mm * DPR);
    if (p.ui.map.width !== px) { p.ui.map.width = px; p.ui.map.height = px; }
    p.ui.map.hidden = !mapOn;
  });
  G.tsCss = clamp(minDim / 11, 22, 56) * G.zoom;
  buildSprites();
}
function setChip(p, key, on, text, cls) {
  let el = p.ui.chipEls[key];
  if (!el) {
    if (!on) return { style: {} };
    el = document.createElement('span'); el.className = 'chip ' + cls; el.dataset.c = cls; p.ui.chips.appendChild(el); p.ui.chipEls[key] = el;
  }
  el.hidden = !on;
  if (on && el.dataset.c !== cls) { el.dataset.c = cls; el.className = 'chip ' + cls; }
  if (on && el.textContent !== text) el.textContent = text;
  return el;
}
function renderHearts(p) {
  const prev = p.hudKey.lives;
  let h = '';
  for (let k = 0; k < 3; k++) h += HEART.replace('%C', (k >= p.lives ? ' empty' : '') + (prev !== undefined && k >= p.lives && k < prev ? ' breaking' : ''));
  p.ui.lives.innerHTML = h;
  p.ui.lives.setAttribute('aria-label', `Jonlar: ${p.lives} / 3`);
  p.hudKey.lives = p.lives;
}
function updateHUD() {
  ui.clock.textContent = fmtTime(G.time);
  if (G.tut) tutTick();
  for (const p of G.players) {
    if (!p.ui) continue;
    if (p.hudKey.lives !== p.lives) renderHearts(p);
    if (!p.alive && p.respawnT > 0) { const rv = respawnVerse(p); if (p.hudKey.rv !== rv) { p.hudKey.rv = rv; p.ui.outVerse.textContent = rv; } }
    const d = fmtDist(p.dist); if (p.hudKey.d !== d) { p.hudKey.d = d; p.ui.dist.textContent = d; }
    const e = fmtPct(G.walkTotal ? (p.exploredPath / G.walkTotal) * 100 : 0); if (p.hudKey.e !== e) { p.hudKey.e = e; p.ui.exp.textContent = e; }
    if (p.hudKey.c !== p.coins) { p.hudKey.c = p.coins; p.ui.coin.textContent = String(p.coins); }
    const van = G.vans.find((v) => v.target === p.id);
    const hunter = G.beasts.find((b) => (b.state === 'chase' || b.state === 'charge') && b.target === p.id && Math.hypot(b.x - p.px, b.y - p.py) < 12);
    setChip(p, 'beast', !!hunter, hunter ? `${BEASTS[hunter.type].name} ${hunter.state === 'charge' ? 'yugurib kelmoqda!' : 'quvmoqda!'}` : '', 'bad');
    const tracker = !hunter && G.beasts.find((b) => (b.state === 'track' || b.state === 'search') && b.target === p.id && Math.hypot(b.x - p.px, b.y - p.py) < 14);
    setChip(p, 'tracker', !!tracker, tracker ? `${BEASTS[tracker.type].name} ${tracker.state === 'track' ? 'izingdan ketyapti' : 'seni qidiryapti'}` : '', 'gold');
    const coiled = !hunter && !tracker && G.beasts.some((b) => b.state === 'coil' && Math.hypot(b.x - p.px, b.y - p.py) < 5);
    setChip(p, 'coiled', coiled, 'Barglar shitirlayapti — yaqinda ilon bor!', 'green');
    setChip(p, 'van', !!van, van ? `Ovchi ${Math.ceil(van.timer)} s` : '', 'bad');
    setChip(p, 'fever', p.fever > 0, `Isitma ${Math.ceil(p.fever)} s`, 'green');
    setChip(p, 'torch', p.torch > 0, `Mash’al ${Math.ceil(p.torch)} s`, 'gold');
    const ng = nearestGate(p.px, p.py);
    const lie = (ai) => (p.liar > 0 ? (ai + p.liarA + (Math.floor(G.time / 4) % 3)) % 8 : ai);   // «Kompas aldaydi»: yo‘nalish noto‘g‘ri
    setChip(p, 'compass', p.compass > 0, `Kompas ${ARR8[lie(((Math.round(Math.atan2(ng.y - p.py, ng.x - p.px) / (Math.PI / 4)) % 8) + 8) % 8)]}${p.liar > 0 ? '🥴' : ''} ${Math.ceil(p.compass)} s`, 'gold');
    setChip(p, 'boots', p.boots > 0, `Etik ${Math.ceil(p.boots)} s`, 'blue');
    setChip(p, 'shield', p.shield > 0, 'Qalqon', 'blue');
    setChip(p, 'frozen', p.frozen > 0, `Muzlagan ${Math.ceil(p.frozen)} s`, 'blue');
    setChip(p, 'scramble', p.scramble > 0, `🎮 ${scrDesc(p.scMap)} · ${Math.ceil(p.scramble)} s`, 'bad');
    setChip(p, 'amnesia', p.amnesia > 0, `🧠 Akleroz · ${Math.ceil(p.amnesia)} s`, 'bad');
    setChip(p, 'mirror', p.mirror > 0, `🪞 Ko‘zgu · ${Math.ceil(p.mirror)} s`, 'blue');
    const nTr = myTraps(p).length;
    setChip(p, 'ptr', nTr > 0, `🪤 Tuzoqlar ${nTr}/${PT_MAX}`, 'gold');
    setChip(p, 'leader', !!p.leader, '👑 Sen yetakchisan — hamma senga ov!', 'bad');
    setChip(p, 'leaderN', !p.leader && !!G.leaderName, `👑 ${G.leaderName} · zarba +${ECON.bounty} 💰`, 'gold');
    const nW = myWalls(p).length;
    setChip(p, 'wall', nW > 0, `🚧 Devor ${nW}/${PW_MAX}`, 'gold');
    setChip(p, 'bomb', p.bomb > 0, `💣 BOMBA ${Math.ceil(p.bomb)} s — birovga tegib topshir!`, 'bad');
    p.ui.root.classList.toggle('bombing', p.bomb > 0 && p.bomb < 10);
    setChip(p, 'flip', p.flip > 0, `🙃 Teskari dunyo · ${Math.ceil(p.flip)} s`, 'bad');
    setChip(p, 'mask', p.mask > 0, `${MASKS[p.maskK].e} Maska · ${Math.ceil(p.mask)} s`, 'bad');
    setChip(p, 'liar', p.liar > 0, `🥴 Kompas aldayapti · ${Math.ceil(p.liar)} s`, 'bad');
    setChip(p, 'shut', p.shutT > 0, `🏪 Do‘kon yopiq · ${Math.ceil(p.shutT)} s`, 'bad');
    setChip(p, 'tax', p.shutT <= 0 && p.taxT > 0, `💸 Narxlar 2× · ${Math.ceil(p.taxT)} s`, 'bad');
    setChip(p, 'radar', p.radar > 0, `📡 Radar · ${Math.ceil(p.radar)} s`, 'green');
    const rv = p.revenge && G.time < p.revenge.until ? p.revenge : null;
    setChip(p, 'revenge', !!rv, rv ? `😈 Qasos: ${rv.name} · −50% · ${Math.ceil(rv.until - G.time)} s` : '', 'gold');
    setChip(p, 'stun', p.stun > 0, `${p.stunIcon || '💫'} Garang ${Math.ceil(p.stun)} s`, 'bad');
    setChip(p, 'slow', p.slow > 0, `Yelim ${Math.ceil(p.slow)} s`, 'bad');
    setChip(p, 'cloak', p.cloak > 0, `Plash ${Math.ceil(p.cloak)} s`, 'blue');
    setChip(p, 'wings', p.wings > 0, 'Qanotlar', 'green');
    setChip(p, 'luck', p.luck > 0, 'Omadli zar', 'gold');
    setChip(p, 'key', p.key > 0, p.key > 1 ? `Qamoq kaliti ×${p.key}` : 'Qamoq kaliti', 'gold');
    setChip(p, 'jail', p.jail, 'Qamoqda', 'bad');
    if (G.teams) { const al = G.players.filter((q) => q !== p && q.team === p.team).map((q) => q.name).concat(remoteList().filter((r) => r.team === p.team).map((r) => r.name)); setChip(p, 'team', true, `${p.team === 0 ? '🟧' : '🟦'} Jamoa: sen${al.length ? ' + ' + al.join(', ') : ''}`, 'blue'); }
    setChip(p, 'gkey', hasKey(p) || (G.teams && G.players.some((q) => q !== p && q.team === p.team && q.gkey)), p.gkey ? '🔑 Darvoza kaliti bor' : hasKey(p) ? '🚪 Darvoza jamoang uchun ochiq — chiq!' : '🔑 Kalit sherigingda — u darvozani ochsin', hasKey(p) ? 'green' : 'gold');
    const vs = G.online ? voiceStatus() : '';
    setChip(p, 'voice', !!vs, vs, VOICE.track && !VOICE.muted ? 'green' : 'gold');
    const talk = VOICE.on ? [...(VOICE.speaking ? ['sen'] : []), ...Array.from(VOICE.peers.values()).filter((E) => E.speaking).map(voiceName)] : [];
    setChip(p, 'talk', talk.length > 0, `🔊 ${talk.join(', ')}`, 'blue');
    setChip(p, 'vtap', VOICE.tap, '🔇 Ovozni yoqish uchun ekranga bos', 'bad');
    const arrow = (tx, ty) => ARR8[lie(((Math.round(Math.atan2(ty - p.py, tx - p.px) / (Math.PI / 4)) % 8) + 8) % 8)];
    const kc = G.keyCells[p.keySlot], on = p.knowKey && !p.gkey && kc >= 0;
    setChip(p, 'keymap', on, on ? `🔑 kalit ${arrow(kc % G.N, (kc / G.N) | 0)} ${Math.round(Math.hypot((kc % G.N) - p.px, ((kc / G.N) | 0) - p.py) * G.tileM)} m` : '', 'blue');
    let near = -1, nd = Infinity;
    if (p.knowChest) for (const i of G.chestCells) if (!p.spent[i]) { const d = Math.hypot((i % G.N) - p.px, ((i / G.N) | 0) - p.py); if (d < nd) { nd = d; near = i; } }
    setChip(p, 'chestmap', near >= 0, near >= 0 ? `🗺️ sandiq ${arrow(near % G.N, (near / G.N) | 0)} ${Math.round(nd * G.tileM)} m` : '', 'gold');
    toolsRender(p);
    duelUI(p);
    if (p.pick) mapPickDraw(p);
    if (p === me()) document.body.classList.toggle('flip', p.flip > 0 && p.alive);
    pipsTick(p);
    p.ui.root.classList.toggle('fever', p.fever > 0);
  }
}
function toast(p, msg, ms = 2400) {
  if (!p.ui) return;
  const now = performance.now();
  if (msg === p.lastToast && now - p.lastToastAt < 1500) return;
  p.lastToast = msg; p.lastToastAt = now;
  const el = p.ui.toast;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(p.ui.toastTimer);
  p.ui.toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

/* ---- joystik: ekranning istalgan joyini bosib suring ---- */
export { buildViewports, layout, setChip, renderHearts, updateHUD, toast };
