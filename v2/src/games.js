// Mini-o‘yinlar: har bir o‘yin fabrikasi (DiceGame … Connect4Game, DuelGame), GAMES ro‘yxati, zar (buildDie/setDie), umumiy boshqaruv yordamchilari.
import { Sound } from './audio.js';
import { PIPS, ROT, finishCard, setMain } from './cards.js';
import { dlSet } from './combat.js';
import { ACT_KEYS, ARROW, BEASTS, CHEST, DIRS, DUEL_COUNT, DUEL_S, L3, QGEN, RIDDLES, TRAPS, V, pickN, ri } from './content.js';
import { inputVec, keysDown } from './input.js';
import { EMOJI_FONT, floatText } from './render.js';
import { G, GAME_REG, lvl } from './state.js';
import { TAU, clamp, lerp, pickRand, reduceMotion, shuffle, touchUI } from './util.js';
function DuelGame(spec, c) {
  const p = c.p, D = p.duel, rem = spec.opp.kind === 'remote';
  const q = setGame(c, `<div class="duel"><div class="dbar"><span class="dn">Sen</span><div class="dtrack"><i class="dme"></i></div><b class="dcnt dm">0</b></div><div class="dbar opp"><span class="dn"></span><div class="dtrack"><i class="dop"></i></div><b class="dcnt do">0</b></div><div class="dtime">Tayyor bo‘l…</div><button class="bigbtn idle" type="button">BOS!</button></div>`);
  q('.opp .dn').textContent = spec.opp.name;
  const btn = q('.bigbtn'), tm = q('.dtime'), bm = q('.dme'), bo = q('.dop'), cm = q('.dm'), co = q('.do');
  let st = 'wait', t = 0, n = 0, oppN = 0, sentN = -1, sentAt = -9, endAt = 0, runT = 0;
  const draw = () => { const sc = Math.max(40, n, oppN) * 1.1; bm.style.width = (n / sc) * 100 + '%'; bo.style.width = (oppN / sc) * 100 + '%'; cm.textContent = n; co.textContent = oppN; };
  const press = () => { if (st !== 'run') return; n++; Sound.tap(); bump(btn, 'hit'); draw(); };
  const done = (final, abortMsg) => {
    if (c.stage === 'result') return;
    st = 'end';
    if (abortMsg) { c.duelResult = { void: true }; finishCard(c, false, abortMsg); return; }
    c.duelResult = { n, oppN: final, win: n > final, tie: n === final };
    finishCard(c, n > final, n > final ? 'Raqibingdan ko‘p bosding!' : n === final ? 'Teng bosdingiz.' : 'Raqib ko‘proq bosdi.', n === final ? 'warn' : undefined);
  };
  tap(c, btn, press);
  draw();
  return {
    start() { st = 'count'; t = DUEL_COUNT; },
    update(dt) {
      if (st === 'count') {
        t -= dt; tm.textContent = t > 0 ? String(Math.ceil(t)) : 'BOS!';
        if (t <= 0) { st = 'run'; t = DUEL_S; runT = 0; btn.classList.remove('idle'); }
        return;
      }
      if (st === 'run') {
        t -= dt; runT += dt; tm.textContent = fmt1(Math.max(0, t)) + ' s';
        oppN = rem ? Math.max(oppN, D.oppN) : Math.floor(spec.opp.rate * Math.min(DUEL_S, runT));
        if (rem && (n !== sentN) && G.time - sentAt > 0.2) { sentN = n; sentAt = G.time; dlSet({ to: spec.opp.peer, id: D.id, st: 'run', n }); }
        draw();
        if (t <= 0) {
          st = 'wait2'; endAt = G.time; btn.classList.add('idle'); tm.textContent = 'Tugadi!';
          if (rem) dlSet({ to: spec.opp.peer, id: D.id, st: 'done', n });
        }
        return;
      }
      if (st === 'wait2') {
        if (!rem) { oppN = Math.floor(spec.opp.rate * DUEL_S); draw(); done(oppN); return; }
        oppN = Math.max(oppN, D.oppN); draw();
        if (D.oppDone) done(D.oppFinal); else if (G.time - endAt > 6) done(oppN);
      }
    },
    action: press,
    abort(msg) { done(0, msg); },
  };
}

/* ---- Xalaqit oynachasi: yuborgan sehring raqibga qanday ta’sir qilayotgani ---- */
function buildDie(el) {
  const cube = el.querySelector('.cube');
  for (let v = 1; v <= 6; v++) {
    const f = document.createElement('div');
    f.className = 'face f' + v;
    for (const q of PIPS[v]) { const i = document.createElement('i'); i.style.gridArea = `${Math.ceil(q / 3)} / ${((q - 1) % 3) + 1}`; f.appendChild(i); }
    cube.appendChild(f);
  }
  el.spin = { x: 0, y: 0 };
  setDie(el, 1 + ((Math.random() * 6) | 0), false);
}
function setDie(el, v, tumble) {
  const s = el.spin;
  if (tumble) { s.x += 2 + ((Math.random() * 2) | 0); s.y += 1 + ((Math.random() * 2) | 0); }
  const [rx, ry] = ROT[v];
  el.querySelector('.cube').style.transform = `rotateX(${rx + 360 * s.x}deg) rotateY(${ry + 360 * s.y}deg)`;
  el.setAttribute('aria-label', 'Zar: ' + v);
}
const fmt1 = (x) => x.toFixed(1).replace('.', ',');
const live = (c) => c.stage === 'play' && c.p.card === c && G.mode === 'play';
function setGame(c, html) { c.el.game.innerHTML = html; return (s) => c.el.game.querySelector(s); }
function tap(c, el, fn) { el.addEventListener('pointerdown', (e) => { e.preventDefault(); c.idle = 0; if (live(c)) fn(e); }); }
const timeBar = (bar, t, T0) => { if (bar) bar.style.width = clamp(t / T0, 0, 1) * 100 + '%'; };
const bump = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
// To‘rt tomonga joylashgan javob tugmalari: klaviatura/joystik yo‘nalishi — shu javob.
const crossHTML = (cls) => `<div class="xpick ${cls || ''}">${DIRS.map((d) => `<button class="xb ${d}" type="button" data-d="${d}" data-a="${ARROW[d]}"></button>`).join('')}</div>`;
function crossBind(c, onPick) {
  const btns = {};
  c.el.game.querySelectorAll('.xb').forEach((b) => { btns[b.dataset.d] = b; tap(c, b, () => { if (!b.hidden && !b.disabled) onPick(b.dataset.d); }); });
  return btns;
}
function crossFill(btns, labels) {
  DIRS.forEach((d, k) => {
    const v = Array.isArray(labels) ? labels[k] : labels[d], b = btns[d];
    b.className = 'xb ' + d; b.disabled = false; b.hidden = v === undefined || v === null;
    if (!b.hidden) b.textContent = v;
  });
}
// Katakli o‘yinlar uchun kursor: yo‘nalish — kursor, harakat tugmasi — tanlash.
function gridNav(c, btns, cols, pick) {
  let cur = -1;
  const rows = Math.ceil(btns.length / cols);
  const show = () => btns.forEach((b, k) => b.classList.toggle('cur', k === cur));
  btns.forEach((b, k) => tap(c, b, () => pick(k)));
  return {
    dir(d) {
      if (cur < 0) cur = 0;
      else {
        let r = (cur / cols) | 0, k = cur % cols;
        if (d === 'left') k = (k + cols - 1) % cols; else if (d === 'right') k = (k + 1) % cols;
        else if (d === 'up') r = (r + rows - 1) % rows; else r = (r + 1) % rows;
        cur = Math.min(btns.length - 1, r * cols + k);
      }
      show();
    },
    act() { if (cur >= 0) pick(cur); },
  };
}

/* ---- Zar ---- */
function DiceGame(spec, c) {
  const area = c.el.game;
  area.innerHTML = '<div class="tray"><div class="dice"><div class="die"><div class="tilt"><div class="cube"></div></div></div><div class="die"><div class="tilt"><div class="cube"></div></div></div></div><div class="tries"></div></div>';
  const dice = area.querySelectorAll('.die'), tries = area.querySelector('.tries'), max = spec.tries || 1;
  dice.forEach(buildDie);
  const g = { mainLabel: 'Zar tashla', busy: false, att: 0, roll: 0, a: 1, b: 1 };
  const drawTries = () => {
    tries.textContent = '';
    if (c.info) { tries.textContent = c.info; return; }
    const lb = document.createElement('span'); lb.className = 'lbl'; lb.textContent = 'Urinish'; tries.appendChild(lb);
    for (let k = 0; k < max; k++) { const s = document.createElement('span'); s.className = 'pip' + (k < g.att ? ' used' : ''); tries.appendChild(s); }
  };
  drawTries();
  g.action = () => {
    if (g.busy || c.stage !== 'play') return;
    if (c.kind !== 'jail') c.el.back.hidden = true;
    g.busy = true; setMain(c);
    g.a = 1 + ((Math.random() * 6) | 0); g.b = 1 + ((Math.random() * 6) | 0);
    if (c.p.luck > 0) { g.a = 6; g.b = 6; c.p.luck--; floatText(c.p.px, c.p.py, 'Omadli zar!', '#ffe07a'); }
    setDie(dice[0], g.a, true); setDie(dice[1], g.b, true);
    Sound.init(); Sound.dice();
    c.el.result.className = 'result'; c.el.result.textContent = 'Zarlar dumalamoqda…';
    g.roll = reduceMotion ? 0.25 : 0.98;
  };
  g.update = (dt) => {
    if (g.roll <= 0) return;
    g.roll -= dt;
    if (g.roll > 0) return;
    g.busy = false; g.att++;
    let r;
    if (spec.resolve) r = Object.assign({ done: true }, spec.resolve(g.a, g.b, c));
    else {
      const ok = g.a + g.b >= spec.need;
      r = ok ? { done: true, ok: true } : g.att < max ? { done: false, msg: 'Yana urinib ko‘r!' } : { done: true, ok: false };
    }
    drawTries();
    if (r.done) finishCard(c, r.ok, r.msg || '', r.cls, [g.a, g.b]);
    else {
      c.el.result.className = 'result warn';
      c.el.result.innerHTML = `<span class="sum">${g.a} + ${g.b} = ${g.a + g.b}</span>`;
      const m = document.createElement('span'); m.className = 'msg'; m.textContent = r.msg; c.el.result.appendChild(m);
      setMain(c);
    }
  };
  return g;
}

/* ---- Strelkalar ---- */
const OPP = { up: 'down', down: 'up', left: 'right', right: 'left' };
function ArrowsGame(spec, c) {
  const L = lvl(), n = L3(spec.n, L), win = L3(spec.win, L), allow = L3(spec.miss, L), mode = spec.mode || ['same', 'mix', 'mix'][L];
  const q = setGame(c, `<div class="qbox"><p class="big arrowq">·</p><p class="ghint ah">${mode === 'same' ? 'Strelka qaysi tomonga qarasa — o‘sha tomonni bos.' : 'Yashil — o‘sha tomon, qizil — teskari tomon!'}</p></div>${crossHTML('arr')}<p class="gcount"></p>`);
  const btns = crossBind(c, (d) => press(d)), big = q('.arrowq'), cnt = q('.gcount');
  crossFill(btns, DIRS.map((d) => ARROW[d]));
  let run = false, k = 0, miss = 0, cur = null, flip = false, t = 0, gap = 0;
  const draw = () => { cnt.textContent = `${k} / ${n} · Xato: ${miss} / ${allow}`; };
  const show = () => { cur = pickRand(DIRS); flip = mode === 'rev' || (mode === 'mix' && Math.random() < 0.45); big.textContent = ARROW[cur]; big.className = 'big arrowq ' + (flip ? 'red' : 'green'); t = win; };
  const fail = (msg) => { miss++; Sound.bump(); draw(); if (miss > allow) { run = false; finishCard(c, false, msg); return true; } return false; };
  function press(d) {
    if (!run || !cur) return;
    const want = flip ? OPP[cur] : cur;
    cur = null;
    if (d === want) {
      k++; Sound.tap(); draw(); big.textContent = '✓'; big.className = 'big arrowq';
      if (k >= n) { run = false; finishCard(c, true, 'Barcha strelkalarga chaqqon javob berding!'); } else gap = 0.25;
    } else { big.textContent = '✗'; big.className = 'big arrowq'; if (!fail('Noto‘g‘ri tomon!')) gap = 0.45; }
  }
  draw();
  return {
    start() { run = true; gap = 0.5; },
    update(dt) {
      if (!run) return;
      if (!cur) { gap -= dt; if (gap <= 0) show(); return; }
      t -= dt;
      if (t <= 0) { cur = null; big.textContent = '⌛'; big.className = 'big arrowq'; if (!fail('Kech qolding!')) gap = 0.45; }
    },
    dir: press,
  };
}

/* ---- Ovla (uyalar) ---- */
function padsHTML(cls, mid) {
  return `<div class="pads ${cls}">${DIRS.map((d) => `<button class="pad ${d}" type="button" data-d="${d}" aria-label="${ARROW[d]}"></button>`).join('')}<div class="mid">${mid}</div></div><p class="gcount"></p>`;
}

/* ---- Barabanlar (Saymon) ---- */
function SimonGame(spec, c) {
  const len = L3(spec.len, lvl()), rev = !!spec.rev;
  c.el.game.innerHTML = padsHTML('simon', 'Tingla');
  const pads = {}, cnt = c.el.game.querySelector('.gcount'), mid = c.el.game.querySelector('.mid');
  c.el.game.querySelectorAll('.pad').forEach((b) => { pads[b.dataset.d] = b; b.textContent = ARROW[b.dataset.d]; });
  const seq = Array.from({ length: len }, () => pickRand(DIRS)), want = rev ? seq.slice().reverse() : seq;
  let phase = 'idle', i = 0, t = 0, lit = null, pos = 0;
  const light = (d, on) => { pads[d].classList.toggle('lit', on); };
  const draw = () => { cnt.textContent = phase === 'input' ? `${rev ? 'Teskari takrorla' : 'Takrorla'}: ${pos} / ${len}` : `${len} ta zarbni yodla${rev ? ' — keyin TESKARI tartibda takrorlaysan' : ''}`; };
  const press = (d) => {
    if (phase !== 'input') return;
    light(d, true); setTimeout(() => light(d, false), 160);
    Sound.pad(DIRS.indexOf(d));
    if (d === want[pos]) { pos++; draw(); if (pos >= len) { phase = 'done'; finishCard(c, true, 'Tartibni to‘g‘ri takrorlading!'); } }
    else { phase = 'done'; finishCard(c, false, `Noto‘g‘ri: ${pos + 1}-zarb ${ARROW[want[pos]]} edi.`); }
  };
  c.el.game.querySelectorAll('.pad').forEach((b) => tap(c, b, () => press(b.dataset.d)));
  draw();
  return {
    start() { phase = 'show'; i = 0; t = 0.6; lit = null; mid.textContent = 'Tingla'; },
    update(dt) {
      if (phase !== 'show') return;
      t -= dt;
      if (t > 0) return;
      if (lit) { light(lit, false); lit = null; t = 0.18; i++; if (i >= len) { phase = 'input'; pos = 0; mid.textContent = rev ? 'Teskari!' : 'Takrorla!'; draw(); } }
      else { lit = seq[i]; light(lit, true); Sound.pad(DIRS.indexOf(lit)); t = 0.5; }
    },
    dir: press,
  };
}

