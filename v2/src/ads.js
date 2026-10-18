// Reklama: yuklanish ekrani (launch), chastota chegarasi, reklama ko‘rib tirilish (adRevive), ADS adapteri (demo/h5/admob).
import { Sound } from './audio.js';
import { ears } from './bots.js';
import { setMode } from './engine.js';
import { toast } from './hud.js';
import { netDirty } from './net-room.js';
import { RESPAWN_IMMUNE, reveal } from './player.js';
import { emit, floatText } from './render.js';
import { G, ui } from './state.js';
import { pickRand } from './util.js';
const LD_TIPS = [
  '🔑 Har kimning o‘z kaliti bor. Raqib kalitini ko‘rasan, lekin ololmaysan — yoniga tuzoq qo‘yib ket!',
  '☠️ Halok bo‘lsang, kaliting o‘sha joyda qoladi — qaytib kelib olasan.',
  '🧭 Darvozani faqat kompas ko‘rsatadi.',
  '🎲 Har 2 daqiqada zar tashlanadi — hammaga bir xil hodisa tushadi.',
  '🗿 Darvoza oldida qo‘riqchi kutadi: oxirgi sinovni yut!',
  '🪄 Do‘kondan tangaga sehr ol va raqibga ishlat.',
  '🧍 Har qahramonning o‘z kuchi bor — menyuda rasmga bosib tanla.',
  '🐆 Hayvon quvsa — burilishlarga qoch.',
];
let gamesRun = 0, lastAdAt = -1e12, launching = false;
function launch(run, opts = {}) {
  if (launching) return;
  launching = true;
  gamesRun++;
  const ad = opts.ad !== false && Ads.enabled() && gamesRun > 1 && Date.now() - lastAdAt > ADS.gapMs;
  setMode('loading');
  ui.loader.hidden = false; ui.ldAd.hidden = true;
  ui.ldKicker.textContent = opts.title || 'Zar Labirinti';
  ui.ldTip.textContent = pickRand(LD_TIPS);
  let pct = 0;
  const set = (v) => { pct = v; ui.ldFill.style.width = v + '%'; ui.ldPct.textContent = Math.round(v) + '%'; };
  const to = (v, ms) => new Promise((res) => { const a = pct, t0 = performance.now(); const tk = () => { const k = Math.min(1, (performance.now() - t0) / ms); set(a + (v - a) * k); if (k < 1) requestAnimationFrame(tk); else res(); }; requestAnimationFrame(tk); });
  set(0);
  (async () => {
    try {
      await to(35, 500);
      if (ad) { lastAdAt = Date.now(); await Promise.race([Ads.interstitial().catch(() => {}), new Promise((r) => setTimeout(r, 20000))]); }
      await to(85, ad ? 300 : 500);
      await new Promise((r) => setTimeout(r, 30));
      run();   // labirint shu yerda quriladi (katta labirintda biroz vaqt oladi)
      await to(100, 200);
    } finally {
      ui.loader.hidden = true; launching = false;
      if (G.mode === 'loading') setMode('menu');
    }
  })();
}

/* ================= Reklama: «ko‘rib davom et» (mukofotli reklama) ================= */
// Hozir ADS.mode = 'demo' — haqiqiy reklama o‘rniga 5 soniyalik sinov oynasi chiqadi.
// Play Market'ga chiqarishda: 'h5' (Google H5 Games Ads, adsbygoogle skripti bilan) yoki 'admob' (Capacitor + @capacitor-community/admob) qilib qo‘ying.
const ADS = { mode: 'demo', admobRewardId: 'ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN', admobInterId: 'ca-app-pub-XXXXXXXXXXXXXXXX/NNNNNNNNNN', gapMs: 180000 };
const Ads = {
  enabled() { return ADS.mode !== 'off'; },
  rewarded() {
    if (ADS.mode === 'h5' && typeof window.adBreak === 'function') return new Promise((res) => {
      let got = false;
      window.adBreak({ type: 'reward', name: 'revive', beforeReward: (show) => show(), adViewed: () => { got = true; }, adDismissed: () => {}, adBreakDone: () => res(got) });
    });
    const AdMob = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
    if (ADS.mode === 'admob' && AdMob) return AdMob.prepareRewardVideoAd({ adId: ADS.admobRewardId }).then(() => AdMob.showRewardVideoAd()).then(() => true, () => false);
    return Ads.demo();
  },
  // O'yin oldidan (yuklanish paytida) ko'rsatiladigan reklama.
  interstitial() {
    if (ADS.mode === 'h5' && typeof window.adBreak === 'function') return new Promise((res) => { window.adBreak({ type: 'start', name: 'game-start', adBreakDone: () => res(true) }); });
    const AdMob = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.AdMob;
    if (ADS.mode === 'admob' && AdMob) return AdMob.prepareInterstitial({ adId: ADS.admobInterId }).then(() => AdMob.showInterstitial()).then(() => true, () => false);
    return new Promise((res) => {   // sinov rejimi: yuklanish oynasi ichida 5 soniya
      ui.ldAd.hidden = false;
      let left = 5; ui.ldAdC.textContent = left + ' s';
      const iv = setInterval(() => { left--; ui.ldAdC.textContent = left + ' s'; if (left <= 0) { clearInterval(iv); ui.ldAd.hidden = true; res(true); } }, 1000);
    });
  },
  demo() {
    return new Promise((res) => {
      const veil = document.createElement('div'); veil.className = 'adveil';
      veil.innerHTML = '<div class="adbox" role="dialog" aria-label="Reklama"><b>📺 Reklama</b><p>Sinov rejimi: haqiqiy reklama ulanganda bu yerda video chiqadi.</p><div class="adbar"><i></i></div></div>';
      document.body.appendChild(veil);
      const bar = veil.querySelector('i'), t0 = performance.now(), dur = 5000;
      const tick = () => { const k = Math.min(1, (performance.now() - t0) / dur); bar.style.width = (k * 100) + '%'; if (k < 1) requestAnimationFrame(tick); else { veil.remove(); res(true); } };
      requestAnimationFrame(tick);
    });
  },
};
function adRevive(p) {
  if (G.reviveUsed || p.alive || !p.ui || p.adBusy) return;
  G.reviveUsed = true; p.adBusy = true; p.ui.adrev.hidden = true;
  Ads.rewarded().then((ok) => {
    p.adBusy = false;
    if (G.mode !== 'play' && G.mode !== 'paused') return;
    if (!ok) { toast(p, 'Reklama oxirigacha ko‘rilmadi — boshidan boshlaysan.'); return; }
    if (p.alive) return;
    if (p.keyDropAt >= 0 && G.keyCells[p.keySlot] === p.keyDropAt) { p.gkey = true; p.keyDropAt = -1; }   // tirildi — kalit yana qo'lida
    Object.assign(p, { alive: true, lives: 1, respawnT: 0, hurtT: 0, immune: RESPAWN_IMMUNE, moving: false, moveT: 1 });
    p.ui.out.hidden = true;
    reveal(p);
    emit(p.px, p.py, 28, 'spark');
    floatText(p.px, p.py, '+1 ❤', '#ff7a6a');
    ears(p, () => Sound.portal());
    toast(p, 'Qayta tirilding! 1 ❤ bilan shu joydan davom et — pul, kalit va sehrlaring joyida.', 4200);
    netDirty(p, true);
  });
}

/* ================= Kunlik labirint: hamma uchun bitta, har kuni yangi ================= */
export { LD_TIPS, gamesRun, lastAdAt, launching, launch, ADS, Ads, adRevive };
