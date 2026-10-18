// Uchrashuvlar: tuzoq/hayvon/sakrash/sandiq kartalari, natijani qo‘llash (challengeResult), mukofotlar (TIERS/REWARDS).
import { Sound } from './audio.js';
import { beastFlee } from './beasts.js';
import { FX, openCard, trapXus } from './cards.js';
import { BEASTS, CHEST, ECON, MIRROR_S, OBST, T, TRAPS, walk } from './content.js';
import { GAMES, describe } from './games.js';
import { toast } from './hud.js';
import { EFFECTS, rivalTargets } from './magic.js';
import { applyGift, giveCoins, loseLife } from './player.js';
import { emit, floatText, mmSet } from './render.js';
import { G, lvl } from './state.js';
import { pickRand } from './util.js';
function challengeResult(p, def, ok, c) {
  if (ok) {
    p.stats.dodged++; Sound.ok();
    const n = c.kind === 'beast' ? ECON.win.beast : def.lethal ? ECON.win.lethal : ECON.win.trap;   // yutganga standart mukofot
    giveCoins(p, n);
    return `${def.win} +${n} 💰`;
  }
  p.stats.caught++;
  if (p.shield > 0 && (def.lethal || def.effect)) {
    p.shield = 0; c.saved = true;
    floatText(p.px, p.py, 'Qalqon!', '#9fe3ff'); Sound.pickup();
    return 'Lekin qalqon seni saqlab qoldi — hech narsa yo‘qotmading!';
  }
  if (def.lethal) loseLife(p); else Sound.hurt();
  return def.lose + (!p.alive ? ' Jonlar tugadi — hammasini yo‘qotib, boshidan boshlaysan…' : '');
}

