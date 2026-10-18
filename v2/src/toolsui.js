// UIManager (sehr paneli): PiP oynalar, do‘kon panelini qurish/ko‘rsatish (toolsBuild/toolsRender), tanlash va ishlatish.
import { FOE_KEYS, PLACE_KEYS, PTRAPS, PTRAP_KEYS, PT_LIFE, PT_MAX, TOOLS } from './content.js';
import { toast } from './hud.js';
import { MAPS, MAP_KEYS, buyMap, canPay, fireTool, priceOf, revengeOn, rivalTargets, shopRows, shopTab, toolCost, toolTargets } from './magic.js';
import { chatOpen } from './net-room.js';
import { PIP_MAX, pipView } from './render.js';
import { G } from './state.js';
import { PWALL, PW_LIFE, myTraps, trapPlace, trapSpot, wallPlace } from './traps.js';
import { touchUI } from './util.js';
function pipClose(p, pp) {
  const k = p.pips.indexOf(pp);
  if (k >= 0) p.pips.splice(k, 1);
  if (pp.el) { pp.el.root.remove(); pp.el = null; }
}
function pipsClear(p) { for (const pp of p.pips.slice()) pipClose(p, pp); }
// Sehr ishlatilganda: shu raqib uchun kichik ekran ochiladi (bor bo‘lsa — yangilanadi). Ko‘pi bilan PIP_MAX ta.
function pipOpen(p, t, key, busy, refl) {
  if (!p.ui || !p.ui.pips) return;
  let pp = p.pips.find((x) => x.id === t.id);
  if (!pp) {
    const q = t.kind === 'local' ? t.q : null;
    pp = { id: t.id, q, rkey: q ? null : (t.bi === undefined ? t.peer : t.peer + '#' + t.bi), fx: {}, born: G.time, idleAt: 0, deadAt: 0, cam: null, actor: null, cap: null, name: t.name, color: (q ? q.color : t.r.color) || '#d6a84c' };
    const root = sabEl('div', 'rvw'), view = sabEl('div', 'rvview'), cap = sabEl('div', 'rvcap'), nm = sabEl('b', '', t.name), fx = sabEl('span', '', '');
    const x = sabEl('button', 'rvx', '✕');
    x.type = 'button'; x.setAttribute('aria-label', 'Oynachani yopish');
    x.addEventListener('click', () => pipClose(p, pp));
    root.style.setProperty('--pc', pp.color);
    view.setAttribute('role', 'img');
    cap.append(nm, fx); root.append(view, cap, x);
    p.ui.pips.appendChild(root);
    pp.el = { root, view, fx };
    p.pips.push(pp);
    while (p.pips.length > PIP_MAX) pipClose(p, p.pips[0]);
  }
  pp.born = G.time; pp.idleAt = 0;
  pp.fx[key] = { at: G.time, wait: !!busy };
  if (refl) { delete pp.fx[key]; pp.fx.refl = { at: G.time, wait: false }; }
  pipsTick(p);
}
function pipCaption(vm) {
  if (!vm.alive) return '☠ halok bo‘ldi';
  const a = [], s = (v) => Math.ceil(v);
  if (vm.wait) a.push('⏳ kutmoqda');
  if (vm.frozen > 0) a.push(`❄️ ${s(vm.frozen)} s`);
  if (vm.slow > 0) a.push(`🍯 ${s(vm.slow)} s`);
  if (vm.scramble > 0) a.push(`🎮 ${s(vm.scramble)} s`);
  if (vm.amnesia > 0) a.push(`🧠 ${s(vm.amnesia)} s`);
  if (vm.refl > 0) a.push('🪞 qaytarildi');
  if (vm.stun > 0) a.push(`💫 ${s(vm.stun)} s`);
  if (vm.jail) a.push('⛓️ qamoqda');
  else if (vm.bandit) a.push('📯 qaroqchi');
  if (vm.fog > 0) a.push('🌫️ tuman');
  if (vm.swap > 0) a.push('🔀 almashdi');
  if (vm.bomb > 0) a.push(`💣 ${s(vm.bomb)} s`);
  if (vm.flip > 0) a.push(`🙃 ${s(vm.flip)} s`);
  if (vm.mask > 0) a.push(`🎭 ${s(vm.mask)} s`);
  if (vm.liar > 0) a.push(`🥴 ${s(vm.liar)} s`);
  if (vm.shut > 0) a.push(`🏪 ${s(vm.shut)} s`);
  if (vm.kmove > 0) a.push('🔑 ko‘chdi');
  if (vm.steal > 0) a.push('🤏 o‘g‘irlandi');
  if (vm.sic > 0) a.push('🚐 ovchi');
  return a.join(' · ') || 'tuzaldi';
}
// 10 marta/s: sarlavhalar yangilanadi; ta’sir tugagach (yoki raqib chiqib ketsa) oynacha yopiladi.
function pipsTick(p) {
  for (const pp of p.pips.slice()) {
    const vm = pipView(pp);
    if (!vm) { pipClose(p, pp); continue; }
    const hold = vm.frozen > 0 || vm.slow > 0 || vm.scramble > 0 || vm.amnesia > 0 || vm.jail || vm.bandit || vm.wait || vm.fog > 0 || vm.swap > 0 || vm.refl > 0 || vm.bomb > 0 || vm.flip > 0 || vm.mask > 0 || vm.liar > 0 || vm.shut > 0 || vm.kmove > 0 || vm.steal > 0 || vm.sic > 0;
    pp.deadAt = vm.alive ? 0 : pp.deadAt || G.time;
    if (hold || (pp.deadAt && G.time - pp.deadAt < 2.5)) pp.idleAt = 0; else if (!pp.idleAt) pp.idleAt = G.time;
    if (pp.idleAt && G.time - pp.idleAt > 1.5 && G.time - pp.born > 3) { pipClose(p, pp); continue; }
    const txt = pipCaption(vm);
    if (pp.cap !== txt) { pp.cap = txt; pp.el.fx.textContent = txt; pp.el.view.setAttribute('aria-label', `${pp.name}: ${txt}`); }
  }
}

