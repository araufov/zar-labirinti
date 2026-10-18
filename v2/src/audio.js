// AudioManager: Web Audio sintezi (Sound), kompressor+reverb zanjiri, fon ovozi, baraban (xavf) ritmi, tebranish (buzz).
import { setChip } from './hud.js';
import { store } from './save.js';
import { G, me } from './state.js';
import { clamp } from './util.js';
const buzz = (ms) => { try { if (!Sound.muted && navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* yo'q */ } };
const Sound = {
  ctx: null, out: null, master: null, wet: null, amb: null, noise: null, muted: store.get('jl_mute') === '1', ambOn: store.get('jl_amb') !== '0', quiet: false, last: {}, asleep: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended' && !this.asleep) this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ac = this.ctx = new AC();
      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.18;
      this.master = ac.createGain(); this.master.gain.value = this.muted ? 0 : 0.85;
      comp.connect(this.master); this.master.connect(ac.destination);
      this.out = ac.createGain(); this.out.gain.value = 1; this.out.connect(comp);   // quruq signal
      // Reverb: sintez qilingan impuls (0.9 s, o‘rmon kabi yumshoq)
      const sr = ac.sampleRate, L = Math.floor(sr * 0.9), ir = ac.createBuffer(2, L, sr);
      for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < L; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / L, 2.6) * 0.6; }
      const conv = ac.createConvolver(); conv.buffer = ir;
      this.wet = ac.createGain(); this.wet.gain.value = 0.22;
      this.out.connect(conv); conv.connect(this.wet); this.wet.connect(comp);
      const len = sr, buf = ac.createBuffer(1, len, sr), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      this.ambient();
    } catch (e) { this.ctx = null; }
  },
  setMuted(m) {
    this.muted = m; store.set('jl_mute', m ? '1' : '0');
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.05);
  },
  // Sahifa fonga o‘tganda butun ovoz to‘xtaydi, qaytganda davom etadi
  sleep(on) {
    this.asleep = on;
    if (!this.ctx) return;
    if (on) this.ctx.suspend().catch(() => {}); else this.ctx.resume().catch(() => {});
  },
  gate(name, ms = 50) { const n = performance.now(); if (n - (this.last[name] || 0) < ms) return false; this.last[name] = n; return true; },
  // O‘rmon atrof-muhiti: shamol (filtrlangan shovqin + sekin LFO), chigirtkalar, ahyon-ahyonda qush
  ambient() {
    const ac = this.ctx; if (!ac || this.amb) return;
    const g = ac.createGain(); g.gain.value = 0; g.connect(this.out);
    const wind = ac.createBufferSource(); wind.buffer = this.noise; wind.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 260; lp.Q.value = 0.4;   // past, yumshoq shamol
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 90; lfo.connect(lg); lg.connect(lp.frequency);
    const wg = ac.createGain(); wg.gain.value = 0.035;
    wind.connect(lp); lp.connect(wg); wg.connect(g); wind.start(); lfo.start();
    this.amb = { g, t: 0 };
    const bird = () => {
      if (!this.amb) return;
      if (!this.muted && !this.asleep && this.ambOn && G.mode === 'play') {
        const f0 = 1800 + Math.random() * 1400, n = 2 + ((Math.random() * 3) | 0);
        for (let k = 0; k < n; k++) this.tone('sine', f0 + Math.random() * 300, f0 * (0.8 + Math.random() * 0.5), 0.12, 0.05, k * 0.14);
      }
      setTimeout(bird, 7000 + Math.random() * 14000);
    };
    setTimeout(bird, 4000);
    this.ambTick();
  },
  ambTick() {
    if (!this.amb) return;
    const on = this.ambOn && G.mode === 'play', m = me(), danger = on && m && (m.drumD <= 5.2 || G.beasts.some((b) => b.state === 'chase' && b.target === m.id));
    this.amb.g.gain.setTargetAtTime(on ? (danger ? 0.5 : 1) : 0, this.ctx.currentTime, 1.2);
    setTimeout(() => this.ambTick(), 500);
  },
  env(g, t, a, peak, dec) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
  },
  tone(type, f0, f1, dur, vol, when = 0, detune = 0) {
    if (!this.ctx || this.muted || this.quiet || this.asleep) return;
    const t = this.ctx.currentTime + when, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); if (detune) o.detune.value = detune;
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    this.env(g, t, 0.006, vol, dur);
    o.connect(g); g.connect(this.out);
    o.start(t); o.stop(t + dur + 0.05);
  },
  // Ikki tebratgichli «boy» ton: yengil detune, chiroyli jaranglaydi
  rich(type, f0, f1, dur, vol, when = 0) { this.tone(type, f0, f1, dur, vol * 0.6, when, -6); this.tone(type, f0, f1, dur, vol * 0.6, when, 6); },
  burst(dur, vol, freq, q, when = 0, type = 'bandpass') {
    if (!this.ctx || this.muted || this.quiet || this.asleep) return;
    const t = this.ctx.currentTime + when, s = this.ctx.createBufferSource(), f = this.ctx.createBiquadFilter(), g = this.ctx.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; f.Q.value = q;
    this.env(g, t, 0.003, vol, dur);
    s.connect(f); f.connect(g); g.connect(this.out);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  },
  drum(v = 1, p = 1, when = 0) { this.tone('sine', 150 * p, 48 * p, 0.42, 0.9 * v, when); this.burst(0.06, 0.35 * v, 900 * p, 0.8, when, 'lowpass'); },
  dice() { for (let i = 0; i < 9; i++) this.burst(0.03, 0.25, 2200 + Math.random() * 1800, 3, i * 0.075 + Math.random() * 0.03); },
  sting() { [110, 116.5, 164.8].forEach((f, i) => this.tone('sawtooth', f, f * 0.97, 1.1, 0.1, i * 0.02)); this.drum(1, 0.8); },
  roar() { this.tone('sawtooth', 95, 55, 0.9, 0.22); this.tone('square', 150, 70, 0.6, 0.05, 0.05); this.burst(0.7, 0.35, 380, 0.7, 0, 'lowpass'); },
  growl() { this.tone('sawtooth', 70, 55, 0.6, 0.08); this.burst(0.5, 0.12, 260, 0.6, 0, 'lowpass'); },
  hurt() { this.tone('triangle', 240, 70, 0.6, 0.5); this.burst(0.2, 0.4, 300, 0.7, 0, 'lowpass'); },
  boing() { this.tone('sine', 170, 560, 0.16, 0.22); this.tone('sine', 560, 150, 0.3, 0.2, 0.14); },
  sad() { [[233, 220], [220, 207], [207, 196], [196, 130]].forEach(([a, b], i) => this.tone('sawtooth', a, b, i === 3 ? 0.9 : 0.3, 0.1, i * 0.34)); },
  horn() { for (let k = 0; k < 2; k++) { this.tone('sawtooth', 440, 438, 0.35, 0.12, k * 0.45); this.tone('square', 444, 442, 0.35, 0.06, k * 0.45); } },
  cluck() { for (let k = 0; k < 4; k++) this.tone('square', 700 - k * 40, 380 - k * 20, 0.07, 0.07, k * 0.1); },
  fuse() { this.tone('square', 1400, 900, 0.04, 0.06); },
  boom() { this.burst(0.7, 0.5, 220, 0.6, 0, 'lowpass'); this.tone('sine', 120, 38, 0.6, 0.8); },
  jump() { this.tone('sine', 260, 720, 0.35, 0.25); this.burst(0.35, 0.18, 1200, 0.6); },
  splash() { this.burst(0.4, 0.3, 1800, 0.5); this.burst(0.25, 0.2, 700, 0.8, 0.05); },
  portal() { this.tone('sine', 280, 1300, 0.7, 0.2); this.tone('triangle', 620, 180, 0.7, 0.1, 0.12); this.burst(0.6, 0.12, 2400, 2); },
  rewind() { this.tone('sawtooth', 1100, 120, 1.1, 0.08); this.tone('sine', 880, 90, 1.1, 0.12, 0.1); },
  pickup() { [784, 988, 1319, 1568].forEach((f, i) => this.rich('triangle', f, 0, 0.3, 0.2, i * 0.06)); this.burst(0.05, 0.12, 6000, 1.5); },
  coin() { this.tone('sine', 2093, 0, 0.18, 0.18); this.tone('sine', 2637, 0, 0.32, 0.14, 0.05); this.burst(0.04, 0.1, 7000, 2); },
  ok() { [392, 523.25, 659.25].forEach((f, i) => this.rich('triangle', f, 0, 0.32, 0.22, i * 0.07)); },
  tap() { this.burst(0.035, 0.18, 1500, 2); this.tone('sine', 900, 500, 0.05, 0.08); },
  whoosh() { this.burst(0.28, 0.16, 900, 0.5, 0, 'bandpass'); this.burst(0.2, 0.1, 2400, 0.6, 0.05); },
  step(k) { this.burst(0.05, 0.07, k ? 700 : 560, 0.9, 0, 'lowpass'); },
  tick() { this.tone('square', 880, 0, 0.09, 0.1); },
  pad(k) { this.tone('triangle', [392, 523.25, 329.63, 261.63][k], 0, 0.35, 0.28); },
  win() {
    [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach((f, i) => this.rich('triangle', f, 0, 0.6, 0.26, i * 0.11));
    [[523.25, 659.25, 783.99], [587.33, 739.99, 880], [659.25, 783.99, 1046.5]].forEach((ch, i) => ch.forEach((f) => this.rich('sawtooth', f, 0, 0.9, 0.05, 0.7 + i * 0.32)));
    this.drum(1, 1, 0.7); this.drum(1, 1.5, 1.02);
  },
  lose() { [220, 185, 155, 110].forEach((f, i) => this.tone('sawtooth', f, f * 0.98, 0.7, 0.12, i * 0.28)); this.drum(1, 0.6); },
  bump() { this.burst(0.05, 0.12, 180, 0.7, 0, 'lowpass'); },
};