/* ---- Topishmoq / savol ---- */
function nextQuestion(p) {
  const L = lvl();
  if (Math.random() < 0.5) {
    for (let k = 0; k < 8; k++) { const R = pickRand(QGEN)(L); if (!p.qseen.has(R.q)) { p.qseen.add(R.q); return R; } }
  }
  let pool = RIDDLES.map((_, k) => k).filter((k) => !p.riddles.has(k));
  if (!pool.length) { p.riddles.clear(); pool = RIDDLES.map((_, k) => k); }
  const idx = pickRand(pool);
  p.riddles.add(idx);
  return RIDDLES[idx];
}
function RiddleGame(spec, c) {
  const R = nextQuestion(c.p), n = R.a.length, T0 = spec.time + (R.q.length > 110 ? 5 : 0);
  const order = shuffle(R.a.map((_, k) => k));
  const q = setGame(c, '<div class="riddle" hidden><p class="qcat"></p><p class="q"></p><div class="opts"></div><div class="meter time"><i></i></div></div>');
  const box = q('.riddle'), opts = q('.opts'), bar = q('.meter i');
  q('.qcat').textContent = R.c || 'Topishmoq';
  q('.q').textContent = R.q;
  const btns = order.map((k) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'opt'; b.textContent = R.a[k]; b.dataset.k = String(k);
    opts.appendChild(b); return b;
  });
  let run = false, t = T0, sel = -1;
  const mark = () => btns.forEach((b, j) => b.classList.toggle('sel', j === sel));
  const reveal = () => btns.forEach((b) => { b.disabled = true; if (b.dataset.k === '0') b.classList.add('right'); });
  const choose = (j) => {
    if (!run) return;
    run = false; reveal();
    const right = btns[j].dataset.k === '0';
    if (!right) btns[j].classList.add('wrong');
    finishCard(c, right, right ? 'To‘g‘ri javob!' : `Noto‘g‘ri. To‘g‘ri javob: ${R.a[0]}.`);
  };
  btns.forEach((b, j) => b.addEventListener('click', () => { if (live(c)) choose(j); }));
  return {
    start() { box.hidden = false; run = true; },
    update(dt) {
      if (!run) return;
      t -= dt; timeBar(bar, t, T0);
      if (t <= 0) { run = false; reveal(); finishCard(c, false, `Vaqt tugadi. To‘g‘ri javob: ${R.a[0]}.`); }
    },
    dir(d) { if (!run) return; if (sel < 0) sel = 0; else sel = (sel + (d === 'up' || d === 'left' ? n - 1 : 1)) % n; mark(); },
    action() { if (run && sel >= 0) choose(sel); },
  };
}

