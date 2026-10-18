// PlayerController (kirish): klaviatura, joystik, gamepad; inputVec/quant, keysDown, tugmalarni taqsimlash.
import { Sound } from './audio.js';
import { cardDir, cardMain } from './cards.js';
import { duelAccept, duelChallenge, duelDecline } from './combat.js';
import { ACT_KEYS, SLOTS } from './content.js';
import { pause, resume, setZoom, startLocal, toggleMap } from './engine.js';
import { mapPickClose, mapPickConfirm, mapPickMove, mapPickZoom } from './magic.js';
import { chatOpen, joinRoom, sayNow } from './net-room.js';
import { G, NET, me } from './state.js';
import { toolsKey, toolsOpen, toolsTab } from './toolsui.js';
import { voiceToggle } from './voice.js';
function inputVec(p) {
  let x = 0, y = 0;
  const codes = p.keys;
  if (codes) {
    for (const s of codes.slots) {
      if (keysDown.has(s.up)) y -= 1; if (keysDown.has(s.down)) y += 1;
      if (keysDown.has(s.left)) x -= 1; if (keysDown.has(s.right)) x += 1;
    }
  }
  if (p.joy.on) { x += p.joy.x; y += p.joy.y; }
  x += p.pad.x; y += p.pad.y;
  return { x, y };
}
function quant(v) {
  const ax = Math.abs(v.x), ay = Math.abs(v.y);
  if (Math.max(ax, ay) < 0.35) return null;
  return ax >= ay ? [Math.sign(v.x), 0] : [0, Math.sign(v.y)];
}
function bindJoystick(p) {
  const zone = p.ui.zone, joy = p.ui.joy, knob = p.ui.knob, R = 52;
  const rel = (e) => { const r = p.ui.root.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  zone.addEventListener('pointerdown', (e) => {
    if (G.mode !== 'play' || p.card || p.joy.on) return;
    e.preventDefault();
    Sound.init();
    const [x, y] = rel(e);
    Object.assign(p.joy, { on: true, id: e.pointerId, ox: x, oy: y, x: 0, y: 0 });
    joy.classList.remove('hint'); joy.style.left = x + 'px'; joy.style.top = y + 'px'; knob.style.transform = '';
    try { zone.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  zone.addEventListener('pointermove', (e) => {
    if (!p.joy.on || e.pointerId !== p.joy.id) return;
    const [x, y] = rel(e);
    let dx = x - p.joy.ox, dy = y - p.joy.oy;
    const len = Math.hypot(dx, dy);
    if (len > R) { dx = dx / len * R; dy = dy / len * R; }
    p.joy.x = dx / R; p.joy.y = dy / R;
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  });
  const end = (e) => {
    if (!p.joy.on || e.pointerId !== p.joy.id) return;
    Object.assign(p.joy, { on: false, id: -1, x: 0, y: 0 });
    joy.classList.add('hint'); joy.style.left = ''; joy.style.top = ''; knob.style.transform = '';
  };
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);
  zone.addEventListener('lostpointercapture', end);
}

/* ---- klaviatura ---- */
const keysDown = new Set();
function assignKeys() {
  for (const p of G.players) p.keys = p.bot ? null : { slots: SLOTS, act: new Set(ACT_KEYS) };
}
function keyOwner(code) {
  for (const p of G.players) {
    if (!p.keys) continue;
    if (p.keys.act.has(code)) return { p, act: true };
    for (const s of p.keys.slots) {
      if (code === s.up) return { p, d: [0, -1] };
      if (code === s.down) return { p, d: [0, 1] };
      if (code === s.left) return { p, d: [-1, 0] };
      if (code === s.right) return { p, d: [1, 0] };
    }
  }
  return null;
}
function bindKeys() {
  window.addEventListener('keydown', (e) => {
    const code = e.code, tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') { if (code === 'Enter' && e.target.id === 'oCode') { e.preventDefault(); joinRoom(); } return; }
    if (G.mode === 'menu') { if ((code === 'Enter' || code === 'NumpadEnter') && !e.repeat && !(e.target && e.target.classList && e.target.classList.contains('ava'))) { e.preventDefault(); startLocal(); } return; }
    if (G.mode === 'paused') { if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); resume(); } return; }
    if (G.mode === 'over' || G.mode === 'won') return;
    if (G.mode !== 'play') return;
    const m0 = me();
    if (m0 && m0.ui && !m0.card && m0.pick) {   // teleport manzilini tanlash
      e.preventDefault();
      if (code === 'Escape' || code === 'Backspace') { mapPickClose(m0, true); return; }
      if (code === 'Enter' || code === 'NumpadEnter' || code === 'Space') { if (!e.repeat) mapPickConfirm(m0); return; }
      if (e.key === '+' || e.key === '=' || code === 'NumpadAdd') { mapPickZoom(m0, 1.5); return; }
      if (e.key === '-' || e.key === '_' || code === 'NumpadSubtract') { mapPickZoom(m0, 1 / 1.5); return; }
      const o = keyOwner(code);
      if (o && o.d) mapPickMove(m0, o.d[0], o.d[1], e.shiftKey ? 6 : 1);
      return;
    }
    if (m0 && m0.ui && !m0.card) {
      if (code === 'KeyT' && !e.repeat) { e.preventDefault(); toolsOpen(m0, !m0.sab.open); return; }
      if (code === 'KeyX' && !e.repeat) { e.preventDefault(); duelChallenge(m0); return; }
      if (NET.duelPrompt && !e.repeat && (code === 'KeyY' || code === 'KeyN')) { e.preventDefault(); if (code === 'KeyY') duelAccept(m0); else duelDecline(m0); return; }
      if (code === 'KeyV' && !e.repeat && G.online && NET.named) { e.preventDefault(); voiceToggle(); return; }
      if (code === 'KeyC' && !e.repeat && G.online && NET.named) { e.preventDefault(); chatOpen(m0, m0.ui.chatPanel.hidden); return; }
      if (!m0.ui.chatPanel.hidden) {
        const cm = /^(?:Digit|Numpad)([0-9])$/.exec(code);
        if (cm) { e.preventDefault(); if (!e.repeat) sayNow((+cm[1] + 9) % 10); return; }
        if (code === 'Escape') { e.preventDefault(); chatOpen(m0, false); return; }
      }
      if (m0.sab.open) {
        const dm = /^(?:Digit|Numpad)([0-9])$/.exec(code);
        if (dm) { e.preventDefault(); if (!e.repeat) toolsKey(m0, +dm[1] || 10); return; }
        if (code === 'Escape' || code === 'Backspace') { e.preventDefault(); toolsOpen(m0, m0.sab.step === 'target'); return; }
        if ((code === 'KeyQ' || code === 'KeyR' || code === 'KeyE') && m0.sab.step === 'tools') { e.preventDefault(); toolsTab(m0, code === 'KeyQ' ? 'tool' : code === 'KeyR' ? 'trap' : 'map'); return; }
      }
    }
    if (code === 'Escape' || code === 'KeyP') { e.preventDefault(); pause(); return; }
    if (code === 'KeyM') { toggleMap(); return; }
    if (e.key === '+' || e.key === '=' || code === 'NumpadAdd') { setZoom(G.zoom * 1.15); return; }
    if (e.key === '-' || e.key === '_' || code === 'NumpadSubtract') { setZoom(G.zoom / 1.15); return; }
    const o = keyOwner(code);
    if (!o) return;
    e.preventDefault();
    if (e.repeat) return;
    if (o.act) { keysDown.add(code); if (o.p.card) cardMain(o.p); return; }
    keysDown.add(code);
    if (o.p.card) cardDir(o.p, o.d);
  });
  window.addEventListener('keyup', (e) => keysDown.delete(e.code));
  window.addEventListener('blur', () => keysDown.clear());
}

/* ---- geympad (ulangan joystiklar) ---- */
function pollPads() {
  let pads = [];
  try { pads = navigator.getGamepads ? Array.from(navigator.getGamepads()).filter(Boolean) : []; } catch (e) { pads = []; }
  G.players.slice(0, 1).forEach((p) => {
    const gp = pads[0];
    if (!gp) { p.pad.x = 0; p.pad.y = 0; return; }
    let x = gp.axes[0] || 0, y = gp.axes[1] || 0;
    if (Math.abs(x) < 0.25) x = 0; if (Math.abs(y) < 0.25) y = 0;
    const b = (i) => !!(gp.buttons[i] && gp.buttons[i].pressed);
    if (b(12)) y = -1; if (b(13)) y = 1; if (b(14)) x = -1; if (b(15)) x = 1;
    p.pad.x = x; p.pad.y = y;
    const a = b(0) || b(1);
    if (a && !p.pad.a && p.card) cardMain(p);
    p.pad.a = a;
    const st = b(9);
    if (st && !p.pad.s) { if (G.mode === 'play') pause(); else if (G.mode === 'paused') resume(); }
    p.pad.s = st;
  });
}

/* ================= Botlar: o‘z tumani bilan labirintni o‘rganadigan raqiblar ================= */
export { inputVec, quant, bindJoystick, keysDown, assignKeys, keyOwner, bindKeys, pollPads };
