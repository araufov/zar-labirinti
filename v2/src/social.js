// Do‘stlar va zallar: ID (Ism#1234), so‘rovlar, qabul, taklif, zal ochish, tez o‘yin (SOC).
import { Sound, buzz } from './audio.js';
import { cfg } from './config.js';
import { DEF_NAME, DIFFS } from './content.js';
import { selDiff, toMenu } from './engine.js';
import { GUEST, firebaseDB, localDB } from './net-adapters.js';
import { createRoom, enterRoom } from './net-room.js';
import { avatarURL } from './render.js';
import { store } from './save.js';
import { G, NET, ui } from './state.js';
import { $, clamp } from './util.js';
const SOC = { db: null, tag: '', friends: {}, fsub: {}, fdata: {}, reqs: {}, invites: {}, lobbies: {}, seenInv: {}, inv: null };
['soc', 'socId', 'socCopy', 'hallOpen', 'quickPlay', 'hallPub', 'hallList', 'frCount', 'frIn', 'frAdd', 'frMsg', 'frSearch', 'frReq', 'frList', 'invBar', 'invTxt', 'invGo', 'invNo'].forEach((id) => { ui[id] = $(id); });
const cleanName = (n) => (n || '').toLowerCase().replace(/[.#$\[\]\/\s]/g, '').slice(0, 14) || 'mehmon';
const myName = () => (cfg.name || '').trim().slice(0, 14) || DEF_NAME;
const myId = () => `${myName()}#${SOC.tag}`;
async function socialInit(local) {
  try {
    const db = local ? localDB() : await firebaseDB();
    if (!db) return;
    SOC.db = db;
    const tstore = local || GUEST ? sessionStorage : null;
    let tag = tstore ? tstore.getItem('jl_tag') : store.get('jl_tag');
    if (!tag) { tag = String(1000 + ((Math.random() * 9000) | 0)); if (tstore) tstore.setItem('jl_tag', tag); else store.set('jl_tag', tag); }
    SOC.tag = tag;
    await socPublish();
    db.onDisconnect(`users/${db.uid}/on`, false);
    db.on(`friends/${db.uid}`, (v) => socFriends(v || {}));
    db.on(`requests/${db.uid}`, (v) => { SOC.reqs = v || {}; socRender(); });
    db.on(`invites/${db.uid}`, (v) => { SOC.invites = v || {}; socInvites(); });
    db.on('lobbies', (v) => { SOC.lobbies = v || {}; socRender(); });
    setInterval(() => { if (SOC.db) SOC.db.update(`users/${SOC.db.uid}`, { on: true, seen: SOC.db.stamp() }).catch(() => {}); }, 30000);
    ui.soc.hidden = false;
    ui.oCreate.hidden = true;   // «Zal ochish» xona yaratishni almashtiradi
    socRender();
  } catch (e) { console.warn('social', e); }
}
let pubT = 0;
function socPublish() {
  const db = SOC.db; if (!db) return Promise.resolve();
  const name = myName(), nl = cleanName(name);
  ui.socId.textContent = myId();
  return Promise.all([
    db.update(`users/${db.uid}`, { name, nl, tag: SOC.tag, look: cfg.look, on: true, seen: db.stamp(), room: NET.code || '' }),
    db.set(`ids/${nl}_${SOC.tag}`, db.uid),
  ]).catch(() => {});
}
function socFriends(v) {
  const db = SOC.db;
  SOC.friends = v;
  for (const id of Object.keys(SOC.fsub)) if (!v[id]) { SOC.fsub[id](); delete SOC.fsub[id]; delete SOC.fdata[id]; }
  for (const id of Object.keys(v)) if (!SOC.fsub[id]) SOC.fsub[id] = db.on(`users/${id}`, (u) => { SOC.fdata[id] = u || {}; socRender(); });
  socRender();
}
const liveLobby = (L) => L && L.phase === 'lobby' && (L.n | 0) < (L.max || 4) && Date.now() - (L.at || 0) < 3 * 3600e3;
function socRow(host, look, title, sub, acts, online) {
  const li = document.createElement('li');
  const img = document.createElement('img'); img.src = avatarURL(clamp(look | 0, 0, 3)); img.alt = '';
  const box = document.createElement('div'), b = document.createElement('b'), sm = document.createElement('small');
  if (online !== undefined) { const d = document.createElement('i'); d.className = 'dot' + (online ? ' on' : ''); b.appendChild(d); }
  b.append(title); sm.textContent = sub; box.append(b, sm);
  const a = document.createElement('div'); a.className = 'acts';
  for (const [label, fn, primary] of acts) { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'btn sm ' + (primary ? 'primary' : 'ghost'); bt.textContent = label; bt.addEventListener('click', fn); a.appendChild(bt); }
  li.append(img, box, a); host.appendChild(li);
}
function socRender() {
  const db = SOC.db; if (!db) return;
  ui.socId.textContent = myId();
  const inRoom = !!(NET.code && NET.named);
  ui.hallOpen.parentElement.hidden = inRoom; ui.hallPub.parentElement.hidden = inRoom;
  // zallar: ochiq yoki do‘stimniki
  ui.hallList.innerHTML = '';
  const halls = Object.entries(SOC.lobbies).filter(([, L]) => liveLobby(L) && (L.pub || SOC.friends[L.host] || L.host === db.uid)).sort((a, b) => (b[1].at || 0) - (a[1].at || 0)).slice(0, 8);
  for (const [code, L] of halls) {
    const mine = L.host === db.uid || code === NET.code;
    socRow(ui.hallList, L.look, `${L.hostName || 'Zal'}ning zali`, `${L.n | 0}/${L.max || 4} o‘yinchi · ${DIFFS[L.diff] ? DIFFS[L.diff].name : ''}${L.team ? ' · 2×2' : ''}${L.pub ? '' : ' · do‘stlar uchun'}`,
      mine ? [] : [['Kirish', () => enterRoom(code, false), true]]);
  }
  if (!halls.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Hozir ochiq zal yo‘q — o‘zing och!'; ui.hallList.appendChild(li); }
  // do‘stlik so‘rovlari
  ui.frReq.innerHTML = '';
  for (const [id, r] of Object.entries(SOC.reqs)) socRow(ui.frReq, r.look, `${r.name}#${r.tag}`, 'do‘stlik so‘ramoqda', [['✓', () => socAccept(id), true], ['✕', () => db.remove(`requests/${db.uid}/${id}`)]]);
  // do‘stlar
  ui.frList.innerHTML = '';
  const fr = Object.keys(SOC.friends).map((id) => [id, SOC.fdata[id] || {}]).sort((a, b) => (b[1].on ? 1 : 0) - (a[1].on ? 1 : 0));
  for (const [id, u] of fr) {
    const L = u.room && SOC.lobbies[u.room], acts = [];
    if (u.on && L && liveLobby(L) && u.room !== NET.code) acts.push(['Qo‘shilish', () => enterRoom(u.room, false), true]);
    if (u.on && NET.code && NET.named && u.room !== NET.code) acts.push(['Chaqirish', () => socInvite(id, u), !acts.length]);
    socRow(ui.frList, u.look, `${u.name || '…'}#${u.tag || ''}`, u.on ? (u.room ? (u.room === NET.code ? 'sen bilan zalda' : 'zalda') : 'onlayn') : 'oflayn', acts, !!u.on);
  }
  ui.frCount.textContent = fr.length ? `· ${fr.filter(([, u]) => u.on).length}/${fr.length} onlayn` : '';
  if (!fr.length && !Object.keys(SOC.reqs).length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = 'Do‘stingning ID sini so‘ra (masalan, Ali#4821) va yuqoriga yoz.'; ui.frList.appendChild(li); }
}
async function socAdd() {
  const db = SOC.db, raw = (ui.frIn.value || '').trim();
  ui.frSearch.innerHTML = ''; ui.frMsg.textContent = '';
  if (!db || !raw) return;
  const m = raw.match(/^(.+?)#(\d{4})$/);
  if (m) {
    const uid = await db.get(`ids/${cleanName(m[1])}_${m[2]}`);
    if (!uid) { ui.frMsg.textContent = 'Bunday ID topilmadi. Ism va 4 xonali raqamni tekshir.'; return; }
    socRequest(uid);
    return;
  }
  const list = (await db.searchUsers(cleanName(raw))).filter((u) => u.uid !== db.uid);
  if (!list.length) { ui.frMsg.textContent = 'Hech kim topilmadi. To‘liq ID ni yozib ko‘r: Ism#1234'; return; }
  for (const u of list) socRow(ui.frSearch, u.look, `${u.name}#${u.tag}`, SOC.friends[u.uid] ? 'allaqachon do‘sting' : u.on ? 'onlayn' : 'oflayn', SOC.friends[u.uid] ? [] : [['➕', () => socRequest(u.uid), true]], !!u.on);
}
async function socRequest(uid) {
  const db = SOC.db;
  if (uid === db.uid) { ui.frMsg.textContent = 'Bu o‘zingning ID ing 🙂'; return; }
  if (SOC.friends[uid]) { ui.frMsg.textContent = 'U allaqachon do‘sting.'; return; }
  if (SOC.reqs[uid]) { socAccept(uid); return; }   // u ham so‘ragan bo‘lsa — darhol do‘st
  await db.set(`requests/${uid}/${db.uid}`, { name: myName(), tag: SOC.tag, look: cfg.look, at: db.stamp() });
  ui.frMsg.textContent = '✓ So‘rov yuborildi — u qabul qilgach, ro‘yxatingda chiqadi.';
  ui.frIn.value = ''; ui.frSearch.innerHTML = '';
}
async function socAccept(uid) {
  const db = SOC.db;
  await db.set(`friends/${db.uid}/${uid}`, true);
  await db.set(`friends/${uid}/${db.uid}`, true);
  await db.remove(`requests/${db.uid}/${uid}`);
}
function socInvite(uid) {
  const db = SOC.db;
  if (!NET.code) return;
  db.set(`invites/${uid}/${db.uid}`, { code: NET.code, name: myName(), at: Date.now() });
  ui.frMsg.textContent = '✓ Taklif yuborildi.';
}
function socInvites() {
  const db = SOC.db;
  const list = Object.entries(SOC.invites).filter(([, v]) => v && v.code && Date.now() - (v.at || 0) < 5 * 60e3 && v.code !== NET.code);
  const [id, v] = list.sort((a, b) => b[1].at - a[1].at)[0] || [];
  if (!v) { ui.invBar.hidden = true; SOC.inv = null; return; }
  SOC.inv = { id, v };
  ui.invTxt.textContent = `🎲 ${v.name} seni zalga chaqiryapti!`;
  ui.invBar.hidden = false;
  if (!SOC.seenInv[id + v.at]) { SOC.seenInv[id + v.at] = 1; buzz([40, 30, 40]); Sound.init(); Sound.ok(); }
}
function invAnswer(yes) {
  const db = SOC.db, inv = SOC.inv;
  ui.invBar.hidden = true;
  if (!inv) return;
  db.remove(`invites/${db.uid}/${inv.id}`);
  if (yes) {
    if (G.mode === 'play' || G.mode === 'paused' || G.mode === 'won' || G.mode === 'over') toMenu();
    enterRoom(inv.v.code, false);
    setTimeout(() => { const el = $('online'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }, 200);
  }
}
// Zal: xona ochilganda ro‘yxatga yoziladi, egasi chiqsa o‘chadi.
function socRoomJoined(code, host) {
  const db = SOC.db; if (!db) return;
  db.update(`users/${db.uid}`, { room: code }).catch(() => {});
  if (host) {
    db.set(`lobbies/${code}`, { host: db.uid, hostName: myName(), look: cfg.look, pub: !!ui.hallPub.checked, n: 1, max: 4, diff: selDiff(), team: cfg.team ? 1 : 0, phase: 'lobby', at: Date.now() });
    db.onDisconnect(`lobbies/${code}`, null);
  }
  socRender();
}
function socRoomLeft(code, host) {
  const db = SOC.db; if (!db) return;
  db.update(`users/${db.uid}`, { room: '' }).catch(() => {});
  if (host && code) db.remove(`lobbies/${code}`);
}
function socLobby(patch) { const db = SOC.db; if (db && NET.host && NET.code) db.update(`lobbies/${NET.code}`, Object.assign({ at: Date.now() }, patch)).catch(() => {}); }
function quickPlay() {
  const db = SOC.db; if (!db) return;
  const open = Object.entries(SOC.lobbies).filter(([code, L]) => liveLobby(L) && L.pub && L.host !== db.uid && code !== NET.code).sort((a, b) => (b[1].n | 0) - (a[1].n | 0));
  if (open.length) enterRoom(open[0][0], false); else createRoom();
}

/* ================= Yuklanish ekrani: 0–100%, shu payt reklama (cheklov bilan) ================= */
['loader', 'ldFill', 'ldPct', 'ldAd', 'ldAdC', 'ldTip', 'ldKicker'].forEach((id) => { ui[id] = $(id); });
function socPublishSoon() { clearTimeout(pubT); pubT = setTimeout(socPublish, 800); }
export { SOC, cleanName, myName, myId, socialInit, pubT, socPublish, socFriends, liveLobby, socRow, socRender, socAdd, socRequest, socAccept, socInvite, socInvites, invAnswer, socRoomJoined, socRoomLeft, socLobby, quickPlay, socPublishSoon };
