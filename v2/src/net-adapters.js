// NetworkManager (adapterlar): Firebase RTDB xonasi (firebaseRoom), bitta brauzer ichidagi sinov xonasi (localRoom), ijtimoiy baza adapterlari (firebaseDB/localDB), NET_CFG (Firebase/TURN sozlamalari).
let fbP = null;
const GUEST = /[?&]guest=1\b/.test(location.search);
// Firebase: bitta ilova, anonim kirish (ro‘yxatdan o‘tmasdan har kimga o‘z ID si).
function fbInit() {
  if (fbP) return fbP;
  fbP = (async () => {
    const C = NET_CFG.firebase;
    if (!C.databaseURL) return null;
    if (!window.firebase || !window.firebase.database) {
      await loadScript(FB_SDK + 'firebase-app-compat.js');
      await loadScript(FB_SDK + 'firebase-auth-compat.js');
      await loadScript(FB_SDK + 'firebase-database-compat.js');
    }
    const fb = window.firebase;
    // ?guest=1 — sinov: alohida ilova nusxasi va xotirasiz kirish, shu oynada boshqa foydalanuvchi bo‘ladi (asosiy oynaga tegmaydi)
    const app = GUEST ? (fb.apps.find((a) => a.name === 'guest') || fb.initializeApp(C, 'guest')) : (fb.apps.find((a) => a.name === '[DEFAULT]') || fb.initializeApp(C)), db = fb.database(app);
    let uid = null;
    try {
      const auth = fb.auth(app);
      if (GUEST) await auth.setPersistence(fb.auth.Auth.Persistence.NONE);
      if (!auth.currentUser) await auth.signInAnonymously();
      uid = auth.currentUser.uid;
    } catch (e) { console.warn('Anonim kirish yoqilmagan:', e && e.code); }
    return { fb, app, db, uid };
  })().catch((e) => { console.warn(e); fbP = null; return null; });
  return fbP;
}
async function firebaseDB() {
  const F = await fbInit();
  if (!F || !F.uid) return null;
  const { db, fb } = F, ref = (p) => db.ref(p);
  return {
    uid: F.uid,
    get: (p) => ref(p).once('value').then((sn) => sn.val()),
    set: (p, v) => ref(p).set(v),
    update: (p, o) => ref(p).update(o),
    remove: (p) => ref(p).remove(),
    on: (p, cb) => { const f = (sn) => cb(sn.val()); ref(p).on('value', f); return () => ref(p).off('value', f); },
    onDisconnect: (p, v) => (v === null ? ref(p).onDisconnect().remove() : ref(p).onDisconnect().set(v)),
    stamp: () => fb.database.ServerValue.TIMESTAMP,
    searchUsers: (q) => ref('users').orderByChild('nl').startAt(q).endAt(q + '').limitToFirst(8).once('value').then((sn) => { const o = []; sn.forEach((c) => { o.push(Object.assign({ uid: c.key }, c.val())); }); return o; }),
  };
}
// Sinov uchun: bitta brauzerdagi oynalar o‘rtasida umumiy «baza» (localStorage; har bir tugun alohida kalitda — oynalar bir-birining yozuvini o‘chirmasin).
function localDB() {
  const P = 'zdb|', seg = (p) => p.split('/').filter(Boolean);
  const rd = (k) => { try { const v = localStorage.getItem(k); return v === null ? undefined : JSON.parse(v); } catch (e) { return undefined; } };
  const getAt = (o, ks) => ks.reduce((x, k) => (x && typeof x === 'object' ? x[k] : undefined), o);
  const read = (p) => {
    const ks = seg(p);
    if (ks.length >= 2) return getAt(rd(P + ks[0] + '|' + ks[1]), ks.slice(2));
    const out = {}; let any = false;
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P + ks[0] + '|')) { out[k.slice((P + ks[0] + '|').length)] = rd(k); any = true; } }
    return any ? out : undefined;
  };
  const writeAt = (p, v) => {
    const ks = seg(p), key = P + ks[0] + '|' + ks[1];
    if (ks.length === 2) { if (v === null || v === undefined) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(v)); return; }
    let root = rd(key); if (!root || typeof root !== 'object') root = {};
    let o = root; const rest = ks.slice(2);
    for (let i = 0; i < rest.length - 1; i++) { if (!o[rest[i]] || typeof o[rest[i]] !== 'object') o[rest[i]] = {}; o = o[rest[i]]; }
    if (v === null || v === undefined) delete o[rest[rest.length - 1]]; else o[rest[rest.length - 1]] = v;
    if (Object.keys(root).length) localStorage.setItem(key, JSON.stringify(root)); else localStorage.removeItem(key);
  };
  const subs = new Set();
  const fire = () => { for (const sb of subs) { const v = read(sb.path), j = JSON.stringify(v === undefined ? null : v); if (j !== sb.last) { sb.last = j; sb.cb(JSON.parse(j)); } } };
  addEventListener('storage', (e) => { if (e.key && e.key.startsWith(P)) fire(); });
  let uid = sessionStorage.getItem('zuid');
  if (!uid) { uid = 'u' + Math.random().toString(36).slice(2, 10); sessionStorage.setItem('zuid', uid); }
  const odc = [];
  addEventListener('pagehide', () => { for (const [pp, v] of odc) writeAt(pp, v); });
  return {
    uid, local: true,
    get: async (pp) => { const v = read(pp); return v === undefined ? null : v; },
    set: async (pp, v) => { writeAt(pp, v); fire(); },
    update: async (pp, o) => { for (const k in o) writeAt(pp + '/' + k, o[k]); fire(); },
    remove: async (pp) => { writeAt(pp, null); fire(); },
    on: (pp, cb) => { const sb = { path: pp, cb, last: undefined }; subs.add(sb); setTimeout(() => { const v = read(pp); sb.last = JSON.stringify(v === undefined ? null : v); cb(v === undefined ? null : v); }, 0); return () => subs.delete(sb); },
    onDisconnect: async (pp, v) => { odc.push([pp, v]); },
    stamp: () => Date.now(),
    searchUsers: async (q) => Object.entries(read('users') || {}).filter(([, x]) => x && x.nl && x.nl.startsWith(q)).slice(0, 8).map(([id, x]) => Object.assign({ uid: id }, x)),
  };
}
const NET_CFG = {
  firebase: {
    apiKey: 'AIzaSyCzn9-HM60doQ_OQcJxaw7jCKqxE6R8wTE',
    authDomain: 'zar-labirinti.firebaseapp.com',
    databaseURL: 'https://zar-labirinti-default-rtdb.europe-west1.firebasedatabase.app',
    projectId: 'zar-labirinti',
    storageBucket: 'zar-labirinti.firebasestorage.app',
    messagingSenderId: '461883101026',
    appId: '1:461883101026:web:6fc55229469710445a263b',
  },
  // Ovoz mobil internetda ham ulanishi uchun TURN (masalan, metered.ca). Bo‘sh bo‘lsa faqat STUN ishlaydi.
  turn: { urls: ['turn:46.101.238.117:3478', 'turn:46.101.238.117:3478?transport=tcp', 'turn:46.101.238.117:443?transport=tcp'], username: 'zar', credential: 'c5be5b98e0c92c191e21b11d5b902e53' },
};
const FB_SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
function loadScript(src) {
  return new Promise((res, rej) => { const el = document.createElement('script'); el.src = src; el.async = true; el.onload = res; el.onerror = () => rej(new Error('yuklanmadi: ' + src)); document.head.appendChild(el); });
}
const newPeerId = () => 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
// claude.ai «room» bilan bir xil ko‘rinish: join(nom) → { presence(patch), onPeers(cb, err), leave() }.
// Holat JSON matn sifatida saqlanadi (Firebase massiv va bo‘sh qiymatlarni buzmasin).
async function firebaseRoom() {
  const F = await fbInit();
  if (!F) return null;
  const fb = F.fb, db = F.db;
  return {
    async join(name) {
      const me = newPeerId(), roomRef = db.ref('rooms/' + name), myRef = roomRef.child(me);
      let state = {}, live = true, pend = null, busy = false;
      await myRef.onDisconnect().remove();
      const write = () => {
        if (!live) return Promise.resolve();
        if (busy) { pend = true; return Promise.resolve(); }
        busy = true;
        return myRef.set({ p: JSON.stringify(state), t: fb.database.ServerValue.TIMESTAMP }).finally(() => { busy = false; if (pend && live) { pend = false; write(); } });
      };
      return {
        presence(patch) { state = Object.assign({}, state, patch); return write(); },
        onPeers(cb, onErr) {
          const fn = (snap) => {
            const peers = [];
            snap.forEach((ch) => {
              let pres = {};
              try { pres = JSON.parse(ch.val().p || '{}'); } catch (e) { /* buzilgan yozuv */ }
              peers.push({ peer: ch.key, sameTab: ch.key === me, isMe: ch.key === me, kind: 'viewer', presence: pres });
            });
            if (!peers.some((q) => q.sameTab)) peers.push({ peer: me, sameTab: true, isMe: true, kind: 'viewer', presence: state });
            cb({ peers });
          };
          const err = () => { if (onErr) onErr(); };
          roomRef.on('value', fn, err);
          return () => roomRef.off('value', fn);
        },
        leave() { live = false; roomRef.off(); return myRef.onDisconnect().cancel().then(() => myRef.remove()).catch(() => {}); },
      };
    },
  };
}
// Sinov uchun: bitta brauzerdagi bir nechta oyna o‘zaro o‘ynaydi (?net=local).
function localRoom() {
  const bc = new BroadcastChannel('zar-net');
  const rooms = new Map();   // nom -> { me, state, peers: Map(id -> {presence, at}), cbs:Set }
  const emit = (R) => { const peers = [{ peer: R.me, sameTab: true, isMe: true, kind: 'viewer', presence: R.state }]; for (const [id, v] of R.peers) peers.push({ peer: id, sameTab: false, isMe: false, kind: 'viewer', presence: v.presence }); for (const cb of R.cbs) cb({ peers }); };
  bc.onmessage = (e) => { const m = e.data, R = rooms.get(m.room); if (!R || m.from === R.me) return;
    if (m.type === 'bye') R.peers.delete(m.from); else R.peers.set(m.from, { presence: m.state, at: Date.now() });
    if (m.type === 'hi') bc.postMessage({ room: m.room, from: R.me, type: 'st', state: R.state });
    emit(R); };
  setInterval(() => { const now = Date.now(); for (const [name, R] of rooms) { bc.postMessage({ room: name, from: R.me, type: 'st', state: R.state }); let ch = false; for (const [id, v] of R.peers) if (now - v.at > 4000) { R.peers.delete(id); ch = true; } if (ch) emit(R); } }, 1000);
  return {
    async join(name) {
      const R = { me: newPeerId(), state: {}, peers: new Map(), cbs: new Set() };
      rooms.set(name, R);
      bc.postMessage({ room: name, from: R.me, type: 'hi', state: R.state });
      return {
        presence(patch) { R.state = Object.assign({}, R.state, patch); bc.postMessage({ room: name, from: R.me, type: 'st', state: R.state }); emit(R); return Promise.resolve(); },
        onPeers(cb) { R.cbs.add(cb); setTimeout(() => emit(R), 0); return () => R.cbs.delete(cb); },
        leave() { bc.postMessage({ room: name, from: R.me, type: 'bye' }); rooms.delete(name); return Promise.resolve(); },
      };
    },
  };
}
export { fbP, GUEST, fbInit, firebaseDB, localDB, NET_CFG, FB_SDK, loadScript, newPeerId, firebaseRoom, localRoom };
