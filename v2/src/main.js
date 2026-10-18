// // Kirish nuqtasi: modullarni ulaydi, UI tugmalarini bog‘laydi (bindUI) va o‘yinni ishga tushiradi (boot). Sinov uchun window.__jl.
import { ADS, Ads, adRevive, launch } from './ads.js';
import { Sound, drumTick } from './audio.js';
import { pickTarget, teleportTo } from './beasts.js';
import { BOT_SKILL, botInit, botKeyHint, botTools, botTraps, botWalls } from './bots.js';
import { FX, cardBack, cardDir, cardMain, closeCard, finishCard, fxTok, openCard, trapXus } from './cards.js';
import { dlSet, duelAbort, duelAccept, duelCandidates, duelChallenge, duelDecline, duelNet, duelUI } from './combat.js';
import { cfg, playerCfg, saveCfg, teamCfg } from './config.js';
import { BAIT_FX, BEASTS, CHEST, DIFFS, DUEL_COUNT, DUEL_R, DUEL_S, ECON, FOE_KEYS, ITEMS, ITEM_IX, MASKS, PLACE_KEYS, PTRAPS, PTRAP_KEYS, PT_LIFE, PT_MAX, QGEN, RIDDLES, SP, T, TARGET_KEYS, TOOLS, TRAPS, maskOf, trapFx } from './content.js';
import { REWARDS, TIERS, beastCard, challengeResult, chestCard, pickReward, trapCard } from './encounters.js';
import { endGame } from './endgame.js';
import { mapOn, newGame, pause, preview, refreshBest, resume, setMode, setZoom, startLocal, startLoop, stepWorld, syncSound, toMenu, toggleMap } from './engine.js';
import { ZAR_EV, achLoad, ghostPuff, guardCard, replayRoutes, zarEvent } from './events.js';
import { GAMES, WORDS, describe } from './games.js';
import { updateHUD } from './hud.js';
import { bindKeys, keysDown } from './input.js';
import { EFFECTS, FEED_Q, MAPS, MAP_KEYS, SCRAMBLES, addTool, applyFx, buyMap, canPay, cleanse, endAmnesia, feed, feedShow, fireChaos, fireSelf, fireTool, hasBad, leaderTarget, mapPickClose, mapPickConfirm, mapPickDraw, mapPickMove, mapPickOpen, mapPickSet, mapPickZoom, moveKey, priceOf, reflectFx, revengeOn, rivalTargets, sabotage, scrDesc, scrVec, shopRows, shopTab, startAmnesia, startMask, toolCost, toolTargets, updateLeader, validSpot } from './magic.js';
import { bfs, bfsMulti, generate } from './maze.js';
import { buildCodex, buildSetup, syncBots } from './menu.js';
import { createRoom, hostStart, initRoom, joinRoom, leaveRoom, netDirty, netFlush, onlineStatus, readPeer } from './net-room.js';
import { applyGift, banditCatch, callBandit, dropKey, finish, freeFromJail, giveCoins, hasKey, jailCard, learnChestMap, learnKeyMap, loseLife, onEnterTile, playerDown, portalStep, refreshKeys, respawn, sendToJail, setKeySlot, takeCoins, takeGateKey, tryStep } from './player.js';
import { FXQ, drawRadar, nearestGate, pipView, resize } from './render.js';
import { store } from './save.js';
import { SOC, invAnswer, myId, quickPlay, socAccept, socAdd } from './social.js';
import { G, NET, freshFx, freshTools, lvl, me, ui } from './state.js';
import { buyMapUI, pipClose, pipOpen, pipsTick, toolsDo, toolsKey, toolsOpen, toolsPick, toolsRender, toolsTab } from './toolsui.js';
import { PWALL, PW_LIFE, PW_MAX, bombExplode, bombPass, bombTick, destOk, dropWalls, expireTraps, expireWalls, myTraps, myWalls, placedHit, ptList, trapCommit, trapPlace, trapSpot, trapTaken, wallCheck, wallList, wallPlace, wallSet } from './traps.js';
import { LEVELS, TASKS, dailyNo, dailyShare, dailyText, startDaily, startTut, tutLoad, tutTick } from './tutorial.js';
import { $, clamp, randSeed } from './util.js';
import { VOICE, sdpPack, sdpUnpack, voiceJoin, voiceLeave, voiceMute, voiceToggle, voiceUI } from './voice.js';