/* ---- Xotira: juftini top ---- */
const MEM_ICONS = ['🐒', '🦁', '🐍', '🦏', '🐊', '🦜', '🐘', '🦓', '🐆', '🦋', '🌺', '🍌', '🥥', '🐢'];
function MemoryGame(spec, c) {
  const L = lvl(), pairs = L3(spec.pairs, L), T0 = L3(spec.time, L), cols = 4;
  const icons = pickN(spec.icons || MEM_ICONS, pairs), deck = shuffle(icons.concat(icons));
  const q = setGame(c, `<div class="memo" style="--cols:${cols}">${deck.map((e) => `<button class="mc" type="button"><span>${e}</span></button>`).join('')}</div><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const btns = Array.from(c.el.game.querySelectorAll('.mc')), bar = q('.meter i'), cnt = q('.gcount');
  let run = false, t = T0, open = [], done = 0, lock = 0, flips = 0;
  const draw = () => { timeBar(bar, t, T0); cnt.textContent = `Juftlar: ${done} / ${pairs} · ${Math.ceil(Math.max(0, t))} s`; };
  const flip = (k) => {
    if (!run || lock > 0) return;
    const b = btns[k];
    if (b.classList.contains('up') || b.classList.contains('done')) return;
    b.classList.add('up'); Sound.tap(); open.push(k); flips++;
    if (open.length < 2) return;
    const [a, d] = open;
    if (deck[a] === deck[d]) {
      btns[a].classList.add('done'); btns[d].classList.add('done'); open = []; done++; Sound.pad(done % 4); draw();
      if (done >= pairs) { run = false; finishCard(c, true, `Hamma juftlarni topding (${flips} ta ochish)!`); }
    } else { lock = 0.8; Sound.bump(); }
  };
  const nav = gridNav(c, btns, cols, flip);
  draw();
  return {
    start() { run = true; },
    update(dt) {
      if (!run) return;
      if (lock > 0) { lock -= dt; if (lock <= 0) { open.forEach((k) => btns[k].classList.remove('up')); open = []; } }
      t -= dt; draw();
      if (t <= 0) { run = false; btns.forEach((b) => b.classList.add('up')); finishCard(c, false, `Vaqt tugadi: ${done} / ${pairs} juft.`); }
    },
    dir: nav.dir, action: nav.act,
  };
}

/* ---- Rang va so‘z ---- */
const COLORS = [['Qizil', '#ff5a45'], ['Yashil', '#4fd16b'], ['Sariq', '#ffd23f'], ['Ko‘k', '#4aa3ff']];
function StroopGame(spec, c) {
  const L = lvl(), n = L3(spec.n, L), T0 = L3(spec.time, L), allow = L3(spec.miss, L);
  const q = setGame(c, `<div class="qbox"><p class="ghint">So‘zni o‘qima — <b>harflar qaysi rangda</b> yozilganini tanla</p><p class="big stroopw">…</p></div>${crossHTML('words')}<div class="meter time"><i></i></div><p class="gcount"></p>`);
  const btns = crossBind(c, (d) => pick(d)), w = q('.stroopw'), bar = q('.meter i'), cnt = q('.gcount');
  let run = false, t = T0, k = 0, miss = 0, ink = 0;
  crossFill(btns, []);
  const draw = () => { timeBar(bar, t, T0); cnt.textContent = `${k} / ${n} · Xato: ${miss} / ${allow}`; };
  const next = () => {
    ink = (Math.random() * 4) | 0;
    let word = (Math.random() * 4) | 0;
    if (Math.random() < 0.85) while (word === ink) word = (Math.random() * 4) | 0;
    w.textContent = COLORS[word][0].toUpperCase(); w.style.color = COLORS[ink][1];
    const order = shuffle([0, 1, 2, 3]);
    crossFill(btns, order.map((j) => COLORS[j][0]));
    DIRS.forEach((d, j) => { btns[d].dataset.k = String(order[j]); });
  };
  function pick(d) {
    if (!run) return;
    if (+btns[d].dataset.k === ink) { k++; Sound.tap(); }
    else { miss++; Sound.bump(); if (miss > allow) { run = false; draw(); finishCard(c, false, `Harflar ${COLORS[ink][0].toLowerCase()} rangda edi — so‘z seni aldadi!`); return; } }
    draw();
    if (k >= n) { run = false; finishCard(c, true, 'So‘zga emas, rangga qarading — barakalla!'); return; }
    next();
  }
  draw();
  return { start() { run = true; next(); }, update(dt) { if (!run) return; t -= dt; draw(); if (t <= 0) { run = false; finishCard(c, false, `Vaqt tugadi: ${k} / ${n}.`); } }, dir: pick };
}


/* ---- Muvozanat ---- */
function holdButtons(c) {
  const held = { left: false, right: false };
  c.el.game.querySelectorAll('.duo .bigbtn').forEach((b) => {
    const s = b.dataset.s;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); held[s] = true; b.classList.add('hit'); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
    const up = () => { held[s] = false; b.classList.remove('hit'); };
    b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
  });
  return held;
}
function BalanceGame(spec, c) {
  const L = lvl(), T0 = L3(spec.time, L), drift = L3(spec.drift, L);
  const q = setGame(c, `<p class="ghint">Shamol itaradi — ◀ ▶ ni bosib turib, o‘rtada ushla</p><div class="beam"><i class="safe"></i><b class="needle">${spec.icon || '🧍'}</b></div><div class="duo"><button class="bigbtn idle" type="button" data-s="left">◀</button><button class="bigbtn idle" type="button" data-s="right">▶</button></div><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const needle = q('.needle'), bar = q('.meter i'), cnt = q('.gcount'), held = holdButtons(c);
  let run = false, t = T0, x = 0, v = 0, wind = 0, wt = 0;
  const draw = () => {
    needle.style.left = (50 + x * 46) + '%'; needle.style.transform = `translateX(-50%) rotate(${x * 35}deg)`;
    timeBar(bar, t, T0); cnt.textContent = `Chida: ${fmt1(Math.max(0, t))} s`;
  };
  draw();
  return {
    start() { run = true; c.el.game.querySelectorAll('.duo .bigbtn').forEach((b) => b.classList.remove('idle')); },
    update(dt) {
      if (!run) return;
      wt -= dt;
      if (wt <= 0) { wt = 0.5 + Math.random() * 0.8; wind = (Math.random() * 2 - 1) * drift * 1.6 + Math.sign(x || (Math.random() - 0.5)) * drift * 0.4; }
      const iv = clamp(inputVec(c.p).x + (held.right ? 1 : 0) - (held.left ? 1 : 0), -1, 1);
      v += (wind + iv * 2.7) * dt; v *= Math.exp(-1.6 * dt); x += v * dt;
      t -= dt; draw();
      if (Math.abs(x) >= 1) { run = false; finishCard(c, false, 'Muvozanatni yo‘qotding!'); }
      else if (t <= 0) { run = false; finishCard(c, true, 'Oxirigacha muvozanatni saqlading!'); }
    },
  };
}

/* ---- Yo‘laklar: qochib qol / ushlab ol ---- */
function LaneGame(spec, c, mode) {
  const L = lvl(), sp = L3(spec.speed, L), T0 = L3(spec.time, L), allow = L3(spec.miss, L), need = mode === 'catch' ? L3(spec.need, L) : 0;
  const lead = mode === 'dodge' ? `Tushayotgan ${spec.obj}dan qoch!` : `${spec.good.join(' ')} ni ushla, ${spec.bad.join(' ')} dan qoch!`;
  const q = setGame(c, `<p class="ghint">${lead}</p><div class="lanes"><div class="runner">${mode === 'catch' ? '🧺' : '🏃'}</div></div><div class="duo"><button class="bigbtn idle" type="button" data-s="left">◀</button><button class="bigbtn idle" type="button" data-s="right">▶</button></div><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const box = q('.lanes'), runner = q('.runner'), bar = q('.meter i'), cnt = q('.gcount');
  let run = false, lane = 1, t = T0, objs = [], spawn = 0.5, got = 0, miss = 0;
  const place = () => { runner.style.left = ((lane + 0.5) / 3) * 100 + '%'; };
  const move = (s) => { if (!run) return; const nl = clamp(lane + s, 0, 2); if (nl !== lane) { lane = nl; place(); Sound.tap(); } };
  c.el.game.querySelectorAll('.duo .bigbtn').forEach((b) => tap(c, b, () => move(b.dataset.s === 'left' ? -1 : 1)));
  box.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (!live(c)) return;
    const r = box.getBoundingClientRect(), ln = clamp(Math.floor(((e.clientX - r.left) / r.width) * 3), 0, 2);
    if (ln !== lane) move(Math.sign(ln - lane));
  });
  const draw = () => { timeBar(bar, t, T0); cnt.textContent = mode === 'dodge' ? `Tegdi: ${miss} / ${allow} · ${fmt1(Math.max(0, t))} s` : `Ushlandi: ${got} / ${need} · Xato: ${miss} / ${allow}`; };
  const end = (ok, msg) => { run = false; objs.forEach((o) => o.el.remove()); objs = []; finishCard(c, ok, msg); };
  place(); draw();
  return {
    start() { run = true; c.el.game.querySelectorAll('.duo .bigbtn').forEach((b) => b.classList.remove('idle')); },
    update(dt) {
      if (!run) return;
      t -= dt;
      spawn -= dt;
      if (spawn <= 0) {
        spawn = (mode === 'dodge' ? 0.72 : 0.62) / sp * (0.75 + Math.random() * 0.5);
        // Qochish o‘yinida bitta yo‘lak doim butunlay bo‘sh qoladi.
        const ahead = objs.filter((o) => !o.hit && o.y < 0.92), used = new Set(ahead.map((o) => o.lane));
        const free = [0, 1, 2].filter((l) => !ahead.some((o) => o.lane === l && o.y < 0.3) && (mode !== 'dodge' || used.has(l) || used.size < 2));
        if (free.length) {
          const good = mode === 'catch' && Math.random() < 0.7, o = { lane: pickRand(free), y: -0.12, good, hit: false, el: document.createElement('span') };
          o.el.className = 'fall'; o.el.textContent = mode === 'dodge' ? spec.obj : pickRand(good ? spec.good : spec.bad);
          o.el.style.left = ((o.lane + 0.5) / 3) * 100 + '%';
          box.appendChild(o.el); objs.push(o);
        }
      }
      for (const o of objs) {
        o.y += dt * 0.62 * sp;
        o.el.style.top = o.y * 100 + '%';
        if (!o.hit && o.y >= 0.7 && o.y <= 0.88 && o.lane === lane) {
          o.hit = true; o.el.classList.add('gone');
          if (mode === 'dodge' || !o.good) { miss++; Sound.hurt(); bump(box, 'hurt'); }
          else { got++; Sound.pickup(); bump(box, 'yum'); }
        }
      }
      objs = objs.filter((o) => { if (o.y > 1.1 || (o.hit && o.y > 0.95)) { o.el.remove(); return false; } return true; });
      draw();
      if (miss > allow) end(false, mode === 'dodge' ? 'Ko‘p zarba yeding!' : 'Zaharli narsalarni ushlab olding!');
      else if (mode === 'catch' && got >= need) end(true, 'Hammasini ushlab olding!');
      else if (t <= 0) end(mode === 'dodge', mode === 'dodge' ? 'Hammasidan omon qolding!' : `Vaqt tugadi: ${got} / ${need}.`);
    },
    dir(d) { if (d === 'left') move(-1); else if (d === 'right') move(1); },
  };
}

/* ---- Naqshni eslab qol ---- */
function PatternGame(spec, c) {
  const L = lvl(), size = spec.size || 3, rounds = L3(spec.rounds, L), k0 = L3(spec.k, L), show = L3(spec.show, L), n = size * size;
  const q = setGame(c, `<div class="pgrid" style="--cols:${size}">${'<button class="pc" type="button"></button>'.repeat(n)}</div><p class="gcount"></p>`);
  const btns = Array.from(c.el.game.querySelectorAll('.pc')), cnt = q('.gcount');
  let phase = 'idle', r = 0, set = null, found = 0, t = 0, kk = k0;
  const draw = () => { cnt.textContent = phase === 'input' ? `Topildi: ${found} / ${kk} · Raund ${r + 1} / ${rounds}` : phase === 'show' ? 'Yonib turgan kataklarni eslab qol!' : `Raund ${Math.min(r + 1, rounds)} / ${rounds}`; };
  const round = () => {
    kk = Math.min(n - 1, k0 + r);
    set = new Set(pickN(Array.from({ length: n }, (_, j) => j), kk));
    btns.forEach((b, j) => { b.className = 'pc' + (set.has(j) ? ' lit' : ''); });
    phase = 'show'; t = show; found = 0; draw(); Sound.pad(r % 4);
  };
  const pick = (j) => {
    if (phase !== 'input') return;
    const b = btns[j];
    if (b.classList.contains('right')) return;
    if (set.has(j)) {
      b.classList.add('right'); found++; Sound.tap(); draw();
      if (found >= kk) { r++; if (r >= rounds) { phase = 'done'; finishCard(c, true, 'Naqshni xatosiz eslading!'); } else { phase = 'wait'; t = 0.6; } }
    } else {
      b.classList.add('wrong'); phase = 'done';
      btns.forEach((x, i) => { if (set.has(i) && !x.classList.contains('right')) x.classList.add('miss'); });
      Sound.bump(); finishCard(c, false, 'Bu katak naqshda yo‘q edi.');
    }
  };
  const nav = gridNav(c, btns, size, pick);
  draw();
  return {
    start() { round(); },
    update(dt) {
      if (phase === 'show') { t -= dt; if (t <= 0) { btns.forEach((b) => b.classList.remove('lit')); phase = 'input'; draw(); } }
      else if (phase === 'wait') { t -= dt; if (t <= 0) round(); }
    },
    dir: nav.dir, action: nav.act,
  };
}



/* ---- Ritm ---- */
function RhythmGame(spec, c) {
  const L = lvl(), beats = L3(spec.beats, L), bpm = L3(spec.bpm, L), tol = L3(spec.tol, L), need = beats - L3(spec.slack, L), per = 60 / bpm, lead = 4;
  const q = setGame(c, `<p class="ghint">${spec.lead ? spec.lead + ': ' : ''}avval 4 zarbni tingla, so‘ng halqa barabanga tekkanda ur</p><div class="drumbox"><div class="ring"></div><div class="drumhead">${spec.icon || '🥁'}</div></div><button class="bigbtn idle" type="button">Ur!</button><p class="gcount"></p>`);
  const ring = q('.ring'), head = q('.drumhead'), btn = q('.bigbtn'), cnt = q('.gcount');
  let run = false, t = 0, hits = 0, bad = 0, lastBeat = -1;
  const judged = new Uint8Array(beats), beatT = (k) => (k + lead) * per;
  const draw = () => { cnt.textContent = t < lead * per ? `Tingla: ${Math.min(lead, Math.floor(t / per) + 1)}…` : `Tushdi: ${hits} / ${need} · ortiqcha: ${bad}`; };
  const press = () => {
    if (!run) return;
    bump(btn, 'hit');
    let best = -1, bd = Infinity;
    for (let k = 0; k < beats; k++) { if (judged[k]) continue; const d = Math.abs(t - beatT(k)); if (d < bd) { bd = d; best = k; } }
    if (best >= 0 && bd <= tol) { judged[best] = 1; hits++; Sound.drum(0.8, 1.25); bump(head, 'ok'); }
    else if (t >= lead * per - tol) { bad++; Sound.bump(); }
    draw();
  };
  tap(c, btn, press); tap(c, head, press);
  draw();
  return {
    start() { run = true; t = 0; btn.classList.remove('idle'); },
    update(dt) {
      if (!run) return;
      t += dt;
      const k = Math.floor(t / per + 1e-4);
      if (k !== lastBeat) { lastBeat = k; if (k < lead) { Sound.drum(0.9, 1); bump(head, 'ok'); } else if (k < lead + beats) Sound.tick(); }
      const ph = (t / per) % 1, on = t < beatT(beats - 1);
      ring.style.transform = `scale(${1.9 - ph * 0.9})`; ring.style.opacity = on ? String(0.2 + ph * 0.8) : '0';
      for (let j = 0; j < beats; j++) if (!judged[j] && t > beatT(j) + tol) judged[j] = 2;
      draw();
      if (t > beatT(beats - 1) + tol + 0.05) {
        run = false;
        const ok = hits - Math.max(0, bad - 1) >= need;
        finishCard(c, ok, ok ? `Ritmga tushding: ${hits} / ${beats}!` : `Ritm buzildi: ${hits} / ${beats}.`);
      }
    },
    action: press,
  };
}

/* ---- So‘zni tikla ---- */
const WORDS = {
  Hayvon: ['MAYMUN', 'TULKI', 'BURGUT', 'ARSLON', 'KIYIK', 'QUYON', 'ZEBRA', 'JIRAFA', 'TIMSOH', 'KAPTAR', 'LAYLAK', 'TOVUQ', 'YOLBARS', 'KIRPI', 'BAQA', 'ILON', 'AYIQ', 'TUYA', 'QUNDUZ', 'KALTAKESAK'],
  Meva: ['OLMA', 'ANOR', 'BEHI', 'UZUM', 'QOVUN', 'TARVUZ', 'BANAN', 'LIMON', 'GILOS', 'XURMO', 'ANJIR', 'APELSIN', 'MANDARIN'],
  Tabiat: ['DARYO', 'BULUT', 'YULDUZ', 'OSMON', 'TUMAN', 'VULQON', 'SAHRO', 'MUZLIK', 'OROL', 'QOYA', 'KAMALAK', 'PALMA', 'LIANA', 'NILUFAR', 'TERAK'],
  Narsa: ['KITOB', 'QALAM', 'DAFTAR', 'SOAT', 'KOMPAS', 'XARITA', 'SANDIQ', 'KALIT', 'ARQON', 'BARABAN', 'OYNA', 'STOL', 'KURSI', 'PIYOLA', 'ZAMBARAK'],
};
function ScrambleGame(spec, c) {
  const L = lvl(), [lo, hi] = L3(spec.len, L), T0 = L3(spec.time, L), allow = L3(spec.miss, L);
  const all = [];
  for (const [cat, list] of Object.entries(WORDS)) for (const w of list) if (w.length >= lo && w.length <= hi) all.push([cat, w]);
  const [cat, word] = pickRand(all);
  let letters = shuffle(word.split(''));
  if (letters.join('') === word) letters = letters.reverse();
  const cols = word.length <= 5 ? word.length : Math.ceil(word.length / 2);
  const q = setGame(c, `<p class="ghint">Mavzu: <b>${cat}</b>. Harflarni to‘g‘ri tartibda bos va so‘zni tikla.</p><div class="slots">${'<span>·</span>'.repeat(word.length)}</div><div class="tiles" style="--cols:${cols}">${letters.map((ch) => `<button class="tile" type="button">${ch}</button>`).join('')}</div><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const slots = c.el.game.querySelectorAll('.slots span'), btns = Array.from(c.el.game.querySelectorAll('.tile')), bar = q('.meter i'), cnt = q('.gcount');
  let run = false, t = T0, pos = 0, miss = 0;
  const draw = () => { timeBar(bar, t, T0); cnt.textContent = `Xato: ${miss} / ${allow} · ${Math.ceil(Math.max(0, t))} s`; };
  const pick = (j) => {
    if (!run) return;
    const b = btns[j];
    if (b.disabled) return;
    if (letters[j] === word[pos]) {
      b.disabled = true; slots[pos].textContent = letters[j]; slots[pos].classList.add('on'); pos++; Sound.tap();
      if (pos >= word.length) { run = false; finishCard(c, true, `To‘g‘ri — ${word}!`); return; }
    } else {
      miss++; Sound.bump(); bump(b, 'no');
      if (miss > allow) { run = false; finishCard(c, false, `So‘z «${word}» edi.`); return; }
    }
    draw();
  };
  const nav = gridNav(c, btns, cols, pick);
  draw();
  return {
    start() { run = true; },
    update(dt) { if (!run) return; t -= dt; draw(); if (t <= 0) { run = false; finishCard(c, false, `Vaqt tugadi. So‘z «${word}» edi.`); } },
    dir: nav.dir, action: nav.act,
  };
}

/* ---- Qaysi ko‘za ostida? ---- */
function ShellGame(spec, c) {
  const L = lvl(), swaps = L3(spec.swaps, L), dur = L3(spec.speed, L), rounds = L3(spec.rounds, L);
  const q = setGame(c, `<p class="ghint">${spec.item} qaysi ko‘za ostida qolganini kuzat</p><div class="shell" style="--dur:${dur}s"><b class="pearl">${spec.item}</b><span class="cup">🏺</span><span class="cup">🏺</span><span class="cup">🏺</span></div>${crossHTML('shellx')}<p class="gcount"></p>`);
  const cups = Array.from(c.el.game.querySelectorAll('.cup')), pearl = q('.pearl'), btns = crossBind(c, (d) => pick(d)), cnt = q('.gcount');
  const MAP = { left: 0, up: 1, right: 2 };
  let phase = 'idle', t = 0, left = 0, slot = [0, 1, 2], ball = 0, r = 0;
  crossFill(btns, []);
  const place = () => { cups.forEach((cp, i) => { cp.style.setProperty('--slot', slot[i]); }); pearl.style.setProperty('--slot', slot[ball]); };
  const draw = () => { cnt.textContent = phase === 'pick' ? 'Qaysi biri? Tanla!' : phase === 'mix' ? 'Ko‘zalar aralashmoqda…' : `Raund: ${Math.min(r + 1, rounds)} / ${rounds}`; };
  const round = () => {
    slot = [0, 1, 2]; ball = ri(0, 2); place();
    cups.forEach((cp) => cp.classList.remove('lift')); cups[ball].classList.add('lift'); pearl.hidden = false;
    crossFill(btns, []); phase = 'show'; t = 1.3; left = swaps; draw();
  };
  function pick(d) {
    if (phase !== 'pick' || !(d in MAP)) return;
    const s = MAP[d], ci = slot.indexOf(s);
    cups[ci].classList.add('lift'); pearl.hidden = false;
    if (ci === ball) {
      Sound.pickup(); r++;
      if (r >= rounds) { phase = 'done'; finishCard(c, true, 'Ko‘zing aldanmadi — topding!'); }
      else { phase = 'wait'; t = 0.9; }
    } else { cups[ball].classList.add('lift'); Sound.bump(); phase = 'done'; finishCard(c, false, 'Bu ko‘za bo‘sh chiqdi.'); }
    crossFill(btns, []); draw();
  }
  place(); draw();
  return {
    start() { round(); },
    update(dt) {
      if (phase === 'show') { t -= dt; if (t <= 0) { cups[ball].classList.remove('lift'); phase = 'hide'; t = 0.45; } }
      else if (phase === 'hide') { t -= dt; if (t <= 0) { pearl.hidden = true; phase = 'mix'; t = 0; draw(); } }
      else if (phase === 'mix') {
        t -= dt;
        if (t > 0) return;
        if (left <= 0) { phase = 'pick'; crossFill(btns, { left: '◀ Chap', up: '▲ O‘rta', right: 'O‘ng ▶' }); draw(); return; }
        const a = ri(0, 2), b = (a + ri(1, 2)) % 3, ia = slot.indexOf(a), ib = slot.indexOf(b);
        slot[ia] = b; slot[ib] = a; place(); left--; t = dur + 0.06; Sound.tap();
      } else if (phase === 'wait') { t -= dt; if (t <= 0) round(); }
    },
    dir: pick,
  };
}

/* ---- Qulfni och (sonni top) ---- */
function LockGame(spec, c) {
  const L = lvl(), max = L3(spec.max, L), tries = L3(spec.tries, L), secret = ri(1, max);
  const q = setGame(c, `<p class="ghint">Qulf kodi — 1 dan ${max} gacha bitta son. Har urinishdan keyin qulf «kattaroq» yoki «kichikroq» deb aytadi.</p><div class="lockrow"><button class="btn ghost" type="button" data-v="-5">−5</button><button class="btn ghost" type="button" data-v="-1">−1</button><span class="big lockv">?</span><button class="btn ghost" type="button" data-v="1">+1</button><button class="btn ghost" type="button" data-v="5">+5</button></div><p class="ghint lockh">&nbsp;</p><p class="gcount"></p>`);
  const val = q('.lockv'), hint = q('.lockh'), cnt = q('.gcount');
  let run = false, v = Math.ceil(max / 2), used = 0, lo = 1, hi = max;
  const draw = () => { val.textContent = String(v); cnt.textContent = `Urinish: ${used} / ${tries} · oraliq: ${lo}–${hi}`; };
  const add = (k) => { if (!run) return; v = clamp(v + k, 1, max); Sound.tick(); draw(); };
  c.el.game.querySelectorAll('.lockrow .btn').forEach((b) => tap(c, b, () => add(+b.dataset.v)));
  const g = {
    mainLabel: 'Tekshir',
    start() { run = true; draw(); },
    update() {},
    dir(d) { add({ left: -1, right: 1, up: 5, down: -5 }[d]); },
    action() {
      if (!run) return;
      used++;
      if (v === secret) { run = false; draw(); Sound.pickup(); finishCard(c, true, `Kod ${secret} — qulf ochildi!`); return; }
      if (v < secret) { lo = Math.max(lo, v + 1); hint.textContent = `${v} — kichik. Kattaroq son ▲`; } else { hi = Math.min(hi, v - 1); hint.textContent = `${v} — katta. Kichikroq son ▼`; }
      Sound.bump(); bump(val, 'no');
      if (used >= tries) { run = false; draw(); finishCard(c, false, `Urinishlar tugadi. Kod ${secret} edi.`); return; }
      draw();
    },
  };
  draw();
  return g;
}

/* ================= Challenge o‘yinlari: ommabop viral o‘yinlar ================= */
// Tugma yoki yo‘nalish (yuqoriga) ushlab turilganmi? (klaviatura, joystik, geympad)
const heldAct = (c) => ACT_KEYS.some((k) => keysDown.has(k)) || inputVec(c.p).y < -0.5;

// Kartaning ichiga chiziladigan kichik «kanvas»: mantiqiy W×H, ekranda o‘lchamga moslashadi.
function gameCanvas(W, H) {
  const cv = document.createElement('canvas'), d = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.round(W * d); cv.height = Math.round(H * d);
  cv.className = 'gcv'; cv.style.maxWidth = W + 'px'; cv.style.aspectRatio = `${W} / ${H}`;
  const g = cv.getContext('2d'); g.setTransform(d, 0, 0, d, 0, 0);
  const pt = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (W / (r.width || W)), (e.clientY - r.top) * (H / (r.height || H))]; };
  return { cv, g, W, H, pt };
}
const ARROW_ROW = ['left', 'up', 'down', 'right'];
const arrowRowHTML = '<div class="arrowrow">' + ARROW_ROW.map((d) => `<button class="ab" type="button" data-d="${d}" aria-label="${ARROW[d]}">${ARROW[d]}</button>`).join('') + '</div>';
const arrowRowBind = (c, fn) => c.el.game.querySelectorAll('.arrowrow .ab').forEach((b) => tap(c, b, () => fn(b.dataset.d)));
const flapSound = () => Sound.tone('triangle', 420, 760, 0.09, 0.16);