const kick = (base, game) => `${base} · ${GAMES[game.type].name}${GAMES[game.type].chal ? ' 🔥' : ''}`;
function trapCard(p, i) {
  const def = TRAPS[G.trap[i]], game = pickRand(def.games);
  openCard(p, { kind: 'trap', icon: def.icon, kicker: kick('Tuzoq', game), title: def.name, rhyme: def.rhyme, shart: describe(game, lvl()), xus: trapXus(def, FX()), game,
    onResult: (ok, c) => challengeResult(p, def, ok, c),
    onClose: (ok, c) => {
      p.spent[i] = 1; mmSet(p, i);
      if (ok || c.saved || !p.alive) return;
      if (def.effect) EFFECTS[def.effect](p);
      // Har bir yutqazilgan tuzoq xaritaga qarab yana bir necha soniya qotirib qo‘yadi
      p.stun = Math.max(p.stun, FX().stun); p.stunIcon = def.icon;
      toast(p, `${def.icon} ${FX().stun} soniya garang bo‘lib qimirlay olmaysan.`);
    } });
}
function beastCard(p, b) {
  const def = BEASTS[b.type], game = pickRand(def.games);
  openCard(p, { kind: 'beast', icon: def.icon, kicker: kick('Xavfli hayvon', game), title: def.name, rhyme: def.rhyme, shart: describe(game, lvl()), xus: def.xus, game,
    onResult: (ok, c) => challengeResult(p, def, ok, c),
    onClose: (ok, c) => { beastFlee(b, p); if (!ok && !c.saved && def.effect && p.alive) EFFECTS[def.effect](p); } });
}
function jumpCard(p, dx, dy) {
  const N = G.N, first = G.g[(p.py + dy) * N + p.px + dx];
  let x = p.px + dx, y = p.py + dy, w = 0;
  while ((G.g[y * N + x] === T.CHASM || G.g[y * N + x] === T.RIVER) && w < 6) { w++; x += dx; y += dy; }
  if (!walk(G.g[y * N + x])) return;
  const key = first === T.CHASM ? 'chasm' : 'river', o = OBST[key], chasm = key === 'chasm', need = o.need(w);
  const doJump = () => {
    p.stats.jumps++;
    p.jump = { fx: p.px, fy: p.py, tx: x, ty: y, w, t: 0, dur: 0.34 + 0.12 * w, river: !chasm };
    emit(p.px, p.py + 0.2, 6, 'dust');
    Sound.jump();
  };
  if (p.wings > 0) { p.wings--; floatText(p.px, p.py, 'Qanotlar!', '#cfe9ff'); toast(p, 'Qanotlar seni narigi tomonga uchirib o‘tdi!'); doJump(); return; }
  openCard(p, { kind: 'jump', icon: o.icon, kicker: 'Sakrash joyi', title: o.name + (chasm && w > 1 ? ' (keng)' : ''), rhyme: o.rhyme, shart: o.shart(w), xus: o.xus,
    back: true, backDir: [-dx, -dy], info: `Kengligi: ${w} katak ≈ ${Math.round(w * G.tileM)} m`, prompt: 'Zar tashla yoki ortga qayt.',
    game: { type: 'dice', tries: 1, resolve: (a, b, c) => {
      const sum = a + b, dbl = a === b;
      if (dbl && a === 1) {
        if (p.shield > 0) { p.shield = 0; c.saved = true; return { ok: false, cls: 'warn', msg: 'Ikki bir! Jarlikka qulay deding, lekin qalqon saqladi.' }; }
        loseLife(p);
        return { ok: false, msg: (chasm ? 'Ikki bir! Oyog‘ing toyib, jarlikka qulading. Lianaga ilinib zo‘rg‘a chiqding: −1 jon.' : 'Ikki bir! Timsoh tishlab oldi: −1 jon.') + (!p.alive ? ' Jonlar tugadi — hammasini yo‘qotib, boshidan boshlaysan…' : '') };
      }
      if (dbl || sum >= need) { Sound.ok(); return { ok: true, msg: dbl ? 'Juft! Zar kuchi seni narigi tomonga uloqtirdi.' : chasm ? 'Sakrading — narigi chetga yetib bording!' : 'Toshdan toshga sakrab, daryodan o‘tding!' }; }
      if (!chasm && sum <= 4) {
        if (p.shield > 0) { p.shield = 0; c.saved = true; return { ok: false, cls: 'warn', msg: 'Timsoh tashlandi, lekin qalqon saqladi.' }; }
        loseLife(p);
        return { ok: false, msg: 'Timsoh jag‘ini yopdi — tishlab oldi: −1 jon.' + (!p.alive ? ' Jonlar tugadi — hammasini yo‘qotib, boshidan boshlaysan…' : '') };
      }
      Sound.bump();
      return { ok: false, cls: 'warn', msg: `Yetmadi (kerak: ${need}+). ${chasm ? 'Chetida to‘xtab qolding' : 'Qirg‘oqda qolding'} — yana urinib ko‘r.` };
    } },
    onClose: (ok) => { if (ok && p.alive) doJump(); } });
}
// Sovg‘a darajalari: oddiy ⭐, noyob ⭐⭐, afsonaviy ⭐⭐⭐. Daraja tasodifan (xaritaga qarab: qiyinroqda yaxshisi ko‘proq), ichida teng ehtimol bilan tanlanadi.
const TIERS = [
  { key: 'common', name: 'Oddiy', stars: '⭐', color: '#e3efc8', w: [64, 60, 56], burst: 16 },
  { key: 'rare', name: 'Noyob', stars: '⭐⭐', color: '#7fd0ff', w: [28, 31, 33], burst: 30 },
  { key: 'epic', name: 'Afsonaviy', stars: '⭐⭐⭐', color: '#ffb84a', w: [8, 9, 11], burst: 70 },
];
const REWARDS = {
  coins: { t: 0, w: 3, msg: `Sandiq to‘la tanga: +${ECON.chest} 💰!` },
  torch: { t: 0, msg: 'Sandiqdan mash’al chiqdi: atrofing yorishdi!' },
  boots: { t: 0, msg: 'Sandiqdan tezyurar etik chiqdi!' },
  shield: { t: 0, msg: 'Sandiqdan qalqon chiqdi!' },
  glue: { t: 0, foe: true, msg: 'Yelim shari sumkangga tushdi! 🪄 tugmadan raqibga ishlat.' },
  fogbomb: { t: 0, foe: true, msg: 'Tuman bombasi sumkangga tushdi! 🪄 tugmadan raqibga ishlat.' },
  life: { t: 1, msg: 'Sandiqdan shifobaxsh meva chiqdi: +1 jon!' },
  compass: { t: 1, msg: 'Sandiqdan kompas chiqdi: chiqish tomonini ko‘rsatadi!' },
  map: { t: 1, msg: 'Sandiqdan sehrli xarita chiqdi: atrof-muhit ochildi!' },
  cloak: { t: 1, msg: 'Ko‘rinmas plash! 30 soniya hayvonlar va qaroqchi seni sezmaydi.' },
  key: { t: 1, msg: 'Qamoq kaliti! Qamoqqa tushsang, darhol chiqasan.' },
  freeze: { t: 1, foe: true, msg: 'Muzlatish sehri sumkangga tushdi! 🪄 tugmadan raqibga ishlat.' },
  mirror: { t: 1, msg: `Ko‘zgu qalqoni! ${MIRROR_S} soniya ichida senga yuborilgan sehr yuboruvchining o‘ziga qaytadi (bir marta).` },
  amnesia: { t: 1, foe: true, msg: 'Akleroz sehri sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  trapkit: { t: 1, foe: true, msg: 'Tuzoq to‘plami sumkangga tushdi! 🪄 do‘kon → «Tuzoq» varag‘idan qo‘y.' },
  scramble: { t: 1, foe: true, msg: 'Boshqaruvni aralashtirish sehri sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  jackpot: { t: 2, msg: `Katta xazina! +${ECON.jackpot} 💰!` },
  gold: { t: 2, msg: 'Sandiqda oltin girdob bor — chiqishga yaqinroq uchasan!' },
  wings: { t: 2, msg: 'Sandiqdan qanotlar chiqdi: keyingi jarlik yoki daryodan zarsiz uchib o‘tasan!' },
  luck: { t: 2, msg: 'Omadli zar! Keyingi zaring ikkita oltilik bo‘ladi.' },
  bandit: { t: 2, foe: true, msg: 'Qaroqchini chaqiruvchi shox sumkangga tushdi! 🪄 tugmadan ishlat.' },
  swap: { t: 2, foe: true, msg: 'Joy almashtirish sehri sumkangga tushdi! 🪄 tugmadan ishlat.' },
  flip: { t: 0, foe: true, msg: 'Teskari dunyo sehri sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  mask: { t: 0, foe: true, msg: 'Maskalash sehri sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  liar: { t: 0, foe: true, msg: 'Yolg‘onchi kompas sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  steal: { t: 0, foe: true, msg: 'Cho‘ntak o‘g‘risi sumkangga tushdi! 🪄 yaqin raqibga ishlat.' },
  cleanse: { t: 0, foe: true, msg: 'Tozalash sumkangga tushdi! 🪄 do‘kondan o‘zingga ishlat.' },
  radar: { t: 0, foe: true, msg: 'Radar sumkangga tushdi! 🪄 do‘kondan yoq — tuzoqlarni ko‘rasan.' },
  bomb: { t: 1, foe: true, msg: 'Bomba sumkangga tushdi! 🪄 do‘kondan raqibga ishlat — 30 soniyada portlaydi!' },
  kmove: { t: 1, foe: true, msg: 'Kalitni ko‘chirish sehri sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  shut: { t: 1, foe: true, msg: 'Do‘kon qulfi sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  sic: { t: 1, foe: true, msg: 'Ovchi Burgut chaqirig‘i sumkangga tushdi! 🪄 do‘kondan raqibga ishlat.' },
  chaos: { t: 2, foe: true, msg: 'Tartibsizlik sehri sumkangga tushdi! 🪄 do‘kondan ishlat — hamma joyi almashadi.' },
};
// Qaysi sovg‘alar mumkin: raqib yo‘q bo‘lsa xalaqit sehrlari chiqmaydi; joy almashtirish — faqat oldinda raqib bo‘lsa.
function pickReward(p) {
  const foes = rivalTargets(p).length, L = lvl();
  const can = ([k, R]) => (k !== 'life' || p.lives < 3) && (k !== 'key' || p.key < 2) && (!R.foe || foes);
  let x = Math.random() * TIERS.reduce((a, T) => a + T.w[L], 0), tier = TIERS.length - 1;
  for (let k = 0; k < TIERS.length; k++) { x -= TIERS[k].w[L]; if (x < 0) { tier = k; break; } }
  for (let t = tier; t >= 0; t--) {   // darajada mos sovg‘a qolmasa — pastroq darajadan
    const pool = Object.entries(REWARDS).filter((e) => e[1].t === t && can(e));
    if (pool.length) {   // `w` — tanlanish og‘irligi (tanga ko‘proq tushsin)
      let x = Math.random() * pool.reduce((a, e) => a + (e[1].w || 1), 0);
      for (const e of pool) { x -= e[1].w || 1; if (x < 0) return e[0]; }
      return pool[0][0];
    }
  }
  return 'coins';
}
function chestCard(p, i) {
  let gift = null;
  const game = pickRand(CHEST.games);
  openCard(p, { kind: 'chest', icon: CHEST.icon, kicker: kick('Xazina', game), title: CHEST.name, rhyme: CHEST.rhyme, shart: describe(game, lvl()), xus: CHEST.xus, game,
    onResult: (ok) => {
      p.stats.chests += ok ? 1 : 0;
      if (!ok) return 'Sandiq qulflanib qoldi.';
      gift = pickReward(p);
      const T = TIERS[REWARDS[gift].t];
      if (T.key === 'epic') Sound.win(); else { Sound.pickup(); if (T.key === 'rare') Sound.ok(); }
      return `${T.stars} ${T.name} sovg‘a! ${REWARDS[gift].msg}`;
    },
    onClose: (ok) => {
      p.spent[i] = 1; mmSet(p, i);
      if (ok && gift) {
        const T = TIERS[REWARDS[gift].t];
        emit(p.px, p.py, T.burst, T.key === 'epic' ? 'confetti' : 'gold');
        floatText(p.px, p.py, `${T.stars} ${T.name}`, T.color);
        applyGift(p, gift);
      }
    } });
}

/* ================= Mini-o‘yinlar ================= */
export { challengeResult, kick, trapCard, beastCard, jumpCard, TIERS, REWARDS, pickReward, chestCard };