/* ================= Yordamchilar ================= */
function bindUI() {
  ui.bStart.addEventListener('click', startLocal);
  ui.dailyGo.addEventListener('click', startDaily);
  ui.dailyShare.addEventListener('click', dailyShare);
  ui.bPause.addEventListener('click', () => (G.mode === 'play' ? pause() : resume()));
  ui.bSound.addEventListener('click', () => { Sound.init(); Sound.setMuted(!Sound.muted); syncSound(); });
  const ambChk = $('ambChk'); ambChk.checked = Sound.ambOn; ambChk.addEventListener('change', () => { Sound.ambOn = ambChk.checked; store.set('jl_amb', ambChk.checked ? '1' : '0'); });
  ui.bMap.addEventListener('click', toggleMap);
  ui.zIn.addEventListener('click', () => setZoom(G.zoom * 1.15));
  ui.zOut.addEventListener('click', () => setZoom(G.zoom / 1.15));
  ui.pResume.addEventListener('click', resume);
  const again = (seed) => {
    if (G.tut) { startTut(G.tut.n, seed); return; }
    if (G.daily) { startDaily(); return; }
    const conf = G.players.map((p) => ({ name: p.name, look: p.look, bot: !!p.bot, skill: p.bot ? BOT_SKILL.indexOf(p.bot.K) : 0 }));
    if (G.online && NET.host && NET.named) { NET.named.presence({ phase: 'play', seed, diff: G.diff, nb: conf.filter((c) => c.bot).length, tmode: G.teams ? 1 : 0 }).catch(() => {}); newGame(seed, G.diff, conf, { online: true, teams: G.teams }); }
    else { const tm = G.teams; launch(() => newGame(seed, G.diff, conf, { teams: tm })); }
  };
  ui.pRestart.addEventListener('click', () => again(G.seed));
  ui.pNew.addEventListener('click', () => again(randSeed()));
  ui.pMenu.addEventListener('click', toMenu);
  ui.eNew.addEventListener('click', () => {
    if (G.daily) { startDaily(); return; }
    if (!G.tut) { again(randSeed()); return; }
    const n = G.tut.n, won = !!G.winner && G.winner === me();
    if (won && n < LEVELS.length) startTut(n + 1); else if (won) startLocal(); else startTut(n);
  });
  ui.eSame.addEventListener('click', () => again(G.seed));
  ui.eMenu.addEventListener('click', toMenu);
  ui.eShare.addEventListener('click', () => dailyShare());
  ui.eReplay.addEventListener('click', replayRoutes);
  document.querySelectorAll('input[name="tmode"]').forEach((inp) => inp.addEventListener('change', () => { cfg.team = inp.value === '1'; saveCfg(); syncBots(); }));
  ui.oCreate.addEventListener('click', createRoom);
  ui.oJoin.addEventListener('click', joinRoom);
  ui.oStart.addEventListener('click', hostStart);
  ui.oLeave.addEventListener('click', () => { leaveRoom(); onlineStatus(''); });
  ui.oMic.addEventListener('click', voiceToggle);
  ui.oMicOff.addEventListener('click', voiceLeave);
  ui.hallOpen.addEventListener('click', createRoom);
  ui.quickPlay.addEventListener('click', quickPlay);
  ui.frAdd.addEventListener('click', socAdd);
  ui.frIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') socAdd(); });
  ui.socCopy.addEventListener('click', () => { const t = myId(); if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => { ui.frMsg.textContent = `📋 ${t} nusxalandi — do‘stingga yubor.`; }, () => {}); });
  ui.invGo.addEventListener('click', () => invAnswer(true));
  ui.invNo.addEventListener('click', () => invAnswer(false));
  document.querySelectorAll('input[name="diff"]').forEach((inp) => inp.addEventListener('change', () => store.set('jl_diff', inp.value)));
  document.querySelectorAll('input[name="bots"]').forEach((inp) => inp.addEventListener('change', () => { cfg.bots = +inp.value; saveCfg(); syncBots(); }));
  document.querySelectorAll('input[name="skill"]').forEach((inp) => inp.addEventListener('change', () => { cfg.skill = +inp.value; saveCfg(); syncBots(); }));
  document.addEventListener('visibilitychange', () => { if (document.hidden) { if (!G.online) pause(); Sound.sleep(true); } else Sound.sleep(false); });
  window.addEventListener('resize', resize);
  ui.stage.addEventListener('wheel', (e) => { if (G.mode !== 'play') return; e.preventDefault(); setZoom(G.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08)); }, { passive: false });
  bindKeys();
}
function boot() {
  if (store.get('jl_lowfx') === '1') { FXQ.dapple = false; FXQ.fog3 = false; FXQ.light2 = false; FXQ.auto = false; }
  const savedZoom = parseFloat(store.get('jl_zoom2'));
  G.zoom = savedZoom > 0 ? clamp(savedZoom, 0.6, 1.8) : 1;
  const savedDiff = store.get('jl_diff');
  if (savedDiff && DIFFS[savedDiff]) $('d-' + savedDiff).checked = true;
  buildCodex();
  if (window.matchMedia && matchMedia('(min-width: 861px)').matches) document.querySelectorAll('details.guide').forEach((d) => { d.open = true; });
  buildSetup();
  bindUI();
  syncSound();
  ui.bMap.setAttribute('aria-pressed', String(mapOn));
  refreshBest();
  preview();
  setMode('menu');
  resize();
  startLoop();
  drumTick();
  initRoom();
}

