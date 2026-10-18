// Renderer: Canvas chizish — spritelar, plitkalar, jonzotlar, tuman, yorug‘lik, zarrachalar, minixarita, PiP ko‘rinishlar, vinyetka, resize/DPR.
import { AMNESIA_S, BEASTS, BEAST_KINDS, BOMB_S, CHEST, FLIP_S, ITEMS, LIAR_S, LOOKS, MASK_S, PTRAPS, SHUT_S, T, TRAPS, VAN_LOOK, maskOf } from './content.js';
import { viewers } from './engine.js';
import { layout } from './hud.js';
import { SAYS } from './net-room.js';
import { hasKey } from './player.js';
import { G, me, remoteList } from './state.js';
import { $, TAU, clamp, hash2, lerp, mulberry32, pickRand, reduceMotion } from './util.js';
import { VOICE, voiceSpeakingPeer } from './voice.js';
const cv = $('view'), ctx = cv.getContext('2d');
const fogL = document.createElement('canvas'), fctx = fogL.getContext('2d');
const fogLow = document.createElement('canvas'), flctx = fogLow.getContext('2d');
let fogImg = null, DPR = 1;
const SPR = { ts: 0, mist: null };

function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; }
function rr(g, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath(); g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';

/* ---- Odamcha: 4 yo‘nalish, yurish, sakrash, qo‘l silkitish ---- */
function drawPerson(g, x, y, s, L, o) {
  const dir = o.dir || 'down', side = dir === 'left' || dir === 'right';
  const mv = !!o.moving, sw = mv ? Math.sin(o.ph || 0) : 0;
  const bob = mv ? Math.abs(Math.cos(o.ph || 0)) * s * 0.03 : Math.sin(o.idle || 0) * s * 0.01;
  g.save();
  g.translate(x, y - (o.lift || 0) * s * 0.55);
  if (o.rot) g.rotate(o.rot);
  if (o.scale !== undefined) g.scale(o.scale, o.scale);
  if (mv) { const q = 1 + Math.abs(Math.sin(o.ph || 0)) * 0.04; g.scale(1 / q, q); }   // qadamda yengil cho‘zilish
  if (dir === 'left') g.scale(-1, 1);
  if (o.alpha !== undefined) g.globalAlpha *= o.alpha;
  const hipY = -s * 0.17 - bob, shY = hipY - s * 0.21, hr = s * 0.125, headY = shY - hr * 0.92;
  const lw = Math.max(1.5, s * 0.07);
  g.lineCap = 'round'; g.lineJoin = 'round';
  const leg = (x0, x1, y1, col) => {
    g.strokeStyle = col; g.lineWidth = lw;
    g.beginPath(); g.moveTo(x0, hipY); g.lineTo(x1, y1); g.stroke();
    g.fillStyle = '#2a1a0e';
    g.beginPath(); g.ellipse(x1 + (side ? lw * 0.35 : 0), y1, lw * 0.72, lw * 0.45, 0, 0, TAU); g.fill();
  };
  const arm = (x0, x1, y1, col) => {
    g.strokeStyle = col; g.lineWidth = lw * 0.82;
    g.beginPath(); g.moveTo(x0, shY + s * 0.04); g.lineTo(x1, y1); g.stroke();
    g.fillStyle = L.skin; g.beginPath(); g.arc(x1, y1, lw * 0.48, 0, TAU); g.fill();
  };
  if (side) {
    leg(0, -sw * s * 0.1, -Math.max(0, -sw) * s * 0.035, L.pants2);
    arm(0, sw * s * 0.11, shY + s * 0.17, L.shirt2);
    leg(0, sw * s * 0.1, -Math.max(0, sw) * s * 0.035, L.pants);
  } else {
    leg(-s * 0.045, -s * 0.05, -Math.max(0, sw) * s * 0.05, L.pants);
    leg(s * 0.045, s * 0.05, -Math.max(0, -sw) * s * 0.05, L.pants);
  }
  if (side) { g.fillStyle = '#6b4a26'; rr(g, -s * 0.16, shY + s * 0.02, s * 0.08, s * 0.15, s * 0.03); g.fill(); }
  g.fillStyle = L.shirt; rr(g, -s * 0.1, shY, s * 0.2, hipY - shY + s * 0.02, s * 0.06); g.fill();
  g.fillStyle = 'rgba(0,0,0,0.16)'; rr(g, -s * 0.1, hipY - s * 0.07, s * 0.2, s * 0.09, s * 0.03); g.fill();
  g.fillStyle = '#3b2716'; g.fillRect(-s * 0.1, hipY - s * 0.035, s * 0.2, s * 0.028);
  if (dir === 'up') {
    g.fillStyle = '#6b4a26'; rr(g, -s * 0.085, shY + s * 0.02, s * 0.17, s * 0.15, s * 0.035); g.fill();
    g.fillStyle = '#4e3418'; g.fillRect(-s * 0.085, shY + s * 0.08, s * 0.17, s * 0.022);
  }
  if (side) arm(0, -sw * s * 0.11, shY + s * 0.17, L.shirt);
  else {
    arm(-s * 0.1, -s * 0.135, shY + s * 0.165 + sw * s * 0.025, L.shirt);
    if (o.wave) arm(s * 0.1, s * 0.17, shY - s * 0.09 + Math.sin((o.idle || 0) * 9) * s * 0.03, L.shirt);
    else arm(s * 0.1, s * 0.135, shY + s * 0.165 - sw * s * 0.025, L.shirt);
  }
  g.fillStyle = L.skin; g.beginPath(); g.arc(0, headY, hr, 0, TAU); g.fill();
  g.fillStyle = L.hair;
  if (dir === 'up') { g.beginPath(); g.arc(0, headY, hr * 1.03, 0, TAU); g.fill(); }
  else if (side) { g.beginPath(); g.arc(-hr * 0.12, headY - hr * 0.08, hr * 1.0, Math.PI * 0.72, Math.PI * 1.92); g.fill(); }
  else { g.beginPath(); g.arc(0, headY - hr * 0.06, hr * 1.03, Math.PI * 1.02, Math.PI * 1.98); g.fill(); }
  if (L.pony) {
    g.fillStyle = L.hair; g.beginPath();
    if (dir === 'up') g.ellipse(0, headY + hr * 0.9, hr * 0.32, hr * 0.62, 0, 0, TAU);
    else if (side) g.ellipse(-hr * 1.05, headY + hr * 0.25, hr * 0.32, hr * 0.62, 0.5, 0, TAU);
    else g.ellipse(hr * 1.0, headY + hr * 0.35, hr * 0.26, hr * 0.55, -0.3, 0, TAU);
    g.fill();
  }
  if (dir === 'down') {
    g.fillStyle = '#1a120b';
    g.beginPath(); g.arc(-hr * 0.38, headY + hr * 0.14, hr * 0.12, 0, TAU); g.arc(hr * 0.38, headY + hr * 0.14, hr * 0.12, 0, TAU); g.fill();
    g.fillStyle = 'rgba(230,110,90,0.35)';
    g.beginPath(); g.arc(-hr * 0.6, headY + hr * 0.45, hr * 0.16, 0, TAU); g.arc(hr * 0.6, headY + hr * 0.45, hr * 0.16, 0, TAU); g.fill();
    g.strokeStyle = '#7a3b2a'; g.lineWidth = Math.max(1, hr * 0.1);
    g.beginPath(); g.arc(0, headY + hr * 0.35, hr * 0.25, Math.PI * 0.2, Math.PI * 0.8); g.stroke();
    if (L.glasses) { g.strokeStyle = '#2a2a2a'; g.lineWidth = Math.max(1, hr * 0.09); g.beginPath(); g.arc(-hr * 0.38, headY + hr * 0.14, hr * 0.24, 0, TAU); g.moveTo(hr * 0.62, headY + hr * 0.14); g.arc(hr * 0.38, headY + hr * 0.14, hr * 0.24, 0, TAU); g.stroke(); }
  } else if (side) {
    g.fillStyle = '#1a120b'; g.beginPath(); g.arc(hr * 0.52, headY + hr * 0.1, hr * 0.12, 0, TAU); g.fill();
    g.fillStyle = L.skin; g.beginPath(); g.arc(hr * 0.98, headY + hr * 0.25, hr * 0.17, 0, TAU); g.fill();
    if (L.glasses) { g.strokeStyle = '#2a2a2a'; g.lineWidth = Math.max(1, hr * 0.09); g.beginPath(); g.arc(hr * 0.52, headY + hr * 0.1, hr * 0.24, 0, TAU); g.stroke(); }
  }
  if (L.hat === 'safari') {
    g.fillStyle = '#8a5a2b'; g.beginPath(); g.ellipse(0, headY - hr * 0.45, hr * 1.55, hr * 0.42, 0, 0, TAU); g.fill();
    g.fillStyle = '#a8743a'; rr(g, -hr * 0.85, headY - hr * 1.28, hr * 1.7, hr * 0.88, hr * 0.42); g.fill();
    g.fillStyle = '#3b2716'; g.fillRect(-hr * 0.85, headY - hr * 0.64, hr * 1.7, hr * 0.2);
  } else if (L.hat === 'cap') {
    g.fillStyle = L.capColor; g.beginPath(); g.arc(0, headY - hr * 0.15, hr * 1.04, Math.PI, TAU); g.fill();
    g.fillStyle = '#1f3f63';
    if (dir === 'down') { g.beginPath(); g.ellipse(0, headY - hr * 0.15, hr * 0.95, hr * 0.26, 0, 0, Math.PI); g.fill(); }
    else if (side) { rr(g, hr * 0.2, headY - hr * 0.3, hr * 1.0, hr * 0.24, hr * 0.12); g.fill(); }
  } else if (L.hat === 'band') {
    g.strokeStyle = '#e8c34a'; g.lineWidth = hr * 0.22;
    g.beginPath(); g.arc(0, headY, hr * 0.97, Math.PI * 1.08, Math.PI * 1.92); g.stroke();
  }
  g.restore();
}
function drawShadow(g, x, y, s, lift, col) {
  const k = 1 - (lift || 0) * 0.4;
  g.fillStyle = 'rgba(0,0,0,0.38)';
  g.beginPath(); g.ellipse(x, y, s * 0.2 * k, s * 0.075 * k, 0, 0, TAU); g.fill();
  if (col) { g.strokeStyle = col; g.lineWidth = Math.max(1.5, s * 0.03); g.beginPath(); g.ellipse(x, y, s * 0.26, s * 0.1, 0, 0, TAU); g.stroke(); }
}
function drawTomb(g, x, y, s) {
  g.fillStyle = 'rgba(0,0,0,0.35)'; g.beginPath(); g.ellipse(x, y, s * 0.2, s * 0.07, 0, 0, TAU); g.fill();
  g.fillStyle = '#8e8a80'; g.beginPath();
  g.moveTo(x - s * 0.15, y); g.lineTo(x - s * 0.15, y - s * 0.3); g.arc(x, y - s * 0.3, s * 0.15, Math.PI, TAU); g.lineTo(x + s * 0.15, y); g.closePath(); g.fill();
  g.strokeStyle = '#5c5850'; g.lineWidth = Math.max(1, s * 0.03);
  g.beginPath(); g.moveTo(x, y - s * 0.38); g.lineTo(x, y - s * 0.18); g.moveTo(x - s * 0.07, y - s * 0.31); g.lineTo(x + s * 0.07, y - s * 0.31); g.stroke();
}
const avaCache = {};
function avatarURL(look) {
  look = clamp(look | 0, 0, LOOKS.length - 1);
  if (avaCache[look]) return avaCache[look];
  const c = makeCanvas(96, 96), g = c.getContext('2d');
  drawPerson(g, 48, 128, 150, LOOKS[look], { dir: 'down' });
  return (avaCache[look] = c.toDataURL());
}

/* ---- Plitkalar ---- */
function stoneSprite(ts, r, mossy) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d'), cs = ts / 2;
  g.fillStyle = mossy ? '#2a2e20' : '#2f2a22'; g.fillRect(0, 0, ts, ts);
  for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) {
    const pad = cs * (0.06 + r() * 0.05);
    const x = i * cs + pad + (r() - 0.5) * cs * 0.06, y = j * cs + pad + (r() - 0.5) * cs * 0.06;
    const w = cs - pad * 2, h = cs - pad * 2, rad = cs * (0.16 + r() * 0.16), base = 112 + ((r() * 36) | 0), warm = (r() * 10) | 0;
    g.fillStyle = 'rgba(0,0,0,0.35)'; rr(g, x + cs * 0.025, y + cs * 0.035, w, h, rad); g.fill();   // tosh ostidagi soya
    g.fillStyle = `rgb(${base + 12 + warm},${base + 4},${base - 14 - warm})`; rr(g, x, y, w, h, rad); g.fill();
    const gr = g.createLinearGradient(x, y, x + w, y + h);
    gr.addColorStop(0, 'rgba(255,240,210,0.28)'); gr.addColorStop(0.45, 'rgba(255,255,255,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.36)');
    g.fillStyle = gr; rr(g, x, y, w, h, rad); g.fill();
    g.strokeStyle = 'rgba(255,245,220,0.18)'; g.lineWidth = Math.max(1, cs * 0.03);   // yuqori qirra yorug‘i
    g.beginPath(); g.moveTo(x + rad, y + cs * 0.015); g.lineTo(x + w - rad, y + cs * 0.015); g.stroke();
    if (r() < 0.35) {   // yoriq
      g.strokeStyle = 'rgba(30,22,14,0.45)'; g.lineWidth = Math.max(1, cs * 0.02);
      const cx0 = x + r() * w, cy0 = y + r() * h; g.beginPath(); g.moveTo(cx0, cy0); g.lineTo(cx0 + (r() - 0.5) * w * 0.6, cy0 + (r() - 0.5) * h * 0.6); g.lineTo(cx0 + (r() - 0.5) * w * 0.6, cy0 + (r() - 0.5) * h * 0.6); g.stroke();
    }
    for (let k = 0; k < 4; k++) {
      g.fillStyle = `rgba(40,30,20,${0.08 + r() * 0.12})`;
      g.beginPath(); g.arc(x + r() * w, y + r() * h, cs * (0.02 + r() * 0.035), 0, TAU); g.fill();
    }
  }
  if (mossy) { g.fillStyle = 'rgba(80,130,60,0.16)'; g.fillRect(0, 0, ts, ts); }
  if (r() < 0.6 || mossy) {
    g.fillStyle = 'rgba(96,140,64,0.5)';
    for (let k = 0; k < (mossy ? 14 : 7); k++) {
      const along = r() * ts, off = cs + (r() - 0.5) * ts * 0.05;
      g.beginPath();
      if (r() < 0.5) g.arc(off, along, ts * 0.022, 0, TAU); else g.arc(along, off, ts * 0.022, 0, TAU);
      g.fill();
    }
  }
  return c;
}
function hedgeSprite(ts, r, flowers) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d');
  const cols = ['#163a20', '#1c4727', '#235530', '#2b6338', '#183f23', '#2f6e3c'];
  g.fillStyle = '#0f2616'; g.fillRect(0, 0, ts, ts);
  for (let k = 0; k < 30; k++) {
    const x = r() * ts, y = r() * ts, a = r() * Math.PI, L = ts * (0.1 + r() * 0.12), col = cols[(r() * cols.length) | 0];
    for (const ox of [-ts, 0, ts]) for (const oy of [-ts, 0, ts]) {
      const px = x + ox, py = y + oy;
      if (px < -L || py < -L || px > ts + L || py > ts + L) continue;
      g.save(); g.translate(px, py); g.rotate(a);
      g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, L, L * 0.42, 0, 0, TAU); g.fill();
      g.fillStyle = 'rgba(180,230,150,0.16)'; g.beginPath(); g.ellipse(-L * 0.15, -L * 0.12, L * 0.55, L * 0.2, 0, 0, TAU); g.fill();   // barg yorug‘i
      g.strokeStyle = 'rgba(0,0,0,0.2)'; g.lineWidth = Math.max(1, ts * 0.012);
      g.beginPath(); g.moveTo(-L * 0.9, 0); g.lineTo(L * 0.9, 0); g.stroke();
      g.restore();
    }
  }
  const vg = g.createRadialGradient(ts / 2, ts / 2, ts * 0.25, ts / 2, ts / 2, ts * 0.78);   // chekkalari qorong‘iroq — devor hajmli ko‘rinadi
  vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.3)');
  g.fillStyle = vg; g.fillRect(0, 0, ts, ts);
  if (flowers) {
    const fc = ['#e85d75', '#f2c14e', '#c77dff', '#ff8c42'][(r() * 4) | 0];
    for (let k = 0; k < 3; k++) {
      const x = ts * (0.2 + r() * 0.6), y = ts * (0.2 + r() * 0.6), fr = ts * 0.035;
      g.fillStyle = fc;
      for (let p = 0; p < 5; p++) { g.beginPath(); g.arc(x + Math.cos(p * 1.256) * fr, y + Math.sin(p * 1.256) * fr, fr, 0, TAU); g.fill(); }
      g.fillStyle = '#ffe9a8'; g.beginPath(); g.arc(x, y, fr * 0.7, 0, TAU); g.fill();
    }
  }
  return c;
}
function faceSprite(ts, r) {
  const fh = Math.max(2, Math.round(ts * 0.3)), c = makeCanvas(ts, fh), g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 0, fh);
  gr.addColorStop(0, 'rgba(5,14,8,0)'); gr.addColorStop(1, 'rgba(5,14,8,0.75)');
  g.fillStyle = gr; g.fillRect(0, 0, ts, fh);
  g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = Math.max(1, ts * 0.015);
  for (let k = 0; k < 7; k++) { const x = r() * ts; g.beginPath(); g.moveTo(x, fh * 0.2); g.lineTo(x + (r() - 0.5) * ts * 0.05, fh); g.stroke(); }
  return c;
}
function shadeSprite(ts, side) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d'), d = ts * (side === 't' ? 0.46 : side === 'b' ? 0.14 : 0.24);
  const gr = side === 't' ? g.createLinearGradient(0, 0, 0, d) : side === 'b' ? g.createLinearGradient(0, ts, 0, ts - d) : side === 'l' ? g.createLinearGradient(0, 0, d, 0) : g.createLinearGradient(ts, 0, ts - d, 0);
  gr.addColorStop(0, `rgba(0,0,0,${side === 't' ? 0.58 : side === 'b' ? 0.18 : 0.32})`); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, ts, ts);
  return c;
}
// Tosh yo‘lak chetidagi o‘t tutamlari (devor yonida)
function tuftSprite(ts, r) {
  const c = makeCanvas(ts, Math.round(ts * 0.3)), g = c.getContext('2d');
  for (let k = 0; k < 9; k++) {
    const x = ts * (0.05 + r() * 0.9), h = ts * (0.08 + r() * 0.14);
    g.strokeStyle = `rgba(${60 + (r() * 40) | 0},${120 + (r() * 60) | 0},${50 + (r() * 30) | 0},0.85)`; g.lineWidth = Math.max(1, ts * 0.018);
    g.beginPath(); g.moveTo(x, c.height); g.quadraticCurveTo(x + (r() - 0.5) * ts * 0.08, c.height - h * 0.6, x + (r() - 0.5) * ts * 0.16, c.height - h); g.stroke();
  }
  return c;
}
function pitSprite(ts, r) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d');
  const gr = g.createRadialGradient(ts / 2, ts / 2, ts * 0.05, ts / 2, ts / 2, ts * 0.8);
  gr.addColorStop(0, '#000'); gr.addColorStop(0.6, '#0b0805'); gr.addColorStop(1, '#2a1f15');
  g.fillStyle = gr; g.fillRect(0, 0, ts, ts);
  g.strokeStyle = 'rgba(150,110,70,0.12)'; g.lineWidth = Math.max(1, ts * 0.02);
  for (let k = 0; k < 5; k++) {
    const y = r() * ts;
    g.beginPath(); g.moveTo(0, y);
    g.bezierCurveTo(ts * 0.3, y + (r() - 0.5) * ts * 0.3, ts * 0.7, y + (r() - 0.5) * ts * 0.3, ts, y + (r() - 0.5) * ts * 0.2);
    g.stroke();
  }
  return c;
}
function rimSprite(ts, r, side, fill, edge) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d');
  const m = { l: [1, 0, 0, 1, 0, 0], r: [-1, 0, 0, 1, ts, 0], t: [0, 1, 1, 0, 0, 0], b: [0, -1, 1, 0, 0, ts] }[side];
  g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
  const pts = [];
  for (let k = 0; k <= 7; k++) pts.push([ts * (0.1 + r() * 0.12), (k / 7) * ts]);
  g.beginPath(); g.moveTo(0, 0); for (const [x, y] of pts) g.lineTo(x, y); g.lineTo(0, ts); g.closePath();
  g.fillStyle = fill; g.fill();
  g.beginPath(); pts.forEach(([x, y], k) => (k ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.strokeStyle = edge; g.lineWidth = Math.max(1, ts * 0.04); g.stroke();
  return c;
}
function waterSprite(ts) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, ts, ts);
  gr.addColorStop(0, '#16424c'); gr.addColorStop(1, '#1d5a5e');
  g.fillStyle = gr; g.fillRect(0, 0, ts, ts);
  return c;
}
function footSprite(ts, flip) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d');
  g.fillStyle = 'rgba(45,30,15,0.24)';
  const pr = (x, y, a) => { g.save(); g.translate(x, y); g.rotate(a); g.beginPath(); g.ellipse(0, 0, ts * 0.045, ts * 0.08, 0, 0, TAU); g.fill(); g.restore(); };
  if (flip) { pr(ts * 0.4, ts * 0.35, 0.2); pr(ts * 0.58, ts * 0.62, 0.2); } else { pr(ts * 0.6, ts * 0.38, -0.2); pr(ts * 0.42, ts * 0.64, -0.2); }
  return c;
}
function emojiSprite(ch, size, ring) {
  const c = makeCanvas(size, size), g = c.getContext('2d');
  if (ring) {
    g.fillStyle = 'rgba(30,15,8,0.45)'; g.strokeStyle = 'rgba(228,104,60,0.7)'; g.lineWidth = Math.max(1, size * 0.04);
    g.beginPath(); g.arc(size / 2, size / 2, size * 0.34, 0, TAU); g.fill(); g.stroke();
  }
  g.font = `${Math.round(size * (ring ? 0.42 : 0.7))}px ${EMOJI_FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(ch, size / 2, size * 0.54);
  return c;
}
function gateSprite(ts) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d');
  g.fillStyle = '#4f463b'; g.fillRect(0, 0, ts, ts);
  g.fillStyle = '#2b1d10';
  for (let k = 0; k < 4; k++) g.fillRect(ts * (0.14 + k * 0.22), ts * 0.08, ts * 0.08, ts * 0.86);
  g.fillRect(ts * 0.08, ts * 0.3, ts * 0.84, ts * 0.08); g.fillRect(ts * 0.08, ts * 0.66, ts * 0.84, ts * 0.08);
  return c;
}
function exitSprite(ts, side) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d');
  g.translate(ts / 2, ts / 2); g.rotate(side * Math.PI / 2); g.translate(-ts / 2, -ts / 2);
  const gr = g.createLinearGradient(0, ts, 0, 0);
  gr.addColorStop(0, '#6b4d1c'); gr.addColorStop(1, '#f6d58a');
  g.fillStyle = gr; g.fillRect(0, 0, ts, ts);
  g.strokeStyle = 'rgba(80,50,10,.6)'; g.lineWidth = Math.max(1, ts * 0.05);
  g.beginPath(); g.arc(ts / 2, ts * 0.66, ts * 0.3, Math.PI, 0); g.stroke();
  return c;
}
// Qulflangan darvoza: temir panjara va oltin hoshiya (kalit bo‘lsa — oltin ravoq)
function lockedExitSprite(ts, side) {
  const c = makeCanvas(ts, ts), g = c.getContext('2d');
  g.translate(ts / 2, ts / 2); g.rotate(side * Math.PI / 2); g.translate(-ts / 2, -ts / 2);
  g.fillStyle = '#3b3226'; g.fillRect(0, 0, ts, ts);
  g.fillStyle = '#17120c';
  for (let k = 0; k < 4; k++) g.fillRect(ts * (0.14 + k * 0.22), ts * 0.06, ts * 0.08, ts * 0.88);
  g.fillRect(ts * 0.08, ts * 0.3, ts * 0.84, ts * 0.08); g.fillRect(ts * 0.08, ts * 0.66, ts * 0.84, ts * 0.08);
  g.strokeStyle = '#d6a84c'; g.lineWidth = Math.max(1, ts * 0.06); g.strokeRect(ts * 0.04, ts * 0.04, ts * 0.92, ts * 0.92);
  return c;
}
const FXQ = { dapple: true, vignette: true, fog3: true, light2: true, tuft: true };
function dappleSprite(n) {
  const c = makeCanvas(n, n), g = c.getContext('2d'), r = mulberry32(31), u = n / 256;
  for (let k = 0; k < 22; k++) {
    const x = r() * n, y = r() * n, rad = (26 + r() * 70) * u, a = 0.05 + r() * 0.07;
    for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, `rgba(255,225,150,${a})`); gr.addColorStop(0.6, `rgba(255,210,120,${a * 0.4})`); gr.addColorStop(1, 'rgba(255,200,100,0)');
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  return c;
}
function drawDapple(V, t) {
  if (!SPR.dapple) SPR.dapple = dappleSprite(Math.round(256 * DPR));
  const { ox, oy, W, H } = V, sp = SPR.dapple, ms = sp.width * 1.6;
  ctx.save(); ctx.globalAlpha = 0.75;   // oddiy aralashtirish: «lighter» zaif telefonlarda qimmat
  const mx = ox * 0.8 + Math.sin(t * 0.07) * 40 * DPR, my = oy * 0.8 + Math.cos(t * 0.05) * 30 * DPR;
  const sx0 = ((mx % ms) + ms) % ms - ms, sy0 = ((my % ms) + ms) % ms - ms;
  for (let y = sy0; y < H; y += ms) for (let x = sx0; x < W; x += ms) ctx.drawImage(sp, x, y, ms, ms);
  ctx.restore();
}
function mistSprite(n) {
  const c = makeCanvas(n, n), g = c.getContext('2d'), r = mulberry32(7), u = n / 256;
  for (let k = 0; k < 46; k++) {
    const x = r() * n, y = r() * n, rad = (20 + r() * 60) * u, a = 0.05 + r() * 0.09;
    for (const ox of [-n, 0, n]) for (const oy of [-n, 0, n]) {
      const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
      gr.addColorStop(0, `rgba(140,170,150,${a})`); gr.addColorStop(1, 'rgba(140,170,150,0)');
      g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
    }
  }
  return c;
}
function buildSprites() {
  const ts = Math.max(8, Math.round(G.tsCss * DPR));
  if (ts === SPR.ts) return;
  SPR.ts = ts;
  const r = mulberry32(90210);
  SPR.stone = [0, 1, 2, 3].map((k) => stoneSprite(ts, r, k >= 2));
  SPR.hedge = [0, 1, 2, 3, 4, 5].map((k) => hedgeSprite(ts, r, k >= 4));
  SPR.face = faceSprite(ts, r);
  SPR.shT = shadeSprite(ts, 't'); SPR.shL = shadeSprite(ts, 'l'); SPR.shR = shadeSprite(ts, 'r'); SPR.shB = shadeSprite(ts, 'b');
  SPR.tuft = tuftSprite(ts, r);
  SPR.pit = pitSprite(ts, r);
  SPR.water = waterSprite(ts);
  SPR.rim = {}; SPR.bank = {};
  for (const s of ['l', 'r', 't', 'b']) { SPR.rim[s] = rimSprite(ts, r, s, '#6f6454', '#3b342a'); SPR.bank[s] = rimSprite(ts, r, s, '#4d5a35', '#2c331d'); }
  SPR.foot = [footSprite(ts, false), footSprite(ts, true)];
  SPR.icons = TRAPS.map((t) => emojiSprite(t.icon, ts, true));
  SPR.items = ITEMS.map((t) => emojiSprite(t.icon, ts, false));
  SPR.chest = emojiSprite(CHEST.icon, Math.round(ts * 1.1), false);
  SPR.coin = emojiSprite('💰', Math.round(ts * 1.05), false);
  SPR.beasts = {};
  for (const k of BEAST_KINDS) SPR.beasts[k] = emojiSprite(BEASTS[k].icon, Math.round(ts * 1.15), false);
  SPR.popIcons = {};
  SPR.gate = gateSprite(ts);
  SPR.exit = [0, 1, 2, 3].map((sd) => exitSprite(ts, sd));
  SPR.exitLocked = [0, 1, 2, 3].map((sd) => lockedExitSprite(ts, sd));
  SPR.lock = emojiSprite('🔒', Math.round(ts * 0.62), false);
  SPR.gkey = emojiSprite('🔑', Math.round(ts * 1.1), false);
}
function popSprite(icon) {
  const size = Math.round(SPR.ts * 1.6), key = icon + size;
  return SPR.popIcons[key] || (SPR.popIcons[key] = emojiSprite(icon, size, false));
}

function renderPos(p) {
  if (p.jump) {
    const j = p.jump, t = clamp(j.t, 0, 1), e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    return { x: lerp(j.fx, j.tx, e), y: lerp(j.fy, j.ty, e), lift: Math.sin(Math.PI * t) };
  }
  if (p.slide) { const f = clamp(p.slide.acc / p.slide.ms, 0, 1); return { x: lerp(p.mfx, p.px, f), y: lerp(p.mfy, p.py, f), lift: 0 }; }
  if (p.moving) return { x: lerp(p.mfx, p.px, p.moveT), y: lerp(p.mfy, p.py, p.moveT), lift: 0 };
  return { x: p.px, y: p.py, lift: 0 };
}
const faceName = (f) => (f.x > 0 ? 'right' : f.x < 0 ? 'left' : f.y < 0 ? 'up' : 'down');
const lightRadius = (p) => (p.fever > 0 ? 1.7 : p.torch > 0 ? 4.6 : 3.3);

function drawRipples(sx, sy, ts, t, horiz, h) {
  ctx.strokeStyle = 'rgba(170,225,220,0.28)'; ctx.lineWidth = Math.max(1, ts * 0.03);
  for (let k = 0; k < 3; k++) {
    const q = ((k / 3 + t * 0.35 + (h & 15) / 16) % 1) * ts;
    ctx.beginPath();
    if (horiz) { ctx.moveTo(sx + ts * 0.12, sy + q); ctx.quadraticCurveTo(sx + ts * 0.5, sy + q - ts * 0.07, sx + ts * 0.88, sy + q); }
    else { ctx.moveTo(sx + q, sy + ts * 0.12); ctx.quadraticCurveTo(sx + q - ts * 0.07, sy + ts * 0.5, sx + q, sy + ts * 0.88); }
    ctx.stroke();
  }
}
function drawCroc(sx, sy, ts, t, h, horiz) {
  const ph = t * 0.8 + (h & 31), s = Math.sin(ph) * ts * 0.16;
  const cx = sx + ts * 0.5 + (horiz ? 0 : s), cy = sy + ts * 0.5 + (horiz ? s : 0);
  ctx.fillStyle = '#2c4a24';
  ctx.beginPath(); ctx.ellipse(cx, cy, ts * 0.2, ts * 0.085, horiz ? Math.PI / 2 : 0, 0, TAU); ctx.fill();
  const blink = Math.sin(t * 1.3 + h) > 0.94 ? 0.25 : 1, er = ts * 0.032;
  ctx.fillStyle = '#e9d64a';
  const e1x = horiz ? cx - ts * 0.05 : cx - ts * 0.12, e1y = horiz ? cy - ts * 0.12 : cy - ts * 0.05;
  const e2x = horiz ? cx + ts * 0.05 : cx - ts * 0.12, e2y = horiz ? cy - ts * 0.12 : cy + ts * 0.05;
  ctx.beginPath(); ctx.ellipse(e1x, e1y, er, er * blink, 0, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(e2x, e2y, er, er * blink, 0, 0, TAU); ctx.fill();
}
function drawPortal(sx, sy, ts, t) {
  ctx.save(); ctx.translate(sx + ts / 2, sy + ts / 2);
  const g0 = ctx.createRadialGradient(0, 0, 0, 0, 0, ts * 0.45);
  g0.addColorStop(0, '#05020c'); g0.addColorStop(0.55, '#2a0f55'); g0.addColorStop(1, 'rgba(60,20,120,0)');
  ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(0, 0, ts * 0.45, 0, TAU); ctx.fill();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let k = 0; k < 4; k++) {
    ctx.rotate(t * (1.4 + k * 0.45) + k);
    ctx.strokeStyle = `hsla(${185 + k * 32},95%,${62 + k * 4}%,0.8)`;
    ctx.lineWidth = Math.max(1, ts * (0.045 - k * 0.006));
    ctx.beginPath(); ctx.arc(0, 0, ts * (0.12 + k * 0.075), 0, Math.PI * (1.1 + 0.2 * Math.sin(t * 2 + k))); ctx.stroke();
  }
  ctx.restore();
}
function glowAt(x, y, r, col) {
  ctx.globalCompositeOperation = 'lighter';
  const gl = ctx.createRadialGradient(x, y, 0, x, y, r);
  gl.addColorStop(0, col); gl.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = gl; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalCompositeOperation = 'source-over';
}

// Darvoza chegaraning qaysi tomonida: 0 shimol, 1 sharq, 2 janub, 3 g‘arb.
const gateSide = (x, y) => { const q = G.exits.find((e) => e.x === x && e.y === y); return q ? q.side : (y === 0 ? 0 : x === G.N - 1 ? 1 : y === G.N - 1 ? 2 : 3); };
// Berilgan nuqtaga eng yaqin darvoza.
function nearestGate(x, y) {
  let best = G.exits[0], bd = Infinity;
  for (const q of G.exits) { const d = Math.hypot(q.x - x, q.y - y); if (d < bd) { bd = d; best = q; } }
  return best;
}
function drawTiles(V, t) {
  const { ts, ox, oy, p } = V, N = G.N, g = G.g, E = p.explored;
  const ya = Math.max(0, V.y0), yb = Math.min(N - 1, V.y1), xa = Math.max(0, V.x0), xb = Math.min(N - 1, V.x1);
  for (let y = ya; y <= yb; y++) {
    const sy = oy + y * ts;
    for (let x = xa; x <= xb; x++) {
      const i = y * N + x;
      if (!E[i]) continue;
      const sx = ox + x * ts, tt = g[i], h = hash2(x, y);
      if (tt === T.WALL) {
        ctx.drawImage(SPR.hedge[h % 13 < 11 ? h & 3 : 4 + (h & 1)], sx, sy);
        if (y < N - 1 && g[i + N] !== T.WALL) ctx.drawImage(SPR.face, sx, sy + ts - SPR.face.height);
      } else if (tt === T.PATH || tt === T.PORTAL) {
        ctx.drawImage(SPR.stone[h & 3], sx, sy);
        if (y > 0 && g[i - N] === T.WALL) { ctx.drawImage(SPR.shT, sx, sy); if (FXQ.tuft && (h & 3) === 0) ctx.drawImage(SPR.tuft, sx, sy); }
        if (g[i - 1] === T.WALL) ctx.drawImage(SPR.shL, sx, sy);
        if (g[i + 1] === T.WALL) ctx.drawImage(SPR.shR, sx, sy);
        if (y < N - 1 && g[i + N] === T.WALL) ctx.drawImage(SPR.shB, sx, sy);
        if (p.visited[i]) ctx.drawImage(SPR.foot[(h >> 3) & 1], sx, sy);
        if (tt === T.PORTAL) drawPortal(sx, sy, ts, t);
        const tr = G.trap[i];
        if (tr >= 0 && p.spent[i]) { ctx.globalAlpha = 0.75; ctx.drawImage(SPR.icons[tr], sx, sy); ctx.globalAlpha = 1; }
        if (G.chest[i]) {
          const open = p.spent[i], bob = open ? 0 : Math.sin(t * 2.5 + (h & 7)) * ts * 0.04, sp = SPR.chest;
          if (!open) glowAt(sx + ts / 2, sy + ts / 2, ts * 0.7, `rgba(255,200,90,${0.35 + 0.15 * Math.sin(t * 3 + h)})`);
          ctx.globalAlpha = open ? 0.35 : 1;
          ctx.drawImage(sp, sx + (ts - sp.width) / 2, sy + (ts - sp.height) / 2 - ts * 0.08 + bob);
          ctx.globalAlpha = 1;
        }
        if (G.coin[i]) {
          const bob = Math.sin(t * 3 + (h & 7)) * ts * 0.05, sp = SPR.coin;
          glowAt(sx + ts / 2, sy + ts / 2, ts * 0.5, `rgba(255,200,70,${0.3 + 0.12 * Math.sin(t * 4 + h)})`);
          ctx.drawImage(sp, sx + (ts - sp.width) / 2, sy + (ts - sp.height) / 2 - ts * 0.06 + bob);
        }
        const it = G.item[i];
        if (it >= 0) {
          const bob = Math.sin(t * 3 + (h & 7)) * ts * 0.06;
          glowAt(sx + ts / 2, sy + ts / 2, ts * 0.55, `rgba(255,210,120,${0.32 + 0.12 * Math.sin(t * 4 + h)})`);
          ctx.drawImage(SPR.items[it], sx, sy - ts * 0.12 + bob);
        }
        if (G.keyAt[i] === p.keySlot && !p.gkey) {   // o‘z kaliting
          const bob = Math.sin(t * 3.2 + (h & 7)) * ts * 0.06, sp = SPR.gkey;
          glowAt(sx + ts / 2, sy + ts / 2, ts * 0.7, `rgba(120,220,255,${0.4 + 0.15 * Math.sin(t * 4 + h)})`);
          ctx.drawImage(sp, sx + (ts - sp.width) / 2, sy + (ts - sp.height) / 2 - ts * 0.1 + bob);
        } else if (G.keyAt[i] >= 0 && G.keyLive[G.keyAt[i]]) {   // raqib kaliti: ko‘rinadi, lekin olib bo‘lmaydi
          const sp = SPR.gkey;
          glowAt(sx + ts / 2, sy + ts / 2, ts * 0.55, 'rgba(255,90,70,0.28)');
          ctx.save(); ctx.globalAlpha = 0.5; ctx.drawImage(sp, sx + (ts - sp.width) / 2, sy + (ts - sp.height) / 2 - ts * 0.06); ctx.restore();
        }
      } else if (tt === T.CHASM || tt === T.RIVER) {
        const isC = tt === T.CHASM, horiz = g[i - 1] !== T.WALL || g[i + 1] !== T.WALL;
        ctx.drawImage(isC ? SPR.pit : SPR.water, sx, sy);
        if (!isC) drawRipples(sx, sy, ts, t, horiz, h);
        const set = isC ? SPR.rim : SPR.bank;
        if (g[i - 1] === T.PATH) ctx.drawImage(set.l, sx, sy);
        if (g[i + 1] === T.PATH) ctx.drawImage(set.r, sx, sy);
        if (g[i - N] === T.PATH) ctx.drawImage(set.t, sx, sy);
        if (g[i + N] === T.PATH) ctx.drawImage(set.b, sx, sy);
        if (!isC && h % 3 === 0) drawCroc(sx, sy, ts, t, h, horiz);
      } else if (tt === T.ENTRY) {
        ctx.drawImage(SPR.gate, sx, sy);
      } else if (tt === T.EXIT) {
        const sd = gateSide(x, y);
        if (hasKey(p)) ctx.drawImage(SPR.exit[sd], sx, sy);
        else { ctx.drawImage(SPR.exitLocked[sd], sx, sy); ctx.drawImage(SPR.lock, sx + (ts - SPR.lock.width) / 2, sy + (ts - SPR.lock.height) / 2); }
      }
    }
  }
}

function beastMs(b) {
  const D = BEASTS[b.type], q = G.players[b.target];
  if (q && q.look === 2 && b.state !== 'wander') return Math.round(beastMs0(b, D) * 1.3);   // Zoolog: hayvonlar sekinroq yetadi
  return beastMs0(b, D);
}
function beastMs0(b, D) {
  if (b.state === 'chase') return b.lunge > 0 ? D.lunge : D.chase;
  if (b.state === 'charge') return D.charge;
  if (b.state === 'track') return D.track;
  if (b.state === 'search') return D.search;
  return D.wander;
}
function beastVisible(b, p) {
  return p.explored[b.y * G.N + b.x] && Math.hypot(b.x - p.px, b.y - p.py) <= lightRadius(p) + 0.6;
}
function drawEntities(V, t) {
  const { ts, ox, oy, p } = V, N = G.N, list = [], counts = {};
  const addPerson = (q, rp, kind) => {
    const key = Math.round(rp.y) * N + Math.round(rp.x);
    if (q !== p && !p.explored[key]) return;
    counts[key] = (counts[key] || 0) + 1;
    list.push({ kind, q, rp, slot: counts[key] - 1, key });
  };
  for (const q of (G.mode === 'menu' ? viewers : G.players)) if (!q.finished) addPerson(q, renderPos(q), 'player');
  for (const r of remoteList()) if (!r.fin) addPerson(r, { x: r.rx, y: r.ry, lift: 0 }, 'remote');
  for (const e of list) e.n = counts[e.key];
  for (const b of G.beasts) if (beastVisible(b, p)) {
    const f = b.state === 'rest' ? 1 : clamp(b.acc / beastMs(b), 0, 1);
    list.push({ kind: 'beast', b, rp: { x: lerp(b.fx, b.x, f), y: lerp(b.fy, b.y, f) } });
  }
  list.sort((a, b) => a.rp.y - b.rp.y);
  const many = G.players.length + G.remotes.size > 1;
  for (const e of list) {
    if (e.kind === 'beast') { drawBeast(e, V, t); continue; }
    const off = e.n > 1 ? (e.slot - (e.n - 1) / 2) * ts * 0.26 : 0;
    drawActor(e, ox + (e.rp.x + 0.5) * ts + off, oy + (e.rp.y + 0.5) * ts + ts * 0.3, ts, t, many, p, true);
  }
}
// Bitta odamni chizadi (o‘z ekranida ham, xalaqit oynachasida ham): soya, yelim, qahramon, muz, qafas, pufak, ism.
function drawActor(e, x, y, ts, t, many, p, tags) {
  const q = e.q;
  if (!q.alive) { drawTomb(ctx, x, y, ts); return; }
  let scale = 1, rot = 0, alpha = 1;
  if (q.tele) { const k = q.tele.phase === 'out' ? 1 - q.tele.t : q.tele.t; scale = Math.max(0.05, k); rot = (1 - k) * 6; alpha = k; }
  if (q.hurtT > 0 && Math.sin(t * 40) > 0) alpha *= 0.35;
  if (e.kind === 'remote') alpha *= 0.92;
  if (q.cloak > 0) alpha *= 0.4 + 0.12 * Math.sin(t * 5);
  drawShadow(ctx, x, y, ts, e.rp.lift, many ? q.color : null);
  if (q.slow > 0) { ctx.fillStyle = 'rgba(232,170,40,0.6)'; ctx.beginPath(); ctx.ellipse(x, y, ts * 0.34, ts * 0.12, 0, 0, TAU); ctx.fill(); }
  const mk = maskOf(q), mv = e.kind === 'remote' ? q.moving : (q.moving || !!q.slide), phs = e.kind === 'remote' ? t * 12 : q.ph;
  if (mk) drawMasked(x, y, ts, mk, { moving: mv, ph: phs, lift: e.rp.lift, scale, rot, alpha, idle: t * 2 + (q.id || 0), face: q.face ? q.face.x : 0 });
  else drawPerson(ctx, x, y, ts * 1.15, LOOKS[q.look] || LOOKS[0], { dir: faceName(q.face || { x: 0, y: 1 }), moving: mv, ph: phs, lift: e.rp.lift, scale, rot, alpha, idle: t * 2 + (q.id || 0), wave: G.winner === q });
  if (q.frozen > 0) drawIce(ctx, x, y, ts);
  if (q.jail) drawCage(ctx, x, y, ts);   // (masofadagi o‘yinchida ham r.jail bor)
  if (q.mirror > 0) drawMirror(x, y, ts, t, q.mirror);
  if (e.kind === 'remote' ? !!(q.peer && !q.isBot && voiceSpeakingPeer(q.peer)) : VOICE.on && VOICE.speaking && q === me()) drawSpeak(x, y - e.rp.lift * ts * 0.6, ts, t);   // gapirayotganini ko‘rsatadi
  if (tags && q.bot && q.card && !q.jail) drawBubble(x, y - ts * (many ? 1.62 : 1.2) - e.rp.lift * ts * 0.6, ts, q.card.icon, t);
  else if (q.stun > 0) drawBubble(x, y - ts * (many ? 1.62 : 1.2), ts, tags ? (q.stunIcon || '💫') : '💫', t);   // oynachada qaysi tuzoq/sandiq ekani sir qoladi
  const bsec = q.bomb > 0 ? q.bomb : q.bm > 0 ? q.bm : 0;
  if (bsec > 0) drawBomb(x, y - ts * (many ? 1.78 : 1.5) - e.rp.lift * ts * 0.6, ts, t, bsec);
  if (mk) { const ph = (t + (q.id || 0) * 2.3) % 8; if (ph < 2) drawSay(x, y - ts * (many ? 1.62 : 1.35) - e.rp.lift * ts * 0.6, ts, { text: mk.say, until: G.time + (2 - ph) }, t); }   // maska kiygan o‘z ovozi bilan gapiradi
  if (tags && q.say && q.say.until > G.time) drawSay(x, y - ts * (many ? 1.62 : 1.3) - e.rp.lift * ts * 0.6, ts, q.say, t);   // tezkor gap pufagi
  if (tags && many && (e.n === 1 || q === p)) {
    const fs = Math.max(10, Math.round(ts * 0.26));
    ctx.font = `800 ${fs}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    const label = (q.leader ? '👑 ' : '') + q.name, ty = y - ts * 1.02 - e.rp.lift * ts * 0.6, w = ctx.measureText(label).width + fs * 0.8;
    ctx.fillStyle = 'rgba(20,13,6,0.75)'; rr(ctx, x - w / 2, ty - fs * 1.15, w, fs * 1.25, fs * 0.6); ctx.fill();
    ctx.fillStyle = q === p ? '#ffe7a6' : q.color; ctx.fillText(label, x, ty);
  }
}
// Maskalangan o‘yinchi: odam o‘rniga emoji (tovuq, masxaraboz, kartoshka…) sakrab yuradi.
function drawMasked(x, y, ts, mk, o) {
  const spr = popSprite(mk.e), size = ts * 1.3 * o.scale, k = size / spr.width, bob = o.moving ? Math.abs(Math.sin(o.ph)) * ts * 0.14 : Math.sin(o.idle) * ts * 0.02;
  ctx.save();
  ctx.globalAlpha = o.alpha;
  ctx.translate(x, y - ts * 0.58 - o.lift * ts * 0.6 - bob);
  ctx.rotate(o.rot + (o.moving ? Math.sin(o.ph) * 0.14 : 0));
  if (o.face < 0) ctx.scale(-1, 1);
  ctx.drawImage(spr, -(spr.width * k) / 2, -(spr.height * k) / 2, spr.width * k, spr.height * k);
  ctx.restore();
}
// Ko‘zgu qalqoni: o‘yinchi atrofida yaltiroq oynasimon qobiq.
function drawMirror(x, y, ts, t, left) {
  const cy = y - ts * 0.5, a = left < 6 ? 0.4 + 0.4 * Math.sin(t * 14) : 0.85;
  ctx.save();
  ctx.globalAlpha = a;
  const g = ctx.createRadialGradient(x, cy, ts * 0.15, x, cy, ts * 0.78);
  g.addColorStop(0, 'rgba(200,235,255,0)'); g.addColorStop(0.7, 'rgba(190,230,255,0.16)'); g.addColorStop(1, 'rgba(235,248,255,0.5)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, cy, ts * 0.5, ts * 0.74, 0, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(225,245,255,0.85)'; ctx.lineWidth = Math.max(1.2, ts * 0.035);
  ctx.beginPath(); ctx.ellipse(x, cy, ts * 0.5, ts * 0.74, 0, 0, TAU); ctx.stroke();
  const ph = t * 2.2;   // aylanib yuruvchi yaltirash
  ctx.lineWidth = Math.max(2, ts * 0.06); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.ellipse(x, cy, ts * 0.5, ts * 0.74, 0, ph, ph + 0.7); ctx.stroke();
  ctx.restore();
}
// Gapirayotgan o‘yinchi boshi yonida ovoz to‘lqinlari.
function drawSpeak(x, y, ts, t) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineWidth = Math.max(1.5, ts * 0.055); ctx.strokeStyle = 'rgb(130,255,170)';
  for (let k = 0; k < 3; k++) {
    const a = (t * 1.8 + k / 3) % 1, r = ts * (0.1 + a * 0.26);
    ctx.globalAlpha = (1 - a) * 0.9;
    ctx.beginPath(); ctx.arc(x + ts * 0.34, y - ts * 0.82, r, -0.85, 0.85); ctx.stroke();
  }
  ctx.restore();
}
function drawIce(g, x, y, s) {
  g.save();
  g.fillStyle = 'rgba(170,225,255,0.42)'; g.strokeStyle = 'rgba(225,245,255,0.9)'; g.lineWidth = Math.max(1.5, s * 0.03);
  rr(g, x - s * 0.3, y - s * 1.08, s * 0.6, s * 1.14, s * 0.1); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(x - s * 0.18, y - s * 0.9); g.lineTo(x - s * 0.05, y - s * 0.55); g.moveTo(x + s * 0.14, y - s * 0.95); g.lineTo(x + s * 0.2, y - s * 0.7); g.stroke();
  g.restore();
}
function drawCage(g, x, y, s) {
  const w = s * 0.58, h = s * 1.1, left = x - w / 2, top = y - h;
  g.save();
  g.fillStyle = 'rgba(20,20,26,0.2)'; g.fillRect(left, top, w, h);
  g.strokeStyle = '#6d7078'; g.lineWidth = Math.max(2, s * 0.05); g.lineCap = 'round';
  for (let k = 0; k <= 4; k++) { const bx = left + (w * k) / 4; g.beginPath(); g.moveTo(bx, top); g.lineTo(bx, y); g.stroke(); }
  g.beginPath(); g.moveTo(left - 2, top); g.lineTo(left + w + 2, top); g.moveTo(left - 2, y); g.lineTo(left + w + 2, y); g.stroke();
  g.restore();
}
function drawBubble(x, y, ts, icon, t) {
  const r = ts * 0.34, bob = Math.sin(t * 5) * ts * 0.03;
  ctx.fillStyle = 'rgba(240,230,204,0.95)'; ctx.strokeStyle = 'rgba(60,40,20,0.8)'; ctx.lineWidth = Math.max(1, ts * 0.025);
  ctx.beginPath(); ctx.arc(x, y + bob, r, 0, TAU); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(x - r * 0.55, y + bob + r * 1.15, r * 0.16, 0, TAU); ctx.fill(); ctx.stroke();
  const spr = popSprite(icon), k = (r * 1.45) / spr.width;
  ctx.drawImage(spr, x - (spr.width * k) / 2, y + bob - (spr.height * k) / 2, spr.width * k, spr.height * k);
  const dots = 1 + (Math.floor(t * 3) % 3);
  ctx.fillStyle = 'rgba(60,40,20,0.85)';
  for (let k2 = 0; k2 < dots; k2++) { ctx.beginPath(); ctx.arc(x + r * 0.95 + k2 * ts * 0.09, y + bob + r * 0.75, ts * 0.03, 0, TAU); ctx.fill(); }
}
function drawBeast(e, V, t) {
  const { ts, ox, oy } = V, b = e.b, x = ox + (e.rp.x + 0.5) * ts, y = oy + (e.rp.y + 0.5) * ts + ts * 0.3;
  const spr = SPR.beasts[b.type], moving = b.state !== 'rest' && b.state !== 'coil';
  const hop = moving ? Math.abs(Math.sin(t * (b.state === 'wander' ? 7 : 14) + b.seed)) * ts * 0.06 : 0;
  const sc = 1 + (b.pounce > 0 ? Math.sin(b.pounce / 0.6 * Math.PI) * 0.4 : 0);
  const hunting = b.state === 'chase' || b.state === 'charge';
  drawShadow(ctx, x, y, ts * 1.2, 0, hunting ? 'rgba(255,70,50,0.8)' : null);
  ctx.save(); ctx.translate(x, y - spr.height * 0.45 * sc - hop);
  ctx.scale(b.faceX > 0 ? -sc : sc, sc);
  ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
  ctx.restore();
  const mark = b.alert || (hunting ? '!' : '');
  if (mark) {
    ctx.font = `900 ${Math.round(ts * 0.45)}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = mark === '?' ? '#ffc94a' : '#ff5a3c'; ctx.fillText(mark, x, y - spr.height * 0.9 - hop);
  }
}
function drawBeastEyes(V, t) {
  const { ts, ox, oy, p } = V;
  for (const b of G.beasts) {
    const hot = b.state === 'chase' || b.state === 'charge', warm = b.state === 'track' || b.state === 'search', lurk = b.state === 'coil';
    if (!(hot || warm || lurk) || beastVisible(b, p)) continue;
    const dist = Math.hypot(b.x - p.px, b.y - p.py);
    if (dist > (hot ? 9 : warm ? 7 : 4)) continue;
    const f = lurk ? 1 : clamp(b.acc / beastMs(b), 0, 1);
    const x = ox + (lerp(b.fx, b.x, f) + 0.5) * ts, y = oy + (lerp(b.fy, b.y, f) + 0.5) * ts;
    const a = hot ? 0.7 + 0.3 * Math.sin(t * 10) : 0.45 + 0.2 * Math.sin(t * 4 + b.seed);
    const col = hot ? `rgba(255,80,40,${a})` : lurk ? `rgba(150,230,90,${a})` : `rgba(255,190,70,${a})`;
    for (const dx of [-0.09, 0.09]) glowAt(x + dx * ts, y, ts * 0.12, col);
  }
}
function drawVans(V, t) {
  const { ts, ox, oy, p } = V;
  for (const v of G.vans) {
    const tp = G.players[v.target];
    if (tp !== p && !(p.explored[v.y * G.N + v.x] && Math.hypot(v.x - p.px, v.y - p.py) <= lightRadius(p) + 0.6)) continue;
    const f = clamp(v.acc / v.step, 0, 1);
    const x = ox + (lerp(v.fx, v.x, f) + 0.5) * ts, y = oy + (lerp(v.fy, v.y, f) + 0.5) * ts + ts * 0.3;
    glowAt(x, y - ts * 0.3, ts * 1.2, `rgba(255,60,40,${0.4 * (0.6 + 0.4 * Math.sin(t * 8))})`);
    const dx = tp.px - v.x, dy = tp.py - v.y;
    const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down';
    drawShadow(ctx, x, y, ts, 0, 'rgba(255,60,40,0.8)');
    drawPerson(ctx, x, y, ts * 1.15, VAN_LOOK, { dir, moving: true, ph: t * 14 });
  }
}
function drawLight(V, px, py, t) {
  const { ts, p } = V;
  const R = ts * lightRadius(p) * (1 + Math.sin(t * 7.3) * 0.015 + Math.sin(t * 17.1) * 0.01);
  const gr = ctx.createRadialGradient(px, py, ts * 0.25, px, py, R);
  gr.addColorStop(0, 'rgba(2,6,4,0)'); gr.addColorStop(0.5, 'rgba(2,6,4,0.08)'); gr.addColorStop(0.85, 'rgba(2,6,4,0.5)'); gr.addColorStop(1, 'rgba(2,6,4,0.74)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, V.W, V.H);
  const fl = 1 + Math.sin(t * 11) * 0.06 + Math.sin(t * 23.7) * 0.04;
  if (FXQ.light2) glowAt(px, py, R * 0.55, p.torch > 0 ? `rgba(255,160,70,${0.22 * fl})` : `rgba(255,190,110,${0.12 * fl})`);
  glowAt(px, py, R, p.torch > 0 ? 'rgba(255,130,40,0.12)' : 'rgba(255,170,80,0.07)');
}
function drawFog(V, t) {
  const { ts, ox, oy, x0, y0, x1, y1, p } = V, N = G.N, E = p.explored;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
  if (fogLow.width !== cw || fogLow.height !== ch || !fogImg) {
    fogLow.width = cw; fogLow.height = ch;
    fogImg = flctx.createImageData(cw, ch);
    const d = fogImg.data;
    for (let k = 0; k < d.length; k += 4) { d[k] = 12; d[k + 1] = 21; d[k + 2] = 16; }
  }
  const d = fogImg.data;
  for (let j = 0; j < ch; j++) {
    const y = y0 + j, inY = y >= 0 && y < N;
    for (let i = 0; i < cw; i++) {
      const x = x0 + i;
      d[(j * cw + i) * 4 + 3] = inY && x >= 0 && x < N && E[y * N + x] ? 0 : 255;
    }
  }
  flctx.putImageData(fogImg, 0, 0);
  const hs = 0.5, W = Math.ceil(V.W * hs), H = Math.ceil(V.H * hs);
  fctx.globalCompositeOperation = 'source-over'; fctx.globalAlpha = 1;
  fctx.clearRect(0, 0, W + 2, H + 2);
  fctx.imageSmoothingEnabled = true;
  fctx.drawImage(fogLow, (ox + x0 * ts) * hs, (oy + y0 * ts) * hs, cw * ts * hs, ch * ts * hs);
  fctx.globalCompositeOperation = 'source-atop';
  const ms = SPR.mist.width;
  const layers = [[(t * 14 * DPR + ox) * hs, (t * 6 * DPR + oy) * hs, 0.5, 1], [(-t * 9 * DPR + ox) * hs + ms * 0.37, (t * 11 * DPR + oy) * hs + ms * 0.61, 0.32, 1], [(t * 4 * DPR + ox * 0.6) * hs, (-t * 3 * DPR + oy * 0.6) * hs, 0.28, 1.9]];
  for (const [mx, my, a, sc] of layers) {
    if (sc > 1 && !FXQ.fog3) continue;
    fctx.globalAlpha = a;
    const mz = ms * sc, sx0 = Math.round(((mx % mz) + mz) % mz - mz), sy0 = Math.round(((my % mz) + mz) % mz - mz);
    for (let y = sy0; y < H; y += mz) for (let x = sx0; x < W; x += mz) fctx.drawImage(SPR.mist, x, y, mz, mz);
  }
  fctx.globalAlpha = 1; fctx.globalCompositeOperation = 'source-over';
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(fogL, 0, 0, W, H, 0, 0, W / hs, H / hs);
}
function drawExitBeacon(V, t) {
  const { ts, ox, oy, p } = V, k = hasKey(p) ? 1 : 0.55;   // qulflangan darvoza xiraroq
  for (const q of G.exits) {
    if (!p.explored[q.idx]) continue;      // darvoza ochilmaguncha hech narsa ko‘rinmaydi
    const x = ox + (q.x + 0.5) * ts, y = oy + (q.y + 0.5) * ts;
    if (x < -ts * 6 || x > V.W + ts * 6 || y < -ts * 6 || y > V.H + ts * 6) continue;
    const pulse = (0.75 + 0.25 * Math.sin(t * 2.4)) * k;
    glowAt(x, y, ts * 2.4, `rgba(255,214,120,${0.55 * pulse})`);
    ctx.save(); ctx.translate(x, y); ctx.rotate(q.side * Math.PI / 2);   // nur darvozadan tashqariga qarab
    ctx.globalCompositeOperation = 'lighter';
    const bg = ctx.createLinearGradient(0, 0, 0, -ts * 6);
    bg.addColorStop(0, `rgba(255,220,140,${0.35 * pulse})`); bg.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = bg; ctx.fillRect(-ts * 0.35, -ts * 6, ts * 0.7, ts * 6);
    ctx.restore();
    ctx.globalCompositeOperation = 'source-over';
  }
}
// Xarita topilgan bo‘lsa: kalit va sandiqlar joyi tumanda ham porlab turadi.
function drawMarks(V, t) {
  const { ts, ox, oy, p } = V, N = G.N;
  const mark = (i, rgb, sp) => {
    const x = ox + ((i % N) + 0.5) * ts, y = oy + (((i / N) | 0) + 0.5) * ts;
    if (x < -ts || x > V.W + ts || y < -ts || y > V.H + ts) return;
    const pulse = 0.6 + 0.4 * Math.sin(t * 4 + i);
    glowAt(x, y, ts * 0.95, `rgba(${rgb},${0.5 * pulse})`);
    ctx.drawImage(sp, x - sp.width / 2, y - sp.height / 2 - ts * 0.05);
  };
  if (p.liar > 0) return;   // yolg‘onchi kompas: belgilar yo‘qoladi
  if (p.knowKey && !p.gkey && G.keyCells[p.keySlot] >= 0) mark(G.keyCells[p.keySlot], '120,220,255', SPR.gkey);
  if (p.knowChest) for (const i of G.chestCells) if (!p.spent[i]) mark(i, '255,190,70', SPR.chest);
}
function drawCompass(V, px, py, t) {
  const { ts, p } = V;
  if (!(p.compass > 0)) return;
  const rp = renderPos(p), ng = nearestGate(rp.x, rp.y), R = ts * (0.95 + 0.05 * Math.sin(t * 5));
  const a = Math.atan2(ng.y - rp.y, ng.x - rp.x) + (p.liar > 0 ? (p.liarA + (Math.floor(G.time / 4) % 3)) * (Math.PI / 4) : 0);   // yolg‘onchi kompas
  const cx = px + Math.cos(a) * R, cy = py + Math.sin(a) * R;
  glowAt(cx, cy, ts * 0.35, 'rgba(255,215,110,0.6)');
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(a);
  ctx.fillStyle = '#ffd56e'; ctx.strokeStyle = '#6b4a10'; ctx.lineWidth = Math.max(1, ts * 0.025);
  ctx.beginPath(); ctx.moveTo(ts * 0.2, 0); ctx.lineTo(-ts * 0.12, -ts * 0.12); ctx.lineTo(-ts * 0.05, 0); ctx.lineTo(-ts * 0.12, ts * 0.12); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.restore();
}

/* ---- zarrachalar va suzuvchi yozuvlar ---- */
const PART = {
  dust: { col: [170, 150, 118], size: [0.05, 0.1], life: 0.55, spd: 0.6, up: 0.4, grav: 0, glow: false },
  splash: { col: [160, 225, 240], size: [0.03, 0.06], life: 0.7, spd: 1.6, up: 2.2, grav: 7, glow: false },
  spark: { col: [150, 120, 255], size: [0.03, 0.06], life: 0.9, spd: 1.8, up: 0.5, grav: 0, glow: true, swirl: true },
  gold: { col: [255, 210, 110], size: [0.03, 0.06], life: 0.9, spd: 1.2, up: 1.2, grav: 1.5, glow: true },
  leaf: { col: [90, 170, 70], size: [0.05, 0.08], life: 1.0, spd: 1.4, up: 1.2, grav: 2.5, glow: false },
  blood: { col: [230, 60, 45], size: [0.03, 0.05], life: 0.6, spd: 1.5, up: 1.4, grav: 6, glow: false },
  rewind: { col: [200, 180, 255], size: [0.03, 0.05], life: 0.6, spd: 0.4, up: 0.3, grav: 0, glow: true },
  confetti: { col: null, size: [0.05, 0.08], life: 2.2, spd: 3, up: 3.5, grav: 4, glow: false },
};
const CONF = [[255, 90, 90], [255, 210, 80], [90, 210, 120], [90, 170, 255], [220, 120, 255]];
function emit(x, y, n, kind) {
  const P = PART[kind];
  if (reduceMotion) n = Math.ceil(n / 3);
  for (let k = 0; k < n && G.parts.length < 900; k++) {
    const a = Math.random() * TAU, sp = P.spd * (0.4 + Math.random() * 0.6);
    G.parts.push({ x: x + 0.5 + (Math.random() - 0.5) * 0.3, y: y + 0.5 + (Math.random() - 0.5) * 0.3, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.6 - P.up * Math.random(),
      life: P.life * (0.6 + Math.random() * 0.4), max: P.life, size: lerp(P.size[0], P.size[1], Math.random()), kind, P,
      col: P.col || CONF[(Math.random() * CONF.length) | 0], rot: Math.random() * TAU, a0: a });
  }
}
function floatText(x, y, text, color) { G.floats.push({ x: x + 0.5, y: y + 0.1, text, color, t: 0 }); }
function updateParts(dt) {
  for (const q of G.parts) {
    if (q.P.swirl) { q.a0 += dt * 5; q.vx = Math.cos(q.a0) * 1.2; q.vy = Math.sin(q.a0) * 0.8 - 0.6; }
    q.x += q.vx * dt; q.y += q.vy * dt; q.vy += q.P.grav * dt; q.life -= dt; q.rot += dt * 6;
  }
  G.parts = G.parts.filter((q) => q.life > 0);
  for (const f of G.floats) f.t += dt;
  G.floats = G.floats.filter((f) => f.t < 1.5);
  for (const pp of G.pops) pp.t += dt;
  G.pops = G.pops.filter((pp) => pp.t < 0.9);
}
function drawParts(V) {
  const { ts, ox, oy, p } = V, N = G.N;
  for (const q of G.parts) {
    const a = clamp(q.life / q.max, 0, 1), x = ox + q.x * ts, y = oy + q.y * ts, s = q.size * ts;
    if (x < -20 || y < -20 || x > V.W + 20 || y > V.H + 20) continue;
    const ci = clamp(q.y | 0, 0, N - 1) * N + clamp(q.x | 0, 0, N - 1);
    if (!p.explored[ci]) continue;
    if (q.P.glow) ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(${q.col[0]},${q.col[1]},${q.col[2]},${a * (q.P.glow ? 0.9 : 0.75)})`;
    if (q.kind === 'confetti' || q.kind === 'leaf') { ctx.save(); ctx.translate(x, y); ctx.rotate(q.rot); ctx.fillRect(-s, -s * 0.5, s * 2, s); ctx.restore(); }
    else { ctx.beginPath(); ctx.arc(x, y, s, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'source-over';
  }
}
function drawFloats(V) {
  const { ts, ox, oy, p } = V, N = G.N;
  for (const f of G.floats) {
    if (!p.explored[clamp(f.y | 0, 0, N - 1) * N + clamp(f.x | 0, 0, N - 1)]) continue;
    const a = f.t < 1.1 ? 1 : 1 - (f.t - 1.1) / 0.4, x = ox + f.x * ts, y = oy + (f.y - f.t * 0.9) * ts;
    const fs = Math.max(13, Math.round(ts * 0.42));
    ctx.font = `900 ${fs}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.lineWidth = Math.max(2, fs * 0.18); ctx.strokeStyle = 'rgba(20,10,4,0.85)'; ctx.strokeText(f.text, x, y);
    ctx.fillStyle = f.color; ctx.fillText(f.text, x, y);
    ctx.globalAlpha = 1;
  }
}
function drawPops(V, t) {
  const { ts, ox, oy, p } = V;
  for (const pp of G.pops) {
    if (!p.explored[pp.y * G.N + pp.x]) continue;
    const k = clamp(pp.t / 0.55, 0, 1), s = k < 0.7 ? (k / 0.7) * 1.25 : 1.25 - (k - 0.7) / 0.3 * 0.25;
    const spr = popSprite(pp.icon), x = ox + (pp.x + 0.5) * ts, y = oy + (pp.y - 0.1) * ts - k * ts * 0.4;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.rotate(Math.sin(t * 20) * 0.08 * (1 - k));
    ctx.drawImage(spr, -spr.width / 2, -spr.height / 2); ctx.restore();
  }
}
const flies = Array.from({ length: 14 }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.012, vy: (Math.random() - 0.5) * 0.012, p: Math.random() * 6 }));
const leaves = Array.from({ length: 6 }, () => ({ x: Math.random(), y: Math.random(), v: 0.02 + Math.random() * 0.03, s: 0.6 + Math.random() * 0.6, p: Math.random() * 6, c: pickRand(['#3f7a33', '#6b8f2e', '#9a7a2e', '#2f6a3a']) }));
function updateAmbient(dt) {
  for (const f of flies) { f.x = (f.x + f.vx * dt + 1) % 1; f.y = (f.y + f.vy * dt + 1) % 1; }
  for (const l of leaves) { l.y += l.v * dt; if (l.y > 1.05) { l.y = -0.05; l.x = Math.random(); } }
}
function drawAmbient(V, t) {
  const W = V.W, H = V.H, r = 3 * DPR;
  for (const f of flies) glowAt(f.x * W, f.y * H, r * 4, `rgba(220,240,140,${0.22 + 0.22 * Math.sin(t * 2 + f.p)})`);
  if (reduceMotion) return;
  for (const l of leaves) {
    const x = (l.x + Math.sin(t * 0.8 + l.p) * 0.03) * W, y = l.y * H, s = 7 * DPR * l.s;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.sin(t * 1.5 + l.p) * 1.2);
    ctx.fillStyle = l.c; ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * 0.45, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

/* ---- Xalaqit oynachasi: raqib ko‘rinishi (tepada kichik ekran) ---- */
const PIP_MAX = 2, PIP_R = 3.3, PIP_TILES = 5.2;
const PIP_REFL = 4;   // ko‘zgu qaytargani oynachada shuncha soniya ko‘rinadi
const PIP_SIM = { freeze: 8, glue: 20, scramble: 30, bandit: 12, fogbomb: 5, swap: 3.5, amnesia: AMNESIA_S, refl: PIP_REFL, flip: FLIP_S, mask: MASK_S, liar: LIAR_S, shut: SHUT_S, kmove: 3, steal: 3, sic: 14, chaos: 3.5, bomb: BOMB_S };   // onlayn raqibda ta’sir muddati (u yerdagi haqiqiy qiymatlarga mos)
const banditOn = (q) => G.beasts.some((b) => BEASTS[b.type].bandit && (b.state === 'chase' || b.state === 'charge') && b.target === q.id);
// Raqibning hozirgi holati. Shu qurilmadagi (bot) raqib — haqiqiy holat; onlayn raqib — joyi presence'dan, ta’sirlari yuborilgan sehrdan hisoblanadi.
function pipView(pp) {
  const T0 = G.time, fx = pp.fx, left = (k) => { const f = fx[k]; return f && !f.wait ? Math.max(0, f.at + PIP_SIM[k] - T0) : 0; };
  if (pp.q) {
    const a = pp.q;
    if (!G.players.includes(a)) return null;
    for (const k of Object.keys(fx)) if (fx[k].wait && !a.fxq.some((f) => f.kind === k)) { fx[k].wait = false; fx[k].at = T0; }   // band edi, endi tegdi
    const rp = renderPos(a);
    return { actor: a, kind: 'player', x: rp.x, y: rp.y, lift: rp.lift, alive: a.alive, frozen: a.frozen, slow: a.slow, scramble: a.scramble, stun: a.stun, jail: a.jail,
      bandit: a.alive && banditOn(a), wait: a.alive && a.fxq.length > 0, fog: left('fogbomb'), swap: left('swap'), amnesia: a.amnesia, refl: left('refl'),
      bomb: a.bomb, flip: a.flip, mask: a.mask, liar: a.liar, shut: a.shutT, kmove: left('kmove'), steal: left('steal'), sic: a.alive && G.vans.some((v) => v.target === a.id) ? 1 : 0 };
  }
  const r = G.remotes.get(pp.rkey);
  if (!r || r.rx === undefined) return null;
  if (pp.dc !== undefined && (pp.dc !== r.deaths || !r.alive)) for (const k of Object.keys(fx)) delete fx[k];   // halok bo‘ldi: hamma ta’sir yo‘qoladi
  pp.dc = r.deaths;
  const ac = pp.actor || (pp.actor = { id: 10, cloak: 0, hurtT: 0, tele: null, slide: null, card: null, bot: false, stunIcon: '', stun: 0 });
  Object.assign(ac, { name: r.name, look: r.look, color: r.color, peer: r.peer, isBot: r.isBot, face: r.face, moving: r.moving, alive: r.alive, jail: r.jail, frozen: left('freeze'), slow: left('glue'), scramble: left('scramble'), disguise: r.disguise, bm: r.bm });
  return { actor: ac, kind: 'remote', x: r.rx, y: r.ry, lift: 0, alive: r.alive, frozen: ac.frozen, slow: ac.slow, scramble: ac.scramble, stun: 0, jail: r.jail,
    bandit: left('bandit') > 0, wait: false, fog: left('fogbomb'), swap: left('swap'), amnesia: left('amnesia'), refl: left('refl'),
    bomb: r.bm, flip: left('flip'), mask: left('mask'), liar: left('liar'), shut: left('shut'), kmove: left('kmove'), steal: left('steal'), sic: left('sic') };
}
// Faqat raqib atrofidagi yaqin joy (uning o‘z yorug‘ligi kabi); darvoza sir qolishi uchun devor bo‘lib ko‘rinadi, topilmalar chizilmaydi.
function drawTilesLite(V, t, cx, cy) {
  const { ts, ox, oy } = V, N = G.N, g = G.g, R2 = (PIP_R + 1) * (PIP_R + 1);
  const ya = Math.max(0, V.y0), yb = Math.min(N - 1, V.y1), xa = Math.max(0, V.x0), xb = Math.min(N - 1, V.x1);
  const wall = (j) => g[j] === T.WALL || g[j] === T.EXIT;
  for (let y = ya; y <= yb; y++) {
    const sy = oy + y * ts;
    for (let x = xa; x <= xb; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) > R2) continue;
      const i = y * N + x, sx = ox + x * ts, tt = g[i], h = hash2(x, y);
      if (tt === T.WALL || tt === T.EXIT) {
        ctx.drawImage(SPR.hedge[h % 13 < 11 ? h & 3 : 4 + (h & 1)], sx, sy);
        if (y < N - 1 && !wall(i + N)) ctx.drawImage(SPR.face, sx, sy + ts - SPR.face.height);
      } else if (tt === T.PATH || tt === T.PORTAL) {
        ctx.drawImage(SPR.stone[h & 3], sx, sy);
        if (y > 0 && wall(i - N)) ctx.drawImage(SPR.shT, sx, sy);
        if (wall(i - 1)) ctx.drawImage(SPR.shL, sx, sy);
        if (wall(i + 1)) ctx.drawImage(SPR.shR, sx, sy);
        if (tt === T.PORTAL) drawPortal(sx, sy, ts, t);
      } else if (tt === T.CHASM || tt === T.RIVER) {
        const isC = tt === T.CHASM, horiz = g[i - 1] !== T.WALL || g[i + 1] !== T.WALL;
        ctx.drawImage(isC ? SPR.pit : SPR.water, sx, sy);
        if (!isC) drawRipples(sx, sy, ts, t, horiz, h);
        const set = isC ? SPR.rim : SPR.bank;
        if (g[i - 1] === T.PATH) ctx.drawImage(set.l, sx, sy);
        if (g[i + 1] === T.PATH) ctx.drawImage(set.r, sx, sy);
        if (g[i - N] === T.PATH) ctx.drawImage(set.t, sx, sy);
        if (g[i + N] === T.PATH) ctx.drawImage(set.b, sx, sy);
      } else if (tt === T.ENTRY) ctx.drawImage(SPR.gate, sx, sy);
    }
  }
}
// Boshqaruv aralashganda: boshi uzra aylanib, o‘rnini almashtirib turadigan strelkalar.
function drawScrambleFx(x, y, ts, t) {
  const ar = ['↑', '→', '↓', '←'], sh = Math.floor(t * 3);
  ctx.save();
  ctx.font = `900 ${Math.max(10, Math.round(ts * 0.34))}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, ts * 0.07); ctx.strokeStyle = 'rgba(30,10,40,0.9)';
  for (let k = 0; k < 4; k++) {
    const a = t * 2.6 + (k * Math.PI) / 2, ax = x + Math.cos(a) * ts * 0.66, ay = y - ts * 0.62 + Math.sin(a) * ts * 0.3, ch = ar[(k + sh) % 4];
    ctx.fillStyle = `hsl(${300 + k * 18},90%,76%)`; ctx.strokeText(ch, ax, ay); ctx.fillText(ch, ax, ay);
  }
  ctx.restore();
}
// Akleroz: boshi uzra aylanuvchi so‘roq belgilari.
function drawQuestionFx(x, y, ts, t) {
  ctx.save();
  ctx.font = `900 ${Math.max(10, Math.round(ts * 0.36))}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = Math.max(2, ts * 0.07); ctx.strokeStyle = 'rgba(25,15,45,0.9)';
  for (let k = 0; k < 4; k++) {
    const a = t * 1.9 + (k * Math.PI) / 2, ax = x + Math.cos(a) * ts * 0.66, ay = y - ts * 0.62 + Math.sin(a) * ts * 0.3;
    ctx.fillStyle = `hsl(${250 + k * 20},85%,80%)`; ctx.strokeText('?', ax, ay); ctx.fillText('?', ax, ay);
  }
  ctx.restore();
}
function renderPip(pp, vm, X, Y, W, H, t, dt) {
  const ts = SPR.ts, k = W / (PIP_TILES * ts), w = W / k, h = H / k, N = G.N;
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip();
  ctx.translate(X, Y); ctx.scale(k, k);
  ctx.fillStyle = '#0c1510'; ctx.fillRect(0, 0, w, h);
  if (!pp.cam || Math.abs(vm.x - pp.cam.x) + Math.abs(vm.y - pp.cam.y) > 6) pp.cam = { x: vm.x, y: vm.y };
  else { const kk = 1 - Math.exp(-dt * 10); pp.cam.x += (vm.x - pp.cam.x) * kk; pp.cam.y += (vm.y - pp.cam.y) * kk; }
  const ox = Math.round(w / 2 - (pp.cam.x + 0.5) * ts), oy = Math.round(h * 0.6 - (pp.cam.y + 0.5) * ts);   // oldida pufak uchun joy qolsin
  const V = { ts, ox, oy, W: w, H: h, x0: Math.floor(-ox / ts) - 1, y0: Math.floor(-oy / ts) - 1, x1: Math.ceil((w - ox) / ts), y1: Math.ceil((h - oy) / ts) };
  drawTilesLite(V, t, vm.x, vm.y);
  const R2 = (PIP_R + 0.8) * (PIP_R + 0.8), near = (a, b) => (a - vm.x) * (a - vm.x) + (b - vm.y) * (b - vm.y) <= R2, list = [{ kind: vm.kind, q: vm.actor, rp: { x: vm.x, y: vm.y, lift: vm.lift }, n: 1 }];
  for (const q of G.players) if (q !== vm.actor && !q.finished) { const rp = renderPos(q); if (near(rp.x, rp.y)) list.push({ kind: 'player', q, rp, n: 1 }); }
  for (const r of remoteList()) if (!r.fin && r !== G.remotes.get(pp.rkey) && near(r.rx, r.ry)) list.push({ kind: 'remote', q: r, rp: { x: r.rx, y: r.ry, lift: 0 }, n: 1 });
  for (const b of G.beasts) {
    const f = b.state === 'rest' ? 1 : clamp(b.acc / beastMs(b), 0, 1), bx = lerp(b.fx, b.x, f), by = lerp(b.fy, b.y, f);
    if (near(bx, by)) list.push({ kind: 'beast', b, rp: { x: bx, y: by } });
  }
  list.sort((a, b) => a.rp.y - b.rp.y);
  for (const e of list) {
    if (e.kind === 'beast') { drawBeast(e, V, t); continue; }
    drawActor(e, ox + (e.rp.x + 0.5) * ts, oy + (e.rp.y + 0.5) * ts + ts * 0.3, ts, t, true, null, false);
  }
  for (const v of G.vans) {   // raqibni quvayotgan ovchi
    if (G.players[v.target] !== vm.actor || !near(v.x, v.y)) continue;
    const f = clamp(v.acc / v.step, 0, 1), vx = ox + (lerp(v.fx, v.x, f) + 0.5) * ts, vy = oy + (lerp(v.fy, v.y, f) + 0.5) * ts + ts * 0.3;
    const dx = vm.x - v.x, dy = vm.y - v.y;
    glowAt(vx, vy - ts * 0.3, ts * 1.2, `rgba(255,60,40,${0.4 * (0.6 + 0.4 * Math.sin(t * 8))})`);
    drawShadow(ctx, vx, vy, ts, 0, 'rgba(255,60,40,0.8)');
    drawPerson(ctx, vx, vy, ts * 1.15, VAN_LOOK, { dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy < 0 ? 'up' : 'down', moving: true, ph: t * 14 });
  }
  const cx = ox + (vm.x + 0.5) * ts, cy = oy + (vm.y + 0.5) * ts;
  if (vm.alive && vm.scramble > 0) { drawScrambleFx(cx, cy + ts * 0.3, ts, t); drawBubble(cx, cy - ts * 1.55, ts, '🎮', t); }
  else if (vm.alive && vm.amnesia > 0) { drawQuestionFx(cx, cy + ts * 0.3, ts, t); drawBubble(cx, cy - ts * 1.55, ts, '🧠', t); }
  else if (vm.alive && vm.flip > 0) drawBubble(cx, cy - ts * 1.55, ts, '🙃', t);
  else if (vm.alive && vm.liar > 0) drawBubble(cx, cy - ts * 1.55, ts, '🥴', t);
  else if (vm.alive && vm.kmove > 0) drawBubble(cx, cy - ts * 1.55, ts, '🔑', t);
  else if (vm.alive && vm.steal > 0) drawBubble(cx, cy - ts * 1.55, ts, '🤏', t);
  else if (vm.alive && vm.shut > 0) drawBubble(cx, cy - ts * 1.55, ts, '🏪', t);
  else if (vm.alive && vm.sic > 0) drawBubble(cx, cy - ts * 1.55, ts, '🚐', t);
  if (vm.alive && vm.refl > 0) drawMirror(cx, cy + ts * 0.3, ts, t, 99);
  if (vm.alive && vm.bandit && !vm.jail) drawBubble(cx, cy - ts * 1.55, ts, '📯', t);
  if (vm.alive && vm.wait) drawBubble(cx, cy - ts * 1.55, ts, '⏳', t);
  // ularning yorug‘ligi: atrofi yorug‘, chetlari qorong‘u
  const gr = ctx.createRadialGradient(cx, cy, ts * 0.7, cx, cy, ts * (PIP_R + 0.2));
  gr.addColorStop(0, 'rgba(2,6,4,0)'); gr.addColorStop(0.65, 'rgba(2,6,4,0.3)'); gr.addColorStop(1, 'rgba(2,6,4,0.96)');
  ctx.fillStyle = gr; ctx.fillRect(0, 0, w, h);
  glowAt(cx, cy, ts * (PIP_R - 0.4), 'rgba(255,170,80,0.10)');
  if (vm.alive && vm.frozen > 0) {
    ctx.fillStyle = 'rgba(130,200,255,0.16)'; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(215,242,255,0.8)'; ctx.lineWidth = ts * 0.14; ctx.strokeRect(ts * 0.07, ts * 0.07, w - ts * 0.14, h - ts * 0.14);
  }
  if (vm.fog > 0) {   // tuman bombasi: ko‘rinish yana tumanga burkanadi
    const a = Math.min(1, vm.fog / 1.2);
    ctx.fillStyle = `rgba(118,148,134,${0.4 * a})`; ctx.fillRect(0, 0, w, h);
    for (let k = 0; k < 7; k++) {
      const bx = ((t * (12 + k * 5) + k * w * 0.37) % (w + ts * 4)) - ts * 2, by = h * (0.12 + 0.76 * ((k * 0.381) % 1)) + Math.sin(t * 0.9 + k) * ts * 0.4, rad = ts * (1.1 + (k % 3) * 0.35);
      const fg = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
      fg.addColorStop(0, `rgba(196,214,203,${0.66 * a})`); fg.addColorStop(1, 'rgba(196,214,203,0)');
      ctx.fillStyle = fg; ctx.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
    }
  }
  if (vm.swap > 0) {
    const f = 1 - vm.swap / PIP_SIM.swap, a = Math.max(0, 1 - f * 1.4);
    ctx.strokeStyle = `rgba(190,160,255,${a})`; ctx.lineWidth = ts * 0.12;
    ctx.beginPath(); ctx.arc(cx, cy, ts * (0.3 + f * 2.2), 0, TAU); ctx.stroke();
  }
  ctx.restore();
}
function renderPips(t, dt) {
  const m = viewers[0];
  if (!m || !m.pips || !m.pips.length || !m.ui || (G.mode !== 'play' && G.mode !== 'paused')) return;
  for (const pp of m.pips) {
    if (!pp.el) continue;
    const vm = pipView(pp);
    if (!vm) continue;
    const el = pp.el.view, r = el.getBoundingClientRect(), bw = el.clientLeft || 0;
    const X = Math.round((r.left + bw) * DPR), Y = Math.round((r.top + bw) * DPR), W = Math.round((r.width - 2 * bw) * DPR), H = Math.round((r.height - 2 * bw) * DPR);
    if (W < 24 || H < 24) continue;
    if (document.body.classList.contains('flip')) {   // ekran teskari bo‘lsa, oynacha ham teskari chiziladi (CSS uni yana ag‘daradi)
      ctx.save(); ctx.translate(cv.width, cv.height); ctx.rotate(Math.PI);
      renderPip(pp, vm, X, Y, W, H, t, dt);
      ctx.restore();
    } else renderPip(pp, vm, X, Y, W, H, t, dt);
  }
}

function renderVP(p, t, dt) {
  const X = Math.round(p.vp.x * DPR), Y = Math.round(p.vp.y * DPR), W = Math.round(p.vp.w * DPR), H = Math.round(p.vp.h * DPR);
  if (W < 4 || H < 4) return;
  ctx.save();
  ctx.beginPath(); ctx.rect(X, Y, W, H); ctx.clip(); ctx.translate(X, Y);
  ctx.fillStyle = '#0c1510'; ctx.fillRect(0, 0, W, H);
  const ts = SPR.ts, rp = renderPos(p);
  const k = 1 - Math.exp(-dt * 10);
  p.cam.x += (rp.x - p.cam.x) * k; p.cam.y += (rp.y - p.cam.y) * k;
  let shx = 0, shy = 0;
  if (p.shake > 0) { p.shake = Math.max(0, p.shake - dt); shx = (Math.random() - 0.5) * p.shake * ts * 0.6; shy = (Math.random() - 0.5) * p.shake * ts * 0.6; }
  const ox = Math.round(W / 2 - (p.cam.x + 0.5) * ts + shx), oy = Math.round(H / 2 - (p.cam.y + 0.5) * ts + shy);
  const V = { ts, ox, oy, W, H, p, x0: Math.floor(-ox / ts) - 1, y0: Math.floor(-oy / ts) - 1, x1: Math.ceil((W - ox) / ts), y1: Math.ceil((H - oy) / ts) };
  drawTiles(V, t);
  if (FXQ.dapple) drawDapple(V, t);
  drawPTraps(V, t);
  drawEntities(V, t);
  drawParts(V);
  const pcx = ox + (rp.x + 0.5) * ts, pcy = oy + (rp.y + 0.5) * ts;
  drawLight(V, pcx, pcy, t);
  drawFog(V, t);
  drawMarks(V, t);
  drawRadar(V, t);
  if (V.p.look === 1) drawSense(V, t);
  drawWalls(V, t);
  drawExitBeacon(V, t);
  drawBeastEyes(V, t);
  drawVans(V, t);
  drawCompass(V, pcx, pcy, t);
  drawPops(V, t);
  drawFloats(V);
  drawAmbient(V, t);
  if (FXQ.vignette) drawVignette(V);
  ctx.restore();
}
// Post-effekt: chekkalari qorong‘i vinyetka + yengil iliq rang (telefonda arzon: bitta gradient)
let vigCache = null;
function drawVignette(V) {
  const { W, H } = V;
  if (!vigCache || vigCache.width !== W || vigCache.height !== H) {
    vigCache = makeCanvas(W, H); const g = vigCache.getContext('2d');
    const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,0.5)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter'; g.fillStyle = 'rgba(60,40,10,0.06)'; g.fillRect(0, 0, W, H);
  }
  ctx.drawImage(vigCache, 0, 0);
}
function render(t, dt) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  ctx.fillStyle = '#0c1510'; ctx.fillRect(0, 0, cv.width, cv.height);
  if (!G.g || !SPR.ts) return;
  for (const p of viewers) renderVP(p, t, dt);
  renderPips(t, dt);
}

/* ---- mini xarita (har o‘yinchiga o‘ziniki) ---- */
function mmColor(p, i) {
  const t = G.g[i];
  if (t === T.WALL) return [28, 62, 38];
  if (t === T.CHASM) return [6, 6, 6];
  if (t === T.RIVER) return [45, 110, 125];
  if (t === T.EXIT) return [245, 196, 80];
  if (t === T.ENTRY) return [140, 92, 45];
  if (t === T.PORTAL) return [160, 100, 255];
  if (G.coin[i]) return [255, 196, 0];
  if (G.keyAt[i] === p.keySlot && !p.gkey) return [90, 220, 255];
  if (G.keyAt[i] >= 0 && G.keyLive[G.keyAt[i]]) return [230, 110, 90];
  if (G.item[i] >= 0) return [255, 225, 120];
  if (G.chest[i] && !p.spent[i]) return [255, 180, 60];
  if (G.trap[i] >= 0 && p.spent[i]) return [228, 104, 60];
  if (p.visited[i]) return [236, 220, 170];
  return [150, 140, 112];
}
function mmSet(p, i) {
  const m = p.mm;
  if (!m) return;
  const d = m.img.data, k = i * 4;
  if (!p.explored[i]) d[k + 3] = 0;
  else { const c = mmColor(p, i); d[k] = c[0]; d[k + 1] = c[1]; d[k + 2] = c[2]; d[k + 3] = 255; }
  m.dirty = true;
}
function mmSetAll(i) { for (const p of G.players) if (p.explored[i]) mmSet(p, i); }
function mmInit(p) {
  const base = makeCanvas(G.N, G.N);
  p.mm = { base, img: base.getContext('2d').createImageData(G.N, G.N), dirty: true };
  for (let i = 0; i < G.N * G.N; i++) if (p.explored[i]) mmSet(p, i);
}
function drawMinimap(p, t) {
  const c = p.ui && p.ui.map;
  if (!c || c.hidden || !p.mm) return;
  const m = p.mm;
  if (m.dirty) { m.base.getContext('2d').putImageData(m.img, 0, 0); m.dirty = false; }
  const g = p.ui.mapCtx, sz = c.width, sc = sz / G.N;
  g.fillStyle = '#0a110c'; g.fillRect(0, 0, sz, sz);
  g.imageSmoothingEnabled = false;
  g.drawImage(m.base, 0, 0, sz, sz);
  const pr = Math.max(2.2 * DPR, sc * 1.1);
  const dot = (x, y, col, ring) => {
    g.fillStyle = col; g.beginPath(); g.arc((x + 0.5) * sc, (y + 0.5) * sc, pr, 0, TAU); g.fill();
    if (ring) { g.strokeStyle = `rgba(255,255,255,${0.5 + 0.4 * Math.sin(t * 5)})`; g.lineWidth = DPR; g.beginPath(); g.arc((x + 0.5) * sc, (y + 0.5) * sc, pr * 2.2, 0, TAU); g.stroke(); }
  };
  if (p.amnesia > 0) {   // akleroz: xarita bo‘m-bo‘sh, faqat o‘zing
    g.fillStyle = 'rgba(220,200,255,0.8)'; g.font = `800 ${Math.round(sz * 0.12)}px "Alegreya Sans", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('🧠 ' + Math.ceil(p.amnesia), sz / 2, sz * 0.12);
    const rp0 = renderPos(p); dot(rp0.x, rp0.y, p.color, true);
    return;
  }
  for (const q of G.players) if (q !== p && q.alive && !q.finished) dot(q.px, q.py, q.color, false);
  for (const r of remoteList()) if (r.alive && !r.fin) dot(r.x, r.y, r.color, false);
  for (const v of G.vans) if (G.players[v.target] === p) dot(v.x, v.y, '#ff2a1a', false);
  if (p.knowChest && !(p.liar > 0)) for (const i of G.chestCells) if (!p.spent[i]) dot(i % G.N, (i / G.N) | 0, '#ffaa28', false);   // xazina xaritasi
  if (p.knowKey && !(p.liar > 0) && !p.gkey && G.keyCells[p.keySlot] >= 0) { const i = G.keyCells[p.keySlot]; dot(i % G.N, (i / G.N) | 0, '#7fe1ff', true); }   // kalit xaritasi
  for (const tr of G.ptraps) if (tr.owner === p) dot(tr.cell % G.N, (tr.cell / G.N) | 0, '#e7b3ff', false);   // o‘zing qo‘ygan tuzoqlar
  for (const tr of G.ptraps) if (tr.kind === 'tbait' && tr.owner !== p && p.explored[tr.cell]) dot(tr.cell % G.N, (tr.cell / G.N) | 0, '#ffc400', false);   // soxta tanga — boshqalarga pul xaltasi
  for (const r of G.rptraps) if (r.kind === 'tbait' && p.explored[r.cell]) dot(r.cell % G.N, (r.cell / G.N) | 0, '#ffc400', false);
  const rp = renderPos(p);
  dot(rp.x, rp.y, p.color, true);
}

/* ================= O‘yin mantig‘i ================= */
function drawPTraps(V, t) {
  const { ts, ox, oy, p } = V, N = G.N;
  const baits = [];   // soxta tanga: boshqalarga haqiqiy pul xaltasiga o‘xshab ko‘rinadi (faqat o‘zing ochgan joylarda)
  for (const tr of G.ptraps) if (tr.kind === 'tbait' && tr.owner !== p) baits.push(tr.cell);
  for (const r of G.rptraps) if (r.kind === 'tbait') baits.push(r.cell);
  for (const cell of baits) {
    if (!p.explored[cell]) continue;
    const gx = cell % N, gy = (cell / N) | 0, sx = ox + gx * ts, sy = oy + gy * ts;
    if (sx < -ts || sx > V.W + ts || sy < -ts || sy > V.H + ts) continue;
    const h = hash2(gx, gy), bob = Math.sin(t * 3 + (h & 7)) * ts * 0.05, sp = SPR.coin;
    glowAt(sx + ts / 2, sy + ts / 2, ts * 0.5, `rgba(255,200,70,${0.3 + 0.12 * Math.sin(t * 4 + h)})`);
    ctx.drawImage(sp, sx + (ts - sp.width) / 2, sy + (ts - sp.height) / 2 - ts * 0.06 + bob);
  }
  for (const tr of G.ptraps) {
    if (tr.owner !== p) continue;
    const x = ox + ((tr.cell % N) + 0.5) * ts, y = oy + (((tr.cell / N) | 0) + 0.5) * ts;
    if (x < -ts || x > V.W + ts || y < -ts || y > V.H + ts) continue;
    const pulse = 0.5 + 0.5 * Math.sin(t * 3 + tr.id), spr = popSprite(PTRAPS[tr.kind].icon), k = (ts * 0.78) / spr.width;
    ctx.save();
    ctx.strokeStyle = `rgba(231,179,255,${0.3 + 0.4 * pulse})`; ctx.lineWidth = Math.max(1.5, ts * 0.05); ctx.setLineDash([ts * 0.12, ts * 0.1]);
    ctx.beginPath(); ctx.arc(x, y, ts * (0.38 + 0.05 * pulse), 0, TAU); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.drawImage(spr, x - (spr.width * k) / 2, y - (spr.height * k) / 2, spr.width * k, spr.height * k);
    ctx.restore();
  }
}


// Radar: yaqin atrofdagi begona yashirin tuzoqlar belgilanadi (tumanda ham ko‘rinadi).
const RADAR_R = 9;
// Ovchi qiz: 2 katak ichidagi yashirin tuzoqlar yonib turadi.
function drawSense(V, t) {
  const { ts, ox, oy, p } = V, N = G.N, spr = popSprite('⚠️'), k = (ts * 0.6) / spr.width;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
    const x = p.px + dx, y = p.py + dy;
    if (x < 0 || y < 0 || x >= N || y >= N) continue;
    const i = y * N + x;
    if (G.trap[i] < 0 || p.spent[i] || !p.explored[i]) continue;
    const cx = ox + (x + 0.5) * ts, cy = oy + (y + 0.5) * ts;
    glowAt(cx, cy, ts * 0.7, `rgba(255,170,60,${0.25 + 0.2 * Math.sin(t * 5 + i)})`);
    ctx.drawImage(spr, cx - (spr.width * k) / 2, cy - (spr.height * k) / 2, spr.width * k, spr.height * k);
  }
}
function drawRadar(V, t) {
  const { ts, ox, oy, p } = V, N = G.N;
  if (!(p.radar > 0)) return;
  const rp = renderPos(p), cx = ox + (rp.x + 0.5) * ts, cy = oy + (rp.y + 0.5) * ts, sw = (t * 0.7) % 1;
  ctx.save();
  ctx.strokeStyle = `rgba(150,255,190,${0.5 * (1 - sw)})`; ctx.lineWidth = Math.max(1.5, ts * 0.06);
  ctx.beginPath(); ctx.arc(cx, cy, ts * RADAR_R * sw, 0, TAU); ctx.stroke();
  const list = [];
  for (const tr of G.ptraps) if (tr.owner !== p) list.push(tr.cell);
  for (const r of G.rptraps) list.push(r.cell);
  const spr = popSprite('⚠️');
  for (const cell of list) {
    const gx = cell % N, gy = (cell / N) | 0;
    if (Math.hypot(gx - rp.x, gy - rp.y) > RADAR_R) continue;
    const x = ox + (gx + 0.5) * ts, y = oy + (gy + 0.5) * ts, pulse = 0.5 + 0.5 * Math.sin(t * 6 + cell), k = (ts * 0.85) / spr.width;
    glowAt(x, y, ts * 0.9, `rgba(255,70,60,${0.35 + 0.3 * pulse})`);
    ctx.drawImage(spr, x - (spr.width * k) / 2, y - (spr.height * k) / 2, spr.width * k, spr.height * k);
  }
  ctx.restore();
}