/* ---- Qizil chiroq, yashil chiroq (Kalmar o‘yini) ---- */
function RedLightGame(spec, c) {
  const L = lvl(), need = L3(spec.need, L), T0 = L3(spec.time, L), warn = L3(spec.warn, L), allow = L3(spec.miss, L);
  const q = setGame(c, `<p class="ghint">Yashil chiroqda <b class="g">yugur</b> (tugmani ushlab tur). Qizil yonsa <b class="r">darhol qo‘yib yubor</b>!</p><div class="rlscene"><span class="rldoll">🙈</span><i class="rllamp green"></i></div><div class="rltrack"><span class="rlrun">🏃</span><span class="rlflag">🏁</span></div><button class="bigbtn idle" type="button">Yugur</button><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const doll = q('.rldoll'), lamp = q('.rllamp'), runner = q('.rlrun'), btn = q('.bigbtn'), bar = q('.meter i'), cnt = q('.gcount');
  let run = false, t = T0, prog = 0, phase = 'green', pt = 2, redT = 0, strikes = 0, lock = 0, ptr = false, block = false;
  const rel = () => { ptr = false; btn.classList.remove('hit'); };
  btn.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!live(c)) return; ptr = true; btn.classList.add('hit'); try { btn.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } });
  btn.addEventListener('pointerup', rel); btn.addEventListener('pointercancel', rel); btn.addEventListener('lostpointercapture', rel);
  const setLight = (ph) => { phase = ph; lamp.className = 'rllamp ' + (ph === 'warn' ? 'yellow' : ph); doll.textContent = ph === 'green' ? '🙈' : ph === 'warn' ? '👀' : '😠'; };
  const draw = () => { runner.style.setProperty('--p', String(clamp(prog / need, 0, 1))); timeBar(bar, t, T0); cnt.textContent = `Yugurish: ${fmt1(Math.min(prog, need))} / ${need} s · Xato: ${strikes} / ${allow}`; };
  draw();
  return {
    dbg: () => ({ phase, prog, need, strikes }),
    start() { run = true; block = heldAct(c); btn.classList.remove('idle'); },
    update(dt) {
      if (!run) return;
      if (block && !heldAct(c)) block = false;
      const moving = (ptr || (heldAct(c) && !block)) && lock <= 0;
      t -= dt; pt -= dt; if (lock > 0) lock -= dt;
      if (pt <= 0) {
        if (phase === 'green') { setLight('warn'); pt = warn; Sound.tick(); }
        else if (phase === 'warn') { setLight('red'); pt = 1 + Math.random() * 1.2; redT = 0; Sound.drum(0.8, 1.2); }
        else { setLight('green'); pt = 1.1 + Math.random() * 1.5; Sound.tick(); }
      }
      if (phase === 'red') {
        redT += dt;
        if (moving && redT > 0.12) {
          strikes++; lock = 0.8; Sound.bump(); bump(lamp, 'shake'); draw();
          if (strikes > allow) { run = false; finishCard(c, false, 'Qizil chiroqda yugurding — nishonga olindi!'); return; }
        }
      } else if (moving) {
        prog += dt;
        if (prog >= need) { prog = need; run = false; draw(); finishCard(c, true, 'Chiziqdan o‘tding — tirik qolding!'); return; }
      }
      if (t <= 0) { run = false; draw(); finishCard(c, false, 'Vaqt tugadi — chiziqqa yetib bormading.'); return; }
      draw();
    },
  };
}

/* ---- Shisha ko‘prik (Kalmar o‘yini) ---- */
function GlassGame(spec, c) {
  const L = lvl(), rows = L3(spec.rows, L), show = L3(spec.show, L), allow = L3(spec.miss, L), icon = spec.icon || '🧍';
  const safe = Array.from({ length: rows }, () => (Math.random() < 0.5 ? 0 : 1));
  const rowsHTML = Array.from({ length: rows }, (_, k) => rows - 1 - k).map((r) => `<div class="grow" data-r="${r}"><button class="gp" type="button" data-s="0"></button><button class="gp" type="button" data-s="1"></button></div>`).join('');
  const q = setGame(c, `<p class="ghint">${spec.lead || 'Shisha ko‘prik'}: xavfsiz oynalarni eslab qol, so‘ng pastdan yuqoriga o‘t. Noto‘g‘ri oyna sinadi!</p><div class="bridge">${rowsHTML}</div><p class="gcount"></p>`);
  const cnt = q('.gcount'), rowEls = Array.from(c.el.game.querySelectorAll('.grow'));
  const panel = (r, s) => c.el.game.querySelector(`.grow[data-r="${r}"] .gp[data-s="${s}"]`);
  let phase = 'idle', t = 0, cur = 0, strikes = 0;
  const draw = () => {
    rowEls.forEach((el) => el.classList.toggle('now', phase === 'play' && +el.dataset.r === cur));
    cnt.textContent = phase === 'show' ? 'Yonib turgan oynalarni eslab qol!' : `Qator: ${Math.min(cur + 1, rows)} / ${rows} · Xato: ${strikes} / ${allow}`;
  };
  const pick = (s) => {
    if (phase !== 'play' || cur >= rows) return;
    const r = cur;
    if (safe[r] === s) { panel(r, s).classList.add('ok'); panel(r, s).textContent = icon; Sound.pad(r % 4); }
    else {
      panel(r, s).classList.add('broke'); panel(r, s).textContent = '💥'; Sound.bump(); strikes++;
      if (strikes > allow) { phase = 'done'; panel(r, safe[r]).classList.add('lit'); draw(); finishCard(c, false, 'Oyna sindi — pastga qulading!'); return; }
      panel(r, safe[r]).classList.add('ok'); panel(r, safe[r]).textContent = icon;
    }
    cur++; draw();
    if (cur >= rows) { phase = 'done'; draw(); finishCard(c, true, 'Ko‘prikdan sog‘-salomat o‘tding!'); }
  };
  c.el.game.querySelectorAll('.gp').forEach((b) => tap(c, b, () => { if (+b.closest('.grow').dataset.r === cur) pick(+b.dataset.s); }));
  draw();
  return {
    dbg: () => ({ safe, cur, phase }),
    start() { phase = 'show'; t = show; for (let r = 0; r < rows; r++) panel(r, safe[r]).classList.add('lit'); draw(); },
    update(dt) {
      if (phase !== 'show') return;
      t -= dt;
      if (t <= 0) { for (let r = 0; r < rows; r++) panel(r, safe[r]).classList.remove('lit'); phase = 'play'; draw(); }
    },
    dir(d) { if (d === 'left') pick(0); else if (d === 'right') pick(1); },
  };
}

/* ---- Dalgona (Kalmar o‘yini): shakl chizig‘i bo‘ylab ignani yurgiz ---- */
const star = (() => { const p = []; for (let k = 0; k <= 10; k++) { const a = -Math.PI / 2 + (k / 10) * TAU, rad = k % 2 ? 0.17 : 0.39; p.push([0.5 + Math.cos(a) * rad, 0.53 + Math.sin(a) * rad]); } return p; })();
const heart = (() => { const p = []; for (let k = 0; k <= 80; k++) { const t = (k / 80) * TAU, X = 16 * Math.pow(Math.sin(t), 3), Y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)); p.push([0.5 + X / 38, 0.47 + Y / 38]); } return p; })();
const DAL_SHAPES = [
  { name: 'doira', pts: (() => { const p = []; for (let k = 0; k <= 64; k++) { const a = -Math.PI / 2 + (k / 64) * TAU; p.push([0.5 + Math.cos(a) * 0.33, 0.5 + Math.sin(a) * 0.33]); } return p; })() },
  { name: 'uchburchak', pts: [[0.5, 0.15], [0.84, 0.77], [0.16, 0.77], [0.5, 0.15]] },
  { name: 'kvadrat', pts: [[0.22, 0.22], [0.78, 0.22], [0.78, 0.78], [0.22, 0.78], [0.22, 0.22]] },
  { name: 'yulduz', pts: star },
  { name: 'yurak', pts: heart },
];
function nearestOnPath(P, cum, x, y, u0, u1) {
  let bestD = Infinity, bestU = u0;
  for (let i = 0; i < P.length - 1; i++) {
    const a = P[i], b = P[i + 1], sl = cum[i + 1] - cum[i];
    if (cum[i + 1] < u0 || cum[i] > u1 || sl < 1e-6) continue;
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const tMin = Math.max(0, (u0 - cum[i]) / sl), tMax = Math.min(1, (u1 - cum[i]) / sl);
    const t = clamp(((x - a[0]) * dx + (y - a[1]) * dy) / (sl * sl), tMin, Math.max(tMin, tMax));
    const px = a[0] + dx * t, py = a[1] + dy * t, d = Math.hypot(x - px, y - py);
    if (d < bestD) { bestD = d; bestU = cum[i] + sl * t; }
  }
  return { d: bestD, u: bestU };
}
function tracePath(g, P, cum, u0, u1) {
  g.beginPath();
  let started = false;
  for (let i = 0; i < P.length - 1; i++) {
    const sl = cum[i + 1] - cum[i];
    if (cum[i + 1] < u0 || cum[i] > u1 || sl < 1e-6) continue;
    const t0 = Math.max(0, (u0 - cum[i]) / sl), t1 = Math.min(1, (u1 - cum[i]) / sl);
    const ax = lerp(P[i][0], P[i + 1][0], t0), ay = lerp(P[i][1], P[i + 1][1], t0), bx = lerp(P[i][0], P[i + 1][0], t1), by = lerp(P[i][1], P[i + 1][1], t1);
    if (!started) { g.moveTo(ax, ay); started = true; }
    g.lineTo(bx, by);
  }
}
function DalgonaGame(spec, c) {
  const L = lvl(), tol = L3(spec.tol, L), crackT = L3(spec.crack, L), T0 = L3(spec.time, L);
  const { cv, g, W, H, pt } = gameCanvas(240, 240);
  const shape = pickRand(DAL_SHAPES), P = shape.pts.map(([x, y]) => [x * W, y * H]), cum = [0];
  for (let i = 1; i < P.length; i++) cum.push(cum[i - 1] + Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]));
  const LEN = cum[cum.length - 1];
  const pointAt = (u) => {
    for (let i = 0; i < P.length - 1; i++) if (u <= cum[i + 1] || i === P.length - 2) { const t = clamp((u - cum[i]) / Math.max(1e-6, cum[i + 1] - cum[i]), 0, 1); return [lerp(P[i][0], P[i + 1][0], t), lerp(P[i][1], P[i + 1][1], t)]; }
    return P[0];
  };
  const q = setGame(c, `<p class="ghint">Ignani chiziq bo‘ylab yurgiz (${touchUI ? 'barmoq' : 'sichqoncha yoki strelkalar'} bilan), <b>${shape.name}</b>ni sindirmasdan kes. Chiziqdan chiqsang — kuki yoriladi!</p><div class="cvhost"></div><div class="meter time"><i></i></div><p class="gcount"></p>`);
  q('.cvhost').appendChild(cv);
  const bar = q('.meter i'), cnt = q('.gcount');
  let cx = P[0][0], cy = P[0][1], prog = 0, crack = 0, t = T0, run = false, ptr = false, hint = '';
  cv.addEventListener('pointerdown', (e) => {
    e.preventDefault(); if (!live(c)) return;
    const [x, y] = pt(e), at = pointAt(prog);
    if (Math.hypot(x - at[0], y - at[1]) > tol * 3.2) { hint = 'Avval ignani yonib turgan nuqtadan ushla'; return; }
    ptr = true; hint = ''; cx = x; cy = y; try { cv.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
  });
  cv.addEventListener('pointermove', (e) => { if (!ptr || !live(c)) return; const m = pt(e); cx = m[0]; cy = m[1]; });
  const rel = () => { ptr = false; };
  cv.addEventListener('pointerup', rel); cv.addEventListener('pointercancel', rel); cv.addEventListener('lostpointercapture', rel);
  const draw = (nowT) => {
    g.fillStyle = '#20150c'; g.fillRect(0, 0, W, H);
    const gr = g.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, W * 0.52); gr.addColorStop(0, '#f1c978'); gr.addColorStop(1, '#c58a34');
    g.fillStyle = gr; g.beginPath(); g.arc(W / 2, H / 2, W * 0.48, 0, TAU); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    tracePath(g, P, cum, 0, LEN); g.strokeStyle = 'rgba(110,60,15,0.26)'; g.lineWidth = tol * 2; g.stroke();
    tracePath(g, P, cum, 0, LEN); g.strokeStyle = 'rgba(90,50,10,0.8)'; g.lineWidth = 2; g.setLineDash([5, 5]); g.stroke(); g.setLineDash([]);
    if (prog > 0) { tracePath(g, P, cum, 0, prog); g.strokeStyle = '#fff6d0'; g.lineWidth = Math.max(3, tol * 0.9); g.stroke(); }
    const s = pointAt(prog);
    if (!run || prog < 4) { g.fillStyle = '#4aa3ff'; g.beginPath(); g.arc(s[0], s[1], 5 + 1.5 * Math.sin(nowT * 6), 0, TAU); g.fill(); }
    if (crack > 0.05) {
      g.strokeStyle = `rgba(70,15,0,${clamp(crack, 0, 1)})`; g.lineWidth = 1.6;
      for (let k = 0; k < 6; k++) { const a = k * 1.05 + 0.4; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a) * 34 * crack, cy + Math.sin(a) * 34 * crack); g.stroke(); }
    }
    g.fillStyle = '#e8e4da'; g.strokeStyle = '#2a2a2a'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(cx, cy, 5, 0, TAU); g.fill(); g.stroke();
    if (crack > 0.5) { g.fillStyle = `rgba(200,40,20,${(crack - 0.5) * 0.5})`; g.fillRect(0, 0, W, H); }
  };
  const label = () => { timeBar(bar, t, T0); cnt.textContent = hint || `Kesildi: ${Math.round((prog / LEN) * 100)}% · Yoriq: ${Math.round(clamp(crack, 0, 1) * 100)}%`; };
  draw(0); label();
  let clock = 0;
  return {
    dbg: () => ({ P, cum, LEN, prog, crack, cx, cy, W, H, tol }),
    start() { run = true; },
    update(dt) {
      clock += dt;
      if (!run) { draw(clock); return; }
      t -= dt;
      const v = inputVec(c.p), mag = Math.hypot(v.x, v.y);
      let keyMove = false;
      if (!ptr && mag > 0.3) { keyMove = true; cx = clamp(cx + (v.x / Math.max(1, mag)) * 95 * dt, 0, W); cy = clamp(cy + (v.y / Math.max(1, mag)) * 95 * dt, 0, H); }
      const win = nearestOnPath(P, cum, cx, cy, Math.max(0, prog - 6), Math.min(LEN, prog + 34));
      if (win.d <= tol && win.u > prog) prog = win.u;
      const off = nearestOnPath(P, cum, cx, cy, 0, LEN).d > tol;
      if ((ptr || keyMove) && off) crack += dt / crackT; else crack = Math.max(0, crack - dt * 0.12);
      draw(clock); label();
      if (crack >= 1) { run = false; Sound.hurt(); finishCard(c, false, 'Kuki yorildi — Dalgona sindi!'); return; }
      if (prog >= LEN - 7) { run = false; prog = LEN; draw(clock); Sound.pickup(); finishCard(c, true, 'Shaklni butunligicha kesib oldin!'); return; }
      if (t <= 0) { run = false; finishCard(c, false, 'Vaqt tugadi — kuki quridi.'); }
    },
  };
}

/* ---- Arqon tortish (Kalmar o‘yini) ---- */
function TugGame(spec, c) {
  const L = lvl(), T0 = L3(spec.time, L), base = L3(spec.foe, L);
  const q = setGame(c, `<div class="tug"><span class="tf">${spec.foeIcon || '🦍'}</span><div class="rope"><i class="mid"></i><b class="knot"></b></div><span class="tf">🧍</span></div><button class="bigbtn idle" type="button">${spec.label || 'Tort!'}</button><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const knot = q('.knot'), btn = q('.bigbtn'), bar = q('.meter i'), cnt = q('.gcount');
  let run = false, t = T0, pos = 0, ph = Math.random() * 6, clock = 0, burst = 1, burstT = 0;
  const draw = () => { knot.style.left = ((pos + 1) / 2) * 100 + '%'; timeBar(bar, t, T0); cnt.textContent = pos > 0.05 ? 'Sen tortyapsan!' : pos < -0.05 ? 'Raqib tortyapti!' : 'Teng kuch'; };
  const end = (ok, msg) => { run = false; draw(); finishCard(c, ok, msg); };
  const pull = () => { if (!run) return; pos = Math.min(1, pos + 0.06); Sound.tap(); bump(btn, 'hit'); draw(); if (pos >= 1) end(true, 'Arqonni o‘z tomoningga tortib oldin!'); };
  tap(c, btn, pull);
  draw();
  return {
    dbg: () => ({ pos, t }),
    start() { run = true; btn.classList.remove('idle'); },
    update(dt) {
      if (!run) return;
      clock += dt; t -= dt; burstT -= dt;
      if (burstT <= 0) { burstT = 0.4; burst = 0.75 + Math.random() * 0.55; }
      pos -= base * (1 + 0.5 * Math.sin(clock * 2.3 + ph)) * burst * dt;
      draw();
      if (pos <= -1) { end(false, 'Raqib arqonni o‘z tomoniga tortib oldi.'); return; }
      if (t <= 0) end(pos > 0, pos > 0 ? 'Vaqt tugadi — arqon sening tomoningda!' : 'Vaqt tugadi — arqon raqib tomonda qoldi.');
    },
    action: pull,
  };
}

/* ---- So‘z topish (Wordle) ---- */
const WORDS_4 = ['olma', 'anor', 'odam', 'bola', 'uzum', 'baqa', 'tuya', 'arpa', 'dala', 'kema', 'oila', 'kuya', 'maza', 'mina', 'lola', 'kino', 'soat', 'sana', 'koza', 'ayiq', 'behi', 'eski', 'mehr', 'akam', 'opam', 'buvi', 'bobo', 'ukam', 'uzoq', 'zira', 'sado', 'sabr', 'fikr', 'vaqt', 'qora'];
const WORDS_5 = ['bahor', 'kitob', 'daryo', 'tuman', 'qalam', 'devor', 'tulki', 'baliq', 'tuxum', 'qovun', 'anjir', 'piyoz', 'sabzi', 'karam', 'qovoq', 'dutor', 'rubob', 'doira', 'oltin', 'temir', 'yaqin', 'katta', 'qizil', 'sariq', 'jigar', 'gilam', 'nuqta', 'tabla', 'maqol', 'ovqat', 'osmon', 'sahro', 'bulut', 'banan', 'limon', 'gilos', 'xurmo', 'ustoz', 'savol', 'javob', 'kamar'];
const WL_KEYS = 'ABDEFGHIJKLMNOPQRSTUVXYZ'.split('');
function wordleScore(guess, word) {
  const res = Array(guess.length).fill('n'), left = {};
  for (let i = 0; i < word.length; i++) { if (guess[i] === word[i]) res[i] = 'g'; else left[word[i]] = (left[word[i]] || 0) + 1; }
  for (let i = 0; i < guess.length; i++) if (res[i] === 'n' && left[guess[i]] > 0) { res[i] = 'y'; left[guess[i]]--; }
  return res;
}
function WordleGame(spec, c) {
  const L = lvl(), len = L3(spec.len, L), tries = L3(spec.tries, L), T0 = L3(spec.time, L);
  const word = pickRand(len === 4 ? WORDS_4 : WORDS_5).toUpperCase();
  let gridHTML = '';
  for (let r = 0; r < tries; r++) gridHTML += `<div class="wrow" style="--n:${len}">${'<span class="wc"></span>'.repeat(len)}</div>`;
  const keysHTML = WL_KEYS.map((k) => `<button class="wk" type="button" data-k="${k}">${k}</button>`).join('') + '<button class="wk wide" type="button" data-k="<" aria-label="O‘chirish">⌫</button><button class="wk wide" type="button" data-k="=" aria-label="Yuborish">⏎ Yubor</button>';
  const q = setGame(c, `<p class="ghint">${len} harfli so‘z. <b class="g">Yashil</b> — joyida, <b class="y">sariq</b> — so‘zda bor, lekin boshqa joyda.</p><div class="wgrid">${gridHTML}</div><div class="wkeys">${keysHTML}</div><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const rowsEl = Array.from(c.el.game.querySelectorAll('.wrow')), keyBtns = Array.from(c.el.game.querySelectorAll('.wk')), bar = q('.meter i'), cnt = q('.gcount');
  const keyEl = {}; keyBtns.forEach((b) => { keyEl[b.dataset.k] = b; });
  let run = false, t = T0, row = 0, cur = '';
  const draw = () => {
    const cells = rowsEl[Math.min(row, tries - 1)].children;
    for (let i = 0; i < len; i++) cells[i].textContent = cur[i] || '';
    timeBar(bar, t, T0); cnt.textContent = `Urinish: ${Math.min(row + 1, tries)} / ${tries} · ${Math.ceil(Math.max(0, t))} s`;
  };
  const press = (k) => {
    if (!run) return;
    if (k === '<') { cur = cur.slice(0, -1); Sound.tap(); }
    else if (k === '=') {
      if (cur.length < len) { bump(rowsEl[row], 'no'); Sound.bump(); return; }
      const sc = wordleScore(cur, word), cells = rowsEl[row].children;
      for (let i = 0; i < len; i++) {
        cells[i].className = 'wc ' + sc[i];
        const kb = keyEl[cur[i]], rank = { n: 1, y: 2, g: 3 };
        if (kb && (rank[sc[i]] > (+kb.dataset.r || 0))) { kb.dataset.r = String(rank[sc[i]]); kb.className = 'wk ' + sc[i]; }
      }
      Sound.pad(row % 4);
      if (cur === word) { run = false; draw(); finishCard(c, true, `To‘g‘ri — ${word}!`); return; }
      row++; cur = '';
      if (row >= tries) { run = false; draw(); finishCard(c, false, `So‘z «${word}» edi.`); return; }
    } else if (cur.length < len) { cur += k; Sound.tap(); }
    draw();
  };
  const nav = gridNav(c, keyBtns, 8, (j) => press(keyBtns[j].dataset.k));
  draw();
  return {
    dbg: () => ({ word, row, cur }),
    start() { run = true; },
    update(dt) { if (!run) return; t -= dt; timeBar(bar, t, T0); if (t <= 0) { run = false; finishCard(c, false, `Vaqt tugadi. So‘z «${word}» edi.`); } },
    dir: nav.dir, action: nav.act,
  };
}

/* ---- 2048 ---- */
function Game2048(spec, c) {
  const L = lvl(), target = L3(spec.target, L), maxMoves = L3(spec.moves, L), T0 = L3(spec.time, L);
  const q = setGame(c, `<div class="b2048"></div>${arrowRowHTML}<div class="meter time"><i></i></div><p class="gcount"></p>`);
  const boardEl = q('.b2048'), bar = q('.meter i'), cnt = q('.gcount');
  const cells = Array.from({ length: 16 }, () => { const e = document.createElement('span'); e.className = 't4'; boardEl.appendChild(e); return e; });
  let b = new Array(16).fill(0), moves = 0, run = false, t = T0;
  const spawn = () => { const empty = []; b.forEach((v, i) => { if (!v) empty.push(i); }); if (empty.length) b[pickRand(empty)] = Math.random() < 0.88 ? 2 : 4; };
  const slideLine = (a) => { const f = a.filter(Boolean), out = []; for (let i = 0; i < f.length; i++) { if (f[i] === f[i + 1]) { out.push(f[i] * 2); i++; } else out.push(f[i]); } while (out.length < 4) out.push(0); return out; };
  const IX = { left: (r, k) => r * 4 + k, right: (r, k) => r * 4 + 3 - k, up: (r, k) => k * 4 + r, down: (r, k) => (3 - k) * 4 + r };
  const shift = (d) => { const nb = b.slice(); for (let r = 0; r < 4; r++) { const out = slideLine([0, 1, 2, 3].map((k) => b[IX[d](r, k)])); for (let k = 0; k < 4; k++) nb[IX[d](r, k)] = out[k]; } return nb; };
  const same = (x, y) => x.every((v, i) => v === y[i]);
  const show = () => {
    cells.forEach((e, i) => { const v = b[i]; e.textContent = v ? String(v) : ''; e.className = 't4' + (v ? ' v' + Math.min(v, 2048) : ''); });
    timeBar(bar, t, T0); cnt.textContent = `Eng katta: ${Math.max(...b)} / ${target} · Yurish: ${moves} / ${maxMoves}`;
  };
  const go = (d) => {
    if (!run || !IX[d]) return;
    const nb = shift(d);
    if (same(nb, b)) { Sound.bump(); return; }
    b = nb; moves++; spawn(); Sound.tap(); show();
    if (Math.max(...b) >= target) { run = false; finishCard(c, true, `${target} ga yetding!`); return; }
    if (moves >= maxMoves) { run = false; finishCard(c, false, 'Yurishlar tugadi.'); return; }
    if (['up', 'down', 'left', 'right'].every((k) => same(shift(k), b))) { run = false; finishCard(c, false, 'Maydon to‘lib qoldi — yurish yo‘q.'); }
  };
  arrowRowBind(c, go);
  let sx = 0, sy = 0, sw = false;
  boardEl.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!live(c)) return; sw = true; sx = e.clientX; sy = e.clientY; });
  boardEl.addEventListener('pointerup', (e) => {
    if (!sw) return; sw = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 18) return;
    go(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
  });
  spawn(); spawn(); show();
  return {
    dbg: () => ({ b: b.slice(), moves }),
    start() { run = true; },
    update(dt) { if (!run) return; t -= dt; timeBar(bar, t, T0); if (t <= 0) { run = false; finishCard(c, false, 'Vaqt tugadi.'); } },
    dir: go,
  };
}

/* ---- Flappy: quvurlar orasidan uch ---- */
function FlappyGame(spec, c) {
  const L = lvl(), need = L3(spec.need, L), gap = L3(spec.gap, L), spd = L3(spec.speed, L), allow = L3(spec.miss, L);
  const { cv, g, W, H } = gameCanvas(300, 200), GROUND = H - 18, BX = 70, R = 11, PW = 40, SPACING = 150, GRAV = 950, FLAP = 300;
  const q = setGame(c, `<div class="cvhost"></div><button class="bigbtn idle" type="button">${spec.label || 'Uch!'}</button><p class="gcount"></p>`);
  q('.cvhost').appendChild(cv);
  const btn = q('.bigbtn'), cnt = q('.gcount');
  let state = 'idle', y = 90, vy = 0, pipes = [], passed = 0, strikes = 0, inv = 0, bob = 0, lastGap = 90, clock = 0, tLeft = 60;
  const spawn = () => {
    lastGap = clamp(lastGap + ri(-55, 55), gap / 2 + 24, GROUND - gap / 2 - 24);
    pipes.push({ x: pipes.length ? pipes[pipes.length - 1].x + SPACING : W + 40, gapY: lastGap, passed: false });
  };
  const draw = () => {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#7fd1ff'); sky.addColorStop(1, '#d4f1ff');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(255,255,255,0.85)';
    for (const [cx0, cy0] of [[60, 40], [190, 28], [270, 60]]) { const cxx = ((cx0 - clock * 14) % (W + 60) + W + 60) % (W + 60) - 30; g.beginPath(); g.arc(cxx, cy0, 12, 0, TAU); g.arc(cxx + 14, cy0 + 3, 10, 0, TAU); g.arc(cxx - 13, cy0 + 4, 9, 0, TAU); g.fill(); }
    for (const p of pipes) {
      g.fillStyle = '#3fae3f'; g.strokeStyle = '#1d6a1d'; g.lineWidth = 2;
      g.fillRect(p.x, 0, PW, p.gapY - gap / 2); g.strokeRect(p.x, 0, PW, p.gapY - gap / 2);
      g.fillRect(p.x, p.gapY + gap / 2, PW, GROUND - p.gapY - gap / 2); g.strokeRect(p.x, p.gapY + gap / 2, PW, GROUND - p.gapY - gap / 2);
      g.fillStyle = '#58c858'; g.fillRect(p.x - 3, p.gapY - gap / 2 - 12, PW + 6, 12); g.fillRect(p.x - 3, p.gapY + gap / 2, PW + 6, 12);
    }
    g.fillStyle = '#c9a35a'; g.fillRect(0, GROUND, W, H - GROUND); g.fillStyle = '#8bc34a'; g.fillRect(0, GROUND, W, 4);
    if (!(inv > 0 && Math.floor(inv * 10) % 2)) {
      g.save(); g.translate(BX, y); g.rotate(clamp(vy / 600, -0.5, 0.9));
      g.font = `24px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🐦', 0, 1); g.restore();
    }
    g.fillStyle = '#1b2b3a'; g.font = '800 18px "Alegreya Sans", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`${passed} / ${need}`, 8, 6);
    if (state === 'ready') { g.textAlign = 'center'; g.font = '700 14px "Alegreya Sans", sans-serif'; g.fillText('Boshlash uchun bos', W / 2, 60); }
    cnt.textContent = `Xato: ${strikes} / ${allow}`;
  };
  const flap = () => {
    if (state === 'ready') { state = 'fly'; spawn(); }
    if (state === 'fly') { vy = -FLAP; flapSound(); }
  };
  tap(c, cv, flap); tap(c, btn, flap);
  draw();
  const crash = (msg) => {
    strikes++; Sound.bump();
    if (strikes > allow) { state = 'done'; draw(); finishCard(c, false, msg); return; }
    const nx = pipes.find((p) => p.x + PW > BX - R);
    y = nx ? nx.gapY : H / 2; vy = 0; inv = 1.3;
  };
  return {
    dbg: () => ({ state, y, vy, gap, BX, R, PW, pipes: pipes.map((p) => ({ x: p.x, gapY: p.gapY })) }),
    start() { state = 'ready'; btn.classList.remove('idle'); },
    update(dt) {
      clock += dt;
      if (state === 'ready') { bob += dt; y = 90 + Math.sin(bob * 4) * 6; draw(); return; }
      if (state !== 'fly') return;
      tLeft -= dt; if (inv > 0) inv -= dt;
      vy += GRAV * dt; y += vy * dt;
      for (const p of pipes) p.x -= spd * dt;
      if (pipes[pipes.length - 1].x <= W - SPACING + 40) spawn();
      pipes = pipes.filter((p) => p.x + PW > -12);
      if (y < R) { y = R; vy = Math.max(vy, 0); }
      let hit = y > GROUND - R;
      if (hit) y = GROUND - R;
      for (const p of pipes) {
        if (!p.passed && p.x + PW < BX - R) { p.passed = true; passed++; Sound.tap(); }
        if (BX + R > p.x && BX - R < p.x + PW && (y - R < p.gapY - gap / 2 || y + R > p.gapY + gap / 2)) hit = true;
      }
      if (passed >= need) { state = 'done'; draw(); finishCard(c, true, `${need} ta quvurdan o‘tding!`); return; }
      if (hit && inv <= 0) { crash('Qush quvurga urildi!'); if (state === 'done') return; }
      if (tLeft <= 0) { state = 'done'; finishCard(c, false, 'Vaqt tugadi.'); return; }
      draw();
    },
    action: flap,
    dir: (d) => { if (d === 'up') flap(); },
  };
}

