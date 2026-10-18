// UIManager (kartalar): mini-o‘yin kartasini ochish/yopish, bosqichlar (openCard, cardMain, cardDir, finishCard, closeCard), FX davomiyliklari.
import { Sound } from './audio.js';
import { botCard } from './bots.js';
import { DIFFS, dirName } from './content.js';
import { quant } from './input.js';
import { mapPickClose } from './magic.js';
import { playerDown } from './player.js';
import { G, GAME_REG, ui } from './state.js';
import { touchUI } from './util.js';
const FX = () => DIFFS[G.diff].fx;   // tuzoq ta’sirining davomiyligi xaritaga qarab: oson < o‘rta < qiyin
// Matndagi {fever}, {flood}… belgilar joriy xarita (yoki kitobda — oson–qiyin oralig‘i) qiymati bilan almashtiriladi.
const fxTok = (str, F) => str.replace(/\{(\w+)\}/g, (m, k) => (F ? F[k] : `${DIFFS.easy.fx[k]}–${DIFFS.hard.fx[k]}`));
const trapXus = (def, F) => fxTok(def.xus + ' Bundan tashqari {stun} soniya garang bo‘lib qimirlay olmaysan.', F);
const PIPS = { 1: [5], 2: [1, 9], 3: [1, 5, 9], 4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9] };
const ROT = { 1: [0, 0], 2: [0, -90], 3: [-90, 0], 4: [90, 0], 5: [0, 90], 6: [0, 180] };
function kbdHint(p) {
  if (touchUI || !p.keys) return '';
  return 'Space';
}

function openCard(p, o) {
  if (p.bot) { botCard(p, o); return; }
  const root = ui.cardTpl.content.firstElementChild.cloneNode(true);
  const q = (s) => root.querySelector(s);
  q('.kicker').textContent = o.kicker;
  const icon = q('.m-icon');
  icon.textContent = o.icon;
  q('.ctitle').textContent = o.title;
  q('.rhyme').textContent = o.rhyme;
  q('.shart').textContent = o.shart;
  q('.xus').textContent = o.xus;
  root.style.setProperty('--pc', p.color);
  const c = Object.assign({}, o, { p, root, stage: 'intro', ok: false, saved: false,
    el: { result: q('.result'), main: q('.b-main'), back: q('.b-back'), game: q('.game') } });
  p.card = c;
  Sound.whoosh();
  p.sab.open = false;
  mapPickClose(p, false);
  c.g = GAME_REG.make(o.game, c);   // o‘yin fabrikasi games.js dan ro‘yxatga olinadi (import halqasi yo‘q)
  if (o.game.type === 'dice') c.stage = 'play';
  c.el.back.hidden = !o.back;
  c.el.main.addEventListener('click', () => cardMain(p));
  c.el.back.addEventListener('click', () => cardBack(p));
  c.el.result.className = 'result';
  c.el.result.textContent = c.stage === 'intro' ? 'Tayyor bo‘lsang — «Boshla» tugmasini bos.' : (o.prompt || 'Zar tashla — taqdiringni bil.');
  setMain(c);
  p.ui.cardwrap.innerHTML = '';
  p.ui.cardwrap.appendChild(root);
  p.ui.cardwrap.hidden = false;
  p.ui.cardwrap.scrollTop = 0;
  p.prevQ = quant({ x: (p.joy.on ? p.joy.x : 0) + p.pad.x, y: (p.joy.on ? p.joy.y : 0) + p.pad.y });
  p.joy.on = false; if (p.ui.joy) { p.ui.joy.classList.add('hint'); p.ui.joy.style.left = ''; p.ui.joy.style.top = ''; p.ui.knob.style.transform = ''; }
  if (!touchUI) setTimeout(() => { if (p.card === c) c.el.main.focus({ preventScroll: true }); }, 40);
}
function setMain(c) {
  const m = c.el.main, k = kbdHint(c.p);
  let label = '', show = true;
  if (c.stage === 'intro') label = 'Boshla';
  else if (c.stage === 'play') { label = c.g.mainLabel || ''; show = !!c.g.mainLabel; }
  else label = c.contLabel || 'Davom et';
  m.hidden = !show;
  m.disabled = c.stage === 'play' && !!c.g.busy;
  m.textContent = label;
  if (k && show) { const kb = document.createElement('kbd'); kb.className = 'k'; kb.textContent = k; m.append(' ', kb); }
}
function cardMain(p) {
  const c = p.card;
  if (!c || G.mode !== 'play') return;
  if (c.stage === 'intro') {
    c.stage = 'play';
    c.root.classList.add('playing');
    c.el.back.hidden = true;
    c.el.result.className = 'result';
    c.el.result.textContent = '';
    c.g.start && c.g.start();
    setMain(c);
  } else if (c.stage === 'play') {
    c.g.action && c.g.action();
  } else closeCard(p);
}
function cardDir(p, d) {
  const c = p.card;
  if (!c || G.mode !== 'play') return;
  if (c.back && !c.el.back.hidden && c.backDir && d[0] === c.backDir[0] && d[1] === c.backDir[1]) { cardBack(p); return; }
  c.idle = 0;
  if (c.stage === 'play' && c.g.dir) c.g.dir(dirName(d));
}
function cardBack(p) {
  const c = p.card;
  if (!c || !c.back || c.el.back.hidden) return;
  p.card = null;
  p.ui.cardwrap.hidden = true;
  p.ui.cardwrap.innerHTML = '';
  if (c.onBack) c.onBack();
}
function finishCard(c, ok, gameMsg, cls, dice) {
  if (c.stage === 'result') return;
  c.stage = 'result'; c.ok = ok;
  const extra = c.onResult ? c.onResult(ok, c) : '';
  if (!cls) cls = c.saved ? 'warn' : ok ? 'good' : 'bad';
  const r = c.el.result;
  r.className = 'result ' + cls;
  r.innerHTML = dice ? `<span class="sum">${dice[0]} + ${dice[1]} = ${dice[0] + dice[1]}</span>${dice[0] === dice[1] ? '<span class="dbl">Juft</span>' : ''}` : '';
  const msg = document.createElement('span'); msg.className = 'msg';
  msg.textContent = [gameMsg, extra].filter(Boolean).join(' ');
  r.appendChild(msg);
  setMain(c);
}
function closeCard(p) {
  const c = p.card;
  if (!c) return;
  p.card = null;
  p.ui.cardwrap.hidden = true;
  p.ui.cardwrap.innerHTML = '';
  if (c.onClose) c.onClose(c.ok, c);
  if (!p.alive) playerDown(p);
}
// Tuzoq va hayvonlar uchun umumiy natija: jon, qalqon, statistika.
export { FX, fxTok, trapXus, PIPS, ROT, kbdHint, openCard, setMain, cardMain, cardDir, cardBack, finishCard, closeCard };