for (const k of ['sting', 'roar', 'growl', 'hurt', 'boing', 'sad', 'horn', 'cluck', 'boom', 'jump', 'splash', 'portal', 'rewind', 'pickup', 'coin', 'ok', 'tap', 'tick', 'win', 'lose', 'bump', 'whoosh', 'step', 'dice']) {
  const f = Sound[k]; Sound[k] = function (...a) { if (!this.gate(k, k === 'tick' || k === 'tap' ? 25 : 50)) return; return f.apply(this, a); };
}
// Labirint barabanlari: yashirin tuzoq yaqinlashganda kuchayadi.
const DRUM = [1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 0];
let drumStep = 0;
function nearestTrap(p, R) {
  const N = G.N;
  let best = Infinity;
  for (let y = Math.max(0, p.py - R); y <= Math.min(N - 1, p.py + R); y++)
    for (let x = Math.max(0, p.px - R); x <= Math.min(N - 1, p.px + R); x++) {
      const i = y * N + x;
      if (G.trap[i] >= 0 && !p.spent[i]) { const d = Math.hypot(x - p.px, y - p.py); if (d < best) best = d; }
    }
  return best;
}
function drumTick() {
  let delay = 140, best = Infinity, beastNear = false;
  const live = G.mode === 'play';
  for (const p of G.players) {
    if (p.bot) continue;
    p.drumD = live && p.alive && !p.finished ? nearestTrap(p, 5) : Infinity;
    if (p.drumD < best) best = p.drumD;
    if (live && p.alive && G.beasts.some((b) => Math.hypot(b.x - p.px, b.y - p.py) <= 4.5)) beastNear = true;
    if (p.ui) {
      const on = p.drumD <= 5.2;
      const el = setChip(p, 'drum', on, 'Baraban', 'drum');
      if (on) el.style.opacity = String(0.35 + clamp(1.15 - p.drumD * 0.2, 0.15, 1) * 0.65);
    }
  }
  if (best <= 5.2) {
    const v = clamp(1.15 - best * 0.2, 0.15, 1);
    if (DRUM[drumStep % 16]) {
      Sound.drum(v * (drumStep % 4 === 0 ? 1 : 0.7), drumStep % 8 === 6 ? 1.35 : 1);
      for (const p of G.players) if (p.ui && p.drumD <= 5.2) { const c = p.ui.chipEls.drum; c.classList.add('beat'); setTimeout(() => c.classList.remove('beat'), 90); }
    }
    delay = best <= 2.3 ? 105 : 140;
  }
  if (beastNear && drumStep % 22 === 0) Sound.growl();
  drumStep++;
  setTimeout(drumTick, delay);
}

/* ================= Grafika ================= */
export { buzz, Sound, DRUM, drumStep, nearestTrap, drumTick };