/* ---- Pianino plitkalari ---- */
function PianoGame(spec, c) {
  const L = lvl(), need = L3(spec.need, L), v0 = L3(spec.speed, L), vmax = L3(spec.vmax, L), allow = L3(spec.miss, L);
  const { cv, g, W, H, pt } = gameCanvas(280, 240), LW = W / 4, RH = H / 4;
  const q = setGame(c, `<p class="ghint">Eng pastdagi <b>qora plitkani</b> o‘z yo‘lagida bos (${touchUI ? 'yo‘lakka bos' : '← ↑ ↓ → tugmalari'}). Tezlik oshib boradi!</p><div class="cvhost"></div><p class="gcount"></p>`);
  q('.cvhost').appendChild(cv);
  const cnt = q('.gcount');
  let tiles = [], v = v0, hits = 0, miss = 0, run = false, flash = 0, lastLane = -1;
  const LANE = { left: 0, up: 1, down: 2, right: 3 };
  const spawnAbove = () => {
    for (;;) {
      const top = tiles.length ? Math.min(...tiles.map((t) => t.y)) : RH * 0.6 + RH;
      if (top <= -RH) return;
      let lane = ri(0, 3); if (lane === lastLane && Math.random() < 0.5) lane = (lane + ri(1, 3)) % 4;
      lastLane = lane; tiles.push({ lane, y: top - RH, done: '' });
    }
  };
  const lowest = () => { let best = null; for (const t of tiles) if (!t.done && t.y + RH > 0 && (!best || t.y > best.y)) best = t; return best; };
  const draw = () => {
    g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#c8c4b8'; g.lineWidth = 1;
    for (let i = 1; i < 4; i++) { g.beginPath(); g.moveTo(i * LW, 0); g.lineTo(i * LW, H); g.stroke(); }
    for (const t of tiles) {
      g.fillStyle = t.done === 'hit' ? '#b9b6ac' : t.done === 'miss' ? '#e0483a' : '#141414';
      g.fillRect(t.lane * LW + 2, t.y + 2, LW - 4, RH - 4);
    }
    if (flash > 0) { g.fillStyle = `rgba(228,72,58,${flash})`; g.fillRect(0, 0, W, H); }
    g.fillStyle = 'rgba(120,120,110,0.9)'; g.font = '800 16px "Alegreya Sans", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`${hits} / ${need}`, 8, 6);
    cnt.textContent = `Xato: ${miss} / ${allow} · tezlik ${Math.round(v)}`;
  };
  const bad = (msg) => { miss++; flash = 0.5; Sound.bump(); if (miss > allow) { run = false; draw(); finishCard(c, false, msg); return true; } return false; };
  const press = (lane) => {
    if (!run) return;
    const t = lowest();
    if (!t) return;
    if (t.lane === lane) { t.done = 'hit'; hits++; Sound.pad(lane); v = Math.min(vmax, v0 + hits * 5); if (hits >= need) { run = false; draw(); finishCard(c, true, 'Pianino ostida barmoqlaring uchib yurdi!'); } }
    else bad('Noto‘g‘ri yo‘lak!');
  };
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (live(c)) press(clamp(Math.floor(pt(e)[0] / LW), 0, 3)); });
  spawnAbove(); draw();
  return {
    dbg: () => ({ tiles: tiles.map((t) => ({ lane: t.lane, y: t.y, done: t.done })), RH, H }),
    start() { run = true; },
    update(dt) {
      if (!run) return;
      if (flash > 0) flash = Math.max(0, flash - dt * 2.5);
      for (const t of tiles) t.y += v * dt;
      for (const t of tiles) if (!t.done && t.y >= H) { t.done = 'miss'; if (bad('Plitka o‘tib ketdi!')) return; }
      tiles = tiles.filter((t) => t.y < H + RH);
      spawnAbove(); draw();
    },
    dir: (d) => { if (d in LANE) press(LANE[d]); },
  };
}

