// Umumiy holat: G (dunyo), ui (DOM havolalari), NET (onlayn xona holati), makePlayer, kalit egaligi so‘rovlari (hasKey), me(), mapLvl/lvl, GAME_REG.
import { DIFFS, PCOLORS, PLACE_KEYS, TOOLS } from './content.js';
import { $ } from './util.js';
const G = {
  mode: 'menu', diff: 'medium', seed: 0, zoom: 1, tsCss: 40,
  N: 0, g: null, trap: null, item: null, chest: null, coin: null, keyAt: null, keyCells: null, chestCells: null, exits: [], start: 0, exitIdx: 0, exitX: 0, exitY: 0, exitSide: 0, sol: null, sols: [], walkTotal: 0, tileM: 10, distExit: null,
  players: [], beasts: [], vans: [], parts: [], floats: [], pops: [], remotes: new Map(), ptraps: [], rptraps: [],
  time: 0, winner: null, online: false,
};
function makePlayer(k, name, look) {
  const n = G.N * G.N, x = G.start % G.N, y = (G.start / G.N) | 0;
  return {
    id: k, name, look, color: PCOLORS[k % 4],
    px: x, py: y, mfx: x, mfy: y, moving: false, moveT: 1, stepMs: 186, bot: null, face: { x: 0, y: 1 }, ph: 0,
    jump: null, slide: null, tele: null, pending: null, card: null,
    lives: 3, alive: true, finished: false, respawnT: 0,
    coins: 0, key: 0, luck: 0, wings: 0, cloak: 0, frozen: 0, slow: 0, jail: false, immune: 0, stun: 0, stunIcon: '', scramble: 0, scMap: 0,
    gkey: false, keySlot: k % 8, knowKey: false, knowChest: false,
    fxq: [], ...freshFx(), tools: freshTools(), tbag: freshBag(), sab: { open: false, step: 'tools', key: null, sig: '', tab: '' }, pips: [], mirror: 0, amnesia: 0, memE: null, memPath: 0, trapSeq: 0, pick: null,
    explored: new Uint8Array(n), visited: new Uint8Array(n), spent: new Uint8Array(n), exploredPath: 0,
    dist: 0, stats: { dodged: 0, caught: 0, jumps: 0, items: 0, portals: 0, chests: 0, coins: 0, jailed: 0, sabotage: 0, hit: 0, spent: 0, deaths: 0, reflected: 0, traps: 0, duels: 0, duelWins: 0 },
    fever: 0, torch: 0, compass: 0, boots: 0, shield: 0, hurtT: 0, shake: 0, trail: [G.start], hist: [G.start],
    cam: { x, y }, vp: { x: 0, y: 0, w: innerWidth, h: innerHeight }, ui: null, mm: null,
    joy: { on: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 }, pad: { x: 0, y: 0, a: false, s: false }, prevQ: null,
    lastMove: -99, riddles: new Set(), qseen: new Set(), netAt: 0, hudKey: {}, drumD: Infinity, lastToast: '', lastToastAt: 0, bumpAt: 0,
  };
}
const freeP = (p) => p.alive && !p.finished && !p.card && !p.pending && !p.tele && !p.slide && !p.jump;
// Yangi o‘yinchi / qayta tug‘ilgan o‘yinchi uchun boshlang‘ich holatlar (sehrlar ro‘yxati TOOLS dan olinadi)
const freshTools = () => Object.fromEntries(Object.keys(TOOLS).map((k) => [k, 0]));
const freshBag = () => Object.fromEntries(PLACE_KEYS.map((k) => [k, 0]));
const freshFx = () => ({ flip: 0, mask: 0, maskK: 0, liar: 0, liarA: 0, shutT: 0, taxT: 0, radar: 0, revenge: null, bomb: 0, bombFrom: '', bombLock: 0, duel: null, duelCool: 0 });

const ui = {};
['stage', 'tools', 'clock', 'menu', 'pause', 'end', 'bSound', 'bMap', 'bPause', 'zIn', 'zOut', 'bStart', 'setupRoster', 'pcNote',
 'pInfo', 'pResume', 'pRestart', 'pNew', 'pMenu', 'eKicker', 'eTitle', 'eVerse', 'eBody', 'eLegend', 'endMap', 'eNew', 'eSame', 'eMenu', 'eNote',
 'codexBeast', 'codexJump', 'codexItem', 'codexTrap', 'codexGames', 'skillRow', 'online', 'oCreate', 'oCode', 'oJoin', 'oLobby', 'oCodeShow', 'oPeers', 'oStart', 'oLeave', 'oStatus', 'oMic', 'oMicOff', 'oVoice',
 'vpTpl', 'cardTpl'].forEach((id) => { ui[id] = $(id); });

/* ================= Ovoz (Web Audio) ================= */
// Ovoz: Web Audio sintez. Zanjir: effektlar → (quruq + reverb) → kompressor → chiqish. Bir xil ovoz 50 ms ichida qayta chalinmaydi.
function remoteList() { return Array.from(G.remotes.values()).filter((r) => r.alive !== undefined); }

const mapLvl = () => DIFFS[G.diff].lvl;
// Mini-o'yinlar bir pog'ona qiyinroq (o'rgatish bosqichlarida — odatdagidek).
const lvl = () => Math.min(2, DIFFS[G.diff].lvl + (G.tut ? 0 : 1));
const me = () => G.players[0];
const NET = { room: null, named: null, code: '', host: false, unsub: [], dirty: false, lastSent: 0, fx: [], fxn: 0, seen: {}, me: '', slotSeed: -1, sayn: 0, sayAt: 0, pdone: new Set(), feedN: 0, feedOut: [], feedSeen: {}, duelN: 0, dl: null, duelPrompt: null };
const GAME_REG = { make: null };   // mini-o‘yin fabrikasi: games.js to‘ldiradi, cards.js chaqiradi (import halqasisiz)
export { G, makePlayer, freeP, freshTools, freshBag, freshFx, ui, remoteList, mapLvl, lvl, me, NET, GAME_REG };
