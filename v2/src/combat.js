// CombatSystem: duel — taklif/qabul/rad, hisob, onlayn sinxron (duelNet), duel UI.
import { Sound } from './audio.js';
import { pushBack } from './beasts.js';
import { BOT_SKILL, ears } from './bots.js';
import { openCard, setMain } from './cards.js';
import { DUEL_ASK_S, DUEL_COOL, DUEL_COUNT, DUEL_R, DUEL_S, ECON } from './content.js';
import { toast } from './hud.js';
import { feed } from './magic.js';
import { netFlush } from './net-room.js';
import { giveCoins, sameTeam } from './player.js';
import { G, NET, freeP, me, remoteList } from './state.js';
import { toolsOpen } from './toolsui.js';
// Onlayn imzo (presence `dl`): {to: peer, id, st: ask|ok|no|run|done, n: bosishlar}
function dlSet(patch) {
  if (!G.online || !NET.named) return;
  NET.dl = patch ? Object.assign({}, NET.dl && NET.dl.id === patch.id ? NET.dl : {}, patch) : null;
  NET.dirty = true; netFlush();
}
function duelCandidates(p) {
  if (G.mode !== 'play' || !freeP(p) || p.jail || p.duel || p.duelCool > 0 || p.pick) return [];
  const out = [], dist = (x, y) => Math.hypot(x - p.px, y - p.py);
  for (const q of G.players) {
    if (q === p || !q.bot || !q.alive || q.finished || !freeP(q) || q.jail || q.cloak > 0 || q.duel || q.duelCool > 0 || sameTeam(p, q)) continue;
    const d = dist(q.px, q.py);
    if (d <= DUEL_R) out.push({ kind: 'bot', q, name: q.name, d });
  }
  if (G.online && NET.named) for (const r of remoteList()) {
    if (r.isBot || !r.alive || r.fin || r.jail || !r.peer || sameTeam(p, r)) continue;
    const d = dist(r.x, r.y);
    if (d <= DUEL_R) out.push({ kind: 'remote', r, name: r.name, peer: r.peer, d });
  }
  return out.sort((a, b) => a.d - b.d);
}
function duelChallenge(p) {
  const c = duelCandidates(p)[0];
  if (!c) { toast(p, '⚔️ Yaqinda duelga mos raqib yo‘q.'); return; }
  toolsOpen(p, false);
  if (c.kind === 'bot') {
    if (Math.random() < 0.15) { toast(p, `⚔️ ${c.name} duelni rad etdi — qo‘rqoq! 😄`, 3000); p.duelCool = 12; return; }
    duelBegin(p, { kind: 'bot', q: c.q, name: c.name, rate: [4.6, 5.8, 7][BOT_SKILL.indexOf(c.q.bot.K)] * (0.85 + Math.random() * 0.3) }, 'c', 0);
    return;
  }
  p.duel = { id: ++NET.duelN, role: 'c', opp: { kind: 'remote', peer: c.peer, name: c.name }, st: 'ask', t0: G.time, oppN: 0, oppDone: false };
  dlSet({ to: c.peer, id: p.duel.id, st: 'ask' });
  toast(p, `⚔️ ${c.name}ga duel taklif qilindi — javobni kut (${DUEL_ASK_S} s)…`, 3600);
}
function duelBegin(p, opp, role, id) {
  p.duel = Object.assign(p.duel && id && p.duel.id === id ? p.duel : {}, { id, role, opp, st: 'run', t0: G.time, oppN: 0, oppDone: false });
  if (opp.kind === 'bot') { opp.q.duel = { opp: 'human' }; opp.q.pending = { t: DUEL_COUNT + DUEL_S + 5, fn: () => {} }; }
  duelCard(p);
}
function duelCard(p) {
  const D = p.duel;
  openCard(p, { kind: 'duel', icon: '⚔️', kicker: 'DUEL', title: `${D.opp.name} bilan duel`, rhyme: 'Kim tezroq bossa —\no‘sha kuchli!',
    shart: `${DUEL_S} soniya ichida raqibingdan ko‘proq bos (tugma yoki Space).`, xus: `Yutgan ${ECON.duel} tanga oladi; yutqazgan shuncha tanga yo‘qotib, orqaga uloqtiriladi.`,
    game: { type: 'duel', opp: D.opp }, onResult: (ok, c) => duelSettle(p, c), onClose: (ok, c) => duelAfter(p, c) });
  const c = p.card;
  if (!c) return;
  c.duel = true; c.stage = 'play'; c.root.classList.add('playing'); c.el.back.hidden = true; c.el.result.textContent = '';
  setMain(c);
  c.g.start();
  Sound.horn();
}
function duelSettle(p, c) {
  const R = c.duelResult || { void: true }, D = p.duel;
  p.duelCool = DUEL_COOL;
  if (R.void || !D) return 'Duel bekor qilindi — hech narsa o‘zgarmadi.';
  p.stats.duels++;
  const bot = D.opp.kind === 'bot' ? D.opp.q : null;
  if (R.tie) return `Durang (${R.n} : ${R.oppN}) — hech kim yutmadi.`;
  if (R.win) {
    p.stats.duelWins++; giveCoins(p, ECON.duel); Sound.win();
    feed('duelwin', p, D.opp.name);
    if (bot) { bot.coins -= Math.min(ECON.duel, bot.coins); pushBack(bot, 14, 'dust'); }
    return `Yutding! ${R.n} : ${R.oppN} · +${ECON.duel} 💰`;
  }
  const lost = Math.min(ECON.duel, p.coins);
  p.coins -= lost; c.duelPush = true; Sound.hurt();
  if (bot) { giveCoins(bot, ECON.duel); feed('duelwin', D.opp.name, p); }
  return `Yutqazding ${R.n} : ${R.oppN}${lost ? ` · −${lost} 💰` : ''} — orqaga uloqtirilasan.`;
}
function duelAfter(p, c) {
  const D = p.duel;
  if (!D) return;
  if (D.opp.kind === 'bot') { const q = D.opp.q; q.pending = null; q.duel = null; q.duelCool = DUEL_COOL; if (q.bot) q.bot.wait = 0.5; }
  p.duel = null;
  if (NET.dl && NET.dl.id === D.id) setTimeout(() => { if (NET.dl && NET.dl.id === D.id) dlSet(null); }, 2500);
  if (c.duelPush) pushBack(p, 14, 'dust');
}
// Duel bekor: raqib chiqib ketdi / rad etdi / javob bermadi.
function duelAbort(p, msg) {
  const D = p.duel;
  if (!D) return;
  if (p.card && p.card.duel) { p.card.g.abort(msg); return; }
  if (NET.dl && NET.dl.id === D.id) dlSet(null);
  if (D.opp.kind === 'bot') { const q = D.opp.q; q.pending = null; q.duel = null; }
  p.duel = null;
  if (msg) toast(p, msg, 3200);
}
// «Yo‘q» javobi: bir xil imzo qayta yozilmaydi (onPeers har chaqirilganda presence yozib yubormaslik uchun).
function dlNo(peer, id) {
  const d = NET.dl;
  if (d && d.to === peer && d.id === id && d.st === 'no') return;
  dlSet({ to: peer, id, st: 'no' });
  setTimeout(() => { const x = NET.dl; if (x && x.st === 'no' && x.to === peer && x.id === id) dlSet(null); }, 4000);   // rad javobi doim turib qolmasin
}
// Duel holatini butunlay tozalaydi (halok bo‘lish, qamoq, qayta tug‘ilish): eskirgan taklif boshqalarni bezovta qilmasin.
function duelReset(p) {
  const D = p.duel;
  if (D && D.opp.kind === 'bot') { const q = D.opp.q; q.pending = null; q.duel = null; }
  p.duel = null;
  if (p === me()) { NET.duelPrompt = null; if (NET.dl) dlSet(null); }
}
function duelAccept(p) {
  const pr = NET.duelPrompt;
  NET.duelPrompt = null;
  if (!pr) return;
  if (G.time - pr.t > DUEL_ASK_S || !freeP(p) || p.duel || p.jail) { dlNo(pr.peer, pr.id); return; }
  // Raqib hali ham shu taklifni kutayotganini 'run' javobidan bilamiz — shundan keyingina karta ochiladi (eskirgan taklifga «g‘alaba» bo‘lmasin).
  p.duel = { id: pr.id, role: 'a', opp: { kind: 'remote', peer: pr.peer, name: pr.name }, st: 'wait', t0: G.time, oppN: 0, oppDone: false };
  toast(p, `⚔️ ${pr.name} bilan duel — tayyorlanyapti…`, 2000);
  dlSet({ to: pr.peer, id: pr.id, st: 'ok' });
}
function duelDecline(p) {
  const pr = NET.duelPrompt;
  NET.duelPrompt = null;
  if (pr) dlNo(pr.peer, pr.id);
}
// Boshqa odamning imzosi (presence): taklif, qabul, rad, jarayon, tugash.
function duelNet(peer, dl) {
  const m = me();
  if (!m || !m.ui || !NET.me) return;
  const pr = NET.duelPrompt;
  if (pr && pr.peer === peer && (!dl || dl.to !== NET.me || dl.id !== pr.id || dl.st !== 'ask')) NET.duelPrompt = null;   // taklif qilgan odam voz kechdi (yoki halok bo‘ldi) — oyna yo‘qoladi
  if (!dl || dl.to !== NET.me) return;
  const D = m.duel;
  if (dl.st === 'ask') {
    const S = NET.dlSeen || (NET.dlSeen = new Map()), key = peer + '|' + dl.id, now = performance.now();
    for (const [k, t] of S) if (now - t > 30000) S.delete(k);
    if (S.has(key)) return;   // bu taklifga allaqachon javob berilgan (rad etilgan taklif qayta chiqmasin)
    const r = G.remotes.get(peer);
    if (D) {
      // Ikkimiz bir vaqtda bir-birimizga taklif yuborgan bo‘lsak: id kichigi qoladi, ikkinchisi darhol qabul qiladi.
      if (D.st === 'ask' && D.opp.kind === 'remote' && D.opp.peer === peer && NET.me > peer && r && freeP(m) && !m.jail) {
        S.set(key, now); m.duel = null; NET.dl = null;
        NET.duelPrompt = { peer, id: dl.id, name: r.name, t: G.time };
        duelAccept(m);
      }
      return;
    }
    if (NET.duelPrompt) return;   // bittasi javob kutayotgan bo‘lsa, ikkinchisi keyin (to‘lib-toshmasin)
    if (!r || m.duelCool > 0 || !freeP(m) || m.jail || G.mode !== 'play' || m.pick) {   // hozir bo‘sh emas
      if (NET.dl && (NET.dl.to !== peer || NET.dl.id !== dl.id)) return;   // boshqa duelning imzosi hali turibdi — keyinroq javob beramiz
      S.set(key, now); dlNo(peer, dl.id); return;
    }
    S.set(key, now);
    NET.duelPrompt = { peer, id: dl.id, name: r.name, t: G.time };
    ears(m, () => Sound.horn());
    toast(m, `⚔️ ${r.name} seni duelga chaqiryapti! (Y — qabul, N — rad)`, 4200);
    return;
  }
  if (!D || D.opp.kind !== 'remote' || D.opp.peer !== peer || D.id !== dl.id) return;
  if (dl.st === 'no') { if (D.st === 'ask' || D.st === 'wait') duelAbort(m, `⚔️ ${D.opp.name} duelni rad etdi.`); return; }
  if (D.role === 'c' && D.st === 'ask' && (dl.st === 'ok' || dl.st === 'run' || dl.st === 'done')) {   // qabul qilindi — boshlaymiz
    if (!freeP(m) || m.jail) { dlNo(peer, D.id); m.duel = null; toast(m, '⚔️ Duel bekor: sen band eding.', 3000); return; }
    duelBegin(m, D.opp, 'c', D.id);
    dlSet({ to: peer, id: D.id, st: 'run', n: 0 });
  } else if (D.role === 'a' && D.st === 'wait' && (dl.st === 'run' || dl.st === 'done')) {   // raqib tayyor — endi boshlaymiz
    if (!freeP(m) || m.jail) { dlNo(peer, D.id); m.duel = null; toast(m, '⚔️ Duel bekor: sen band eding.', 3000); return; }
    duelBegin(m, D.opp, 'a', D.id);
  }
  if (dl.st === 'run' || dl.st === 'done') {
    D.oppN = Math.max(D.oppN, dl.n);
    if (dl.st === 'done') { D.oppDone = true; D.oppFinal = dl.n; }
  }
}
// HUD: yaqinda mos raqib bo‘lsa «Duel» tugmasi; kelgan taklif oynasi; kutish muddatlari.
function duelUI(p) {
  const u = p.ui;
  if (!u || !u.duelBtn) return;
  const cand = duelCandidates(p);
  u.duelBtn.hidden = !cand.length;
  if (cand.length) u.duelBtn.setAttribute('aria-label', `Duel: ${cand[0].name}`);
  if (cand.length && !p.hintDuel) { p.hintDuel = true; toast(p, `⚔️ ${cand[0].name} yaqin — «Duel» tugmasi (yoki X) bilan jangga chaqir: yutgan 5 tanga oladi!`, 4200); }
  const pr = NET.duelPrompt, D = p.duel;
  if (pr && G.time - pr.t > DUEL_ASK_S) duelDecline(p);
  const show = !!NET.duelPrompt && !p.card && !D;
  u.duelAsk.hidden = !show;
  if (show) { const t = `⚔️ ${NET.duelPrompt.name} duelga chaqiryapti!`; const b = u.duelAsk.querySelector('b'); if (b.textContent !== t) b.textContent = t; }
  if (D && D.st === 'ask' && G.time - D.t0 > DUEL_ASK_S + 2) duelAbort(p, `⚔️ ${D.opp.name} javob bermadi.`);
  else if (D && D.st === 'wait' && G.time - D.t0 > 6) duelAbort(p, `⚔️ ${D.opp.name} duelni boshlamadi — bekor.`);
  else if (D && D.st === 'run' && !(p.card && p.card.duel) && G.time - D.t0 > 3) duelAbort(p);   // karta boshqasi bilan almashib ketgan — duel qolib ketmasin
  if (D && D.opp.kind === 'remote' && D.st !== 'ask' && !G.remotes.has(D.opp.peer)) duelAbort(p, `⚔️ ${D.opp.name} chiqib ketdi — duel bekor.`);
}
export { dlSet, duelCandidates, duelChallenge, duelBegin, duelCard, duelSettle, duelAfter, duelAbort, dlNo, duelReset, duelAccept, duelDecline, duelNet, duelUI };