/* ---- Minora (Stack) ---- */
function StackGame(spec, c) {
  const L = lvl(), need = L3(spec.need, L), sp0 = L3(spec.speed, L);
  const { cv, g, W, H } = gameCanvas(280, 240), BH = 18, BASE = H - 16;
  const q = setGame(c, `<div class="cvhost"></div><button class="bigbtn idle" type="button">${spec.label || 'Qo‘y!'}</button><p class="gcount"></p>`);
  q('.cvhost').appendChild(cv);
  const btn = q('.bigbtn'), cnt = q('.gcount');
  let blocks = [{ x: (W - 130) / 2, w: 130 }], mv = null, dirn = 1, levels = 0, sp = sp0, falls = [], run = false, perfects = 0;
  const yOf = (i) => BASE - (i + 1) * BH + Math.max(0, blocks.length - 9) * BH;
  const spawn = () => { const top = blocks[blocks.length - 1]; mv = { x: dirn > 0 ? 0 : W - top.w, w: top.w }; };
  const draw = () => {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#1f3a5f'); sky.addColorStop(1, '#6aa6d8');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    blocks.forEach((b, i) => { g.fillStyle = `hsl(${(i * 22 + 20) % 360},62%,56%)`; g.fillRect(b.x, yOf(i), b.w, BH - 1); });
    if (mv) { g.fillStyle = `hsl(${(blocks.length * 22 + 20) % 360},70%,62%)`; g.fillRect(mv.x, yOf(blocks.length), mv.w, BH - 1); }
    for (const f of falls) { g.globalAlpha = clamp(1 - f.t * 1.2, 0, 1); g.fillStyle = '#d9dde3'; g.fillRect(f.x, f.y, f.w, BH - 1); g.globalAlpha = 1; }
    g.fillStyle = '#16212e'; g.fillRect(0, BASE, W, H - BASE);
    g.fillStyle = '#fff'; g.font = '800 18px "Alegreya Sans", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`${levels} / ${need}`, 8, 6);
    cnt.textContent = perfects ? `Aniq tushirish: ${perfects}` : 'Blokni oldingisining ustiga aniq tushir';
  };
  const drop = () => {
    if (!run || !mv) return;
    const top = blocks[blocks.length - 1];
    const left = Math.max(mv.x, top.x), right = Math.min(mv.x + mv.w, top.x + top.w), ov = right - left;
    if (ov <= 4) { falls.push({ x: mv.x, w: mv.w, y: yOf(blocks.length), t: 0 }); mv = null; run = false; draw(); Sound.hurt(); finishCard(c, false, 'Blok ustiga tushmadi — minora qulab tushdi!'); return; }
    const perfect = Math.abs(mv.x - top.x) <= 3;
    if (perfect) { blocks.push({ x: top.x, w: top.w }); perfects++; Sound.pickup(); }
    else {
      falls.push({ x: mv.x < top.x ? mv.x : right, w: mv.w - ov, y: yOf(blocks.length), t: 0 });
      blocks.push({ x: left, w: ov }); Sound.tap();
    }
    levels++; sp = Math.min(sp0 * 1.9, sp + 7);
    if (levels >= need) { mv = null; run = false; draw(); finishCard(c, true, `${need} qavatli minora qurding!`); return; }
    spawn();
  };
  tap(c, cv, drop); tap(c, btn, drop);
  draw();
  return {
    dbg: () => ({ mv: mv && { x: mv.x, w: mv.w }, top: blocks[blocks.length - 1], levels }),
    start() { run = true; spawn(); btn.classList.remove('idle'); },
    update(dt) {
      for (const f of falls) { f.t += dt; f.y += 260 * dt * f.t; }
      falls = falls.filter((f) => f.t < 1);
      if (run && mv) {
        mv.x += dirn * sp * dt;
        if (mv.x + mv.w > W) { mv.x = W - mv.w; dirn = -1; }
        if (mv.x < 0) { mv.x = 0; dirn = 1; }
      }
      if (run || falls.length) draw();
    },
    action: drop,
    dir: (d) => { if (d === 'down' || d === 'up') drop(); },
  };
}

/* ---- Dinozavr (Chrome oflayn o‘yini) ---- */
function DinoGame(spec, c) {
  const L = lvl(), need = L3(spec.need, L), spd = L3(spec.speed, L), allow = L3(spec.miss, L);
  const { cv, g, W, H } = gameCanvas(300, 170), GROUND = 135, DX = 44, JUMP = 430, GRAV = 1400;
  const q = setGame(c, `<div class="cvhost"></div><button class="bigbtn idle" type="button">${spec.label || 'Sakra!'}</button><p class="gcount"></p>`);
  q('.cvhost').appendChild(cv);
  const btn = q('.bigbtn'), cnt = q('.gcount');
  let run = false, y = 0, vy = 0, obs = [], nextIn = 1.0, passed = 0, strikes = 0, inv = 0, clock = 0, scroll = 0;
  const draw = () => {
    const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, '#f6efe0'); sky.addColorStop(1, '#e8dcc0');
    g.fillStyle = sky; g.fillRect(0, 0, W, H);
    g.fillStyle = '#c9b88a'; g.fillRect(0, GROUND, W, H - GROUND);
    g.strokeStyle = '#8a7a52'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, GROUND); g.lineTo(W, GROUND); g.stroke();
    g.fillStyle = '#a89868';
    for (let k = 0; k < 14; k++) { const px = (((k * 53 - scroll) % (W + 20)) + W + 20) % (W + 20) - 10; g.fillRect(px, GROUND + 8 + (k % 3) * 8, 6 + (k % 4) * 3, 2); }
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (const o of obs) { g.font = `${o.h + 6}px ${EMOJI_FONT}`; g.fillText('🌵', o.x + o.w / 2, GROUND + 2); }
    if (!(inv > 0 && Math.floor(inv * 10) % 2)) { g.font = `34px ${EMOJI_FONT}`; g.save(); g.translate(DX, GROUND - y); g.scale(-1, 1); g.fillText('🦖', 0, 2); g.restore(); }
    g.fillStyle = '#4a3d22'; g.font = '800 18px "Alegreya Sans", sans-serif'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText(`${passed} / ${need}`, 8, 6);
    cnt.textContent = `Xato: ${strikes} / ${allow}`;
  };
  const jump = () => { if (run && y <= 0.01) { vy = JUMP; Sound.jump(); } };
  tap(c, cv, jump); tap(c, btn, jump);
  draw();
  return {
    dbg: () => ({ y, vy, spd, DX, obs: obs.map((o) => ({ x: o.x, w: o.w, h: o.h })) }),
    start() { run = true; btn.classList.remove('idle'); },
    update(dt) {
      if (!run) return;
      clock += dt; scroll += spd * dt; if (inv > 0) inv -= dt;
      vy -= GRAV * dt; y += vy * dt;
      if (y <= 0) { y = 0; vy = 0; }
      nextIn -= dt;
      if (nextIn <= 0) { obs.push({ x: W + 10, w: ri(16, 24), h: ri(24, 34), passed: false }); nextIn = (ri(95, 170) / 100) * (200 / spd) * 0.95 + 0.35; }
      for (const o of obs) {
        o.x -= spd * dt;
        if (!o.passed && o.x + o.w < DX - 11) { o.passed = true; passed++; Sound.tap(); }
        if (!o.hit && inv <= 0 && o.x < DX + 9 && o.x + o.w > DX - 9 && y < o.h - 4) {
          o.hit = true; strikes++; Sound.bump(); inv = 1;
          if (strikes > allow) { run = false; draw(); finishCard(c, false, 'Kaktusga urilding!'); return; }
        }
      }
      obs = obs.filter((o) => o.x + o.w > -20);
      if (passed >= need) { run = false; draw(); finishCard(c, true, `${need} ta to‘siqdan sakrab o‘tding!`); return; }
      draw();
    },
    action: jump,
    dir: (d) => { if (d === 'up') jump(); },
  };
}

