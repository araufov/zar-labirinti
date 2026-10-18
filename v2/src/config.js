// Sozlamalar: cfg (saqlanadigan o‘yin sozlamalari), saveCfg, playerCfg (ism/ko‘rinish), teamCfg.
import { BOT_NAMES, DEF_NAME, LOOKS } from './content.js';
import { store } from './save.js';
import { shuffle } from './util.js';
function teamCfg() { return playerCfg(3); }

/* ================= Do‘stlar va zallar (Firebase yoki ?net=local sinov bazasi) ================= */
const cfg = { bots: 1, skill: 1, name: DEF_NAME, look: 0 };
(function loadCfg() {
  try {
    const s = JSON.parse(store.get('jl_cfg4') || 'null') || {};
    const old = JSON.parse(store.get('jl_players') || 'null');
    if (old && Array.isArray(old.names) && typeof old.names[0] === 'string') cfg.name = old.names[0];
    if (old && Array.isArray(old.looks) && old.looks[0] >= 0 && old.looks[0] < LOOKS.length) cfg.look = old.looks[0];
    if (typeof s.name === 'string') cfg.name = s.name;
    if (s.look >= 0 && s.look < LOOKS.length) cfg.look = s.look | 0;
    if (s.bots >= 0 && s.bots <= 3) cfg.bots = s.bots | 0;
    if (s.skill >= 0 && s.skill <= 2) cfg.skill = s.skill | 0;
    cfg.team = s.team === true;
  } catch (e) { /* ignore */ }
})();
function saveCfg() { store.set('jl_cfg4', JSON.stringify(cfg)); }
// Sen + tanlangan botlar (har biri boshqa qahramon va ism bilan).
function playerCfg(nb = 0) {
  const list = [{ name: (cfg.name || '').trim().slice(0, 14) || DEF_NAME, look: cfg.look }];
  const names = shuffle(BOT_NAMES.slice()), looks = shuffle([0, 1, 2, 3].filter((k) => k !== cfg.look));
  for (let k = 0; k < nb; k++) list.push({ name: names[k], look: looks[k % looks.length], bot: true, skill: cfg.skill });
  return list;
}
export { teamCfg, cfg, saveCfg, playerCfg };
