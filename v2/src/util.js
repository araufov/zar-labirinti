// Yordamchilar: DOM qisqartmasi, matematik va formatlash funksiyalari, tasodif generatori. Hech narsaga bog‘liq emas.
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const TAU = Math.PI * 2;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash2(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
const reduceMotion = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const touchUI = !!(window.matchMedia && matchMedia('(hover: none), (pointer: coarse)').matches);
const fmtTime = (s) => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
const fmtDist = (m) => (m >= 1000 ? (m / 1000).toFixed(2).replace('.', ',') + ' km' : Math.round(m) + ' m');
const fmtPct = (p) => (p < 10 ? p.toFixed(1).replace('.', ',') : String(Math.round(p))) + '%';
const randSeed = () => 100000 + ((Math.random() * 900000) | 0);
const pickRand = (arr) => arr[(Math.random() * arr.length) | 0];
const shuffle = (arr) => { for (let k = arr.length - 1; k > 0; k--) { const j = (Math.random() * (k + 1)) | 0; const t = arr[k]; arr[k] = arr[j]; arr[j] = t; } return arr; };

/* ================= Dunyo ================= */
export { $, clamp, lerp, TAU, mulberry32, hash2, reduceMotion, touchUI, fmtTime, fmtDist, fmtPct, randSeed, pickRand, shuffle };