/* ---- 🪄 xalaqit paneli ---- */
const sabEl = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
function toolsOpen(p, on) {
  if (!p.ui || !p.ui.sabBtn) return;
  if (on && !p.ui.chatPanel.hidden) chatOpen(p, false);
  p.sab.open = !!on; p.sab.step = 'tools'; p.sab.key = null; p.sab.sig = '';
  toolsRender(p);
}
function toolsTab(p, tab) {
  if (!rivalTargets(p).length) tab = 'map';   // raqib bo‘lmasa sehr ham, tuzoq ham kerak emas
  p.sab.tab = tab; p.sab.step = 'tools'; p.sab.sig = '';
  toolsRender(p);
}
function toolsPick(p, key) {
  if (TOOLS[key].self || TOOLS[key].all) { toolsDo(p, key, null); return; }
  const list = toolTargets(p, key);
  if (!list.length) { toast(p, 'Hozircha raqib yo‘q.'); return; }
  if (list.length === 1) { toolsDo(p, key, list[0].id); return; }
  p.sab.step = 'target'; p.sab.key = key; p.sab.sig = '';
  toolsRender(p);
}
// Nishon bosish paytidagi holat bo‘yicha qayta olinadi (raqib yurib ketgan bo‘lishi mumkin).
function toolsDo(p, key, id) {
  const t = TOOLS[key].self || TOOLS[key].all ? null : toolTargets(p, key).find((x) => x.id === id);
  const r = fireTool(p, key, t);
  if (!r.ok) { toast(p, r.msg); return; }
  toolsOpen(p, false);
}
function toolsKey(p, n) {
  if (p.sab.step === 'tools') {
    const row = shopRows(p)[n - 1];
    if (!row) return;
    if (row.type === 'map') { buyMapUI(p, row.key); return; }
    if (row.type === 'trap') { trapPlace(p, row.key); return; }
    if (row.type === 'wall') { if (wallPlace(p)) toolsOpen(p, false); return; }
    if (p.tools[row.key] > 0 || canPay(p, priceOf(p, TOOLS[row.key].price))) toolsPick(p, row.key); else toast(p, p.shutT > 0 ? `🏪 Do‘kon yopiq (${Math.ceil(p.shutT)} s): faqat sumkadagi sehrlar.` : `Pul yetmaydi: ${priceOf(p, TOOLS[row.key].price)} 💰 kerak.`);
  } else {
    const t = toolTargets(p, p.sab.key)[n - 1];
    if (t) toolsDo(p, p.sab.key, t.id);
  }
}
function buyMapUI(p, key) {
  const r = buyMap(p, key);
  if (!r.ok) { toast(p, r.msg); return; }
  toolsOpen(p, false);
}
function toolsBuild(p, targets) {
  const S = p.sab, P = p.ui.sabPanel, ref = { rows: [] };
  P.textContent = '';
  const head = sabEl('div', 'sab-head');
  ref.title = sabEl('b', 'sab-title', S.step === 'tools' ? 'Sehrli do‘kon' : `${TOOLS[S.key].icon} ${TOOLS[S.key].name} — kimga?`);
  ref.coins = sabEl('span', 'sab-coins', '');
  const x = sabEl('button', 'sab-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Yopish');
  x.addEventListener('click', () => toolsOpen(p, false));
  head.append(ref.title, ref.coins, x);
  P.append(head);
  const numKbd = (n) => (touchUI || n > 10 ? null : sabEl('kbd', 'k', String(n % 10)));   // faqat 1–9 va 0 bosiladi
  if (S.step === 'tools') {
    const rivals = rivalTargets(p).length, tab = shopTab(p);
    if (rivals) {
      const bar = sabEl('div', 'sab-tabs');
      for (const [id, label, hot] of [['tool', '🪄 Xalaqit', 'Q'], ['trap', '🪤 Tuzoq', 'R'], ['map', '🗺️ Xaritalar', 'E']]) {
        const b = sabEl('button', 'sab-tab' + (tab === id ? ' on' : ''));
        b.type = 'button'; if (!touchUI) b.append(sabEl('kbd', 'k', hot)); b.append(label);
        b.addEventListener('click', () => toolsTab(p, id));
        bar.append(b);
      }
      P.append(bar);
    }
    P.append(sabEl('p', 'sab-sub', tab === 'tool' ? 'Sehrni pulga sotib ol yoki yo‘lda topgan sehringni ishlat — keyin kimga tegishini tanlaysan.' : tab === 'trap' ? `Tuzoqni turgan joyingga qo‘yib ketasan — faqat sen ko‘rasan. Raqib bossa ishlaydi (bir vaqtda ${PT_MAX} tagacha, ${PT_LIFE / 60} daqiqa turadi). Teleport tuzog‘ida manzilni o‘zing ochgan joylardan tanlaysan. 🚧 Devor esa hammaga ko‘rinadi: oldingdagi yo‘lakni ${PW_LIFE} soniya to‘saydi.` : 'Juda qimmat! Labirintda ham har xaritadan bittadan yashirin turibdi.'));
    if (tab === 'trap') { ref.spot = sabEl('p', 'sab-sub sab-spot', ''); P.append(ref.spot); }
    let n = 0, lastGrp = '';
    for (const rw of shopRows(p)) {
      n++;
      const def = rw.type === 'tool' ? TOOLS[rw.key] : rw.type === 'trap' ? PTRAPS[rw.key] : rw.type === 'wall' ? PWALL : MAPS[rw.key];
      if (rw.type === 'tool' && def.grp !== lastGrp) { lastGrp = def.grp; P.append(sabEl('p', 'sab-grp', def.grp)); }
      const row = sabEl('div', 'sab-row'), mid = sabEl('div', 'sab-mid');
      mid.append(sabEl('b', '', def.name), sabEl('small', '', def.text));
      const go = sabEl('button', 'sab-go'), kb = numKbd(n), lab = sabEl('span');
      go.type = 'button'; if (kb) go.append(kb); go.append(lab);
      go.addEventListener('click', () => (rw.type === 'tool' ? toolsPick(p, rw.key) : rw.type === 'trap' ? trapPlace(p, rw.key) : rw.type === 'wall' ? (wallPlace(p) && toolsOpen(p, false)) : buyMapUI(p, rw.key)));
      row.append(sabEl('span', 'sab-ic', def.icon), mid, go);
      P.append(row);
      ref.rows.push({ type: rw.type, key: rw.key, row, go, lab });
    }
  } else {
    P.append(sabEl('p', 'sab-sub', 'Raqiblar chiqishga yaqinlik bo‘yicha o‘rinlangan (1-o‘rin — oldinda ketayotgan).'));
    targets.forEach((t, ix) => {
      const row = sabEl('div', 'sab-row'), dot = sabEl('span', 'sab-dot'), mid = sabEl('div', 'sab-mid');
      dot.style.background = (t.kind === 'local' ? t.q.color : t.r.color) || '#ccc';
      const nm = sabEl('b', '', t.name), tag = sabEl('span', 'tag', '🥇 yetakchi'), small = sabEl('small', '');
      nm.append(tag); mid.append(nm, small);
      const go = sabEl('button', 'sab-go'), kb = numKbd(ix + 1), lab = sabEl('span'), rev = sabEl('span', 'tag rev', '😈 qasos −50%');
      rev.hidden = true; nm.append(rev);
      go.type = 'button'; if (kb) go.append(kb); go.append(lab);
      go.addEventListener('click', () => toolsDo(p, S.key, t.id));
      row.append(dot, mid, go);
      P.append(row);
      ref.rows.push({ id: t.id, row, go, tag, small, lab, rev });
    });
    const back = sabEl('button', 'sab-go sab-back', '← Orqaga'); back.type = 'button';
    back.addEventListener('click', () => toolsOpen(p, true));
    P.append(back);
  }
  S.ref = ref;
}
function toolsRender(p) {
  const u = p.ui, S = p.sab;
  if (!u || !u.sabBtn) return;
  const playing = G.mode === 'play', rivals = playing ? rivalTargets(p).length : 0;
  const show = playing && p.alive && !p.finished && !p.card && !(G.tut && !G.tut.L.bots);
  const total = FOE_KEYS.reduce((a, k) => a + p.tools[k], 0) + PTRAP_KEYS.reduce((a, k) => a + p.tbag[k], 0);
  u.sabBtn.hidden = !show;
  const afford = (rivals > 0 && (FOE_KEYS.some((k) => p.tools[k] > 0 || canPay(p, priceOf(p, TOOLS[k].price))) || PLACE_KEYS.some((k) => p.tbag[k] > 0))) || MAP_KEYS.some((k) => !MAPS[k].has(p) && !MAPS[k].useless(p) && canPay(p, priceOf(p, MAPS[k].price())));
  u.sabBtn.classList.toggle('locked', p.shutT > 0);
  u.sabBtn.classList.toggle('ready', show && afford);
  const nTxt = total ? String(total) : '';
  if (u.sabN.textContent !== nTxt) u.sabN.textContent = nTxt;
  u.sabN.hidden = !total;
  if (!show) S.open = false;
  u.sabPanel.hidden = !S.open;
  if (!S.open) { S.sig = ''; S.ref = null; return; }
  // Qatorlar faqat tuzilma o‘zgarganda qayta quriladi; matn va holat joyida yangilanadi (bosish paytida tugma almashib ketmasin).
  const targets = S.step === 'target' ? toolTargets(p, S.key) : null;
  const sig = S.step === 'tools' ? `tools:${rivals > 0 ? 1 : 0}:${shopTab(p)}` : `target:${S.key}:${targets.map((t) => t.id).join(',')}`;
  if (sig !== S.sig || !S.ref) { S.sig = sig; toolsBuild(p, targets); }
  const ref = S.ref, coinTxt = `${p.coins} 💰`;
  if (ref.coins.textContent !== coinTxt) ref.coins.textContent = coinTxt;
  if (S.step === 'tools') {
    for (const r of ref.rows) {
      let can, txt, own = false;
      const lock = p.shutT > 0;
      if (r.type === 'tool') {
        const def = TOOLS[r.key], n = p.tools[r.key], price = priceOf(p, def.price);
        own = n > 0; can = own || canPay(p, price); txt = own ? `Ishlat ×${n}` : lock ? '🔒 yopiq' : `${price} 💰`;
      } else if (r.type === 'trap' || r.type === 'wall') {
        const def = r.type === 'wall' ? PWALL : PTRAPS[r.key], n = p.tbag[r.key], price = priceOf(p, def.price);
        own = n > 0; can = own || canPay(p, price); txt = own ? `Qo‘y ×${n}` : lock ? '🔒 yopiq' : `${price} 💰`;
      } else {
        const def = MAPS[r.key], price = priceOf(p, def.price()), has = def.has(p), useless = def.useless(p);
        can = !has && !useless && canPay(p, price); txt = has ? 'Bor ✓' : useless ? 'Kerak emas' : lock ? '🔒 yopiq' : `${price} 💰`;
      }
      if (r.lab.textContent !== txt) r.lab.textContent = txt;
      r.go.disabled = !can; r.go.classList.toggle('own', own); r.row.classList.toggle('off', !can);
    }
    if (ref.spot) {
      const why = trapSpot(p), txt = why ? '📍 ' + why : `📍 Shu yerga qo‘yish mumkin (${myTraps(p).length}/${PT_MAX})`;
      if (ref.spot.textContent !== txt) ref.spot.textContent = txt;
    }
  } else {
    targets.forEach((t, k) => {
      const r = ref.rows[k];
      const txt = t.why ? `${t.rank}-o‘rin · ${t.why}` : `${t.rank}-o‘rin${t.kind === 'remote' ? ' · onlayn' : ''}`;
      if (r.small.textContent !== txt) r.small.textContent = txt;
      r.rev.hidden = !revengeOn(p, t.id);
      const own = p.tools[S.key] > 0, lt = own ? 'Ishlat' : `${toolCost(p, S.key, t)} 💰`;
      if (r.lab.textContent !== lt) r.lab.textContent = lt;
      r.tag.hidden = t.rank !== 1;
      r.go.disabled = !!t.why; r.row.classList.toggle('off', !!t.why);
    });
  }
}
// Bot kalit joyini bilmaydi; ma’lum vaqtdan keyin xaritani «topgandek» kalit tomonga yo‘naladi (mahoratiga qarab).
// Bot kalit joyini bilmaydi: o‘yinchi kabi, puli yetsa do‘kondan kalit xaritasini sotib oladi (yashirin ma’lumotdan foydalanmaydi).
export { pipClose, pipsClear, pipOpen, pipCaption, pipsTick, sabEl, toolsOpen, toolsTab, toolsPick, toolsDo, toolsKey, buyMapUI, toolsBuild, toolsRender };