/* ---- Shisha ag‘darish (Bottle flip) ---- */
function BottleGame(spec, c) {
  const L = lvl(), zw = L3(spec.zone, L), sp = L3(spec.speed, L), tries = L3(spec.tries, L);
  const q = setGame(c, `<p class="ghint">Ikkita chiziqni yashil joyda to‘xtat: avval <b>kuch</b>, so‘ng <b>aylanish</b>. Shisha tik tushishi kerak!</p><div class="bflip"><span class="bottle">${spec.icon || '🍾'}</span><i class="btable"></i></div><div class="track"><div class="zone"></div><div class="mark"></div></div><div class="track"><div class="zone"></div><div class="mark"></div></div><button class="bigbtn idle" type="button">Kuch</button><p class="gcount"></p>`);
  const bottle = q('.bottle'), tracks = Array.from(c.el.game.querySelectorAll('.track')), btn = q('.bigbtn'), cnt = q('.gcount');
  const zones = tracks.map((t) => t.querySelector('.zone')), marks = tracks.map((t) => t.querySelector('.mark'));
  let stage = 0, used = 0, run = false, pos = [Math.random(), Math.random()], dirs = [1, -1], zone = [0, 0], hit = [false, false], busy = 0, t0 = 0;
  const place = () => { for (let k = 0; k < 2; k++) { zone[k] = 0.06 + Math.random() * (0.88 - zw); zones[k].style.left = zone[k] * 100 + '%'; zones[k].style.width = zw * 100 + '%'; zones[k].className = 'zone'; } };
  const draw = () => { marks.forEach((m, k) => { m.style.left = pos[k] * 100 + '%'; m.style.opacity = k > stage ? 0.35 : 1; }); cnt.textContent = `Urinish: ${Math.min(used + 1, tries)} / ${tries}`; };
  const press = () => {
    if (!run || busy > 0) return;
    const ok = pos[stage] >= zone[stage] && pos[stage] <= zone[stage] + zw;
    hit[stage] = ok; zones[stage].className = 'zone ' + (ok ? 'ok' : 'no'); ok ? Sound.tap() : Sound.bump();
    if (stage === 0) { stage = 1; btn.textContent = 'Aylanish'; draw(); return; }
    // ikkala chiziq to‘xtadi: shisha uchadi
    busy = 1.5; run = true; used++;
    const good = hit[0] && hit[1];
    bottle.style.transition = 'transform 1.1s cubic-bezier(.2,.7,.3,1)';
    bottle.style.transform = good ? 'translateY(0) rotate(720deg)' : `translateY(10px) rotate(${hit[0] || hit[1] ? 810 : 560}deg)`;
    bottle.dataset.good = good ? '1' : '0';
    draw();
  };
  tap(c, btn, press);
  place(); draw();
  return {
    dbg: () => ({ stage, pos: pos.slice(), zone: zone.slice(), zw, busy }),
    start() { run = true; btn.classList.remove('idle'); t0 = 0; },
    update(dt) {
      if (!run) return;
      if (busy > 0) {
        busy -= dt;
        if (busy <= 0) {
          const good = bottle.dataset.good === '1';
          if (good) { run = false; Sound.pickup(); finishCard(c, true, 'Shisha tik tushdi — mukammal!'); return; }
          if (used >= tries) { run = false; finishCard(c, false, 'Shisha yiqildi — urinishlar tugadi.'); return; }
          bottle.style.transition = 'none'; bottle.style.transform = 'none';
          stage = 0; btn.textContent = 'Kuch'; place(); hit = [false, false];
        }
        draw(); return;
      }
      for (let k = 0; k <= stage; k++) {
        if (k < stage) continue;
        pos[k] += dirs[k] * sp * dt * (k ? 1.15 : 1);
        if (pos[k] > 1) { pos[k] = 2 - pos[k]; dirs[k] = -1; }
        if (pos[k] < 0) { pos[k] = -pos[k]; dirs[k] = 1; }
      }
      draw();
    },
    action: press,
  };
}

