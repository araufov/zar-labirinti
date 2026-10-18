// Ovozli suhbat: WebRTC (STUN+TURN), SDP siqish, presence orqali signal, ulanish holati (relay/to‘g‘ridan-to‘g‘ri), mikrofon boshqaruvi.
import { Sound } from './audio.js';
import { toast } from './hud.js';
import { NET_CFG } from './net-adapters.js';
import { chatOpen } from './net-room.js';
import { G, NET, me, ui } from './state.js';
const VOICE = { on: false, busy: false, sess: 0, room: null, unsub: null, me: '', stream: null, track: null, muted: false, err: '', peers: new Map(), names: {}, level: 0, speaking: false, hold: 0, an: null, src: null, z: null, buf: null, timer: 0, tap: false, full: false, box: null };
const VOICE_ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] }].concat(NET_CFG.turn.username ? [{ urls: NET_CFG.turn.urls, username: NET_CFG.turn.username, credential: NET_CFG.turn.credential }] : []), bundlePolicy: 'max-bundle' };
const VOICE_MAX = 5;   // suhbatda ko‘pi bilan shuncha kishi (hamma bir xil tanlaydi: peer tartibida)
const MIC_CONSTRAINTS = { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } };
const b64u = {
  enc(u8) { let t = ''; for (let i = 0; i < u8.length; i += 0x8000) t += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(t).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); },
  dec(str) { const t = atob(str.replace(/-/g, '+').replace(/_/g, '/')), u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; },
};
async function readAll(readable, cap) {
  const rd = readable.getReader(), parts = [];
  let n = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    n += value.length;
    if (n > cap) { try { rd.cancel(); } catch (e) { /* ignore */ } return null; }
    parts.push(value);
  }
  const out = new Uint8Array(n);
  let o = 0;
  for (const part of parts) { out.set(part, o); o += part.length; }
  return out;
}
// SDP presence'ga sig‘ishi uchun siqiladi (deflate + base64url). Siqish yo‘q brauzerda — oddiy base64.
// TURN yo‘qligi uchun foydasiz TCP nomzodlar va IPv6 link-local manzillar tashlab yuboriladi (UDP bilan ulanish).
const sdpSlim = (sdp) => sdp.split(/\r?\n/).filter((l) => !(l.startsWith('a=candidate:') && ((/ tcp /i.test(l) && !/ typ relay/i.test(l)) || / fe80:/i.test(l)))).join('\r\n');
async function sdpPack(sdp) {
  const raw = new TextEncoder().encode(sdpSlim(sdp));
  if (typeof CompressionStream === 'function') {
    try {
      const cs = new CompressionStream('deflate-raw'), w = cs.writable.getWriter();
      w.write(raw); w.close();
      return 'z' + b64u.enc(new Uint8Array(await new Response(cs.readable).arrayBuffer()));
    } catch (e) { /* oddiy yo‘l */ }
  }
  return 'r' + b64u.enc(raw);
}
// Boshqa odamdan kelgan signal ishonchsiz ma’lumot: hajmi va tuzilishi tekshiriladi, faqat bitta audio qism qabul qilinadi.
async function sdpUnpack(str) {
  if (typeof str !== 'string' || str.length < 8 || str.length > 2800 || !/^[rz][A-Za-z0-9_-]+$/.test(str)) return null;
  let u;
  try { u = b64u.dec(str.slice(1)); } catch (e) { return null; }
  let txt = null;
  if (str[0] === 'r') txt = new TextDecoder().decode(u);
  else if (typeof DecompressionStream === 'function') {
    try {
      const ds = new DecompressionStream('deflate-raw'), w = ds.writable.getWriter();
      w.write(u).catch(() => {}); w.close().catch(() => {});
      const out = await readAll(ds.readable, 16000);
      if (out) txt = new TextDecoder().decode(out);
    } catch (e) { txt = null; }
  }
  if (!txt || txt.length > 16000 || !txt.startsWith('v=0') || (txt.match(/^m=/gm) || []).length !== 1 || !/^m=audio /m.test(txt) || (txt.match(/^a=candidate:/gm) || []).length > 24) return null;
  return txt;
}
// Sahifa oynasi (iframe) mikrofonni taqiqlagan bo‘lsa, brauzer buni oldindan aytib beradi.
const micBlocked = () => { try { const pp = document.permissionsPolicy || document.featurePolicy; return !!pp && typeof pp.allowsFeature === 'function' && pp.allowsFeature('microphone') === false; } catch (e) { return false; } };
const micErr = (e) => {
  const n = e && e.name;
  if (micBlocked()) return 'Bu sahifa joylashgan oynada mikrofon taqiqlangan (sayt sozlamasi) — faqat eshitish rejimi.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Mikrofon topilmadi — faqat eshitish rejimi.';
  if (n === 'NotSupportedError') return 'Bu qurilma mikrofonni qo‘llamaydi — faqat eshitish rejimi.';
  return 'Mikrofonga ruxsat berilmadi (brauzer yoki shu sahifaning oynasi bloklagan bo‘lishi mumkin) — faqat eshitish rejimi.';
};
function voiceBox() {
  if (!VOICE.box) { const d = document.createElement('div'); d.setAttribute('aria-hidden', 'true'); d.style.cssText = 'position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none'; document.body.appendChild(d); VOICE.box = d; }
  return VOICE.box;
}
const voiceEntry = (id) => ({ id, pc: null, tr: null, rx: null, audio: null, gen: 0, seen: 0, out: null, state: 'new', fails: 0, answered: false, q: Promise.resolve(), timer: 0, dtimer: 0, speaking: false, hold: 0, muted: false, mic: false });
const voiceQueue = (E, fn) => { E.q = E.q.then(fn).catch(() => voiceRetry(E, 'xato')); };
function voicePrefer(tr) {
  try { const op = RTCRtpReceiver.getCapabilities('audio').codecs.filter((c) => /opus/i.test(c.mimeType)); if (op.length) tr.setCodecPreferences(op); } catch (e) { /* eski brauzer */ }
}
function voiceNewPC(E, init) {
  const pc = new RTCPeerConnection(VOICE_ICE);
  E.pc = pc; E.answered = false;
  pc.ontrack = (ev) => voiceAttach(E, ev);
  pc.onconnectionstatechange = () => voiceConn(E, pc);
  if (init) {
    const tr = pc.addTransceiver('audio', { direction: 'sendrecv' });
    voicePrefer(tr); E.tr = tr;
    if (VOICE.track) tr.sender.replaceTrack(VOICE.track).catch(() => {});
  }
  return pc;
}
function voiceGather(pc) {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') { resolve(); return; }
    let t2 = 0;
    const done = () => { clearTimeout(t1); clearTimeout(t2); pc.removeEventListener('icegatheringstatechange', ch); pc.removeEventListener('icecandidate', cand); resolve(); };
    const ch = () => { if (pc.iceGatheringState === 'complete') done(); };
    // TURN bor bo‘lsa relay nomzodini kutamiz (mobil internetda faqat u ishlaydi); yo‘q bo‘lsa — srflx yetarli
    const want = NET_CFG.turn.username ? /typ relay/ : /typ (srflx|relay)/;
    const cand = (e) => { if (e.candidate && want.test(e.candidate.candidate) && !t2) t2 = setTimeout(done, 350); };
    const t1 = setTimeout(done, NET_CFG.turn.username ? 5000 : 2500);
    pc.addEventListener('icegatheringstatechange', ch); pc.addEventListener('icecandidate', cand);
  });
}
function voiceDropPC(E) {
  clearTimeout(E.timer); clearTimeout(E.dtimer); clearTimeout(E.slow);
  const pc = E.pc;
  E.pc = null; E.tr = null; E.rx = null; E.out = null; E.speaking = false;
  if (pc) { pc.ontrack = null; pc.onconnectionstatechange = null; try { pc.close(); } catch (e) { /* ignore */ } }
  if (E.audio) { try { E.audio.pause(); } catch (e) { /* ignore */ } E.audio.srcObject = null; }
}
function voiceClose(id) {
  const E = VOICE.peers.get(id);
  if (!E) return;
  VOICE.peers.delete(id);
  E.nextSig = null;
  voiceDropPC(E);
  if (E.audio) { E.audio.remove(); E.audio = null; }
  voicePublish(); voiceUI();
}
// Mening signallarim (taklif/javob) ovoz xonasidagi presence'da turadi; 4 KiB dan oshmasligi tekshiriladi.
function voicePublish() {
  if (!VOICE.room) return;
  const sg = [];
  for (const E of VOICE.peers.values()) if (E.out) sg.push([E.id, E.out.gen, E.out.k, E.out.d]);
  const patch = { m: VOICE.muted ? 1 : 0, mic: VOICE.track ? 1 : 0, s: sg };
  while (sg.length > 1 && JSON.stringify(patch).length > 3500) sg.pop();
  VOICE.room.presence(patch).catch(() => {});
}
async function voiceOffer(E) {
  if (VOICE.peers.get(E.id) !== E || !VOICE.on) return;
  voiceDropPC(E);
  E.gen = 10000 + ((Math.random() * 89999) | 0);
  const pc = voiceNewPC(E, true);
  await pc.setLocalDescription(await pc.createOffer());
  await voiceGather(pc);
  if (E.pc !== pc) return;
  E.out = { gen: E.gen, k: 'o', d: await sdpPack(pc.localDescription.sdp) };
  E.state = 'offer';
  clearTimeout(E.timer); E.timer = setTimeout(() => voiceRetry(E, 'vaqt'), 25000);
  voicePublish(); voiceUI();
}
async function voiceAnswerFrom(E, sig) {
  if (VOICE.peers.get(E.id) !== E || !VOICE.on) return;
  const sdp = await sdpUnpack(sig.d);
  if (!sdp) return;
  voiceDropPC(E);
  E.gen = sig.gen;
  const pc = voiceNewPC(E, false);
  await pc.setRemoteDescription({ type: 'offer', sdp });
  const tr = pc.getTransceivers().find((t) => t.receiver && t.receiver.track && t.receiver.track.kind === 'audio');
  if (tr) { tr.direction = 'sendrecv'; E.tr = tr; voicePrefer(tr); if (VOICE.track) await tr.sender.replaceTrack(VOICE.track).catch(() => {}); }
  await pc.setLocalDescription(await pc.createAnswer());
  await voiceGather(pc);
  if (E.pc !== pc) return;
  E.out = { gen: sig.gen, k: 'a', d: await sdpPack(pc.localDescription.sdp) };
  E.state = 'answer';
  clearTimeout(E.timer); E.timer = setTimeout(() => voiceRetry(E, 'vaqt'), 25000);
  voicePublish(); voiceUI();
}
// Faqat oxirgi taklifga javob beriladi (begona xonada ketma-ket taklif yuborib yuklash mumkin emas).
async function voiceAnswerLoop(E) {
  E.ansBusy = true;
  try { while (E.nextSig) { const sg = E.nextSig; E.nextSig = null; await voiceAnswerFrom(E, sg); } } finally { E.ansBusy = false; }
}
async function voiceApply(E, sig) {
  const sdp = await sdpUnpack(sig.d);
  if (!sdp || !E.pc || sig.gen !== E.gen || E.pc.signalingState !== 'have-local-offer') return;
  await E.pc.setRemoteDescription({ type: 'answer', sdp });
  E.out = null;
  voicePublish();
}
// Aloqa qaysi yo‘ldan o‘rnatilgani (to‘g‘ridan-to‘g‘ri yoki TURN server orqali) — sinov uchun ko‘rsatiladi
async function voiceVia(E, pc) {
  try {
    const st = await pc.getStats();
    let pair = null;
    st.forEach((r) => { if (r.type === 'transport' && r.selectedCandidatePairId) pair = st.get(r.selectedCandidatePairId); });
    if (!pair) st.forEach((r) => { if (r.type === 'candidate-pair' && (r.selected || r.state === 'succeeded') && !pair) pair = r; });
    if (!pair) return;
    const lc = st.get(pair.localCandidateId), rc = st.get(pair.remoteCandidateId);
    E.via = (lc && lc.candidateType === 'relay') || (rc && rc.candidateType === 'relay') ? 'relay' : 'direct';
    voiceUI();
  } catch (e) { /* ignore */ }
}
function voiceConn(E, pc) {
  if (E.pc !== pc) return;
  const st = pc.connectionState;
  if (st === 'connected') {
    clearTimeout(E.timer); clearTimeout(E.dtimer);
    E.state = 'connected'; E.fails = 0;
    if (E.out) { E.out = null; voicePublish(); }
    voiceVia(E, pc);
  } else if (st === 'failed') voiceRetry(E, 'uzildi');
  else if (st === 'disconnected') { clearTimeout(E.dtimer); E.dtimer = setTimeout(() => { if (E.pc === pc && pc.connectionState !== 'connected') voiceRetry(E, 'uzildi'); }, 6000); }
  voiceUI();
}
// Aloqa o‘rnatilmasa: taklif qiluvchi tomon yangi taklif bilan qayta urinadi (3 martagacha), javob beruvchi yangisini kutadi.
function voiceRetry(E, why) {
  if (VOICE.peers.get(E.id) !== E || !VOICE.on) return;
  voiceDropPC(E);
  E.why = why;
  if (++E.fails > 3) {
    E.state = 'dead';
    // Tarmoq tiklanishi mumkin: taklif qiluvchi tomon har 20 soniyada yana urinib ko‘radi (javob beruvchi yangi taklifni o‘zi oladi)
    if (VOICE.me < E.id) E.slow = setTimeout(() => { if (VOICE.peers.get(E.id) === E && VOICE.on) { E.fails = 0; E.state = 'retry'; voiceQueue(E, () => voiceOffer(E)); voiceUI(); } }, 20000);
    voicePublish(); voiceUI(); return;
  }
  E.state = 'retry';
  if (VOICE.me < E.id) setTimeout(() => { if (VOICE.peers.get(E.id) === E && VOICE.on) voiceQueue(E, () => voiceOffer(E)); }, 1200 * E.fails);
  voicePublish(); voiceUI();
}
function voiceAttach(E, ev) {
  const stream = ev.streams && ev.streams[0] ? ev.streams[0] : new MediaStream([ev.track]);
  if (!E.audio) { E.audio = new Audio(); E.audio.autoplay = true; E.audio.playsInline = true; voiceBox().appendChild(E.audio); }
  E.audio.srcObject = stream;
  E.rx = ev.receiver;
  const pr = E.audio.play();
  if (pr && pr.catch) pr.catch(() => { VOICE.tap = true; voiceUI(); });
}
// Ovoz xonasida kimdir o‘zgardi: yangilar bilan aloqa ochiladi, ketganlarniki yopiladi, kelgan signallar qayta ishlanadi.
function voicePeers(change) {
  if (!VOICE.on) return;
  const all = change.peers.filter((pr) => pr.kind === 'viewer'), mine = all.find((pr) => pr.sameTab);
  if (mine) VOICE.me = mine.peer;
  if (!VOICE.me) return;   // o‘z belgim ma’lum bo‘lmaguncha rollarni (taklif/javob) belgilab bo‘lmaydi
  const ids = all.map((pr) => pr.peer).sort().slice(0, VOICE_MAX);
  VOICE.full = !!VOICE.me && !ids.includes(VOICE.me);
  const here = new Set();
  if (!VOICE.full) for (const pr of all) {
    if (pr.isMe || !ids.includes(pr.peer)) continue;
    here.add(pr.peer);
    let E = VOICE.peers.get(pr.peer);
    const init = VOICE.me < pr.peer;
    if (!E) {
      E = voiceEntry(pr.peer); VOICE.peers.set(pr.peer, E);
      if (init) voiceQueue(E, () => voiceOffer(E));
    }
    const pres = pr.presence || {};
    E.muted = pres.m === 1; E.mic = pres.mic === 1;
    const sg = Array.isArray(pres.s) ? pres.s.slice(0, 5).find((x) => Array.isArray(x) && x[0] === VOICE.me) : null;
    if (!sg) continue;
    const sig = { gen: +sg[1], k: sg[2], d: sg[3] };
    if (!Number.isFinite(sig.gen)) continue;
    if (init) { if (sig.k === 'a' && sig.gen === E.gen && !E.answered) { E.answered = true; voiceQueue(E, () => voiceApply(E, sig)); } }
    else if (sig.k === 'o' && sig.gen !== E.seen) { E.seen = sig.gen; E.nextSig = sig; if (!E.ansBusy) voiceQueue(E, () => voiceAnswerLoop(E)); }
  }
  for (const id of Array.from(VOICE.peers.keys())) if (!here.has(id)) voiceClose(id);
  voiceUI();
}
function voiceMeter() {
  voiceMeterOff();
  const ac = Sound.ctx;
  if (!ac || !VOICE.track) return;
  try {
    const src = ac.createMediaStreamSource(new MediaStream([VOICE.track])), an = ac.createAnalyser(), z = ac.createGain();
    an.fftSize = 512; z.gain.value = 0;
    src.connect(an); an.connect(z); z.connect(ac.destination);
    VOICE.src = src; VOICE.an = an; VOICE.z = z; VOICE.buf = new Uint8Array(an.fftSize);
  } catch (e) { VOICE.an = null; }
}
function voiceMeterOff() {
  try { if (VOICE.src) VOICE.src.disconnect(); if (VOICE.an) VOICE.an.disconnect(); if (VOICE.z) VOICE.z.disconnect(); } catch (e) { /* ignore */ }
  VOICE.src = VOICE.an = VOICE.z = VOICE.buf = null;
}
// 10 marta/s: kim gapiryapti (o‘zim — mikrofon balandligidan, boshqalar — kelayotgan ovoz balandligidan).
function voiceTick() {
  const now = performance.now();
  let lv = 0;
  if (VOICE.an && VOICE.track && VOICE.track.enabled) {
    VOICE.an.getByteTimeDomainData(VOICE.buf);
    let m = 0;
    for (let i = 0; i < VOICE.buf.length; i++) m = Math.max(m, Math.abs(VOICE.buf[i] - 128));
    lv = m / 128;
  }
  VOICE.level = lv;
  if (lv > 0.06) VOICE.hold = now + 450;
  const sp = now < VOICE.hold && !VOICE.muted;
  if (sp !== VOICE.speaking) { VOICE.speaking = sp; voiceUI(); }
  for (const E of VOICE.peers.values()) {
    let l = 0;
    try {   // `timestamp` brauzerga qarab performance.now() yoki Date.now() asosida bo‘ladi — ikkalasiga ham qaraymiz
      const ss = E.rx && E.rx.getSynchronizationSources && E.rx.getSynchronizationSources()[0];
      if (ss && (Math.abs(now - ss.timestamp) < 800 || Math.abs(Date.now() - ss.timestamp) < 800)) l = ss.audioLevel;
    } catch (e) { l = 0; }
    if (l > 0.02) E.hold = now + 450;
    const s2 = now < E.hold;
    if (s2 !== E.speaking) { E.speaking = s2; voiceUI(); }
  }
}
const voiceSpeakingPeer = (peer) => { const E = VOICE.peers.get(peer); return !!(E && E.speaking); };
const voiceName = (E) => VOICE.names[E.id] || 'Mehmon';
function voiceStatus() {
  if (!VOICE.on) return '';
  const tot = VOICE.peers.size, n = Array.from(VOICE.peers.values()).filter((E) => E.state === 'connected').length;
  const me = VOICE.track ? (VOICE.muted ? '🔇 Mikrofon o‘chiq' : '🎙 Mikrofon yoqiq') : '🎧 Faqat eshitish';
  if (VOICE.full) return `${me} · suhbat to‘la (${VOICE_MAX} kishi)`;
  const relay = [...VOICE.peers.values()].filter((E) => E.state === 'connected' && E.via === 'relay').length;
  return `${me} · ${tot ? `${n}/${tot} ulandi${relay ? ` (${relay} server orqali)` : ''}` : 'boshqalarni kutmoqda'}`;
}
function voiceUI() {
  const inRoom = !!(NET.room && NET.named), live = VOICE.on && !!VOICE.track && !VOICE.muted;
  const act = !VOICE.on ? 'Mikrofonni yoqish' : !VOICE.track ? 'Mikrofonni qayta urinish' : VOICE.muted ? 'Ovozni yoqish' : 'Ovozni o‘chirish';
  const m = me(), u = m && m.ui;
  if (u && u.mic) {
    u.mic.hidden = !(inRoom && G.online);
    u.chat.hidden = u.mic.hidden;
    if (u.chat.hidden) chatOpen(m, false);
    u.mic.classList.toggle('live', live);
    u.mic.classList.toggle('muted', VOICE.on && !!VOICE.track && VOICE.muted);
    u.mic.classList.toggle('talk', VOICE.on && VOICE.speaking);
    u.mic.setAttribute('aria-pressed', String(live));
    u.mic.title = act + ' (V) · uzoq bosish — suhbatdan chiqish';
  }
  ui.oMic.hidden = !inRoom;
  ui.oMic.textContent = '🎙 ' + act;
  ui.oMicOff.hidden = !(inRoom && VOICE.on);
  ui.oMic.disabled = VOICE.busy;
  const bad = VOICE.err ? VOICE.err + ' O‘yinda 💬 tugma orqali tezkor gaplar yuborsa bo‘ladi.' : [...VOICE.peers.values()].some((E) => E.state === 'dead') ? 'Ba’zi do‘stlar bilan ovoz aloqasi o‘rnatilmadi (tarmoq to‘sib qo‘ygan bo‘lishi mumkin).' : '';
  ui.oVoice.textContent = VOICE.busy ? 'Mikrofon so‘ralmoqda…' : [VOICE.on ? voiceStatus() : inRoom ? 'Do‘stlar bilan gaplashib o‘ynash uchun mikrofonni yoqing (naushnik bilan yaxshiroq).' : '', bad].filter(Boolean).join(' · ');
}
// Mikrofon tugmasi: bosish — yoqish/o‘chirish, uzoq bosish — suhbatdan chiqish.
function bindMic(p) {
  let hold = 0, long = false;
  const b = p.ui.mic;
  b.addEventListener('pointerdown', () => { long = false; clearTimeout(hold); hold = setTimeout(() => { long = true; if (VOICE.on) { voiceLeave(); toast(p, 'Suhbatdan chiqding.'); } }, 700); });
  for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) b.addEventListener(ev, () => clearTimeout(hold));
  b.addEventListener('click', () => { if (long) { long = false; return; } voiceToggle(); });
}
async function voiceJoin() {
  if (VOICE.on || VOICE.busy || !NET.room || !NET.code) return;
  const sess = ++VOICE.sess;
  VOICE.busy = true; VOICE.err = ''; voiceUI();
  Sound.init();
  if (typeof RTCPeerConnection !== 'function') { VOICE.err = 'Bu brauzer ovozli suhbatni qo‘llamaydi.'; VOICE.busy = false; voiceUI(); return; }
  let stream = null;
  try {
    if (micBlocked()) throw Object.assign(new Error('siyosat'), { name: 'NotAllowedError' });   // so‘ramasdan ham ma’lum: bu oynada mikrofon yo‘q
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw Object.assign(new Error('mikrofon yo‘q'), { name: 'NotSupportedError' });
    stream = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
  } catch (e) { VOICE.err = micErr(e); }
  const track = stream ? stream.getAudioTracks()[0] || null : null;
  const stop = () => { if (stream) for (const t of stream.getTracks()) { try { t.stop(); } catch (e) { /* ignore */ } } };
  if (sess !== VOICE.sess || !NET.named) { stop(); VOICE.busy = false; voiceUI(); return; }   // kutish paytida xonadan chiqib ketdi
  try {
    const room = await NET.room.join('jv-' + NET.code);
    if (sess !== VOICE.sess || !NET.named) { room.leave().catch(() => {}); stop(); VOICE.busy = false; voiceUI(); return; }
    for (const id of Array.from(VOICE.peers.keys())) voiceClose(id);   // oldingi seansdan qolgan yozuvlar bo‘lmasin
    VOICE.stream = stream; VOICE.track = track; VOICE.muted = false; VOICE.room = room; VOICE.on = true;
    VOICE.unsub = room.onPeers(voicePeers, () => { VOICE.err = 'Ovoz xonasi bilan aloqa uzildi.'; voiceUI(); });
    room.presence({ v: 1, m: 0, mic: track ? 1 : 0, s: [] }).catch(() => {});
    VOICE.timer = setInterval(voiceTick, 100);
    voiceMeter();
  } catch (e) {
    stop();
    VOICE.err = 'Ovozli xonaga ulanib bo‘lmadi. Birozdan keyin qayta urinib ko‘ring.';
  }
  VOICE.busy = false; voiceUI();
  voiceNote();
}
// Mikrofon avval bloklangan bo‘lsa (faqat eshitish): qayta so‘raydi va shu zahoti uzatishni boshlaydi.
async function voiceEnableMic() {
  if (!VOICE.on || VOICE.track || VOICE.busy) return;
  const sess = VOICE.sess;
  VOICE.busy = true; voiceUI();
  try {
    const st = await navigator.mediaDevices.getUserMedia(MIC_CONSTRAINTS);
    if (sess !== VOICE.sess || !VOICE.on) { for (const t of st.getTracks()) t.stop(); VOICE.busy = false; voiceUI(); return; }
    VOICE.stream = st; VOICE.track = st.getAudioTracks()[0] || null; VOICE.err = ''; VOICE.muted = false;
    for (const E of VOICE.peers.values()) if (E.tr) E.tr.sender.replaceTrack(VOICE.track).catch(() => {});
    voiceMeter(); voicePublish();
  } catch (e) { VOICE.err = micErr(e); }
  VOICE.busy = false; voiceUI();
  voiceNote();
}
// O‘yin paytida mikrofon xatosi ekranda ham ko‘rsatiladi (lobbida — holat satrida turadi).
function voiceNote() {
  const m = me();
  if (VOICE.err && m && G.mode === 'play') toast(m, VOICE.err + ' Tezkor gaplar uchun 💬 tugmani bosing.', 5600);
}
function voiceMute(m) {
  if (!VOICE.on || !VOICE.track) return;
  VOICE.muted = m; VOICE.track.enabled = !m;
  voicePublish(); voiceUI();
}
function voiceToggle() {
  if (VOICE.busy) return;
  if (!VOICE.on) voiceJoin();
  else if (!VOICE.track) voiceEnableMic();
  else voiceMute(!VOICE.muted);
}
function voiceLeave() {
  VOICE.sess++;
  VOICE.on = false;   // avval kuzatuvchi uziladi: yopish paytidagi presence aks-sadosi eski a’zolarni qayta yaratmasin
  if (VOICE.unsub) { try { VOICE.unsub(); } catch (e) { /* ignore */ } VOICE.unsub = null; }
  for (const id of Array.from(VOICE.peers.keys())) voiceClose(id);
  clearInterval(VOICE.timer); VOICE.timer = 0;
  if (VOICE.room) { VOICE.room.leave().catch(() => {}); VOICE.room = null; }
  voiceMeterOff();
  if (VOICE.stream) for (const t of VOICE.stream.getTracks()) { try { t.stop(); } catch (e) { /* ignore */ } }
  Object.assign(VOICE, { on: false, busy: false, stream: null, track: null, muted: false, speaking: false, hold: 0, level: 0, full: false, tap: false, err: '' });
  voiceUI();
}
// Telefon ovozni o‘z-o‘zidan yoqmasa: ekranga bir bosilganda barcha suhbatdoshlar ovozi yoqiladi.
const voiceUnlock = () => {
  if (!VOICE.tap) return;
  VOICE.tap = false;
  for (const E of VOICE.peers.values()) if (E.audio && E.audio.srcObject) { const pr = E.audio.play(); if (pr && pr.catch) pr.catch(() => { VOICE.tap = true; }); }
  voiceUI();
};
for (const ev of ['pointerdown', 'touchend', 'click', 'keydown']) document.addEventListener(ev, voiceUnlock, true);   // iOS faqat «teginish tugadi/bosildi» ni qabul qiladi
window.addEventListener('pagehide', voiceLeave);

/* ================= Bog‘lash va asosiy sikl ================= */
export { VOICE, VOICE_ICE, VOICE_MAX, MIC_CONSTRAINTS, b64u, readAll, sdpSlim, sdpPack, sdpUnpack, micBlocked, micErr, voiceBox, voiceEntry, voiceQueue, voicePrefer, voiceNewPC, voiceGather, voiceDropPC, voiceClose, voicePublish, voiceOffer, voiceAnswerFrom, voiceAnswerLoop, voiceApply, voiceVia, voiceConn, voiceRetry, voiceAttach, voicePeers, voiceMeter, voiceMeterOff, voiceTick, voiceSpeakingPeer, voiceName, voiceStatus, voiceUI, bindMic, voiceJoin, voiceEnableMic, voiceNote, voiceMute, voiceToggle, voiceLeave, voiceUnlock };