/* ---- Teleport tuzog‘ining manzilini tanlash: xaritada faqat o‘zing ochgan joylar tanlanadi ---- */
function drawWalls(V, t) {
  const { ts, ox, oy, p } = V, N = G.N, spr = popSprite('🚧');
  const cells = G.walls.map((w) => w.cell).concat(G.rwalls.map((w) => w.cell));
  for (const cell of cells) {
    if (!p.explored[cell]) continue;
    const gx = cell % N, gy = (cell / N) | 0, x = ox + (gx + 0.5) * ts, y = oy + (gy + 0.5) * ts;
    if (x < -ts || x > V.W + ts || y < -ts || y > V.H + ts) continue;
    const k = (ts * 1.05) / spr.width;
    ctx.drawImage(spr, x - (spr.width * k) / 2, y - (spr.height * k) / 2 - ts * 0.05 + Math.sin(t * 3 + cell) * ts * 0.01, spr.width * k, spr.height * k);
  }
}
// Botlar ham devor qo‘yadi: orqasida raqib kelayotgan bo‘lsa, to‘xtagan zahoti o‘zi o‘tib kelgan yo‘lakni to‘sadi.
function drawBomb(x, y, ts, t, secs) {
  const hot = secs <= 8, pulse = 0.5 + 0.5 * Math.sin(t * (hot ? 14 : 6)), spr = popSprite('💣'), k = (ts * 0.74 * (1 + 0.08 * pulse)) / spr.width;
  glowAt(x, y, ts * 0.95, `rgba(255,${hot ? 40 : 140},30,${0.25 + 0.35 * pulse})`);
  ctx.drawImage(spr, x - (spr.width * k) / 2, y - (spr.height * k) / 2, spr.width * k, spr.height * k);
  ctx.save();
  ctx.font = `900 ${Math.round(ts * 0.34)}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = ts * 0.08; ctx.strokeStyle = 'rgba(30,5,5,.9)'; ctx.fillStyle = hot ? '#ff8a7a' : '#ffe7a6';
  const txt = String(Math.ceil(secs)); ctx.strokeText(txt, x, y + ts * 0.03); ctx.fillText(txt, x, y + ts * 0.03);
  ctx.restore();
}

/* ---- Duel: yaqin turgan ikki o‘yinchi 10 soniya bosish jangi — ko‘p bosgan yutadi (botlar bilan ham, onlayn do‘st bilan ham) ---- */
function drawSay(x, y, ts, say, t) {
  const left = say.until - G.time;
  if (left <= 0) return;
  const text = say.text || SAYS[say.i] || '', fs = Math.max(11, Math.round(ts * 0.3));
  ctx.save();
  ctx.font = `800 ${fs}px "Alegreya Sans", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + fs * 1.2, h = fs * 1.9, by = y - Math.sin(t * 4) * ts * 0.01;
  ctx.globalAlpha = clamp(left / 0.5, 0, 1);
  ctx.fillStyle = 'rgba(252,246,228,0.97)'; ctx.strokeStyle = 'rgba(60,40,20,0.85)'; ctx.lineWidth = Math.max(1, ts * 0.03);
  rr(ctx, x - w / 2, by - h, w, h, h * 0.42); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - fs * 0.4, by - 1); ctx.lineTo(x - fs * 0.05, by + fs * 0.6); ctx.lineTo(x + fs * 0.35, by - 1); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(252,246,228,0.97)'; ctx.fillRect(x - fs * 0.38, by - 2.5, fs * 0.72, 3);
  ctx.fillStyle = '#2a1a0c'; ctx.fillText(text, x, by - h / 2 + 1);
  ctx.restore();
}