window.__jl = { FXQ, Sound, SP, openCard, cardMain, closeCard, finishCard, SOC, socAdd, socAccept, quickPlay, launch, zarEvent, guardCard, ghostPuff, dropKey, refreshKeys, hasKey, replayRoutes, achLoad, teamCfg, ZAR_EV, startDaily, dailyNo, dailyText, adRevive, Ads, ADS, startTut, tutTick, tutLoad, LEVELS, TASKS, finish, DIFFS, endGame, G, NET, VOICE, voiceJoin, voiceLeave, voiceToggle, voiceMute, voiceUI, sdpPack, sdpUnpack, playerDown, respawn, loseLife, pipsTick, pipView, pipOpen, pipClose, updateHUD, generate, stepWorld, bfs, bfsMulti, botInit, toolsTab, shopTab, shopRows, buyMap, MAPS, MAP_KEYS, scrDesc, SCRAMBLES, scrVec, buyMapUI, ITEMS, ITEM_IX, takeGateKey, learnKeyMap, learnChestMap, nearestGate, setKeySlot, FX, trapXus, fxTok, botKeyHint, TOOLS, toolTargets, fireTool, toolsOpen, toolsPick, toolsDo, toolsKey, toolsRender, addTool, botTools, leaderTarget, newGame, cardMain, cardDir, EFFECTS, trapCard, beastCard, chestCard, portalStep, teleportTo, pickTarget, keysDown, GAMES, QGEN, RIDDLES, TRAPS, BEASTS, CHEST, REWARDS, TIERS, ECON, pickReward, challengeResult, giveCoins, WORDS, openCard, playerCfg, cfg, describe, lvl, closeCard, cardBack, sendToJail, freeFromJail, jailCard, banditCatch, callBandit, applyFx, applyGift, sabotage, rivalTargets, pickReward, takeCoins, tryStep, onEnterTile, readPeer, PTRAPS, PTRAP_KEYS, PT_MAX, PT_LIFE, myTraps, destOk, trapSpot, trapCommit, trapPlace, placedHit, trapTaken, expireTraps, ptList, mapPickOpen, mapPickClose, mapPickSet, mapPickMove, mapPickZoom, mapPickConfirm, mapPickDraw, botTraps, startAmnesia, endAmnesia, reflectFx, T, MASKS, maskOf, priceOf, canPay, toolCost, fireSelf, fireChaos, hasBad, cleanse, moveKey, feed, feedShow, FEED_Q, TARGET_KEYS, FOE_KEYS, PLACE_KEYS, validSpot, startMask, freshTools, freshFx, drawRadar, revengeOn, PWALL, PW_LIFE, PW_MAX, myWalls, wallCheck, wallPlace, wallSet, expireWalls, dropWalls, wallList, botWalls, updateLeader, BAIT_FX, trapFx, netDirty, netFlush, bombTick, bombPass, bombExplode, duelCandidates, duelChallenge, duelAccept, duelDecline, duelAbort, duelNet, duelUI, DUEL_S, DUEL_COUNT, DUEL_R, dlSet };
boot();
export { bindUI, boot };