/* ---- Ilon (Snake) ---- */
function SnakeGame(spec, c) {
  const L = lvl(), need = L3(spec.need, L), step = L3(spec.step, L), T0 = L3(spec.time, L);
  const { cv, g, W, H, pt } = gameCanvas(220, 220), N = 11, CS = W / N;
  const q = setGame(c, `<div class="cvhost"></div>${arrowRowHTML}<div class="meter time"><i></i></div><p class="gcount"></p>`);
  q('.cvhost').appendChild(cv);
  const bar = q('.meter i'), cnt = q('.gcount');
  const VEC = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  let snake = [[5, 5], [4, 5], [3, 5]], dir = 'right', queue = [], apple = [8, 5], eaten = 0, run = false, acc = 0, t = T0;
  const placeApple = () => { const free = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (!snake.some((s) => s[0] === x && s[1] === y)) free.push([x, y]); apple = pickRand(free); };
  const draw = () => {
    g.fillStyle = '#10241a'; g.fillRect(0, 0, W, H);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if ((x + y) % 2) { g.fillStyle = 'rgba(255,255,255,0.03)'; g.fillRect(x * CS, y * CS, CS, CS); }
    snake.forEach((s, i) => { g.fillStyle = i ? '#4fc36a' : '#9be38a'; g.beginPath(); g.roundRect ? g.roundRect(s[0] * CS + 1, s[1] * CS + 1, CS - 2, CS - 2, 5) : g.rect(s[0] * CS + 1, s[1] * CS + 1, CS - 2, CS - 2); g.fill(); });
    const h = snake[0]; g.fillStyle = '#10241a'; g.beginPath(); g.arc(h[0] * CS + CS * 0.62, h[1] * CS + CS * 0.38, 2, 0, TAU); g.arc(h[0] * CS + CS * 0.38, h[1] * CS + CS * 0.38, 2, 0, TAU); g.fill();
    g.font = `${CS * 0.9}px ${EMOJI_FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🍎', apple[0] * CS + CS / 2, apple[1] * CS + CS / 2 + 1);
    timeBar(bar, t, T0); cnt.textContent = `Olma: ${eaten} / ${need}`;
  };
  const turn = (d) => {
    if (!VEC[d]) return;
    const last = queue.length ? queue[queue.length - 1] : dir;
    if (d === last || (VEC[d][0] === -VEC[last][0] && VEC[d][1] === -VEC[last][1])) return;
    if (queue.length < 2) queue.push(d);
  };
  arrowRowBind(c, (d) => { if (run) turn(d); });
  let sx = 0, sy = 0, sw = false;
  cv.addEventListener('pointerdown', (e) => { e.preventDefault(); if (!live(c)) return; sw = true; sx = e.clientX; sy = e.clientY; });
  cv.addEventListener('pointerup', (e) => { if (!sw) return; sw = false; const dx = e.clientX - sx, dy = e.clientY - sy; if (Math.max(Math.abs(dx), Math.abs(dy)) < 14) return; if (run) turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); });
  draw();
  return {
    dbg: () => ({ snake: snake.map((s) => s.slice()), dir, apple: apple.slice(), N, queue: queue.slice() }),
    start() { run = true; },
    update(dt) {
      if (!run) return;
      t -= dt; acc += dt;
      while (acc >= step && run) {
        acc -= step;
        if (queue.length) dir = queue.shift();
        const h = snake[0], nx = h[0] + VEC[dir][0], ny = h[1] + VEC[dir][1];
        const tail = snake[snake.length - 1], eat = nx === apple[0] && ny === apple[1];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N || snake.some((s, i) => s[0] === nx && s[1] === ny && (i < snake.length - 1 || eat) )) { run = false; draw(); Sound.hurt(); finishCard(c, false, 'Ilon urilib ketdi!'); return; }
        snake.unshift([nx, ny]);
        if (eat) { eaten++; Sound.pickup(); if (eaten >= need) { run = false; draw(); finishCard(c, true, `${need} ta olma yeding!`); return; } placeApple(); }
        else snake.pop();
        void tail;
      }
      draw();
      if (t <= 0) { run = false; finishCard(c, false, 'Vaqt tugadi.'); }
    },
    dir: turn,
  };
}

/* ---- X-O (krestik-nolik) ---- */
const TTT_LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
const tttWinner = (b) => { for (const [x, y, z] of TTT_LINES) if (b[x] && b[x] === b[y] && b[x] === b[z]) return b[x]; return b.every(Boolean) ? 'D' : ''; };
function tttMinimax(b, turn) {
  const w = tttWinner(b);
  if (w === 'O') return 1;
  if (w === 'X') return -1;
  if (w === 'D') return 0;
  let best = turn === 'O' ? -2 : 2;
  for (let i = 0; i < 9; i++) if (!b[i]) { b[i] = turn; const v = tttMinimax(b, turn === 'O' ? 'X' : 'O'); b[i] = ''; best = turn === 'O' ? Math.max(best, v) : Math.min(best, v); }
  return best;
}
function tttBotMove(b, err) {
  const free = []; for (let i = 0; i < 9; i++) if (!b[i]) free.push(i);
  if (Math.random() < err) return pickRand(free);
  let best = -2, moves = [];
  for (const i of free) { b[i] = 'O'; const v = tttMinimax(b, 'X'); b[i] = ''; if (v > best) { best = v; moves = [i]; } else if (v === best) moves.push(i); }
  return pickRand(moves);
}
function TicTacToeGame(spec, c) {
  const L = lvl(), err = L3(spec.err, L), drawOk = L >= 1;
  const q = setGame(c, `<p class="ghint">Sen — <b>X</b>, bot — <b>O</b>. ${drawOk ? 'Botdan yutqazma: durang ham yutuq.' : 'Botni yut — uch X ni bir qatorga tizib qo‘y.'}</p><div class="ttt">${'<button class="tc" type="button"></button>'.repeat(9)}</div><p class="gcount"></p>`);
  const btns = Array.from(c.el.game.querySelectorAll('.tc')), cnt = q('.gcount');
  const b = Array(9).fill('');
  let run = false, wait = 0, over = false;
  const show = () => { btns.forEach((e, i) => { e.textContent = b[i]; e.className = 'tc' + (b[i] ? ' ' + b[i].toLowerCase() : ''); }); cnt.textContent = over ? '' : 'Sening navbating'; };
  const finish = (w) => {
    over = true; run = false; show();
    if (w === 'X') finishCard(c, true, 'Yutding — X ning uch belgisi bir qatorda!');
    else if (w === 'D') finishCard(c, drawOk, drawOk ? 'Durang — botdan yutqazmading.' : 'Durang — bot yutqazmadi.');
    else finishCard(c, false, 'Bot yutdi.');
  };
  const pick = (i) => {
    if (!run || wait > 0 || b[i]) return;
    b[i] = 'X'; Sound.tap(); show();
    const w = tttWinner(b);
    if (w) { finish(w); return; }
    wait = 0.45; cnt.textContent = 'Bot o‘ylayapti…';
  };
  const nav = gridNav(c, btns, 3, pick);
  show();
  return {
    dbg: () => ({ b: b.slice(), wait }),
    start() { run = true; },
    update(dt) {
      if (!run || wait <= 0) return;
      wait -= dt;
      if (wait > 0) return;
      b[tttBotMove(b, err)] = 'O'; Sound.pad(2); show();
      const w = tttWinner(b);
      if (w) finish(w);
    },
    dir: nav.dir, action: nav.act,
  };
}

/* ---- To‘rt qatorda (Connect 4): botga qarshi strategik o‘yin ---- */
const C4W = 7, C4H = 6;
const C4_WIN = (() => {   // to‘rtta katakdan iborat hamma qatorlar (gorizontal, vertikal, ikkita diagonal)
  const out = [];
  for (let y = 0; y < C4H; y++) for (let x = 0; x < C4W; x++) for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [1, -1]]) {
    const ex = x + 3 * dx, ey = y + 3 * dy;
    if (ex < 0 || ex >= C4W || ey < 0 || ey >= C4H) continue;
    out.push([0, 1, 2, 3].map((k) => (y + k * dy) * C4W + x + k * dx));
  }
  return out;
})();
function c4Winner(b) {
  for (const w of C4_WIN) { const v = b[w[0]]; if (v && v === b[w[1]] && v === b[w[2]] && v === b[w[3]]) return v; }
  return b.every((v) => v) ? 'D' : '';
}
function c4Drop(b, col, v) {
  for (let y = C4H - 1; y >= 0; y--) if (!b[y * C4W + col]) { b[y * C4W + col] = v; return y * C4W + col; }
  return -1;
}
function c4Eval(b, v) {   // v ning ko‘z qarashi: ochiq uchlik/ikkilik va markaz
  const o = v === 'R' ? 'Y' : 'R';
  let sc = 0;
  for (let y = 0; y < C4H; y++) { if (b[y * C4W + 3] === v) sc += 3; else if (b[y * C4W + 3] === o) sc -= 3; }
  for (const w of C4_WIN) {
    let m = 0, t = 0;
    for (const i of w) { if (b[i] === v) m++; else if (b[i] === o) t++; }
    if (m && t) continue;
    if (m === 3) sc += 7; else if (m === 2) sc += 2; else if (t === 3) sc -= 9; else if (t === 2) sc -= 2;
  }
  return sc;
}
function c4Neg(b, turn, d, alpha, beta) {
  const w = c4Winner(b);
  if (w === 'D') return 0;
  if (w) return (w === turn ? 1 : -1) * (1000 + d);
  if (d === 0) return c4Eval(b, turn);
  const next = turn === 'R' ? 'Y' : 'R';
  let best = -Infinity;
  for (const col of [3, 2, 4, 1, 5, 0, 6]) {
    if (b[col]) continue;
    const i = c4Drop(b, col, turn), sc = -c4Neg(b, next, d - 1, -beta, -alpha);
    b[i] = '';
    if (sc > best) best = sc;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}
// Botning yurishi (sariq): chuqurlik darajaga qarab, `err` ehtimol bilan tasodifiy xato qiladi.
function c4BotMove(b, depth, err) {
  const cols = [0, 1, 2, 3, 4, 5, 6].filter((c) => !b[c]);
  if (Math.random() < err) return pickRand(cols);
  let best = -Infinity, pool = [];
  for (const col of [3, 2, 4, 1, 5, 0, 6]) {
    if (b[col]) continue;
    const i = c4Drop(b, col, 'Y'), sc = -c4Neg(b, 'R', depth - 1, -Infinity, Infinity);
    b[i] = '';
    if (sc > best) { best = sc; pool = [col]; } else if (sc === best) pool.push(col);
  }
  return pickRand(pool);
}
function Connect4Game(spec, c) {
  const L = lvl(), depth = L3(spec.depth, L), err = L3(spec.err, L), T0 = L3(spec.time, L), drawOk = L === 0;
  const q = setGame(c, `<p class="ghint">Sen — 🔴, bot — 🟡. ${drawOk ? 'Durang ham yutuq.' : 'To‘rtta 🔴 ni bir qatorga tizib yut.'} Ustunni bos${touchUI ? '' : ' (← → va Space)'}.</p><div class="c4">${Array.from({ length: C4W }, (_, x) => `<button class="c4col" type="button" aria-label="${x + 1}-ustun">${'<i class="c4d"></i>'.repeat(C4H)}</button>`).join('')}</div><div class="meter time"><i></i></div><p class="gcount"></p>`);
  const cols = Array.from(c.el.game.querySelectorAll('.c4col')), cnt = q('.gcount'), bar = q('.meter i');
  const b = Array(C4W * C4H).fill('');
  let run = false, wait = 0, over = false, t = T0, last = -1;
  const show = () => {
    cols.forEach((col, x) => Array.from(col.children).forEach((d, y) => { const v = b[y * C4W + x]; d.className = 'c4d' + (v ? ' ' + v.toLowerCase() : '') + (y * C4W + x === last ? ' last' : ''); }));
    cnt.textContent = over ? '' : wait > 0 ? 'Bot o‘ylayapti…' : 'Sening navbating';
    timeBar(bar, t, T0);
  };
  const finish = (w, msg) => {
    over = true; run = false; show();
    if (msg) { finishCard(c, false, msg); return; }
    if (w === 'R') finishCard(c, true, 'Yutding — to‘rtta 🔴 bir qatorda!');
    else if (w === 'D') finishCard(c, drawOk, drawOk ? 'Durang — botdan yutqazmading.' : 'Durang — bot yutqazmadi.');
    else finishCard(c, false, 'Bot yutdi — to‘rtta 🟡.');
  };
  const pick = (x) => {
    if (!run || wait > 0 || b[x]) return;
    last = c4Drop(b, x, 'R'); Sound.tap();
    const w = c4Winner(b);
    show();
    if (w) { finish(w); return; }
    wait = 0.55; show();
  };
  const nav = gridNav(c, cols, C4W, pick);
  show();
  return {
    dbg: () => ({ b: b.slice(), wait, t }),
    start() { run = true; show(); },
    update(dt) {
      if (!run) return;
      t -= dt; timeBar(bar, t, T0);
      if (t <= 0) { finish('', 'Vaqt tugadi.'); return; }
      if (wait <= 0) return;
      wait -= dt;
      if (wait > 0) return;
      last = c4Drop(b, c4BotMove(b, depth, err), 'Y'); Sound.pad(2);
      const w = c4Winner(b);
      show();
      if (w) finish(w);
    },
    dir: nav.dir, action: nav.act,
  };
}

/* ---- Ro‘yxat: nomi, sharti, botning omadi ---- */
const GAMES = {
  dice: { name: 'Zar', make: DiceGame, bot: 0, desc: (s) => s.text },
  riddle: { name: 'Topishmoq', make: RiddleGame, bot: 0.66, desc: (s) => `Savol yoki topishmoq: to‘g‘ri javobni tanla. Vaqt — ${s.time} soniya.` },
  arrows: { name: 'Strelkalar', make: ArrowsGame, bot: 0.68, desc: (s, L) => `Strelkalar: ko‘rsatilgan tomonni bos (qizil strelka — teskari). ${L3(s.n, L)} ta strelka, ${L3(s.miss, L)} tadan ortiq xato qilma.` },
  simon: { name: 'Barabanlar', make: SimonGame, bot: 0.62, desc: (s, L) => `Barabanlar: ${L3(s.len, L)} ta zarbni eslab qol va ${s.rev ? 'TESKARI tartibda' : 'xuddi shu tartibda'} takrorla.` },
  memory: { name: 'Juftini top', make: MemoryGame, bot: 0.64, desc: (s, L) => `Juftini top: ${L3(s.pairs, L)} juft yopiq kartani ${L3(s.time, L)} soniyada ochib chiq.` },
  stroop: { name: 'Rang va so‘z', make: StroopGame, bot: 0.64, desc: (s, L) => `Rang va so‘z: so‘z qaysi rangda yozilganini tanla (so‘z o‘zi boshqa rangni aytadi). ${L3(s.n, L)} marta.` },
  balance: { name: 'Muvozanat', make: BalanceGame, bot: 0.66, desc: (s, L) => `Muvozanat: shamol itaradi — ◀ ▶ bilan ${L3(s.time, L)} soniya o‘rtada ushlab tur.` },
  dodge: { name: 'Qochib qol', make: (s, c) => LaneGame(s, c, 'dodge'), bot: 0.66, desc: (s, L) => `Qochib qol: tushayotgan ${s.obj} dan ${L3(s.time, L)} soniya qoch. ${L3(s.miss, L)} tadan ortiq tegmasin.` },
  pattern: { name: 'Naqsh', make: PatternGame, bot: 0.62, desc: (s, L) => `Naqsh: bir lahza yongan ${L3(s.k, L)} ta katakni eslab qol va bos. ${L3(s.rounds, L)} raund.` },
  rhythm: { name: 'Ritm', make: RhythmGame, bot: 0.6, desc: (s, L) => `Ritm: barabanni zarbga tushirib ur — ${L3(s.beats, L)} zarbdan kamida ${L3(s.beats, L) - L3(s.slack, L)} tasi.` },
  scramble: { name: 'So‘z tikla', make: ScrambleGame, bot: 0.64, desc: (s, L) => `So‘z tikla: aralash harflardan so‘zni to‘g‘ri tartibda yig‘. ${L3(s.miss, L)} tadan ortiq xato qilma.` },
  shell: { name: 'Ko‘zalar', make: ShellGame, bot: 0.62, desc: (s, L) => `Ko‘zalar: ${s.item} qaysi ko‘za ostida qolganini aralashtirilgandan keyin top.` },
  lock: { name: 'Qulf', make: LockGame, bot: 0.72, desc: (s, L) => `Qulf: 1 dan ${L3(s.max, L)} gacha yashirin sonni ${L3(s.tries, L)} urinishda top (qulf «kattaroq/kichikroq» deb aytadi).` },
  redlight: { name: 'Qizil chiroq', make: RedLightGame, chal: true, bot: 0.66, desc: (s, L) => `Qizil chiroq, yashil chiroq: yashilda tugmani ushlab yugur, qizil yonsa darhol qo‘yib yubor. ${L3(s.need, L)} soniya yugurish kerak, ${L3(s.miss, L)} tadan ortiq xato qilma.` },
  glass: { name: 'Shisha ko‘prik', make: GlassGame, chal: true, bot: 0.55, desc: (s, L) => `Shisha ko‘prik: bir lahza yonadigan xavfsiz oynalarni eslab qol va ${L3(s.rows, L)} qatordan o‘t. ${L3(s.miss, L) ? 'Bitta xato kechiriladi.' : 'Xato qilib bo‘lmaydi.'}` },
  dalgona: { name: 'Dalgona', make: DalgonaGame, chal: true, bot: 0.5, desc: (s, L) => `Dalgona: ignani shakl chizig‘i bo‘ylab yurgiz, chiziqdan uzoq chiqma — kuki yorilib ketadi. ${L3(s.time, L)} soniya.` },
  tug: { name: 'Arqon tortish', make: TugGame, chal: true, bot: 0.66, desc: (s, L) => `Arqon tortish: «${s.label || 'Tort!'}» tugmasini tez-tez bos va arqonni o‘z tomoningga tort. Vaqt — ${L3(s.time, L)} soniya.` },
  wordle: { name: 'So‘z topish', make: WordleGame, chal: true, bot: 0.45, desc: (s, L) => `So‘z topish: ${L3(s.len, L)} harfli so‘zni ${L3(s.tries, L)} urinishda top. Yashil — harf joyida, sariq — so‘zda bor, lekin boshqa joyda.` },
  g2048: { name: '2048', make: Game2048, chal: true, bot: 0.5, desc: (s, L) => `2048: bir xil sonlarni birlashtirib ${L3(s.target, L)} ga yet — ${L3(s.moves, L)} yurish va ${L3(s.time, L)} soniya ichida.` },
  flappy: { name: 'Uchar qush', make: FlappyGame, chal: true, bot: 0.5, desc: (s, L) => `Uchar qush: tugmani bosib qushni ko‘tar va ${L3(s.need, L)} ta quvur orasidan o‘t. ${L3(s.miss, L) ? 'Bitta urilish kechiriladi.' : 'Urilsang — yutqazasan.'}` },
  piano: { name: 'Pianino', make: PianoGame, chal: true, bot: 0.58, desc: (s, L) => `Pianino plitkalari: eng pastdagi qora plitkani o‘z yo‘lagida bos. ${L3(s.need, L)} ta to‘g‘ri bos, ${L3(s.miss, L)} tadan ortiq xato qilma.` },
  stack: { name: 'Minora', make: StackGame, chal: true, bot: 0.55, desc: (s, L) => `Minora: harakatlanayotgan blokni oldingisining aniq ustiga tushir — ${L3(s.need, L)} qavat qur.` },
  dino: { name: 'Dinozavr', make: DinoGame, chal: true, bot: 0.6, desc: (s, L) => `Dinozavr: kaktuslardan sakrab o‘t — ${L3(s.need, L)} ta to‘siq. ${L3(s.miss, L) ? 'Bitta urilish kechiriladi.' : 'Urilsang — yutqazasan.'}` },
  bottle: { name: 'Shisha ag‘darish', make: BottleGame, chal: true, bot: 0.6, desc: (s, L) => `Shisha ag‘darish: kuch va aylanish chiziqlarini yashil joyda to‘xtat — shisha tik tushsin. ${L3(s.tries, L)} urinish.` },
  snake: { name: 'Ilon', make: SnakeGame, chal: true, bot: 0.5, desc: (s, L) => `Ilon: ${L3(s.need, L)} ta olma yegin, devorga va o‘z dumingga urilma. Vaqt — ${L3(s.time, L)} soniya.` },
  duel: { name: 'Duel', make: DuelGame, bot: 0.5, desc: () => `Duel: ${DUEL_S} soniya ichida raqibingdan ko‘proq bos.` },
  connect4: { name: 'To‘rt qatorda', make: Connect4Game, chal: true, bot: 0.45, desc: (s, L) => (L === 0 ? 'To‘rt qatorda: botdan yutqazma — durang ham yutuq.' : 'To‘rt qatorda: botni yut — to‘rtta 🔴 ni bir qatorga (gorizontal, vertikal yoki diagonal) tizib qo‘y.') },
  tictactoe: { name: 'X-O', make: TicTacToeGame, chal: true, bot: 0.6, desc: (s, L) => (L >= 1 ? 'X-O: botdan yutqazma — durang ham yutuq.' : 'X-O: botni yut — uchta X ni bir qatorga tizib qo‘y.') },
};
const makeGame = (spec, c) => (GAMES[spec.type] || GAMES.riddle).make(spec, c);
const describe = (spec, L) => (GAMES[spec.type] ? GAMES[spec.type].desc(spec, L) : '');
const poolText = (games) => 'Sinovlardan biri: ' + Array.from(new Set(games.map((g) => (g.type === 'dice' ? 'zar' : GAMES[g.type].name.toLowerCase())))).join(', ') + '.';

// 7 yoshdan 70 yoshgacha: faqat tez va tushunarli mini-o'yinlar qoladi (murakkablari olib tashlandi).
const EASY_GAMES = new Set(['dice', 'arrows', 'dodge', 'balance', 'memory', 'shell', 'simon', 'pattern', 'redlight', 'glass', 'tug', 'flappy', 'piano', 'stack', 'dino', 'bottle']);
(function simplifyGames() {
  const fill = ['memory', 'shell', 'arrows', 'simon', 'dodge'];
  const fix = (list) => { const out = list.filter((g) => EASY_GAMES.has(g.type)); for (const k of fill) { if (out.length >= 3) break; if (!out.some((g) => g.type === k)) out.push(V(k)); } return out; };
  for (const t of TRAPS) t.games = fix(t.games);
  for (const k of Object.keys(BEASTS)) if (BEASTS[k].games) BEASTS[k].games = fix(BEASTS[k].games);
  CHEST.games = fix(CHEST.games);
})();

/* ================= Ekran va o‘yinchining paneli ================= */
const ARR8 = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];   // kompas yo‘nalishi: sharq, janubi-sharq, janub, ...
const HEART = '<svg class="heart%C" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>';
GAME_REG.make = makeGame;
export { DuelGame, buildDie, setDie, fmt1, live, setGame, tap, timeBar, bump, crossHTML, crossBind, crossFill, gridNav, DiceGame, OPP, ArrowsGame, padsHTML, SimonGame, nextQuestion, RiddleGame, MEM_ICONS, MemoryGame, COLORS, StroopGame, holdButtons, BalanceGame, LaneGame, PatternGame, RhythmGame, WORDS, ScrambleGame, ShellGame, LockGame, heldAct, gameCanvas, ARROW_ROW, arrowRowHTML, arrowRowBind, flapSound, RedLightGame, GlassGame, star, heart, DAL_SHAPES, nearestOnPath, tracePath, DalgonaGame, TugGame, WORDS_4, WORDS_5, WL_KEYS, wordleScore, WordleGame, Game2048, FlappyGame, PianoGame, StackGame, DinoGame, BottleGame, SnakeGame, TTT_LINES, tttWinner, tttMinimax, tttBotMove, TicTacToeGame, C4W, C4H, C4_WIN, c4Winner, c4Drop, c4Eval, c4Neg, c4BotMove, Connect4Game, GAMES, makeGame, describe, poolText, EASY_GAMES, ARR8, HEART };