/* ================= Ovozli suhbat (mikrofon): gaplashib o‘ynash ================= */
// Ovoz hech qaysi serverdan o‘tmaydi: har bir juft o‘yinchi orasida to‘g‘ridan-to‘g‘ri WebRTC aloqasi ochiladi.
// Aloqani kelishish (signal) xonaning alohida «ovoz» xonasida (jv-<kod>) presence orqali almashadi — o‘yin holatiga halal bermaydi.
// Mikrofon bloklangan bo‘lsa ham «faqat eshitish» rejimida boshqalarni eshitsa bo‘ladi.
function resize() {
  DPR = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.max(1, Math.round(innerWidth * DPR)), h = Math.max(1, Math.round(innerHeight * DPR));
  if (cv.width !== w) cv.width = w;
  if (cv.height !== h) cv.height = h;
  const fw = Math.ceil(w / 2) + 2, fh = Math.ceil(h / 2) + 2;
  if (fogL.width !== fw) fogL.width = fw;
  if (fogL.height !== fh) fogL.height = fh;
  const mistSize = Math.round(280 * DPR);
  if (!SPR.mist || SPR.mist.width !== mistSize) SPR.mist = mistSprite(mistSize);
  SPR.ts = 0;
  layout();
}
export { cv, ctx, fogL, fctx, fogLow, flctx, fogImg, DPR, SPR, makeCanvas, rr, EMOJI_FONT, drawPerson, drawShadow, drawTomb, avaCache, avatarURL, stoneSprite, hedgeSprite, faceSprite, shadeSprite, tuftSprite, pitSprite, rimSprite, waterSprite, footSprite, emojiSprite, gateSprite, exitSprite, lockedExitSprite, FXQ, dappleSprite, drawDapple, mistSprite, buildSprites, popSprite, renderPos, faceName, lightRadius, drawRipples, drawCroc, drawPortal, glowAt, gateSide, nearestGate, drawTiles, beastMs, beastMs0, beastVisible, drawEntities, drawActor, drawMasked, drawMirror, drawSpeak, drawIce, drawCage, drawBubble, drawBeast, drawBeastEyes, drawVans, drawLight, drawFog, drawExitBeacon, drawMarks, drawCompass, PART, CONF, emit, floatText, updateParts, drawParts, drawFloats, drawPops, flies, leaves, updateAmbient, drawAmbient, PIP_MAX, PIP_R, PIP_TILES, PIP_REFL, PIP_SIM, banditOn, pipView, drawTilesLite, drawScrambleFx, drawQuestionFx, renderPip, renderPips, renderVP, vigCache, drawVignette, render, mmColor, mmSet, mmSetAll, mmInit, drawMinimap, drawPTraps, RADAR_R, drawSense, drawRadar, drawWalls, drawBomb, drawSay, resize };
