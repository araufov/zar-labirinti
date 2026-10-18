// O‘yin ma’lumotlari (sof konstantalar): plitkalar (T), qiyinliklar (DIFFS), iqtisod, tuzoqlar, hayvonlar, buyumlar, jumboqlar (QGEN), sehrlar (TOOLS/PTRAPS), ko‘rinishlar. Mantiq yo‘q.
import { pickRand, shuffle } from './util.js';
const T = { WALL: 0, PATH: 1, CHASM: 2, RIVER: 3, ENTRY: 4, EXIT: 5, PORTAL: 6 };
const walk = (t) => t === T.PATH || t === T.CHASM || t === T.RIVER || t === T.PORTAL;
const beastFloor = (t) => t === T.PATH || t === T.PORTAL;
const DIFFS = {
  easy:   { name: 'Oson',  cells: 25,  traps: 20,  obstacles: 6,  pathObs: 1, portals: 4,  items: 11, coins: 8,  chests: 5,  beasts: [1, 1, 1, 1], vanStep: 500, monkeyR: 12, lvl: 0,
    fx: { fever: 25, hunt: 30, flood: 14, rewind: 40, trample: 5, stun: 3 } },
  medium: { name: 'O‘rta', cells: 50,  traps: 50,  obstacles: 16, pathObs: 2, portals: 8,  items: 23, coins: 18, chests: 10, beasts: [2, 2, 2, 2], vanStep: 410, monkeyR: 18, lvl: 1,
    fx: { fever: 38, hunt: 42, flood: 20, rewind: 56, trample: 7, stun: 5 } },
  hard:   { name: 'Qiyin', cells: 100, traps: 115, obstacles: 40, pathObs: 4, portals: 16, items: 52, coins: 40, chests: 22, beasts: [5, 4, 5, 4], vanStep: 360, monkeyR: 26, lvl: 2,
    fx: { fever: 55, hunt: 60, flood: 28, rewind: 80, trample: 10, stun: 8 } },
};
const L3 = (v, L) => (Array.isArray(v) ? v[L] : v);
// Pul va sovg‘alar standarti: hamma joyda bir xil, aniq qoidalar (tasodifiy miqdor yo‘q).
const ECON = {
  pouch: 5,                                   // yerdagi pul xaltasi
  win: { trap: 2, lethal: 3, beast: 4 },      // yutilgan sinov uchun mukofot: oddiy tuzoq / jonga xavfli tuzoq / hayvon
  chest: 10, jackpot: 25,                     // sandiqdan chiqadigan tanga: oddiy / afsonaviy daraja
  price: { common: 5, rare: 10, epic: 15, legend: 20 },   // xalaqit sehrlari narxi: ta’siri qanchalik kuchli bo‘lsa — shuncha qimmat
  steal: 7, bounty: 3, disarm: 2, bomb: 5, duel: 5,   // cho‘ntak o‘g‘risi / yetakchiga xalaqit mukofoti / tuzoqni zararsizlantirish / bomba portlasa yo‘qotiladigan / duel yutug‘i
};
const MIRROR_S = 45;   // ko‘zgu qalqoni shuncha soniya turadi (yoki bitta sehrni qaytargunicha)
const AMNESIA_S = 60;   // akleroz: ochgan joylar shuncha soniya ko‘rinmaydi
const BOMB_R = 1.6, BOMB_PASS_LOCK = 2.5, BOMB_BACK_S = 6;   // bomba: tegib topshirish masofasi (katak), topshirgandan keyin kutish, o‘ziga qaytarmaslik muddati
const FLIP_S = 25, MASK_S = 60, LIAR_S = 60, SHUT_S = 30, TAX_S = 60, RADAR_S = 25, STEAL_R = 6, REVENGE_S = 90, BOMB_S = 30;   // hazil va hujum sehrlari muddatlari
// Maskalash: raqib hammaga shu qiyofada ko‘rinadi (presence'da tartib raqami +1 yuboriladi — tartibni o‘zgartirmang)
const MASKS = [
  { e: '🐔', n: 'tovuq', to: 'tovuqqa', say: 'Qo‘-qo‘-qo‘!' }, { e: '🤡', n: 'masxaraboz', to: 'masxarabozga', say: 'Hi-hi-hi!' },
  { e: '🥔', n: 'kartoshka', to: 'kartoshkaga', say: 'Men kartoshkaman!' }, { e: '🐸', n: 'baqa', to: 'baqaga', say: 'Kvak-kvak!' },
  { e: '🦆', n: 'o‘rdak', to: 'o‘rdakka', say: 'Kra-kra!' }, { e: '🐑', n: 'qo‘y', to: 'qo‘yga', say: 'Me-e-e!' },
];
const maskOf = (q) => (q.mask > 0 ? MASKS[q.maskK] : q.disguise > 0 ? MASKS[q.disguise - 1] : null);

// Mini-o‘yinlar uchun tayyor sozlamalar ([oson, o‘rta, qiyin] qiymatlar bilan).
const SP = {
  balance: { type: 'balance', time: [8, 9, 10], drift: [0.5, 0.7, 0.9] },
  arrows: { type: 'arrows', n: [8, 10, 12], win: [1.7, 1.35, 1.15], miss: [2, 1, 1] },
  riddle: { type: 'riddle', time: 25 },
  memory: { type: 'memory', pairs: [4, 6, 6], time: [40, 55, 46] },
  stroop: { type: 'stroop', n: [5, 6, 7], time: [20, 18, 17], miss: [1, 1, 0] },
  dodge: { type: 'dodge', time: [10, 11, 12], miss: [2, 2, 1], speed: [0.9, 1.05, 1.2], obj: '🥥' },
  pattern: { type: 'pattern', size: 3, k: [3, 4, 5], show: [1.7, 1.5, 1.4], rounds: [1, 2, 2] },
  rhythm: { type: 'rhythm', beats: [6, 8, 8], bpm: [84, 96, 108], tol: [0.17, 0.14, 0.12], slack: [2, 2, 1] },
  scramble: { type: 'scramble', len: [[4, 5], [5, 6], [6, 8]], time: [30, 28, 28], miss: [2, 2, 1] },
  shell: { type: 'shell', swaps: [4, 6, 8], speed: [0.5, 0.4, 0.32], rounds: [1, 1, 2], item: '💎' },
  lock: { type: 'lock', max: [20, 30, 50], tries: [5, 5, 6] },
  simon: { type: 'simon', len: [4, 5, 6] },
  redlight: { type: 'redlight', need: [4, 5, 6], time: [17, 18, 19], warn: [0.45, 0.32, 0.2], miss: [2, 1, 1] },
  glass: { type: 'glass', rows: [4, 5, 6], show: [3.2, 2.8, 2.4], miss: [1, 1, 0] },
  dalgona: { type: 'dalgona', tol: [16, 13, 10], crack: [1.6, 1.2, 0.9], time: [30, 28, 26] },
  tug: { type: 'tug', foe: [0.15, 0.21, 0.27], time: [10, 10, 10] },
  wordle: { type: 'wordle', len: [4, 5, 5], tries: [5, 6, 5], time: [100, 110, 90] },
  g2048: { type: 'g2048', target: [32, 64, 64], moves: [34, 56, 46], time: [75, 110, 90] },
  flappy: { type: 'flappy', need: [4, 5, 6], gap: [106, 98, 92], speed: [90, 98, 106], miss: [1, 1, 0] },
  piano: { type: 'piano', need: [14, 20, 26], speed: [105, 125, 145], vmax: [170, 200, 230], miss: [2, 1, 1] },
  stack: { type: 'stack', need: [6, 8, 10], speed: [105, 135, 165] },
  dino: { type: 'dino', need: [6, 8, 10], speed: [185, 210, 235], miss: [1, 1, 0] },
  bottle: { type: 'bottle', zone: [0.3, 0.23, 0.17], speed: [1.15, 1.45, 1.8], tries: [3, 3, 3] },
  snake: { type: 'snake', need: [5, 7, 9], step: [0.22, 0.18, 0.15], time: [50, 55, 60] },
  tictactoe: { type: 'tictactoe', err: [0.55, 0.3, 0] },
  connect4: { type: 'connect4', depth: [2, 3, 4], err: [0.3, 0.12, 0.03], time: [90, 90, 90] },
};
const V = (k, extra) => Object.assign({}, SP[k], extra || {});

// Labirint tuzoqlari: har birida bir nechta sinov (shart) va yutqazish oqibati (xususiyat). Har safar sinov tasodifan tanlanadi.
const TRAPS = [
  { key: 'quicksand', icon: '⏳', name: 'Qumtuzoq', w: 1, lethal: true,
    games: [V('balance', { icon: '🧍' }), V('rhythm', { icon: '⏳', lead: 'Qum zarbini ushla' }), V('tug', { foeIcon: '⏳' }), V('glass', { lead: 'Qum ustidagi toshlar' }), V('dodge', { obj: '⏳' })],
    rhyme: 'Yer yumshoq, qadam og‘ir, qum seni chaqirar,\nShoshganni yutib yuborar, sabrlini chiqarar.',
    xus: 'Ulgurmasang — qum seni yutadi: −1 jon.',
    win: 'Shoxga yopishib, qumdan sug‘urilib chiqding!', lose: 'Qum seni yutdi. Zo‘rg‘a chiqding, lekin bir joning ketdi.' },
  { key: 'monkeys', icon: '🐒', name: 'Maymunlar to‘dasi', w: 1, effect: 'forget',
    games: [V('riddle'), V('shell', { item: '🍌' }), V('stroop'), V('memory'), V('scramble'), V('connect4'), V('wordle')],
    rhyme: 'Daraxtda shovqin, shoxda to‘polon,\nMaymunlar keldi — yo‘qolar nishon.',
    xus: 'Yutqazsang — maymunlar xaritangni o‘g‘irlaydi: atrof yana tumanga aylanadi. Jon ketmaydi.',
    win: 'Maymunlar hayron qolib, yo‘l berishdi.', lose: 'Maymunlar xaritangni yulib ketdi! Atrof yana tuman.' },
  { key: 'lion', icon: '🦁', name: 'Sher', w: 1, lethal: true,
    games: [V('arrows'), V('redlight'), V('tug', { foeIcon: '🦁' }), V('dino'), V('dodge', { obj: '🦁' })],
    rhyme: 'Bu o‘rmon shohi, kutmaydi so‘rov,\nYollari oltin, ko‘zlari olov.',
    xus: 'Yutqazsang — sher panjasi yetib keladi: −1 jon.',
    win: 'Sher sakraganda chetga o‘zingni otding — u bo‘sh joyga tushdi!', lose: 'Sher panjasi yetib keldi. −1 jon.' },
  { key: 'mosquito', icon: '🦟', name: 'Ulkan chivinlar', w: 1, effect: 'fever',
    games: [V('arrows'), V('dodge', { obj: '🦟' }), V('piano'), V('flappy', { label: 'G‘ing!' })],
    rhyme: 'Kichkina-yu, nishi o‘tkir, g‘ing‘illar qulog‘ingda,\nChaqsa — isitma bosar, tuman tushar ko‘zingda.',
    xus: 'Yutqazsang — {fever} soniya isitma: sekin yurasan va faqat bir qadam atrofni ko‘rasan.',
    win: 'Chivinlardan qutulding!', lose: 'Chaqib oldi! Isitma boshlandi.' },
  { key: 'plant', icon: '🌺', name: 'Yirtqich o‘simlik', w: 1, lethal: true,
    games: [V('pattern'), V('rhythm', { icon: '🌺' }), V('dalgona'), V('stack'), V('bottle')],
    rhyme: 'Gul ochildi, bargida tikan bor,\nOchko‘z o‘simlik — senga intizor.',
    xus: 'Yutqazsang — tikanli poyalar o‘raladi: −1 jon.',
    win: 'Poyalarni aynan vaqtida kesding!', lose: 'Tikanlar sanchildi. −1 jon.' },
  { key: 'monsoon', icon: '🌧️', name: 'Musson toshqini', w: 1, effect: 'flood',
    games: [{ type: 'dice', tries: 1, need: 5, text: 'Zar: 1 urinish. 5 yoki undan ko‘p tashla.' }, V('balance', { icon: '🛶' }), V('dodge', { obj: '🌊' }), V('stack'), V('bottle')],
    rhyme: 'Momaqaldiroq gumburlar, yomg‘ir quyar to‘xtovsiz,\nSuv seni ortga oqizar, qolasan yo‘lsiz-izsiz.',
    xus: 'Yutqazsang, suv seni o‘z izing bo‘ylab {flood} qadam ortga oqizadi. Jon ketmaydi.',
    win: 'Daraxtga chiqib, toshqinni kutib turding.', lose: 'Suv seni ortga oqizib ketdi!' },
  { key: 'rhino', icon: '🦏', name: 'Karkidonlar podasi', w: 0.8, lethal: true, effect: 'trample',
    games: [V('dodge', { obj: '🦏' }), V('arrows'), V('dino'), V('tug', { foeIcon: '🦏' }), V('redlight')],
    rhyme: 'Yer titrar, chang ko‘tarilar, kelar poda shoshib,\nYo‘ldan qoch, yo bosib o‘tar — qolasan toptalib.',
    xus: 'Yutqazsang — −1 jon va {trample} qadam ortga uloqtirilasan.',
    win: 'Devorga yopishib turding — poda yoningdan o‘tib ketdi.', lose: 'Poda seni bosib o‘tdi. −1 jon.' },
  { key: 'hunter', icon: '🎯', name: 'Ovchi Burgut', w: 0.6, effect: 'hunt',
    games: [{ type: 'dice', tries: 1, need: 10, text: 'Zar: 1 urinish. 10 yoki undan ko‘p tashlasang, ovchi seni sezmaydi.' }, V('shell'), V('pattern'), V('redlight', { lead: 'Ovchi qaraganda qotib qol!' }), V('tictactoe')],
    rhyme: 'Uzoq o‘rmon ichidan bir ovchi kelar,\nO‘ljasini topmaguncha tinmay izlar.',
    xus: 'Yutqazsang, u izingdan {hunt} soniyagacha quvadi. Ushlasa — −1 jon. Undan uzoqroq qoch!',
    win: 'Butalar orasiga yashirinding. Ovchi yoningdan o‘tib ketdi.', lose: 'Burgut seni ko‘rdi! Qoch!' },
  { key: 'spider', icon: '🕷️', name: 'Ulkan o‘rgimchak', w: 0.8, lethal: true,
    games: [V('simon'), V('simon', { rev: true }), V('pattern'), V('memory', { icons: ['🕷️', '🕸️', '🦋', '🐝', '🐞', '🦗', '🐜', '🦂'] }), V('glass', { lead: 'To‘r ko‘prigi', icon: '🕷️' }), V('piano')],
    rhyme: 'Ingichka ip, kumush to‘r, tunda to‘qilgan,\nBir kirsang chiqolmaysan — sakkiz oyoq kutgan.',
    xus: 'Yutqazsang — o‘rgimchak chaqadi: −1 jon.',
    win: 'To‘rni to‘g‘ri tartibda uzib chiqding!', lose: 'O‘rgimchak chaqdi. −1 jon.' },
  { key: 'vines', icon: '🌿', name: 'Lianalar', w: 0.9, effect: 'drag',
    games: [V('scramble'), V('tug', { foeIcon: '🌿' }), V('dalgona'), V('snake'), V('stack')],
    rhyme: 'Lianalar ilondek o‘raladi tanangga,\nSudrab ketar noma’lum, qorong‘i tomonga.',
    xus: 'Yutqazsang — lianalar seni yaqin atrofdagi notanish joyga sudrab tashlaydi. Jon ketmaydi.',
    win: 'Lianalarni yulib tashlading!', lose: 'Lianalar seni qorong‘ilikka sudrab ketdi!' },
  { key: 'idol', icon: '🗿', name: 'Qadimiy but', w: 0.8, effect: 'rewind',
    games: [V('riddle'), V('lock'), V('memory'), V('connect4'), V('wordle'), V('g2048')],
    rhyme: 'Tosh ko‘zlari yonadi, vaqt ortga oqar,\nBosgan izing qaytadan seni o‘ziga chaqirar.',
    xus: 'Yutqazsang — but vaqtni ortga buradi: {rewind} qadam oldingi joyingga qaytasan. Jon ketmaydi.',
    win: 'But jilmaydi va ko‘zlarini yumdi.', lose: 'Vaqt ortga burildi! Izing bo‘ylab orqaga uchyapsan…' },
  { key: 'storm', icon: '🌪️', name: 'Girdobli bo‘ron', w: 0.7, effect: 'storm',
    games: [{ type: 'dice', tries: 1, need: 6, text: 'Zar: 1 urinish. 6 yoki undan ko‘p tashla.' }, V('balance', { icon: '🧍' }), V('rhythm', { icon: '🌪️' }), V('flappy'), V('bottle')],
    rhyme: 'Shamol uvillar, osmon aylanar,\nKim qolsa yo‘lida — bo‘ronda yo‘qolar.',
    xus: 'Yutqazsang, bo‘ron seni labirintning noma’lum bir nuqtasiga uloqtiradi.',
    win: 'Ildizga yopishib, bo‘ronni o‘tkazib yubording.', lose: 'Bo‘ron seni ko‘kka ko‘tarib ketdi!' },
];
const TRAP_IX = Object.fromEntries(TRAPS.map((t, i) => [t.key, i]));

// Labirintda kezib yuruvchi xavfli hayvonlar.
const BEASTS = {
  jaguar: { icon: '🐆', name: 'Yaguar', wander: 860, chase: 330, track: 520, search: 560, sense: 6, hear: 4, scent: 16, leash: 16, chaseTime: 8, lethal: true, pack: true, leap: true,
    games: [V('arrows'), V('redlight'), V('dino'), V('tug', { foeIcon: '🐆' }), V('dodge', { obj: '🐆' })],
    rhyme: 'Dog‘li po‘stin, sokin qadam, soyada yashirin,\nBir sakrashda yetib kelar — kim sekin, u qurbon.',
    xus: 'Izingdan hid olib boradi, qadam tovushini eshitadi. Yaqinlashsa bir sakrashda yetib oladi; bittasi quvsa — sheriklari yo‘lingni kesadi. Yutqazsang — −1 jon. Qutulsang, u uzoqqa qochadi.',
    win: 'Mash’ala silkitding — yaguar qorong‘ilikka qochdi.', lose: 'Yaguar tashlandi. −1 jon.' },
  rhino: { icon: '🦏', name: 'Karkidon', wander: 1300, charge: 170, track: 800, search: 900, sense: 7, hear: 5, scent: 12, leash: 12, lethal: true, effect: 'trample6',
    games: [V('dodge', { obj: '🦏' }), V('dino'), V('arrows'), V('tug', { foeIcon: '🦏' }), V('redlight')],
    rhyme: 'Shoxi oldinda, yer gumburlaydi,\nTo‘g‘ri yo‘lda turgan — chetga uchadi.',
    xus: 'Qadam tovushingni eshitib yaqinlashadi va to‘g‘ri yo‘lakda ko‘rsa bor kuchi bilan yuguradi — burilishga qochsang, devorga uriladi. Yutqazsang — −1 jon va 6 qadam ortga.',
    win: 'Oxirgi lahzada chetga sakrading — karkidon yonginangdan o‘tdi.', lose: 'Karkidon seni urib yubordi. −1 jon.' },
  mamba: { icon: '🐍', name: 'Qora mamba', wander: 1800, chase: 760, track: 1500, search: 1500, lunge: 190, sense: 3, hear: 2, scent: 6, leash: 6, chaseTime: 5, lethal: true, coil: true,
    games: [V('arrows'), V('rhythm', { icon: '🐍', lead: 'Ilonni nay bilan sehrla' }), V('simon'), V('shell', { item: '🐍' }), V('snake'), V('piano')],
    rhyme: 'Shitirlagan barglar ostida qora ip,\nTishlasa — zahar, qochsang — omading kulib.',
    xus: 'Barglar orasida o‘ralib yashirinib poylaydi: yaqiniga kelsang chaqmoqdek otilib chiqadi. Yutqazsang — zahar: −1 jon.',
    win: 'Ilonni tayoq bilan nari surding.', lose: 'Mamba chaqdi. −1 jon.' },
  bandit: { icon: '🦹', name: 'Qaroqchi', wander: 800, chase: 330, track: 480, search: 520, sense: 6, hear: 4, scent: 20, leash: 24, chaseTime: 8, bandit: true, pack: true, greedy: true,
    shart: 'Seni tutsa: 5–10 tanga to‘laysan; puling shundan kam bo‘lsa — qamoq.',
    rhyme: 'Yuzi niqobda, qo‘lida xalta,\nPulingni so‘raydi — bermasang qamoq.',
    xus: 'Puli ko‘p odamni tanlaydi, izdan boradi va sheriklarini chaqiradi. Quvib yetsa 5 dan 10 tagacha tanga tortib olib qochadi (har safar boshqacha). Puling shundan kam bo‘lsa — qamoqqa tashlaydi. Qamoqdan faqat ikkita bir xil zar (1-1 … 6-6) tushganda chiqasan.' },
};
const BEAST_KINDS = ['jaguar', 'rhino', 'mamba', 'bandit'];

// Faqat zar bilan sakrab o‘tiladigan joylar.
const OBST = {
  chasm: { icon: '🕳️', name: 'Jarlik',
    rhyme: 'Yo‘l uzildi, ostingda tubsiz zulmat,\nZar — sening qanoting. Tashla, ber jur’at.',
    shart: (w) => (w > 1 ? 'Keng jarlik: 8 yoki undan ko‘p tashla.' : '6 yoki undan ko‘p tashla.') + ' Istalgan juft (1+1 dan boshqa) — albatta sakraysan.',
    xus: 'Yetmasa — chetida to‘xtab qolasan va qayta urinasan. 1+1 tushsa — jarlikka qulaysan: −1 jon.',
    need: (w) => (w > 1 ? 8 : 6) },
  river: { icon: '🐊', name: 'Timsohli daryo',
    rhyme: 'Daryo jim oqar, ostida ko‘zlar —\nTimsohlar sabr bilan o‘ljasin izlar.',
    shart: () => '7 yoki undan ko‘p, yoki istalgan juft (1+1 dan boshqa) tashla — toshdan toshga sakrab o‘tasan.',
    xus: '5–6 tushsa — qirg‘oqda qolasan. 4 va undan kam — timsoh tishlaydi: −1 jon.',
    need: () => 7 },
};
const PORTAL = { icon: '🌀', name: 'Sehrli girdob',
  rhyme: 'Aylanar moviy girdob, yo‘l ochar noma’lumga,\nZar aytar: oldingami, yo qaytasan boshingga.',
  shart: 'Hech narsa so‘ralmaydi: girdobga kirsang bo‘ldi.',
  xus: 'Girdob seni labirintning tasodifiy joyiga uloqtiradi: chiqishga yaqin ham, kirishga qaytarib ham tashlashi mumkin. Yetib borgan joying tuman ichida bo‘ladi.' };
const CHEST = { icon: '🧰', name: 'Xazina sandig‘i',
  rhyme: 'Qadimiy sandiq, qulfida sir bor,\nTopsang javobni — xazinang tayyor.',
  shart: 'Tez mini-o‘yin: xotira, naqsh, ko‘zalar, barabanlar, minora va boshqalar.',
  xus: 'Yechsang — sovg‘a, uch darajadan biri: ⭐ oddiy (tanga, mash’al, tezyurar etik, qalqon, yelim, tuman bombasi), ⭐⭐ noyob (+1 jon, kompas, sehrli xarita, ko‘rinmas plash, qamoq kaliti, muzlatish, boshqaruvni aralashtirish) yoki ⭐⭐⭐ afsonaviy (katta xazina, oltin girdob, qanotlar, omadli zar, qaroqchini chaqirish, joy almashtirish). Qiyin xaritada yaxshi sovg‘a ko‘proq tushadi. Yecha olmasang — sandiq yopiladi, hech narsa yo‘qotmaysan.',
  games: [V('riddle'), V('riddle'), V('riddle'), V('riddle'), V('riddle'), V('lock'), V('scramble'), V('memory'), V('stroop'), V('pattern'), V('simon'), V('shell', { item: '💎' }), V('wordle'), V('g2048'), V('tictactoe'), V('connect4'), V('stack'), V('snake'), V('flappy'), V('piano'), V('dalgona'), V('bottle'), V('dino')] };

const ITEMS = [
  { key: 'torch', icon: '🔥', name: 'Mash’al', w: 0.22, text: 'Mash’al topding — atrofni kengroq ko‘rasan!', shart: 'Ustiga bos.', xus: 'Bir minut 3 qadam atrofni ko‘rasan.' },
  { key: 'compass', icon: '🧭', name: 'Kompas', w: 0.3, text: 'Kompas topding — oltin o‘q chiqish qaysi tomonda ekanini ko‘rsatadi!', shart: 'Ustiga bos.', xus: 'Chiqish qaysi tomonda ekanini faqat kompas ko‘rsatadi: 75 soniya oltin strelka. Eshikning joyi xaritada ko‘rinmaydi.' },
  { key: 'fruit', icon: '🍎', name: 'Shifobaxsh olma', w: 0.18, text: 'Shifobaxsh olma: +1 jon!', shart: 'Ustiga bos (joning to‘la bo‘lmasa).', xus: '+1 jon, lekin 3 tadan oshmaydi.' },
  { key: 'boots', icon: '👟', name: 'Tezyurar etik', w: 0.16, text: 'Tezyurar etik — 20 soniya shamoldek yugurasan!', shart: 'Ustiga bos.', xus: '20 soniya ikki baravar tez yurasan.' },
  { key: 'shield', icon: '🛡️', name: 'Qalqon', w: 0.14, text: 'Qalqon topding — keyingi yutqazishdan saqlaydi!', shart: 'Ustiga bos.', xus: 'Keyingi yutqazilgan tuzoq, hayvon yoki jarlikda hech narsa yo‘qotmaysan.' },
  { key: 'glue', icon: '🍯', name: 'Yelim shari', w: 0.08, text: 'Yelim shari sumkangga tushdi — 🪄 tugmadan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqibni 20 soniya sekin yurgizadi. Sumkangga tushadi, 🪄 tugmadan ishlatasan.' },
  { key: 'fogbomb', icon: '🌫️', name: 'Tuman bombasi', w: 0.07, text: 'Tuman bombasi sumkangga tushdi — 🪄 tugmadan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqibning atrofdagi xaritasi yana tumanga burkanadi.' },
  { key: 'freeze', icon: '❄️', name: 'Muzlatish sehri', w: 0.07, text: 'Muzlatish sehri sumkangga tushdi — 🪄 tugmadan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqib 8 soniya qimirlay olmaydi.' },
  { key: 'bandit', icon: '📯', name: 'Qaroqchi chaqirig‘i', w: 0.06, text: 'Qaroqchini chaqiruvchi shox sumkangga tushdi — 🪄 tugmadan ishlat!', shart: 'Ustiga bos.', xus: 'Qaroqchi raqibni quvadi: 5–10 tanga oladi, puli shundan kam bo‘lsa qamoqqa tashlaydi.' },
  { key: 'scramble', icon: '🎮', name: 'Aralashtirish sehri', w: 0.05, text: 'Aralashtirish sehri sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqibning joystik yo‘nalishlari 30 soniya aralashib ketadi (har safar boshqacha).' },
  { key: 'keymap', icon: '📜', name: 'Kalit xaritasi', w: 0, text: 'Kalit xaritasi! Darvoza kaliting qayerdaligi belgilandi — minixaritaga qara.', shart: 'Ustiga bos. Butun labirintda faqat bitta, yashirin.', xus: 'Kalitingning joyi minixaritada va ekranda belgilanadi, tepada yo‘nalish yozuvi chiqadi. Do‘kondan juda qimmatga sotib ham olsa bo‘ladi.' },
  { key: 'chestmap', icon: '🗺️', name: 'Xazina xaritasi', w: 0, text: 'Xazina xaritasi! Hamma sandiqlar joyi belgilandi — minixaritaga qara.', shart: 'Ustiga bos. Butun labirintda faqat bitta, yashirin.', xus: 'Hamma ochilmagan sandiqlar minixaritada va ekranda belgilanadi. Do‘kondan juda qimmatga sotib ham olsa bo‘ladi.' },
  { key: 'mirror', icon: '🪞', name: 'Ko‘zgu qalqoni', w: 0.07, text: 'Ko‘zgu qalqoni topding — kimdir senga sehr ishlatsa, u o‘sha odamning o‘ziga qaytadi!', shart: 'Ustiga bos.', xus: 'Kimdir senga xalaqit sehri ishlatsa (muzlatish, yelim, akleroz…), u sehr yuboruvchining o‘ziga qaytadi. Bir marta ishlaydi, 45 soniya turadi.' },
  { key: 'trapkit', icon: '🪤', name: 'Tuzoq to‘plami', w: 0.07, text: 'Tuzoq to‘plami — sumkangga tasodifiy tuzoq tushdi: 🪄 do‘kon → «Tuzoq» varag‘idan qo‘y!', shart: 'Ustiga bos.', xus: 'Sumkangga tasodifiy tuzoq yoki devor tushadi (teleport, yelim, tuman, muz, akleroz, soxta tanga, devor). O‘zing xohlagan joyga qo‘yasan; raqib bossa ishlaydi.' },
  { key: 'amnesia', icon: '🧠', name: 'Akleroz', w: 0.05, text: 'Akleroz sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqibning ochgan joylari 1 daqiqa xaritada va ekranda ko‘rinmaydi (faqat hozirgi atrofini ko‘radi).' },
  { key: 'swap', icon: '🔀', name: 'Joy almashtirish', w: 0.05, text: 'Joy almashtirish sehri sumkangga tushdi — 🪄 tugmadan ishlat!', shart: 'Ustiga bos.', xus: 'Oldinda ketayotgan raqib bilan o‘rningni almashtirasan.' },
  { key: 'flip', icon: '🙃', name: 'Teskari dunyo', w: 0.06, text: 'Teskari dunyo sehri sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqibning ekrani 25 soniya teskari ag‘dariladi, joystik esa o‘sha-o‘sha.' },
  { key: 'mask', icon: '🐔', name: 'Maskalash', w: 0.06, text: 'Maskalash sehri sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqib 1 daqiqa hammaga tovuq, masxaraboz yoki kartoshka bo‘lib ko‘rinadi.' },
  { key: 'liar', icon: '🧭', name: 'Kompas aldaydi', w: 0.04, text: 'Yolg‘onchi kompas sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqibning kompasi va kalit/sandiq yo‘naltirgichlari 1 daqiqa noto‘g‘ri tomonni ko‘rsatadi.' },
  { key: 'steal', icon: '🤏', name: 'Cho‘ntak o‘g‘risi', w: 0.06, text: 'Cho‘ntak o‘g‘risi sehri sumkangga tushdi — yaqin raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Yaqin (6 katak) turgan raqibdan 5 tanga o‘g‘irlaysan.' },
  { key: 'kmove', icon: '🔑', name: 'Kalitni ko‘chirish', w: 0.03, text: 'Kalitni ko‘chirish sehri sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqibning topilmagan darvoza kaliti boshqa uzoq yo‘lakka ko‘chadi.' },
  { key: 'shut', icon: '🏪', name: 'Do‘konni yopish', w: 0.03, text: 'Do‘kon qulfi sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Raqib 30 soniya hech narsa sotib ololmaydi, keyin 30 soniya narxlar 2 baravar.' },
  { key: 'sic', icon: '🚐', name: 'Ovchini yuborish', w: 0.03, text: 'Ovchi Burgut chaqirig‘i sumkangga tushdi — 🪄 do‘kondan raqibga ishlat!', shart: 'Ustiga bos.', xus: 'Burgut raqibning izidan tushib, uni quvadi.' },
  { key: 'bomb', icon: '💣', name: 'Bomba', w: 0.04, text: 'Bomba sumkangga tushdi — 🪄 do‘kondan raqibga ishlat: 30 soniyada portlaydi!', shart: 'Ustiga bos.', xus: 'Raqibga bomba tushadi; u boshqaga tegib topshirmasa, 30 soniyada portlab, labirint boshiga uloqtiriladi va 5 tanga yo‘qotadi.' },
  { key: 'chaos', icon: '🌪️', name: 'Tartibsizlik', w: 0.02, text: 'Tartibsizlik sehri sumkangga tushdi — 🪄 do‘kondan ishlat: hamma joyi almashadi!', shart: 'Ustiga bos.', xus: 'Hamma o‘yinchining joylari tasodifan almashadi.' },
  { key: 'cleanse', icon: '🧼', name: 'Tozalash', w: 0.05, text: 'Tozalash sumkangda — senga qilingan hamma xalaqitni yo‘qotadi!', shart: 'Ustiga bos.', xus: 'Muz, yelim, aralash boshqaruv, akleroz, maska va boshqa xalaqitlar yo‘qoladi.' },
  { key: 'radar', icon: '📡', name: 'Radar', w: 0.05, text: 'Radar sumkangda — yashirin tuzoqlarni ko‘rsatadi, ustiga bossang zararsizlanadi!', shart: 'Ustiga bos.', xus: '25 soniya atrofdagi yashirin tuzoqlar ko‘rinadi; ularni bosib zararsizlantirsang +2 tanga.' },
];
const ITEM_IX = Object.fromEntries(ITEMS.map((t, i) => [t.key, i]));

// Savollar banki (birinchi javob — to‘g‘ri; ko‘rsatishda aralashtiriladi).
const RB = (c, list) => list.map((r) => ({ c, q: r[0], a: r.slice(1) }));
const RIDDLES = [
  ...RB('Topishmoq', [
    ['Bir qozonda ikki xil osh.', 'Tuxum', 'Palov', 'Qozon', 'Sho‘rva'],
    ['Yuz to‘nli, birorta tugmasi yo‘q.', 'Karam', 'Olma', 'Kitob', 'Daraxt'],
    ['Tishi bor, lekin hech kimni tishlamaydi.', 'Taroq', 'Bo‘ri', 'Qaychi', 'Mushuk'],
    ['Hammani kiyintiradi, o‘zi esa yalang‘och.', 'Igna', 'Do‘kon', 'Shkaf', 'Tikuvchi'],
    ['O‘zi bir qarich, soqoli bir quloch.', 'Igna va ip', 'Echki', 'Chol', 'Supurgi'],
    ['Oq dalaga qora urug‘ sepiladi: qo‘l bilan ekiladi, ko‘z bilan teriladi.', 'Yozuv', 'Paxta', 'Bug‘doy', 'Qor'],
    ['Bir tup daraxtning 12 ta shoxi bor, har shoxda 4 ta uya, har uyada 7 ta tuxum. Bu nima?', 'Yil', 'Bog‘', 'Qushlar', 'Soat'],
    ['Qanchalik ko‘p olsang, shunchalik kattalashadi.', 'Chuqur', 'Tosh', 'Non', 'Shar'],
    ['Suvga tushsa ham, hech qachon ho‘l bo‘lmaydi.', 'Soya', 'Baliq', 'O‘rdak', 'Tosh'],
    ['Yuradi-yu, joyidan jilmaydi.', 'Soat', 'Daryo', 'Shamol', 'Poyezd'],
    ['Qanotsiz uchadi, ko‘zsiz yig‘laydi.', 'Bulut', 'Qush', 'Shamol', 'Kapalak'],
    ['Kechasi osmonga oltin tangalar sochiladi, ertalab birortasi qolmaydi.', 'Yulduzlar', 'Barglar', 'Qor', 'Yomg‘ir'],
    ['Qishin-yozin bir xil rangda turadi.', 'Archa', 'Olma daraxti', 'Tol', 'Gul'],
    ['Tilsiz gapiradi, oyoqsiz yuradi, uzoq-uzoqlarga yetib boradi.', 'Xat', 'Qush', 'Radio', 'Shamol'],
    ['Nima o‘zi ho‘l bo‘lgan sari boshqa narsalarni quritadi?', 'Sochiq', 'Quyosh', 'Shamol', 'Qum'],
    ['Doim yuqoriga ko‘tariladi, lekin hech qachon pastga tushmaydi.', 'Yosh', 'Tutun', 'Shar', 'Narx'],
    ['Doim oldingda, lekin uni hech qachon ko‘ra olmaysan.', 'Kelajak', 'Burun', 'Soya', 'Yo‘l'],
    ['Oq ko‘rpa yerni yopdi, bahor kelib uni olib ketdi.', 'Qor', 'Tuman', 'Bulut', 'Paxta'],
    ['Yozda kiyinadi, qishda yechinadi.', 'Daraxt', 'Odam', 'Ayiq', 'Quyon'],
    ['Tishi ham, tili ham yo‘q, lekin hammani yig‘latadi.', 'Piyoz', 'Qalampir', 'Shamol', 'Tutun'],
    ['Yer ostida o‘sadi, to‘q sariq rangda, quyon uni juda yaxshi ko‘radi.', 'Sabzi', 'Kartoshka', 'Lavlagi', 'Turp'],
    ['Ming ko‘zi bor, lekin hech narsani ko‘rmaydi.', 'Elak', 'Daraxt', 'Kitob', 'Tarvuz'],
    ['Kunduzi uxlaydi, kechasi uchadi, boshini pastga qilib osilib turadi.', 'Ko‘rshapalak', 'Boyqush', 'Kapalak', 'Maymun'],
    ['Uyini orqasida ko‘tarib yuradi, juda sekin, tanasi shilimshiq.', 'Shilliqqurt', 'Qurbaqa', 'Kaltakesak', 'Chuvalchang'],
    ['Ikki qo‘shni bir umr yonma-yon yashaydi, lekin bir-birini hech qachon ko‘rmaydi.', 'Ko‘zlar', 'Tishlar', 'Oyoqlar', 'Lablar'],
    ['Kechasi tug‘iladi, ertalab maysa ustida marjondek yaltiraydi.', 'Shudring', 'Qor', 'Yulduz', 'Tuman'],
    ['O‘zi suv, lekin suvda suzadi.', 'Muz', 'Baliq', 'Qayiq', 'Bulut'],
    ['Qanoti bor — qush emas, guldan-gulga qo‘nadi, asal yig‘adi.', 'Asalari', 'Kapalak', 'Chivin', 'Ninachi'],
    ['Rang-barang qanotli, guldan-gulga uchadi, avval qurt edi.', 'Kapalak', 'Asalari', 'Qaldirg‘och', 'Chigirtka'],
    ['Bo‘yni uzun, daraxt uchidagi barglarni yeydi, terisi dog‘li.', 'Jirafa', 'Tuya', 'Zebra', 'Kiyik'],
    ['Burni qo‘ldek uzun, quloqlari yelpig‘ichdek.', 'Fil', 'Karkidon', 'Begemot', 'Tuya'],
    ['Cho‘lda yashaydi, o‘rkachi bor, uzoq vaqt suv ichmasa ham chidaydi.', 'Tuya', 'Ot', 'Eshak', 'Jirafa'],
    ['Ko‘ylagi oq-qora yo‘l-yo‘l, otga o‘xshaydi.', 'Zebra', 'Yo‘lbars', 'Panda', 'Eshak'],
    ['Tikanli to‘p o‘rmonda yuradi, xavf sezsa yumaloq bo‘lib oladi.', 'Tipratikan', 'Kirpi baliq', 'Toshbaqa', 'Olmaxon'],
    ['Daraxtdan daraxtga sakraydi, dumi momiq, yong‘oq yig‘adi.', 'Olmaxon', 'Maymun', 'Tulki', 'Kaltakesak'],
    ['Quloqlari uzun, juda tez yuguradi, sabzini yaxshi ko‘radi.', 'Quyon', 'Eshak', 'Kiyik', 'Mushuk'],
    ['Ayyor deydilar, dumi momiq, tovuqxonaga yashirincha kiradi.', 'Tulki', 'Bo‘ri', 'Mushuk', 'Ayiq'],
    ['Suvda ham, quruqlikda ham yashaydi, «vaq-vaq» deydi.', 'Qurbaqa', 'O‘rdak', 'Baliq', 'Timsoh'],
    ['Kechasi ham ko‘radi, boshini orqaga bura oladi, «uhu» deydi.', 'Boyqush', 'Burgut', 'Ko‘rshapalak', 'Qarg‘a'],
    ['Odamdek gapiradi, lekin qush.', 'To‘tiqush', 'Qarg‘a', 'Kaptar', 'Tovus'],
    ['Oyog‘i ham, qo‘li ham yo‘q, lekin daraxtga chiqadi va vishillaydi.', 'Ilon', 'Maymun', 'Chumoli', 'Liana'],
    ['Sakkiz oyoqli, to‘r to‘qiydi, pashsha poylaydi.', 'O‘rgimchak', 'Chumoli', 'Qisqichbaqa', 'Chayon'],
    ['Osti tosh, usti tosh, o‘rtasida tirik jon.', 'Toshbaqa', 'Chig‘anoq', 'Qal’a', 'Tegirmon'],
    ['Yetti rangli ko‘prik, yomg‘irdan keyin osmonda paydo bo‘ladi.', 'Kamalak', 'Bulut', 'Chaqmoq', 'Shafaq'],
    ['Qo‘li yo‘q, oyog‘i yo‘q, lekin eshikni ochadi.', 'Kalit', 'Shamol', 'Mushuk', 'Tutqich'],
    ['Ko‘zi bor — ko‘rmaydi, lekin kiyim tikadi.', 'Igna', 'Qaychi', 'Tugma', 'Ip'],
    ['Kunduzi osmonda, kechasi yo‘q; issiq beradi, yorug‘ beradi.', 'Quyosh', 'Oy', 'Yulduz', 'Chiroq'],
    ['Kechasi chiqadi, goh o‘roqdek, goh to‘liq yumaloq bo‘ladi.', 'Oy', 'Quyosh', 'Bulut', 'Yulduz'],
    ['Varaqlari bor — daraxt emas; gapiradi — tili yo‘q.', 'Kitob', 'Karam', 'Daftar', 'Radio'],
    ['Ikki g‘ildirakli ot: pedal bossang yuradi.', 'Velosiped', 'Arava', 'Mototsikl', 'Samokat'],
    ['Temir qush osmonda uchadi, ichida odamlar o‘tiradi.', 'Samolyot', 'Burgut', 'Raketa', 'Varrak'],
    ['Uzun ilon temir yo‘lda yuguradi, vagonlari bor.', 'Poyezd', 'Avtobus', 'Tramvay', 'Metro'],
    ['Hammaning so‘zini takrorlaydi, lekin o‘zi ko‘rinmaydi; tog‘da yashaydi.', 'Aks-sado', 'Shamol', 'To‘tiqush', 'Radio'],
    ['Qanchalik ko‘p bo‘lsa, shunchalik kam ko‘rasan.', 'Qorong‘ilik', 'Tuman', 'Yorug‘lik', 'Yulduz'],
    ['Nomini aytsang — buziladi.', 'Sukunat', 'Sir', 'Tush', 'Oyna'],
    ['Seniki, lekin uni boshqalar sendan ko‘ra ko‘proq ishlatadi.', 'Isming', 'Telefoning', 'Kitobing', 'Uying'],
    ['Doim keladi, lekin hech qachon yetib kelmaydi.', 'Ertaga', 'Poyezd', 'Bahor', 'Mehmon'],
    ['Saqlasang — seniki, aytib qo‘ysang — hammaniki.', 'Sir', 'Pul', 'Non', 'Kitob'],
    ['Tog‘dan tushadi, dengizga yetadi, lekin oyog‘i yo‘q.', 'Daryo', 'Shamol', 'Tosh', 'Bulut'],
    ['Bir uyda o‘ttiz ikkita oq askar va bitta qizil sarkarda.', 'Tishlar va til', 'Shaxmat', 'Anor', 'Tarvuz'],
    ['Soqoli bor — echki emas, yuzta ko‘ylagi bor — karam emas.', 'Makkajo‘xori', 'Piyoz', 'Chol', 'Archa'],
    ['Yashil qutida qizil ko‘ylakli qora bolalar.', 'Tarvuz', 'Qovun', 'Anor', 'Bodring'],
    ['Sariq, egilgan, maymunlar sevadi.', 'Banan', 'Limon', 'Qovun', 'Makkajo‘xori'],
    ['Po‘sti qattiq, ichida oq suv, palma daraxtida o‘sadi.', 'Kokos', 'Yong‘oq', 'Tuxum', 'Qovun'],
    ['Ichida yuzlab qizil marjon, po‘sti qalin.', 'Anor', 'Uzum', 'Gilos', 'Tarvuz'],
    ['Gullaganda sariq, qariganda oq paxtadek uchib ketadi.', 'Qoqio‘t', 'Lola', 'Paxta', 'Kungaboqar'],
    ['Yuzi doim quyoshga qarab aylanadi, urug‘i mazali.', 'Kungaboqar', 'Lola', 'Atirgul', 'Qovoq'],
    ['Tikani bor, lekin gullarning shohi deyiladi.', 'Atirgul', 'Kaktus', 'Lola', 'Chinnigul'],
    ['Hamma uni bosib o‘tadi, lekin u hech kimdan xafa bo‘lmaydi.', 'Yo‘l', 'Gilam', 'Ostona', 'Ko‘prik'],
    ['Ko‘zguga qarasang — u ham qaraydi, kulsang — u ham kuladi.', 'Aksing', 'Soyang', 'Do‘sting', 'Mushuk'],
    ['Bitta tugmani bossang, uzoqdagi odam bilan gaplashasan.', 'Telefon', 'Televizor', 'Chiroq', 'Soat'],
    ['Qanoti bor, lekin uchmaydi; shamol bersa aylanadi, un tortadi.', 'Shamol tegirmoni', 'Ventilyator', 'Varrak', 'Vertolyot'],
    ['Ichi to‘la shirinlik, uni ari yasaydi.', 'Asal', 'Shakar', 'Murabbo', 'Holva'],
    ['Qorong‘ida yonadi, tugmasini bossang xona yorishadi.', 'Chiroq', 'Gugurt', 'Shamchiroq', 'Televizor'],
    ['Ichida odamchalar gapiradi, kuylaydi, lekin o‘zi bir quti.', 'Televizor', 'Sandiq', 'Shkaf', 'Qo‘g‘irchoq uyi'],
    ['Oq kaptarlar qizil uyda yashaydi.', 'Tishlar', 'Tuxumlar', 'Bulutlar', 'Qorlar'],
    ['Bahorda yashil, yozda soya, kuzda sariq, qishda yalang‘och.', 'Daraxt', 'Maysa', 'Tog‘', 'Bog‘bon'],
  ]),
  ...RB('Mantiq', [
    ['Qaysi savolga hech qachon «ha» deb javob bera olmaysan?', '«Uxlayapsanmi?»', '«Ochmisan?»', '«Charchadingmi?»', '«Kelasanmi?»'],
    ['Lug‘atdagi qaysi so‘z doim noto‘g‘ri yoziladi?', '«Noto‘g‘ri» so‘zi', '«Xato» so‘zi', 'Eng uzun so‘z', 'Hech qaysi'],
    ['Xo‘roz tom tepasida tuxum qo‘ydi. Tuxum qaysi tomonga dumalaydi?', 'Xo‘roz tuxum qo‘ymaydi', 'Sharqqa', 'G‘arbga', 'Hovliga'],
    ['Elektr poyezd shimolga ketyapti, shamol janubga esyapti. Tutun qaysi tomonga ketadi?', 'Elektr poyezdda tutun yo‘q', 'Janubga', 'Shimolga', 'Yuqoriga'],
    ['Qorong‘i xonada sham, lampa va pech bor, qo‘lingda bitta gugurt. Birinchi nimani yoqasan?', 'Gugurtni', 'Shamni', 'Lampani', 'Pechni'],
    ['Bir kishi 8 kun umuman uxlamadi, lekin charchamadi. Qanday qilib?', 'Kechalari uxladi', 'U robot', 'Qahva ichdi', 'Bu mumkin emas'],
    ['Stolda 7 ta sham yonib turibdi. 3 tasini o‘chirdik. Oxirida nechta sham qoladi?', '3 ta', '4 ta', '7 ta', '0 ta'],
    ['Bir yilda nechta oyda 28 kun bor?', 'Hammasida (12 ta)', 'Bittasida', 'Ikkitasida', 'Hech birida'],
    ['Fermerning 17 ta qo‘yi bor edi. 9 tasidan boshqa hammasi qochib ketdi. Nechta qo‘y qoldi?', '9 ta', '8 ta', '17 ta', '0 ta'],
    ['Poygada ikkinchi o‘rindagi yuguruvchini quvib o‘tding. Endi nechanchi o‘rindasan?', 'Ikkinchi', 'Birinchi', 'Uchinchi', 'Oxirgi'],
    ['1 kg paxta og‘irmi yoki 1 kg temir?', 'Ikkalasi teng', 'Temir', 'Paxta', 'Qanday o‘lchashga bog‘liq'],
    ['Malikaning onasining to‘rt farzandi bor: Bahor, Yoz va Kuz. To‘rtinchisining ismi nima?', 'Malika', 'Qish', 'Ko‘klam', 'Nargiza'],
    ['3 ta mushuk 3 ta sichqonni 3 daqiqada tutadi. 100 ta mushuk 100 ta sichqonni necha daqiqada tutadi?', '3 daqiqada', '100 daqiqada', '33 daqiqada', '1 daqiqada'],
    ['5 ta dastgoh 5 daqiqada 5 ta detal yasaydi. 100 ta dastgoh 100 ta detalni necha daqiqada yasaydi?', '5 daqiqada', '100 daqiqada', '20 daqiqada', '1 daqiqada'],
    ['Ko‘ldagi nilufar barglari har kuni ikki baravar ko‘payadi va 48 kunda butun ko‘lni qoplaydi. Ko‘lning yarmini necha kunda qoplaydi?', '47 kunda', '24 kunda', '46 kunda', '12 kunda'],
    ['Kitob va ruchka birga 11 000 so‘m turadi. Kitob ruchkadan 10 000 so‘m qimmat. Ruchka necha so‘m?', '500 so‘m', '1 000 so‘m', '1 500 so‘m', '100 so‘m'],
    ['G‘isht 1 kg va yana yarim g‘isht og‘irlikda. Butun g‘isht necha kg?', '2 kg', '1,5 kg', '1 kg', '3 kg'],
    ['Bir oilada 5 aka-uka bor, har birining bitta singlisi bor. Oilada nechta farzand?', '6 ta', '10 ta', '5 ta', '11 ta'],
    ['Ertadan keyingi kun shanba bo‘lsa, bugun qaysi kun?', 'Payshanba', 'Juma', 'Chorshanba', 'Yakshanba'],
    ['Ikki ota va ikki o‘g‘il 3 ta baliq tutdi, har biriga bittadan tegdi. Qanday qilib?', 'Ular bobo, ota va nabira', 'Bittasi qochib ketdi', 'Bittasini bo‘lishdi', 'Bu mumkin emas'],
    ['Xonaning 4 burchagida bittadan mushuk o‘tiribdi, har bir mushuk qarshisida 3 ta mushuk bor. Xonada jami nechta mushuk?', '4 ta', '12 ta', '16 ta', '7 ta'],
    ['5 ta olmadan 3 tasini olding. Senda nechta olma bor?', '3 ta', '2 ta', '5 ta', '8 ta'],
    ['Qaysi oyda odamlar eng kam gapiradi?', 'Fevralda — u eng qisqa oy', 'Iyulda', 'Dekabrda', 'Yanvarda'],
    ['Uch kishi bitta soyabon ostida turishdi, lekin hech biri ho‘l bo‘lmadi. Nega?', 'Yomg‘ir yog‘mayotgan edi', 'Soyabon katta edi', 'Ular kichkina edi', 'Ular yugurishdi'],
    ['Qaysi narsani ishlatishdan oldin albatta sindirish kerak?', 'Tuxum', 'Shisha', 'Qalam', 'Non'],
    ['Bir kunda soatning soat va minut millari necha marta ustma-ust tushadi?', '22 marta', '24 marta', '12 marta', '23 marta'],
    ['Bir yarim tovuq bir yarim kunda bir yarim tuxum qo‘ysa, bitta tovuq bir kunda nechta tuxum qo‘yadi?', '2/3 ta', '1 ta', '1,5 ta', '2 ta'],
    ['Yarim tunda yomg‘ir yog‘yapti. 72 soatdan keyin quyoshli havo bo‘lishi mumkinmi?', 'Yo‘q — 72 soatdan keyin yana yarim tun bo‘ladi', 'Ha', 'Faqat yozda', 'Faqat ertalab'],
    ['Qaysi sonni o‘ziga qo‘shsang ham, o‘ziga ko‘paytirsang ham bir xil natija chiqadi?', '2', '1', '3', '4'],
    ['6 ta apelsinni 3 kishiga teng bo‘lding, keyin har kim o‘z ulushining yarmini yedi. Jami nechta apelsin qoldi?', '3 ta', '2 ta', '6 ta', '1 ta'],
    ['Bir qavatli uyda hamma narsa sariq: devor, stol, gilam. Zinapoya qanday rangda?', 'Bir qavatli uyda zinapoya yo‘q', 'Sariq', 'Jigarrang', 'Oq'],
    ['Dengizda qanday tosh bo‘lmaydi?', 'Quruq tosh', 'Katta tosh', 'Qora tosh', 'Yumaloq tosh'],
    ['Choyni qaysi qo‘l bilan aralashtirgan yaxshi?', 'Qoshiq bilan aralashtirgan yaxshi', 'O‘ng qo‘l bilan', 'Chap qo‘l bilan', 'Ikkala qo‘l bilan'],
    ['Ikki kishi shaxmat o‘ynadi. Har biri 5 partiyada yutdi, durang bo‘lmadi. Bu qanday bo‘ladi?', 'Ular boshqa-boshqa raqiblar bilan o‘ynagan', 'Bu mumkin emas', 'Hakam xato qilgan', 'Ular 5 partiya o‘ynagan'],
    ['Yugurishda oxirgi yuguruvchini quvib o‘tsang, nechanchi bo‘lasan?', 'Oxirgini quvib o‘tib bo‘lmaydi', 'Oxirgidan oldingi', 'Birinchi', 'Oxirgi'],
    ['Avtobusda 10 kishi bor edi. Bekatda 3 kishi tushdi, 5 kishi chiqdi. Keyingi bekatda 2 kishi tushdi. Avtobusda nechta yo‘lovchi bor?', '10 ta', '12 ta', '8 ta', '15 ta'],
    ['Tuxumni beton polga 1 metr balanddan qanday tashlasang, beton yorilmaydi?', 'Har qanday tashlasang ham — beton tuxumdan yorilmaydi', 'Sekin tashlasang', 'Yonboshlatib tashlasang', 'Qaynatib tashlasang'],
    ['Shifokor 3 ta tabletka berdi: har yarim soatda bittadan ich. Hammasini ichib bo‘lishga qancha vaqt ketadi?', '1 soat', '1,5 soat', '2 soat', '30 daqiqa'],
    ['Arqonni 5 bo‘lakka bo‘lish uchun necha marta kesish kerak?', '4 marta', '5 marta', '6 marta', '3 marta'],
    ['Ota va o‘g‘il avariyaga uchradi. Jarroh bolani ko‘rib: «Bu mening o‘g‘lim!» dedi. Jarroh kim?', 'Bolaning onasi', 'Bolaning amakisi', 'Begona odam', 'Bolaning bobosi'],
    ['Mashina to‘g‘ri yo‘lda ketyapti. Qaysi g‘ildiragi aylanmaydi?', 'Zaxira g‘ildiragi', 'Old chap', 'Orqa o‘ng', 'Hammasi aylanadi'],
    ['Ko‘lda 10 ta o‘rdak suzayotgan edi. Ovchi otdi, 3 tasi tushdi. Ko‘lda nechta o‘rdak qoldi?', '3 ta (qolganlari uchib ketdi)', '7 ta', '10 ta', '0 ta'],
    ['1 dan 100 gacha sonlarni yozib chiqsang, 9 raqami necha marta yoziladi?', '20 marta', '10 marta', '11 marta', '19 marta'],
    ['Yarim tunda soat 12 marta urdi, urishlar orasida 1 soniyadan. Hammasi necha soniya davom etdi?', '11 soniya', '12 soniya', '13 soniya', '24 soniya'],
    ['Savatda 5 ta olma bor. 5 bolaga bittadan berib, savatda ham bitta olma qoldirish mumkinmi?', 'Ha — oxirgi bolaga olmani savat bilan berasan', 'Yo‘q, mumkin emas', 'Faqat bitta olmani kessang', 'Faqat 6 ta olma bo‘lsa'],
    ['Qaysi so‘zda «a» harfi uch marta uchraydi?', 'Baraban', 'Banan', 'Anor', 'Arslon'],
    ['Soat 6 da 6 marta uradi va bu 30 soniya davom etadi. Soat 12 da 12 marta urishi necha soniya davom etadi?', '66 soniya', '60 soniya', '72 soniya', '55 soniya'],
    ['Musobaqada oxirgidan oldingi o‘rindagini quvib o‘tding. Endi nechanchisan?', 'Oxirgidan oldingi', 'Oxirgi', 'Birinchi', 'Uchinchi'],
    ['Qorong‘i xonada qopda qizil, sariq va yashil olmalar bor. Kamida nechta olma olsang, ikkitasi bir xil rangda bo‘lishi aniq?', '4 ta', '3 ta', '2 ta', '6 ta'],
    ['Qaysi so‘z teskari o‘qilsa ham bir xil bo‘ladi?', 'Kiyik', 'Kitob', 'Ota', 'Olma'],
    ['Birinchi qavatdan ikkinchi qavatga chiqish 20 soniya oladi. Birinchidan to‘rtinchi qavatga chiqish-chi?', '60 soniya', '80 soniya', '40 soniya', '70 soniya'],
    ['Daraxt 5 metr. Chumoli kunduzi 3 metr ko‘tariladi, kechasi 2 metr sirpanib tushadi. Necha kunda tepaga chiqadi?', '3 kunda', '5 kunda', '4 kunda', '2 kunda'],
    ['Sen o‘g‘il bolasan. Otangning yagona o‘g‘lining o‘g‘li senga kim bo‘ladi?', 'O‘g‘ling', 'Ukang', 'Jiyaning', 'Nevarang'],
    ['Onamning akasi menga kim bo‘ladi?', 'Tog‘a', 'Amaki', 'Xola', 'Bobo'],
    ['Otamning akasi menga kim bo‘ladi?', 'Amaki', 'Tog‘a', 'Pochcha', 'Bobo'],
    ['Onamning opasi menga kim bo‘ladi?', 'Xola', 'Amma', 'Kelinoyi', 'Buvi'],
    ['Otamning opasi menga kim bo‘ladi?', 'Amma', 'Xola', 'Kelinoyi', 'Buvi'],
    ['Otamning otasi menga kim bo‘ladi?', 'Bobo', 'Amaki', 'Tog‘a', 'Pochcha'],
    ['Agar ikki kun oldin juma bo‘lgan bo‘lsa, ertaga qaysi kun?', 'Dushanba', 'Yakshanba', 'Shanba', 'Seshanba'],
    ['Qaysi narsa ko‘paygan sari yengillashadi?', 'Teshiklar', 'Toshlar', 'Kitoblar', 'Suv'],
    ['3 ta qutida 3 tadan olma bor. Bitta qutini olib ketishdi. Nechta olma qoldi?', '6 ta', '9 ta', '3 ta', '8 ta'],
    ['Agar 2 ta it 2 daqiqada 2 ta suyakni yesa, 6 ta it 6 ta suyakni necha daqiqada yeydi?', '2 daqiqada', '6 daqiqada', '12 daqiqada', '3 daqiqada'],
    ['Narvonning 10 ta pog‘onasi bor. O‘rtasidagi pog‘ona qaysi?', 'O‘rtasi yo‘q — 5 va 6 o‘rtada', '5-pog‘ona', '6-pog‘ona', '4-pog‘ona'],
  ]),
  ...RB('Hisob', [
    ['2, 4, 8, 16, … Keyingi son qaysi?', '32', '24', '20', '18'],
    ['1, 1, 2, 3, 5, 8, … Keyingi son qaysi?', '13', '11', '12', '16'],
    ['Qaysi son ortiqcha: 2, 3, 5, 9, 11?', '9 (u tub son emas)', '2', '5', '11'],
    ['4 × 4 + 4 − 4 ÷ 4 = ?', '19', '4', '16', '3'],
    ['Soat roppa-rosa 3:00 ni ko‘rsatsa, soat va minut millari orasidagi burchak necha gradus?', '90°', '30°', '45°', '180°'],
    ['Eng katta ikki xonali son bilan eng kichik ikki xonali son ayirmasi nechaga teng?', '89', '90', '99', '88'],
    ['Davrada 6 kishi o‘tiribdi. Har kim har kim bilan bir martadan qo‘l berib ko‘rishsa, jami nechta qo‘l siqish bo‘ladi?', '15', '30', '12', '36'],
    ['Ota o‘g‘lidan 30 yosh katta. 5 yildan keyin ota o‘g‘lidan 3 marta katta bo‘ladi. O‘g‘il hozir necha yoshda?', '10 yoshda', '15 yoshda', '5 yoshda', '12 yoshda'],
    ['Qaysi son 10 dan katta, 20 dan kichik va 3 ga ham, 5 ga ham bo‘linadi?', '15', '12', '18', '10'],
    ['Bir sutkada necha daqiqa bor?', '1 440', '1 200', '2 400', '3 600'],
    ['Bir soatda necha soniya bor?', '3 600', '60', '360', '6 000'],
    ['1, 3, 5, 7, … 50-toq son nechaga teng?', '99', '100', '101', '97'],
    ['Juft va toq sonni qo‘shsang, natija qanday bo‘ladi?', 'Har doim toq', 'Har doim juft', 'Goh juft, goh toq', 'Nol'],
    ['Eng kichik tub son qaysi?', '2', '1', '3', '0'],
    ['100 ni yarmiga bo‘lib, so‘ng 10 qo‘shsang nechchi chiqadi?', '60', '20', '55', '210'],
  ]),
  ...RB('Bilim', [
    ['O‘zbekistonning poytaxti qaysi shahar?', 'Toshkent', 'Samarqand', 'Buxoro', 'Xiva'],
    ['Yer Quyosh atrofini taxminan necha kunda bir marta aylanib chiqadi?', '365 kunda', '30 kunda', '24 soatda', '100 kunda'],
    ['Yer o‘z o‘qi atrofida necha soatda bir marta aylanadi?', '24 soatda', '12 soatda', '365 soatda', '48 soatda'],
    ['Dunyodagi eng katta okean qaysi?', 'Tinch okeani', 'Atlantika okeani', 'Hind okeani', 'Shimoliy Muz okeani'],
    ['Dunyodagi eng baland tog‘ cho‘qqisi qaysi?', 'Everest (Jomolungma)', 'Elbrus', 'Kilimanjaro', 'Monblan'],
    ['Afrikadagi eng uzun daryo qaysi?', 'Nil', 'Amazonka', 'Volga', 'Amudaryo'],
    ['Quyosh tizimidagi eng katta sayyora qaysi?', 'Yupiter', 'Yer', 'Mars', 'Venera'],
    ['Quyoshga eng yaqin sayyora qaysi?', 'Merkuriy', 'Venera', 'Yer', 'Neptun'],
    ['Qaysi sayyorani «Qizil sayyora» deyishadi?', 'Mars', 'Yupiter', 'Saturn', 'Venera'],
    ['Halqalari bilan mashhur sayyora qaysi?', 'Saturn', 'Mars', 'Merkuriy', 'Yer'],
    ['Biz yashaydigan Yer Quyoshdan nechanchi sayyora?', 'Uchinchi', 'Birinchi', 'Beshinchi', 'Ikkinchi'],
    ['Suv dengiz sathida necha gradusda qaynaydi?', '100 °C', '50 °C', '0 °C', '200 °C'],
    ['Suv necha gradusda muzlaydi?', '0 °C', '10 °C', '−50 °C', '100 °C'],
    ['Katta yoshdagi odamda odatda nechta tish bo‘ladi?', '32 ta', '28 ta', '20 ta', '40 ta'],
    ['Odam yuragi nechta kameradan iborat?', '4 ta', '2 ta', '3 ta', '6 ta'],
    ['O‘rgimchakning nechta oyog‘i bor?', '8 ta', '6 ta', '10 ta', '4 ta'],
    ['Hasharotlarning nechta oyog‘i bor?', '6 ta', '8 ta', '4 ta', '10 ta'],
    ['Eng tez yuguradigan quruqlik hayvoni qaysi?', 'Gepard', 'Sher', 'Ot', 'Quyon'],
    ['Dunyodagi eng katta hayvon qaysi?', 'Ko‘k kit', 'Fil', 'Jirafa', 'Akula'],
    ['Qaysi hayvonni «cho‘l kemasi» deyishadi?', 'Tuya', 'Ot', 'Eshak', 'Fil'],
    ['Qaysi qush ucha olmaydi, lekin juda tez yuguradi?', 'Tuyaqush', 'Burgut', 'Laylak', 'Kaptar'],
    ['Pingvinlar asosan qayerda yashaydi?', 'Antarktidada', 'Afrikada', 'Sahroda', 'Shimoliy qutbda'],
    ['Kamalakda nechta rang bor?', '7 ta', '5 ta', '6 ta', '9 ta'],
    ['Kabisa yilida necha kun bo‘ladi?', '366 kun', '365 kun', '360 kun', '364 kun'],
    ['Amudaryo va Sirdaryo qaysi dengizga quyilgan?', 'Orol dengiziga', 'Kaspiy dengiziga', 'Qora dengizga', 'O‘rta Yer dengiziga'],
    ['Samarqanddagi mashhur uchta madrasa joylashgan maydon qanday ataladi?', 'Registon', 'Chorsu', 'Labi Hovuz', 'Ichan qal’a'],
    ['Amir Temur qaysi shaharni o‘z davlatining poytaxti qilgan?', 'Samarqand', 'Buxoro', 'Toshkent', 'Xiva'],
    ['«Xamsa» dostonlarini kim yozgan?', 'Alisher Navoiy', 'Zahiriddin Bobur', 'Mirzo Ulug‘bek', 'Abdulla Qodiriy'],
    ['«Boburnoma» asarining muallifi kim?', 'Zahiriddin Muhammad Bobur', 'Alisher Navoiy', 'Amir Temur', 'Ibn Sino'],
    ['Mirzo Ulug‘bek qaysi fan bilan mashhur?', 'Astronomiya', 'Tibbiyot', 'She’riyat', 'Musiqa'],
    ['«O‘tkan kunlar» romanini kim yozgan?', 'Abdulla Qodiriy', 'Cho‘lpon', 'G‘afur G‘ulom', 'Oybek'],
    ['Ibn Sino qaysi soha bilan butun dunyoga mashhur?', 'Tibbiyot', 'Astronomiya', 'Me’morchilik', 'Savdo'],
    ['Al-Xorazmiy nomidan qaysi so‘z kelib chiqqan?', 'Algoritm', 'Alfavit', 'Alkimyo', 'Albom'],
    ['O‘zbekiston bayrog‘ida nechta yulduz bor?', '12 ta', '7 ta', '9 ta', '5 ta'],
    ['O‘zbekiston bayrog‘ida yulduzlar yonida qanday shakl bor?', 'Yangi oy (hilol)', 'Quyosh', 'Qush', 'Daraxt'],
    ['O‘zbekiston mustaqilligi qaysi yili e’lon qilingan?', '1991-yilda', '1989-yilda', '1995-yilda', '2000-yilda'],
    ['Dunyodagi eng katta materik qaysi?', 'Yevrosiyo', 'Afrika', 'Avstraliya', 'Antarktida'],
    ['Afrikadagi ulkan issiq cho‘l qanday ataladi?', 'Sahroi Kabir', 'Qizilqum', 'Gobi', 'Qoraqum'],
    ['Qizilqum cho‘li qaysi ikki daryo oralig‘ida joylashgan?', 'Amudaryo va Sirdaryo', 'Nil va Kongo', 'Volga va Don', 'Zarafshon va Chirchiq'],
    ['Qaysi metall xona haroratida suyuq holatda bo‘ladi?', 'Simob', 'Temir', 'Oltin', 'Mis'],
    ['O‘simliklar havodan qaysi gazni yutadi?', 'Karbonat angidridni', 'Kislorodni', 'Azotni', 'Vodorodni'],
    ['Nafas olganimizda tanamizga eng kerakli gaz qaysi?', 'Kislorod', 'Azot', 'Karbonat angidrid', 'Geliy'],
    ['Oyga birinchi bo‘lib qadam qo‘ygan odam kim?', 'Nil Armstrong', 'Yuriy Gagarin', 'Bazz Oldrin', 'Kolumb'],
    ['Koinotga birinchi bo‘lib uchgan odam kim?', 'Yuriy Gagarin', 'Nil Armstrong', 'Valentina Tereshkova', 'Laika'],
    ['Futbol jamoasidan maydonda bir vaqtda nechta o‘yinchi bo‘ladi?', '11 ta', '10 ta', '9 ta', '12 ta'],
    ['Shaxmat taxtasida nechta katak bor?', '64 ta', '36 ta', '81 ta', '100 ta'],
    ['Shaxmatda qaysi dona faqat diagonal bo‘yicha yuradi?', 'Fil', 'Ot', 'Ruh (to‘ra)', 'Piyoda'],
    ['Olimpiya halqalari nechta?', '5 ta', '4 ta', '6 ta', '7 ta'],
    ['Qadimiy piramidalar bilan mashhur davlat qaysi?', 'Misr', 'Yunoniston', 'Hindiston', 'Xitoy'],
    ['Eyfel minorasi qaysi shaharda joylashgan?', 'Parijda', 'Londonda', 'Rimda', 'Berlinda'],
    ['Kenguru qaysi materikda yashaydi?', 'Avstraliyada', 'Afrikada', 'Amerikada', 'Osiyoda'],
    ['Panda asosan nima yeydi?', 'Bambuk', 'Baliq', 'Go‘sht', 'Banan'],
    ['Odam tanasidagi eng katta a’zo qaysi?', 'Teri', 'Jigar', 'Yurak', 'O‘pka'],
    ['Katta yoshdagi odam skeletida taxminan nechta suyak bor?', '206 ta', '100 ta', '300 ta', '52 ta'],
    ['Qaysi vitamin quyosh nurida terida hosil bo‘ladi?', 'D vitamini', 'C vitamini', 'A vitamini', 'B vitamini'],
    ['Limon va apelsinda qaysi vitamin ko‘p?', 'C vitamini', 'D vitamini', 'K vitamini', 'E vitamini'],
    ['Tovush qayerda umuman tarqalmaydi?', 'Havosiz bo‘shliqda (koinotda)', 'Suvda', 'Havoda', 'Temirda'],
    ['Kompas mili qaysi tomonni ko‘rsatadi?', 'Shimolni', 'Janubni', 'Sharqni', 'G‘arbni'],
    ['Quyosh qaysi tomondan chiqadi?', 'Sharqdan', 'G‘arbdan', 'Shimoldan', 'Janubdan'],
    ['Shimoliy qutb atrofida qaysi yirik yirtqich yashaydi?', 'Oq ayiq', 'Pingvin', 'Sher', 'Kenguru'],
    ['Kanada bayrog‘ida qaysi daraxtning bargi tasvirlangan?', 'Zarang', 'Eman', 'Archa', 'Terak'],
    ['Oddiy o‘yin zarining qarama-qarshi tomonlaridagi sonlar yig‘indisi nechaga teng?', '7', '6', '8', '12'],
    ['Ikkita zar tashlansa, eng ko‘p chiqishi mumkin bo‘lgan yig‘indi qaysi?', '7', '12', '2', '10'],
    ['Labirintdan chiqishning qadimiy usuli: devorga qaysi qo‘lni tegizib yurish kerak?', 'Bir xil qo‘lni (masalan, doim o‘ng)', 'Navbat bilan ikkalasini', 'Hech qaysini', 'Faqat chapni, o‘ng mumkin emas'],
    ['Ko‘rshapalak qaysi hayvonlar guruhiga kiradi?', 'Sutemizuvchilarga', 'Qushlarga', 'Hasharotlarga', 'Sudralib yuruvchilarga'],
    ['Kit baliqmi?', 'Yo‘q, u sutemizuvchi', 'Ha, eng katta baliq', 'Yo‘q, u sudralib yuruvchi', 'Ha, lekin chuchuk suvda yashaydi'],
    ['Timsoh qaysi hayvonlar guruhiga kiradi?', 'Sudralib yuruvchilarga', 'Baliqlarga', 'Sutemizuvchilarga', 'Suvda hamda quruqlikda yashovchilarga'],
    ['Qaysi qush eng katta tuxum qo‘yadi?', 'Tuyaqush', 'Burgut', 'Tovus', 'Oqqush'],
    ['Lola qaysi faslda gullaydi?', 'Bahorda', 'Qishda', 'Kuzda', 'Yozning oxirida'],
    ['O‘zbekistonda «oq oltin» deb nimani aytishadi?', 'Paxtani', 'Kumushni', 'Qorni', 'Sutni'],
    ['Navro‘z bayrami qaysi kuni nishonlanadi?', '21-mart', '1-yanvar', '1-sentabr', '9-may'],
    ['Sumalak qaysi bayramda pishiriladi?', 'Navro‘zda', 'Yangi yilda', 'Mustaqillik kunida', 'Ustozlar kunida'],
    ['Non yopiladigan loy pech nima deb ataladi?', 'Tandir', 'Qozon', 'O‘choq', 'Mo‘ri'],
    ['Do‘ppi nima?', 'Milliy bosh kiyim', 'Milliy taom', 'Musiqa asbobi', 'Oyoq kiyim'],
    ['Atlas va adras nima?', 'Milliy matolar', 'Shirinliklar', 'Raqslar', 'Shaharlar'],
    ['Ichan qal’a qaysi shaharda joylashgan?', 'Xivada', 'Buxoroda', 'Samarqandda', 'Qo‘qonda'],
    ['Minorai Kalon qaysi shaharda?', 'Buxoroda', 'Xivada', 'Samarqandda', 'Termizda'],
    ['Oy Yer atrofini taxminan necha kunda aylanib chiqadi?', 'Taxminan 27 kunda', '7 kunda', '365 kunda', '1 kunda'],
    ['Yerga eng yaqin yulduz qaysi?', 'Quyosh', 'Qutb yulduzi', 'Sirius', 'Oy'],
    ['Qaysi hayvonning yuragi uchta?', 'Sakkizoyoq', 'Fil', 'Kit', 'Tuya'],
    ['Qaysi hayvon terisining rangini o‘zgartira oladi?', 'Xameleon', 'Zebra', 'Fil', 'Quyon'],
    ['Asalarilar bir-biriga gul qayerdaligini qanday bildiradi?', 'Maxsus raqs bilan', 'Qo‘shiq bilan', 'Hid qoldirib', 'Hech qanday'],
    ['Qaysi hayvon bolaligida suvda dumli itbaliq bo‘lib yashaydi?', 'Qurbaqa', 'Timsoh', 'Toshbaqa', 'Ilon'],
    ['Delfinlar qanday nafas oladi?', 'O‘pka bilan — suv yuziga chiqib', 'Jabra bilan', 'Teri orqali', 'Umuman nafas olmaydi'],
    ['Fil bolasi onasining qornida taxminan necha oy bo‘ladi?', '22 oy', '9 oy', '12 oy', '5 oy'],
    ['Qaysi o‘simlik cho‘lda suvni tanasida saqlaydi?', 'Kaktus', 'Nilufar', 'Tol', 'Qamish'],
    ['Inson qonini butun tanaga qaysi a’zo haydaydi?', 'Yurak', 'O‘pka', 'Jigar', 'Oshqozon'],
    ['Inson qaysi a’zosi bilan fikrlaydi?', 'Miya', 'Yurak', 'Jigar', 'Oshqozon'],
    ['Qaysi tomonda Quyosh botadi?', 'G‘arbda', 'Sharqda', 'Shimolda', 'Janubda'],
    ['Bir yilda nechta fasl bor?', '4 ta', '3 ta', '2 ta', '6 ta'],
    ['Eng uzun kun (yozgi quyosh turishi) qaysi oyda bo‘ladi?', 'Iyunda', 'Dekabrda', 'Martda', 'Sentabrda'],
    ['Qaysi qushlar qishda issiq o‘lkalarga uchib ketadi?', 'Laylak va qaldirg‘och', 'Chumchuq va qarg‘a', 'Kaptar va musicha', 'Tovuq va xo‘roz'],
    ['Termometr nimani o‘lchaydi?', 'Haroratni', 'Og‘irlikni', 'Vaqtni', 'Masofani'],
    ['Qaysi asbob bilan uzoqdagi yulduzlarni kuzatishadi?', 'Teleskop', 'Mikroskop', 'Kompas', 'Barometr'],
    ['Juda mayda narsalarni qaysi asbob bilan ko‘rishadi?', 'Mikroskop', 'Teleskop', 'Durbin', 'Kompas'],
    ['Daraxt yoshini qanday aniqlash mumkin?', 'Kesilgan tanasidagi halqalarni sanab', 'Barglarini sanab', 'Balandligini o‘lchab', 'Ildizini sanab'],
  ]),
  ...RB('Emoji topishmoq', [
    ['🌧️ + ☀️ = ?', 'Kamalak', 'Qor', 'Shamol', 'Momaqaldiroq'],
    ['🐝 + 🌸 = ?', 'Asal', 'Choy', 'Sut', 'Shakar'],
    ['🔥 + 💧 = ?', 'Bug‘', 'Muz', 'Tutun', 'Qum'],
    ['🌱 + 💧 + ☀️ = ?', 'O‘simlik', 'Tosh', 'Qum', 'Muz'],
    ['❄️ + ⛄ = ?', 'Qish', 'Yoz', 'Bahor', 'Kuz'],
    ['🐄 + 🥛 = ?', 'Sut', 'Suv', 'Choy', 'Sharbat'],
    ['🌾 + 🔥 = ?', 'Non', 'Un', 'Palov', 'Sho‘rva'],
    ['🍇 + ☀️ = ?', 'Mayiz', 'Sharbat', 'Murabbo', 'Uzum'],
    ['🥚 + 🐣 = ?', 'Jo‘ja', 'Tovuq', 'Xo‘roz', 'O‘rdak'],
    ['👁️ + 👃 + 👄 = ?', 'Yuz', 'Qo‘l', 'Oyoq', 'Bosh kiyim'],
    ['🕐 + 📅 = ?', 'Vaqt', 'Pul', 'Yo‘l', 'Kitob'],
    ['⚽ + 🥅 = ?', 'Gol', 'Shaxmat', 'Tennis', 'Suzish'],
    ['🎹 + 🎤 = ?', 'Musiqa', 'Rasm', 'Kitob', 'Sport'],
    ['🌍 + 🚀 = ?', 'Koinot', 'Dengiz', 'Tog‘', 'Cho‘l'],
    ['🐟 + 🎣 = ?', 'Baliq ovi', 'Dehqonchilik', 'Savdo', 'Sayohat'],
    ['🍵 + 🍬 = ?', 'Choy', 'Sut', 'Qahva', 'Sharbat'],
    ['🚌 + 🎒 = ?', 'Maktab', 'Bozor', 'Kasalxona', 'Stadion'],
    ['🏔️ + ❄️ = ?', 'Muzlik', 'Cho‘l', 'Daryo', 'Bog‘'],
    ['🐑 + ✂️ = ?', 'Jun', 'Teri', 'Go‘sht', 'Sut'],
    ['🐛 + ⏳ = ?', 'Kapalak', 'Chivin', 'Ari', 'Chumoli'],
    ['🧀 + 🍅 + 🍞 = ?', 'Pitsa', 'Palov', 'Manti', 'Sho‘rva'],
    ['🍋 + 💧 + 🧊 = ?', 'Limonad', 'Qaymoq', 'Choy', 'Sut'],
    ['🎂 + 🕯️ = ?', 'Tug‘ilgan kun', 'Navro‘z', 'To‘y', 'Maktab'],
    ['👑 + 🏰 = ?', 'Shoh', 'Dehqon', 'Ovchi', 'Baliqchi'],
    ['📚 + ✏️ = ?', 'Dars', 'O‘yin', 'Dam olish', 'Sayohat'],
    ['🌙 + ⭐ = ?', 'Tun', 'Kun', 'Tong', 'Peshin'],
    ['🚗 + ⛽ = ?', 'Benzin', 'Suv', 'Shamol', 'Yog‘och'],
    ['🦷 + 🪥 = ?', 'Tish tozalash', 'Soch olish', 'Kir yuvish', 'Ovqat pishirish'],
    ['🍞 + 🧈 = ?', 'Nonushta', 'Kechki ovqat', 'Shirinlik', 'Ichimlik'],
    ['🌽 + 🔥 = ?', 'Popkorn', 'Un', 'Sho‘rva', 'Salat'],
  ]),
  ...RB('Maqol', [
    ['Maqolni davom ettir: «Ilm olish — igna bilan …»', 'quduq qazish', 'tog‘ ko‘chirish', 'suv tashish', 'non yopish'],
    ['Maqolni davom ettir: «Mehnat, mehnatning tagi — …»', 'rohat', 'oltin', 'baxt', 'non'],
    ['Maqolni davom ettir: «Bir yigitga yetmish hunar …»', 'oz', 'ko‘p', 'kerak emas', 'yetadi'],
    ['Maqolni davom ettir: «Tomchi-tomchi …»', 'ko‘l bo‘lur', 'daryo oqar', 'yer qurir', 'tosh yorilar'],
    ['Maqolni davom ettir: «Sabr tagi — …»', 'sariq oltin', 'qora tosh', 'shirin non', 'baland tog‘'],
    ['Maqolni davom ettir: «Do‘st boshga ish tushganda …»', 'bilinar', 'qochar', 'kular', 'uxlar'],
    ['Maqolni davom ettir: «Yaxshi gap bilan ilon …»', 'inidan chiqar', 'qochib ketar', 'uxlab qolar', 'och qolar'],
    ['Maqolni davom ettir: «Tilga e’tibor — …»', 'elga e’tibor', 'dilga e’tibor', 'ishga e’tibor', 'so‘zga e’tibor'],
    ['Maqolni davom ettir: «Ko‘z — qo‘rqoq, qo‘l — …»', 'botir', 'dangasa', 'kuchsiz', 'sekin'],
    ['Maqolni davom ettir: «Bugungi ishni …»', 'ertaga qo‘yma', 'bugun tugat', 'kechaga qoldir', 'boshqaga ber'],
    ['Maqolni davom ettir: «Yetti o‘lchab, …»', 'bir kes', 'yetti kes', 'o‘n kes', 'kesma'],
    ['Maqolni davom ettir: «Birlashgan o‘zar, …»', 'birlashmagan to‘zar', 'ajralgan yetar', 'yolg‘iz o‘tar', 'ko‘pchilik qolar'],
    ['Maqolni davom ettir: «Otang bolasi bo‘lma, …»', 'odam bolasi bo‘l', 'onang bolasi bo‘l', 'el bolasi bo‘l', 'o‘z bolang bo‘l'],
    ['Maqolni davom ettir: «Do‘st achitib gapirar, dushman …»', 'kuldirib', 'yig‘latib', 'qo‘rqitib', 'aldab'],
    ['Maqolni davom ettir: «Oz-oz o‘rganib …»', 'dono bo‘lur', 'boy bo‘lur', 'katta bo‘lur', 'charchab qolur'],
    ['Maqolni davom ettir: «Qush uyasida …»', 'ko‘rganini qiladi', 'uxlaganini qiladi', 'yeganini qiladi', 'eshitganini qiladi'],
    ['Maqolni davom ettir: «Ilmli ming yashar, …»', 'ilmsiz bir yashar', 'ilmsiz yuz yashar', 'boy ko‘p yashar', 'dangasa oz yashar'],
    ['Maqolni davom ettir: «Ona yurting — …»', 'oltin beshiging', 'katta uying', 'baland tog‘ing', 'yashil bog‘ing'],
    ['Maqolni davom ettir: «Hunarli kishi …»', 'xor bo‘lmas', 'boy bo‘lmas', 'charchamas', 'uxlamas'],
    ['Maqolni davom ettir: «Qo‘rqqanga qo‘sh …»', 'ko‘rinar', 'yetmas', 'qochar', 'tushar'],
    ['Maqolni davom ettir: «Shamol bo‘lmasa, daraxtning uchi …»', 'qimirlamas', 'sinmas', 'o‘smas', 'gullamas'],
    ['Maqolni davom ettir: «Yaxshidan bog‘ qolar, yomondan …»', 'dog‘ qolar', 'tog‘ qolar', 'yog‘ qolar', 'hech narsa qolmas'],
    ['Maqolni davom ettir: «O‘ylab gapirgan …»', 'og‘rimas', 'yutqazmas', 'charchamas', 'adashmas'],
    ['Maqolni davom ettir: «Ko‘pdan quyon …»', 'qochib qutulmas', 'qo‘rqmas', 'yashirinmas', 'chiqib ketar'],
    ['Maqolni davom ettir: «Vatanni sevmoq …»', 'imondandir', 'oson emas', 'har kimga xos', 'yaxshi odat'],
    ['Maqolni davom ettir: «Ishlagan — …»', 'tishlaydi', 'charchaydi', 'uxlaydi', 'kuladi'],
    ['Maqolni davom ettir: «Yolg‘onchining uyi yonibdi, …»', 'hech kim ishonmabdi', 'hamma yordam beribdi', 'u qochib ketibdi', 'qo‘shnisi kulibdi'],
  ]),
];

/* ---- Savol generatorlari: har safar yangi son va so‘zlar bilan masala tuziladi ---- */
const ri = (a, b) => a + ((Math.random() * (b - a + 1)) | 0);
const nf = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pickN = (arr, n) => shuffle(arr.slice()).slice(0, n);
// To‘g‘ri javob + 3 ta noto‘g‘ri (takrorlanmaydi); sonlar uchun yetishmasa — qo‘shni sonlar.
function choices(right, wrongs, fmt = String) {
  const out = [fmt(right)], seen = new Set(out);
  const add = (w) => { const s = fmt(w); if (out.length < 4 && !seen.has(s)) { seen.add(s); out.push(s); } };
  for (const w of shuffle(wrongs.slice())) if (typeof w !== 'number' || (w >= 0 && isFinite(w))) add(w);
  for (let k = 1; out.length < 4 && typeof right === 'number' && k < 50; k++) { add(right + k); if (right - k >= 0) add(right - k); }
  return out;
}
const DAYS = ['dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba', 'yakshanba'];
const MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr'];
const hhmm = (m) => { m = ((m % 1440) + 1440) % 1440; return `${(m / 60) | 0}:${String(m % 60).padStart(2, '0')}`; };
const roman = (n) => { let s = ''; for (const [v, r] of [[100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]) while (n >= v) { s += r; n -= v; } return s; };

const WCATS = {
  hayvon: { one: 'yovvoyi hayvon', list: ['sher', 'yo‘lbars', 'fil', 'zebra', 'jirafa', 'tulki', 'bo‘ri', 'ayiq', 'kiyik', 'maymun', 'karkidon', 'begemot'] },
  qush: { one: 'qush', list: ['burgut', 'qarg‘a', 'laylak', 'kaptar', 'chumchuq', 'to‘tiqush', 'boyqush', 'tovus', 'qaldirg‘och', 'bulbul', 'oqqush'] },
  meva: { one: 'meva', list: ['olma', 'nok', 'o‘rik', 'shaftoli', 'anor', 'uzum', 'behi', 'gilos', 'banan', 'limon', 'xurmo', 'anjir'] },
  sabzavot: { one: 'sabzavot', list: ['sabzi', 'piyoz', 'kartoshka', 'karam', 'bodring', 'pomidor', 'lavlagi', 'sholg‘om', 'baqlajon', 'turp'] },
  rang: { one: 'rang', list: ['qizil', 'yashil', 'sariq', 'ko‘k', 'oq', 'qora', 'jigarrang', 'pushti', 'binafsha', 'kulrang'] },
  kasb: { one: 'kasb', list: ['shifokor', 'o‘qituvchi', 'haydovchi', 'oshpaz', 'duradgor', 'quruvchi', 'uchuvchi', 'dehqon', 'sotuvchi', 'muhandis'] },
  transport: { one: 'transport vositasi', list: ['avtobus', 'poyezd', 'samolyot', 'velosiped', 'kema', 'tramvay', 'mototsikl', 'metro', 'vertolyot', 'taksi'] },
  cholgu: { one: 'cholg‘u asbobi', list: ['dutor', 'doira', 'nay', 'rubob', 'tanbur', 'g‘ijjak', 'karnay', 'surnay', 'pianino', 'skripka'] },
  shahar: { one: 'O‘zbekiston shahri', list: ['Toshkent', 'Samarqand', 'Buxoro', 'Xiva', 'Namangan', 'Andijon', 'Farg‘ona', 'Qarshi', 'Termiz', 'Navoiy', 'Nukus', 'Jizzax'] },
  davlat: { one: 'davlat', list: ['Fransiya', 'Germaniya', 'Yaponiya', 'Misr', 'Braziliya', 'Kanada', 'Hindiston', 'Italiya', 'Turkiya', 'Xitoy', 'Ispaniya'] },
  mebel: { one: 'mebel', list: ['stol', 'stul', 'shkaf', 'divan', 'karavot', 'kreslo', 'javon'] },
  idish: { one: 'idish', list: ['piyola', 'choynak', 'qozon', 'kosa', 'lagan', 'tovoq', 'kastryulka'] },
  kiyim: { one: 'kiyim', list: ['ko‘ylak', 'shim', 'do‘ppi', 'to‘n', 'kurtka', 'sharf', 'paypoq', 'kamzul'] },
  sport: { one: 'sport turi', list: ['futbol', 'kurash', 'boks', 'tennis', 'shaxmat', 'basketbol', 'suzish', 'voleybol'] },
  tana: { one: 'tana a’zosi', list: ['qo‘l', 'oyoq', 'bosh', 'ko‘z', 'quloq', 'burun', 'yelka', 'tizza'] },
};
const WCAT_KEYS = Object.keys(WCATS);
const clash = (a, b) => (a === 'hayvon' && b === 'qush') || (a === 'qush' && b === 'hayvon');
const ANALOG = [
  ['Baliq', 'suv', 'qush', 'osmon'], ['Sigir', 'buzoq', 'ot', 'toy'], ['Qo‘y', 'qo‘zi', 'echki', 'uloq'], ['It', 'kuchuk', 'tovuq', 'jo‘ja'],
  ['Tuya', 'bo‘taloq', 'eshak', 'xo‘tik'], ['Qo‘l', 'qo‘lqop', 'oyoq', 'paypoq'], ['Ko‘z', 'ko‘rish', 'quloq', 'eshitish'], ['Kun', 'tun', 'yoz', 'qish'],
  ['Qalam', 'yozish', 'qaychi', 'kesish'], ['Shifokor', 'kasalxona', 'o‘qituvchi', 'maktab'], ['Asalari', 'asal', 'sigir', 'sut'], ['Qush', 'uya', 'ayiq', 'in'],
  ['Mushuk', 'miyovlaydi', 'it', 'akillaydi'], ['Qor', 'oq', 'ko‘mir', 'qora'], ['Limon', 'nordon', 'asal', 'shirin'], ['Muz', 'qattiq', 'suv', 'suyuq'],
  ['Toshkent', 'O‘zbekiston', 'Parij', 'Fransiya'], ['Tokio', 'Yaponiya', 'Qohira', 'Misr'], ['Futbol', 'to‘p', 'tennis', 'raketka'], ['Rassom', 'mo‘yqalam', 'oshpaz', 'qozon'],
  ['Quyosh', 'kunduz', 'oy', 'tun'], ['G‘ildirak', 'mashina', 'qanot', 'samolyot'], ['Tosh', 'og‘ir', 'par', 'yengil'], ['Kitob', 'o‘qish', 'qo‘shiq', 'kuylash'],
  ['Dushanba', 'seshanba', 'juma', 'shanba'], ['Bahor', 'yoz', 'kuz', 'qish'], ['Sher', 'yirtqich', 'quyon', 'o‘txo‘r'], ['Dengiz', 'kema', 'osmon', 'samolyot'],
];
const ANTON = [['issiq', 'sovuq'], ['katta', 'kichik'], ['baland', 'past'], ['uzun', 'qisqa'], ['tez', 'sekin'], ['yorug‘', 'qorong‘i'], ['keng', 'tor'], ['og‘ir', 'yengil'],
  ['yaxshi', 'yomon'], ['quvnoq', 'g‘amgin'], ['boy', 'kambag‘al'], ['yangi', 'eski'], ['ochiq', 'yopiq'], ['to‘la', 'bo‘sh'], ['qattiq', 'yumshoq'], ['shirin', 'achchiq'],
  ['kuchli', 'kuchsiz'], ['erta', 'kech'], ['o‘ng', 'chap'], ['do‘st', 'dushman'], ['yosh', 'qari'], ['qalin', 'yupqa'], ['savol', 'javob'], ['quruq', 'ho‘l'],
  ['toza', 'iflos'], ['mehnatkash', 'dangasa'], ['jasur', 'qo‘rqoq'], ['chiroyli', 'xunuk'], ['kirish', 'chiqish'], ['yaqin', 'uzoq'], ['ko‘p', 'oz'], ['semiz', 'oriq']];
const CAPS = [['O‘zbekiston', 'Toshkent'], ['Qozog‘iston', 'Astana'], ['Qirg‘iziston', 'Bishkek'], ['Tojikiston', 'Dushanbe'], ['Turkmaniston', 'Ashxobod'],
  ['Rossiya', 'Moskva'], ['Turkiya', 'Anqara'], ['Fransiya', 'Parij'], ['Germaniya', 'Berlin'], ['Italiya', 'Rim'], ['Ispaniya', 'Madrid'], ['Buyuk Britaniya', 'London'],
  ['Yaponiya', 'Tokio'], ['Xitoy', 'Pekin'], ['Hindiston', 'Yangi Dehli'], ['Misr', 'Qohira'], ['AQSH', 'Vashington'], ['Kanada', 'Ottava'], ['Avstraliya', 'Kanberra'],
  ['Janubiy Koreya', 'Seul'], ['Eron', 'Tehron'], ['Afg‘oniston', 'Kobul'], ['Pokiston', 'Islomobod'], ['Saudiya Arabistoni', 'Ar-Riyod'], ['Ozarbayjon', 'Boku'],
  ['Gruziya', 'Tbilisi'], ['Armaniston', 'Yerevan'], ['Ukraina', 'Kiyev'], ['Polsha', 'Varshava'], ['Gretsiya', 'Afina'], ['Portugaliya', 'Lissabon'],
  ['Niderlandiya', 'Amsterdam'], ['Shvetsiya', 'Stokgolm'], ['Norvegiya', 'Oslo'], ['Finlandiya', 'Xelsinki'], ['Avstriya', 'Vena'], ['Vengriya', 'Budapesht'],
  ['Chexiya', 'Praga'], ['Mo‘g‘uliston', 'Ulan-Bator'], ['Tailand', 'Bangkok'], ['Meksika', 'Mexiko'], ['Kuba', 'Gavana'], ['Keniya', 'Nayrobi'], ['Argentina', 'Buenos-Ayres']];
const YOUNG = [['Sigir', 'buzoq'], ['Ot', 'toy'], ['Qo‘y', 'qo‘zi'], ['Echki', 'uloq'], ['It', 'kuchuk'], ['Tovuq', 'jo‘ja'], ['Tuya', 'bo‘taloq'], ['Eshak', 'xo‘tik']];
const VOICES = [['kishnaydi', 'ot'], ['akillaydi', 'it'], ['miyovlaydi', 'mushuk'], ['vaqillaydi', 'qurbaqa'], ['uvillaydi', 'bo‘ri'], ['vishillaydi', 'ilon'], ['«qu-qu-qu» deb qichqiradi', 'xo‘roz'], ['bo‘kiradi', 'sher']];
const LEGS = [['tovuq', 2], ['o‘rdak', 2], ['g‘oz', 2], ['qo‘y', 4], ['echki', 4], ['sigir', 4], ['it', 4], ['mushuk', 4], ['chumoli', 6], ['o‘rgimchak', 8]];
const GOODS = [['non', 4000], ['sut', 9000], ['daftar', 2500], ['ruchka', 1500], ['qalam', 1000], ['muzqaymoq', 5000], ['olma (1 kg)', 12000], ['choy', 6000], ['sharbat', 7000], ['shokolad', 8000]];
const SHAPES = [['uchburchak', 3], ['kvadrat', 4], ['beshburchak', 5], ['oltiburchak', 6]];

const QGEN = [
  // 1. qo‘shish / ayirish
  (L) => { const m = [20, 80, 400][L], a = ri(5, m), b = ri(2, m), plus = Math.random() < 0.5 || a <= b, r = plus ? a + b : a - b;
    return { c: 'Hisob', q: `${nf(a)} ${plus ? '+' : '−'} ${nf(b)} = ?`, a: choices(r, [r + 10, r - 10, r + 1, r - 1, r + 2, r + 100], nf) }; },
  // 2. ko‘paytirish
  (L) => { const a = ri(2, [5, 9, 12][L]), b = ri(2, [5, 9, 15][L]), r = a * b;
    return { c: 'Hisob', q: `${a} × ${b} = ?`, a: choices(r, [r + a, r - a, r + b, r - b, r + 1, r + 10]) }; },
  // 3. bo‘lish
  (L) => { const b = ri(2, [5, 9, 12][L]), r = ri(2, [6, 10, 15][L]), a = b * r;
    return { c: 'Hisob', q: `${a} ÷ ${b} = ?`, a: choices(r, [r + 1, r - 1, r + 2, b, r * 2]) }; },
  // 4. amallar tartibi
  (L) => { const a = ri(2, 12), b = ri(2, 9), c = ri(2, 9), r = a + b * c;
    return { c: 'Hisob', q: `${a} + ${b} × ${c} = ?`, a: choices(r, [(a + b) * c, r + 1, r - c, a * b + c]) }; },
  // 5. noma’lum son
  (L) => { const m = [20, 60, 150][L], t = ri(0, 2);
    if (t === 0) { const a = ri(3, m), x = ri(2, m); return { c: 'Hisob', q: `${a} + ? = ${a + x}`, a: choices(x, [x + 1, x - 1, a + x, x + 10]) }; }
    if (t === 1) { const b = ri(2, m), r = ri(2, m), x = b + r; return { c: 'Hisob', q: `? − ${b} = ${r}`, a: choices(x, [r - b, x + 1, x - 1, x + 10].filter((v) => v > 0)) }; }
    const a = ri(2, 9), x = ri(2, [6, 9, 12][L]); return { c: 'Hisob', q: `${a} × ? = ${a * x}`, a: choices(x, [x + 1, x - 1, a, x + 2]) }; },
  // 6. arifmetik ketma-ketlik
  (L) => { const s = ri(1, 30), d = ri(2, [5, 9, 15][L]) * (L > 1 && Math.random() < 0.3 ? -1 : 1), seq = [0, 1, 2, 3].map((k) => s + d * k), r = s + d * 4;
    return { c: 'Ketma-ketlik', q: `${seq.join(', ')}, … Keyingi son qaysi?`, a: choices(r, [r + d, r - 1, r + 1, r + 2]) }; },
  // 7. geometrik ketma-ketlik
  (L) => { const s = ri(1, 5), k = ri(2, L ? 3 : 2), seq = [0, 1, 2, 3].map((j) => s * k ** j), r = s * k ** 4;
    return { c: 'Ketma-ketlik', q: `${seq.map(nf).join(', ')}, … Keyingi son qaysi?`, a: choices(r, [seq[3] + (seq[3] - seq[2]), r + s, r - s, r * 2], nf) }; },
  // 8. o‘sib boruvchi qadamlar
  (L) => { const s = ri(1, 10), st = ri(1, 3), seq = [s]; for (let k = 0; k < 4; k++) seq.push(seq[k] + st + k); const r = seq[4] + st + 4;
    return { c: 'Ketma-ketlik', q: `${seq.join(', ')}, … Keyingi son qaysi?`, a: choices(r, [r - 1, r + 1, seq[4] + st + 3, r + 2]) }; },
  // 9. navbatma-navbat qadamlar
  (L) => { const s = ri(5, 20), up = ri(3, 7), dn = ri(1, up - 1), seq = [s]; for (let k = 0; k < 5; k++) seq.push(seq[k] + (k % 2 ? -dn : up)); const r = seq[5] + up;
    return { c: 'Ketma-ketlik', q: `${seq.join(', ')}, … Keyingi son qaysi?`, a: choices(r, [seq[5] - dn, r + 1, r - 1, r + dn]) }; },
  // 10. kvadratlar
  () => { const s = ri(1, 6), seq = [0, 1, 2, 3].map((k) => (s + k) ** 2), r = (s + 4) ** 2;
    return { c: 'Ketma-ketlik', q: `${seq.join(', ')}, … Keyingi son qaysi?`, a: choices(r, [r - 1, r + 1, seq[3] + (seq[3] - seq[2]), r + 2]) }; },
  // 11. bo‘linmaydigan son
  (L) => { const k = pickRand([3, 4, 5, 6, 7, 9]), ms = pickN(Array.from({ length: 12 }, (_, j) => k * (j + 2)), 3); let x; do x = ri(k * 2, k * 13); while (x % k === 0);
    return { c: 'Hisob', q: `Qaysi son ${k} ga qoldiqsiz bo‘linmaydi?`, a: [String(x), ...ms.map(String)] }; },
  // 12. eng katta son (xona qiymati)
  (L) => { const d = pickN([1, 2, 3, 4, 5, 6, 7, 8, 9], L ? 4 : 3), nums = new Set(); while (nums.size < 4) nums.add(+shuffle(d.slice()).join('')); const arr = Array.from(nums), mx = Math.max(...arr);
    return { c: 'Hisob', q: 'Qaysi son eng katta?', a: [nf(mx), ...arr.filter((v) => v !== mx).map(nf)] }; },
  // 13. kasrlar
  () => { const ds = pickN([2, 3, 4, 5, 6, 8, 10], 4), mn = Math.min(...ds), big = Math.random() < 0.5;
    const pickD = big ? mn : Math.max(...ds);
    return { c: 'Hisob', q: `Qaysi kasr eng ${big ? 'katta' : 'kichik'}?`, a: [`1/${pickD}`, ...ds.filter((d) => d !== pickD).map((d) => `1/${d}`)] }; },
  // 14. foiz
  () => { const p = pickRand([10, 20, 25, 50, 75]), base = pickRand([40, 60, 80, 100, 120, 200, 300, 400, 500, 800, 1000].filter((b) => (b * p) % 100 === 0)), r = (base * p) / 100;
    return { c: 'Hisob', q: `${nf(base)} ning ${p} foizi nechaga teng?`, a: choices(r, [r * 2, r / 2, base - r, r + 10].filter((v) => Number.isInteger(v)), nf) }; },
  // 15. qaytim
  () => { const [it, pr] = pickRand(GOODS), n = ri(1, 4), bill = [10000, 20000, 50000, 100000].find((b) => b > pr * n), r = bill - pr * n;
    return { c: 'Pul', q: `${cap(it)} ${nf(pr)} so‘m turadi. ${n} ta olib, ${nf(bill)} so‘m berding. Qancha qaytim olasan?`, a: choices(r, [r + pr, r - pr, r + 1000, r - 500, bill - pr], (v) => nf(v) + ' so‘m') }; },
  // 16. narx
  () => { const [it, pr] = pickRand(GOODS), n = ri(2, 9), r = pr * n;
    return { c: 'Pul', q: `1 ta ${it} ${nf(pr)} so‘m. ${n} ta ${it} necha so‘m bo‘ladi?`, a: choices(r, [r + pr, r - pr, pr * (n + 2), r + 1000], (v) => nf(v) + ' so‘m') }; },
  // 17. soat qo‘shish
  (L) => { const st = ri(6, 20) * 60 + ri(0, 11) * 5, add = ri(2, [8, 15, 30][L]) * 5, r = st + add;
    return { c: 'Vaqt', q: `Soat ${hhmm(st)}. ${add} daqiqadan keyin soat necha bo‘ladi?`, a: choices(hhmm(r), [hhmm(r + 10), hhmm(r - 10), hhmm(r + 60), hhmm(st + add - 40)]) }; },
  // 18. davomiylik
  () => { const st = ri(7, 17) * 60 + ri(0, 5) * 10, len = ri(3, 14) * 5, en = st + len;
    return { c: 'Vaqt', q: `Dars ${hhmm(st)} da boshlanib, ${hhmm(en)} da tugadi. Dars necha daqiqa davom etdi?`, a: choices(len, [len + 10, len - 5, len + 5, 60 - len].filter((v) => v > 0), (v) => v + ' daqiqa') }; },
  // 19. hafta kunlari
  (L) => { const d0 = ri(0, 6), n = ri(2, [9, 20, 40][L]), back = Math.random() < 0.3, r = ((d0 + (back ? -n : n)) % 7 + 7) % 7;
    return { c: 'Vaqt', q: `Bugun ${DAYS[d0]}. ${n} kun${back ? ' oldin' : 'dan keyin'} qaysi kun ${back ? 'bo‘lgan' : 'bo‘ladi'}?`, a: choices(cap(DAYS[r]), [1, 2, 6, 5].map((k) => cap(DAYS[(r + k) % 7]))) }; },
  // 20. oylar
  () => { const m0 = ri(0, 11), n = ri(2, 10), r = (m0 + n) % 12;
    return { c: 'Vaqt', q: `${cap(MONTHS[m0])} oyidan ${n} oy keyin qaysi oy keladi?`, a: choices(cap(MONTHS[r]), [1, 11, 2, 10].map((k) => cap(MONTHS[(r + k) % 12]))) }; },
  // 21. yosh
  () => { const me = ri(7, 14), d = ri(2, 8), y = ri(2, 9), r = me + d + y;
    return { c: 'Yosh', q: `Men ${me} yoshdaman, akam mendan ${d} yosh katta. ${y} yildan keyin akam necha yoshda bo‘ladi?`, a: choices(r, [me + y, me + d, r - d, r + 1]) }; },
  // 22. yosh — necha marta katta
  () => { const D = ri(4, 10), x = ri(2, 8), M = 3 * D + 2 * x;
    return { c: 'Yosh', q: `Ona ${M} yoshda, qizi ${D} yoshda. Necha yildan keyin ona qizidan roppa-rosa 3 marta katta bo‘ladi?`, a: choices(x, [x + 1, x - 1, x + 2, M - 3 * D]) }; },
  // 23. tezlik, vaqt, masofa
  () => { const [who, v] = pickRand([['Piyoda odam', ri(4, 6)], ['Velosipedchi', ri(12, 20)], ['Avtobus', ri(4, 7) * 10], ['Poyezd', ri(6, 12) * 10]]), t = ri(2, 6), s = v * t, k = ri(0, 1);
    if (k) return { c: 'Masala', q: `${who} soatiga ${v} km tezlikda ${t} soat yurdi. U qancha masofa bosib o‘tdi?`, a: choices(s, [s + v, s - v, v + t, s * 2], (x) => nf(x) + ' km') };
    return { c: 'Masala', q: `${who} soatiga ${v} km tezlikda yurib, ${nf(s)} km yo‘l bosdi. Yo‘lda necha soat yurdi?`, a: choices(t, [t + 1, t - 1, t + 2, v].filter((x) => x > 0), (x) => x + ' soat') }; },
  // 24. oyoqlar
  () => { const [a, b] = pickN(LEGS, 2), na = ri(2, 7), nb = ri(2, 6), r = a[1] * na + b[1] * nb;
    return { c: 'Masala', q: `Hovlida ${na} ta ${a[0]} va ${nb} ta ${b[0]} bor. Ularning jami nechta oyog‘i bor?`, a: choices(r, [r + 2, r - 2, (na + nb) * 4, (na + nb) * 2, r + 4]) }; },
  // 25. birliklar
  () => { const k = ri(0, 7);
    if (k === 0) { const h = ri(2, 9); return { c: 'O‘lchov', q: `${h} soat necha daqiqa?`, a: choices(h * 60, [h * 100, h * 60 + 30, h * 30, h * 6], (v) => nf(v) + ' daqiqa') }; }
    if (k === 1) { const m = ri(2, 9); return { c: 'O‘lchov', q: `${m} daqiqa necha soniya?`, a: choices(m * 60, [m * 100, m * 10, m * 30, m * 60 + 60], (v) => nf(v) + ' soniya') }; }
    if (k === 2) { const kg = ri(2, 9) + (Math.random() < 0.5 ? 0.5 : 0); return { c: 'O‘lchov', q: `${String(kg).replace('.', ',')} kg necha gramm?`, a: choices(kg * 1000, [kg * 100, kg * 10000, kg * 1000 + 500, kg * 500], (v) => nf(v) + ' g') }; }
    if (k === 3) { const m = ri(2, 9) * 500; return { c: 'O‘lchov', q: `${nf(m)} metr necha kilometr?`, a: choices(m / 1000, [m / 100, m / 10000, m / 1000 + 1, m / 500], (v) => String(v).replace('.', ',') + ' km') }; }
    if (k === 4) { const d = ri(2, 6); return { c: 'O‘lchov', q: `${d} sutka necha soat?`, a: choices(d * 24, [d * 12, d * 60, d * 20, d * 24 + 12], (v) => v + ' soat') }; }
    if (k === 5) { const w = ri(2, 9); return { c: 'O‘lchov', q: `${w} hafta necha kun?`, a: choices(w * 7, [w * 5, w * 10, w * 7 + 1, w * 6], (v) => v + ' kun') }; }
    if (k === 6) { const l = ri(2, 8); return { c: 'O‘lchov', q: `${l} litr necha millilitr?`, a: choices(l * 1000, [l * 100, l * 10, l * 10000, l * 500], (v) => nf(v) + ' ml') }; }
    const m = ri(2, 9); return { c: 'O‘lchov', q: `${m} metr necha santimetr?`, a: choices(m * 100, [m * 10, m * 1000, m * 100 + 50, m * 50], (v) => nf(v) + ' sm') }; },
  // 26. rim raqamlari
  (L) => { const n = ri(4, [20, 50, 100][L]), toR = Math.random() < 0.5, ws = [n + 1, n - 1, n + 4, n - 4, n + 10, n + 2].filter((v) => v > 0 && v !== n);
    if (toR) return { c: 'Rim raqamlari', q: `${roman(n)} — bu qaysi son?`, a: choices(n, ws) };
    return { c: 'Rim raqamlari', q: `${n} soni rim raqamlarida qanday yoziladi?`, a: choices(roman(n), ws.map(roman)) }; },
  // 27. ustunlar (chekka holat)
  () => { const d = pickRand([2, 3, 4, 5, 10]), n = ri(3, 12), len = d * n;
    return { c: 'Masala', q: `Uzunligi ${len} metr bo‘lgan to‘g‘ri yo‘lak bo‘ylab har ${d} metrda daraxt ekildi — boshida ham, oxirida ham. Jami nechta daraxt?`, a: choices(n + 1, [n, n - 1, n + 2, len]) }; },
  // 28. qo‘l siqish
  () => { const n = ri(3, 10), r = (n * (n - 1)) / 2;
    return { c: 'Masala', q: `${n} do‘st uchrashib, har biri boshqalarning har biri bilan bir martadan qo‘l berib ko‘rishdi. Jami nechta qo‘l siqish bo‘ldi?`, a: choices(r, [n * (n - 1), n * n, r + n, r - 1]) }; },
  // 29. sahifalar
  () => { const a = ri(2, 60), b = a + ri(5, 40), r = b - a + 1;
    return { c: 'Masala', q: `Kitobning ${a}-betidan ${b}-betigacha (ikkalasi ham kiradi) o‘qidim. Necha bet o‘qidim?`, a: choices(r, [r - 1, r + 1, r - 2, b]) }; },
  // 30. teng bo‘lish
  () => { const k = ri(2, 9), each = ri(3, 12), tot = k * each, it = pickRand(['yong‘oq', 'konfet', 'olma', 'qalam', 'o‘rik']);
    return { c: 'Masala', q: `${tot} ta ${it}ni ${k} bolaga teng bo‘lishdi. Har biriga nechtadan tegdi?`, a: choices(each, [each + 1, each - 1, k, each + 2]) }; },
  // 31. yarmi / uchdan biri
  () => { const k = pickRand([2, 3, 4]), part = ri(5, 40), r = part * k, nm = { 2: 'yarmi', 3: 'uchdan biri', 4: 'to‘rtdan biri' }[k];
    return { c: 'Hisob', q: `Bir sonning ${nm} ${part} ga teng. Bu son nechaga teng?`, a: choices(r, [part + k, r + part, part, r - 1]) }; },
  // 32. raqamlar yig‘indisi
  (L) => { const n = ri([100, 1000, 10000][L], [999, 9999, 99999][L]), r = String(n).split('').reduce((s, d) => s + +d, 0);
    return { c: 'Hisob', q: `${nf(n)} sonining raqamlari yig‘indisi nechaga teng?`, a: choices(r, [r + 1, r - 1, r + 2, r - 3]) }; },
  // 33. raqamlardan eng katta son
  (L) => { const d = pickN([0, 1, 2, 3, 4, 5, 6, 7, 8, 9], L ? 4 : 3), big = Math.random() < 0.6;
    const sorted = d.slice().sort((a, b) => (big ? b - a : a - b));
    if (!big && sorted[0] === 0) { const j = sorted.findIndex((x) => x > 0); [sorted[0], sorted[j]] = [sorted[j], sorted[0]]; }
    const r = sorted.join(''), w = new Set(); let g = 0;
    while (w.size < 5 && g++ < 60) { const s = shuffle(d.slice()); if (s[0] !== 0 && s.join('') !== r) w.add(s.join('')); }
    return { c: 'Hisob', q: `${d.join(', ')} raqamlaridan (har birini bir martadan ishlatib) tuzish mumkin bo‘lgan eng ${big ? 'katta' : 'kichik'} son qaysi?`, a: choices(r, Array.from(w)) }; },
  // 34. yaxlitlash
  () => { const n = ri(1000, 9999), to = pickRand([10, 100, 1000]), r = Math.round(n / to) * to, nm = { 10: 'o‘nlik', 100: 'yuzlik', 1000: 'minglik' }[to];
    return { c: 'Hisob', q: `${nf(n)} sonini ${nm}largacha yaxlitla.`, a: choices(r, [r + to, r - to, Math.floor(n / to) * to === r ? r + to : Math.floor(n / to) * to, n], nf) }; },
  // 35. amal belgisi
  () => { for (;;) { const a = ri(2, 12), b = ri(2, 9), ops = { '+': a + b, '−': a - b, '×': a * b, '÷': a % b === 0 ? a / b : null }, op = pickRand(Object.keys(ops)), r = ops[op];
    if (r === null || r < 0 || Object.entries(ops).some(([o, v]) => o !== op && v === r)) continue;
    return { c: 'Hisob', q: `${a} ? ${b} = ${r}. «?» o‘rnida qaysi amal turibdi?`, a: [op, ...Object.keys(ops).filter((o) => o !== op)] }; } },
  // 36. harorat
  () => { const t0 = ri(-12, 6), d = ri(3, 15), r = t0 + d, f = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v) + ' °C';
    return { c: 'Masala', q: `Ertalab havo ${f(t0)} edi, kunduzi ${d} gradusga isidi. Kunduzi harorat necha gradus bo‘ldi?`, a: choices(f(r), [f(t0 - d), f(-r), f(r + 2), f(d - t0)].filter((x) => x !== f(r))) }; },
  // 37. poyezd jadvali
  () => { const st = ri(5, 20) * 60 + ri(0, 11) * 5, h = ri(1, 4), m = ri(1, 11) * 5, r = st + h * 60 + m;
    return { c: 'Vaqt', q: `Poyezd ${hhmm(st)} da jo‘nab, yo‘lda ${h} soat ${m} daqiqa yurdi. U soat nechada yetib keldi?`, a: choices(hhmm(r), [hhmm(r + 60), hhmm(r - 60), hhmm(r - 10), hhmm(st + h * 100 + m)]) }; },
  // 38. soat millari burchagi
  () => { const h = ri(1, 11), r = Math.min(30 * h, 360 - 30 * h);
    return { c: 'Vaqt', q: `Soat roppa-rosa ${h}:00 ni ko‘rsatyapti. Soat va minut millari orasidagi kichik burchak necha gradus?`, a: choices(r, [r + 30, r - 30, h * 10, 360 - r].filter((v) => v > 0 && v <= 360), (v) => v + '°') }; },
  // 39. ikki baravar o‘sish
  () => { const n = ri(8, 60), k = pickRand(['nilufar barglari', 'bakteriyalar', 'qo‘ziqorinlar']);
    return { c: 'Mantiq', q: `Ko‘lda ${k} har kuni ikki baravar ko‘payadi va ${n} kunda butun ko‘lni qoplaydi. Ko‘lning yarmi necha kunda qoplanadi?`, a: choices(n - 1, [n / 2 | 0, n - 2, n + 1, (n / 4) | 0]) }; },
  // 40. ortiqcha so‘z
  () => { let a, b; do { [a, b] = pickN(WCAT_KEYS, 2); } while (clash(a, b));
    const three = pickN(WCATS[a].list, 3), odd = pickRand(WCATS[b].list);
    return { c: 'So‘zlar', q: `Qaysi so‘z ortiqcha? (Qolgan uchtasi — ${WCATS[a].one})`, a: [cap(odd), ...three.map(cap)] }; },
  // 41. qaysi biri …?
  () => { const a = pickRand(WCAT_KEYS), others = WCAT_KEYS.filter((k) => k !== a && !clash(a, k)), ws = pickN(others, 3).map((k) => cap(pickRand(WCATS[k].list)));
    return { c: 'So‘zlar', q: `Qaysi biri — ${WCATS[a].one}?`, a: [cap(pickRand(WCATS[a].list)), ...ws] }; },
  // 42. o‘xshatish
  () => { const p = pickRand(ANALOG);
    return { c: 'O‘xshatish', q: `${p[0]} — ${p[1]}, ${p[2]} — ?`, a: choices(p[3], ANALOG.filter((x) => x !== p).map((x) => x[3])) }; },
  // 43. qarama-qarshi ma’no
  () => { const pr = pickRand(ANTON), rev = Math.random() < 0.5, w = rev ? pr[1] : pr[0], r = rev ? pr[0] : pr[1], ws = pickN(ANTON.filter((x) => x !== pr).map((x) => x[(Math.random() * 2) | 0]), 3);
    return { c: 'So‘zlar', q: `«${cap(w)}» so‘zining ma’nosi qarama-qarshi bo‘lgan so‘z qaysi?`, a: [cap(r), ...ws.map(cap)] }; },
  // 44. poytaxtlar
  () => { const pr = pickRand(CAPS), ws = pickN(CAPS.filter((x) => x !== pr), 3);
    if (Math.random() < 0.6) return { c: 'Geografiya', q: `${pr[0]}ning poytaxti qaysi shahar?`, a: [pr[1], ...ws.map((x) => x[1])] };
    return { c: 'Geografiya', q: `${pr[1]} qaysi davlatning poytaxti?`, a: [pr[0], ...ws.map((x) => x[0])] }; },
  // 45. hayvon bolalari
  () => { const pr = pickRand(YOUNG), ws = pickN(YOUNG.filter((x) => x !== pr), 3).map((x) => cap(x[1]));
    return { c: 'Tabiat', q: `${pr[0]}ning bolasi nima deb ataladi?`, a: [cap(pr[1]), ...ws] }; },
  // 46. hayvon ovozlari
  () => { const pr = pickRand(VOICES), ws = pickN(VOICES.filter((x) => x !== pr), 3).map((x) => cap(x[1]));
    return { c: 'Tabiat', q: `Qaysi jonivor ${pr[0]}?`, a: [cap(pr[1]), ...ws] }; },
  // 47. shakllar burchaklari
  () => { const [nm, k] = pickRand(SHAPES), n = ri(2, 7), r = n * k;
    return { c: 'Geometriya', q: `${n} ta ${nm}ning jami nechta burchagi bor?`, a: choices(r, [r + n, r - n, n + k, r + 1]) }; },
  // 48. haftalar va kunlar
  () => { const w = ri(1, 8), d = ri(1, 6), r = w * 7 + d;
    return { c: 'Vaqt', q: `${w} hafta va ${d} kun — jami necha kun?`, a: choices(r, [w * 5 + d, r + 1, r - 1, w + d]) }; },
  // 49. juft sonlar soni
  () => { const n = ri(10, 60), r = Math.floor(n / 2);
    return { c: 'Hisob', q: `1 dan ${n} gacha (${n} ham kiradi) nechta juft son bor?`, a: choices(r, [r + 1, r - 1, n, r + 2]) }; },
  // 50. qutilar
  () => { const a = ri(3, 9), b = ri(4, 12), it = pickRand(['qalam', 'olma', 'kitob', 'tuxum', 'shar']), r = a * b;
    return { c: 'Masala', q: `${a} ta qutining har birida ${b} tadan ${it} bor. Jami nechta ${it}?`, a: choices(r, [a + b, r + a, r - b, r + 10]) }; },
  // 51. kim ko‘proq
  () => { const names = pickN(['Ali', 'Vali', 'Gulnora', 'Sardor', 'Nodira', 'Bobur', 'Kamola'], 3), v = pickN([3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 3);
    const top = names[v.indexOf(Math.max(...v))];
    return { c: 'Mantiq', q: `${names[0]}da ${v[0]} ta, ${names[1]}da ${v[1]} ta, ${names[2]}da ${v[2]} ta yong‘oq bor. Kimda eng ko‘p yong‘oq bor?`, a: [top, ...names.filter((n) => n !== top), 'Hammasida teng'] }; },
  // 52. bo‘y taqqoslash
  () => { const [a, b, c] = pickN(['Anvar', 'Botir', 'Dilshod', 'Laziz', 'Malika', 'Shahzod', 'Zuhra'], 3);
    return { c: 'Mantiq', q: `${a} ${b}dan baland. ${b} ${c}dan baland. Eng past bo‘yli kim?`, a: [c, a, b, 'Aniqlab bo‘lmaydi'] }; },
];

// Kichkina odamchalar
const LOOKS = [
  { title: 'Kashfiyotchi', skin: '#e8c39a', hair: '#4a2f1b', shirt: '#c9a86a', shirt2: '#9d7f47', pants: '#5b4128', pants2: '#3f2d1b', hat: 'safari' },
  { title: 'Ovchi qiz', skin: '#d6a27a', hair: '#2e1a10', shirt: '#c0392b', shirt2: '#8e2a20', pants: '#3d3a33', pants2: '#29271f', hat: 'band', pony: true },
  { title: 'Zoolog', skin: '#a8714b', hair: '#1d130c', shirt: '#4f8a3a', shirt2: '#376428', pants: '#a08a63', pants2: '#7d6b4b', hat: 'cap', capColor: '#2e5a8a' },
  { title: 'Sayyoh', skin: '#f0c9a0', hair: '#e2c26a', shirt: '#2f6fa0', shirt2: '#22527a', pants: '#4a4f57', pants2: '#33373d', hat: 'none', glasses: true },
];
// Har qahramonning o'z kuchi (botlarda ham ishlaydi).
const ABIL = ['👁 Tumanda uzoqroq ko‘radi', '⚠️ Yaqin yashirin tuzoqlarni sezadi', '🐾 Hayvonlar unga sekinroq yetadi', '👟 Tez yuradi, lekin tumanda kamroq ko‘radi'];
const VAN_LOOK = { title: 'Burgut', skin: '#e0b48c', hair: '#5a4630', shirt: '#7a1d16', shirt2: '#56140f', pants: '#3a2e22', pants2: '#2a2018', hat: 'safari' };
const PCOLORS = ['#ff9a3d', '#ff5470', '#7fdc6a', '#5ab8ff'];
const DEF_NAME = 'Jasur';
const BOT_NAMES = ['Temur', 'Zarina', 'Sardor', 'Lola', 'Bekzod', 'Dilnoza', 'Jahongir', 'Madina', 'Otabek', 'Nigora'];
// Klaviatura: WASD yoki strelkalar, harakat — Space / Enter / F / E
const SLOTS = [
  { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
  { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
];
const ACT_KEYS = ['Space', 'Enter', 'NumpadEnter', 'KeyF', 'KeyE'];

const TOOLS = {
  glue: { grp: 'Sekinlatish', icon: '🍯', name: 'Yelim', price: ECON.price.common, text: 'Raqib 20 soniya sekin yuradi.' },
  freeze: { grp: 'Sekinlatish', icon: '❄️', name: 'Muzlatish', price: ECON.price.rare, text: 'Raqib 8 soniya qimirlay olmaydi.' },
  fogbomb: { grp: 'Aqlni chalg‘itish', icon: '🌫️', name: 'Tuman bombasi', price: ECON.price.common, text: 'Raqibning atrofdagi xaritasi yana tumanga burkanadi.' },
  amnesia: { grp: 'Aqlni chalg‘itish', icon: '🧠', name: 'Akleroz', price: ECON.price.rare, text: 'Raqibning ochgan joylari 1 daqiqa xaritada va ekranda ko‘rinmaydi (faqat hozirgi atrofini ko‘radi).' },
  liar: { grp: 'Aqlni chalg‘itish', icon: '🧭', name: 'Kompas aldaydi', price: ECON.price.common, text: `Raqibning kompasi va kalit/sandiq yo‘naltirgichlari ${LIAR_S} soniya noto‘g‘ri tomonni ko‘rsatadi.` },
  scramble: { grp: 'Aqlni chalg‘itish', icon: '🎮', name: 'Boshqaruvni aralashtirish', price: ECON.price.rare, text: 'Raqibning joystik yo‘nalishlari 30 soniya aralashib ketadi (har safar boshqacha).' },
  flip: { grp: 'Hazil', icon: '🙃', name: 'Teskari dunyo', price: ECON.price.common, text: `Raqibning ekrani ${FLIP_S} soniya teskari ag‘dariladi — joystik esa o‘sha-o‘sha!` },
  mask: { grp: 'Hazil', icon: '🐔', name: 'Maskalash', price: ECON.price.common, text: 'Raqib 1 daqiqa hammaga tovuq, masxaraboz yoki kartoshka bo‘lib ko‘rinadi — o‘ziga ham.' },
  steal: { grp: 'Hujum', icon: '🤏', name: 'Cho‘ntak o‘g‘risi', price: ECON.price.common, text: `Yaqin (${STEAL_R} katak ichida) turgan raqibdan ${ECON.steal} tanga o‘g‘irlaysan.` },
  kmove: { grp: 'Hujum', icon: '🔑', name: 'Kalitni ko‘chirish', price: ECON.price.epic, text: 'Raqibning hali topilmagan darvoza kaliti boshqa uzoq yo‘lakka ko‘chadi.' },
  shut: { grp: 'Hujum', icon: '🏪', name: 'Do‘konni yopish', price: ECON.price.rare, text: `Raqib ${SHUT_S} soniya do‘kondan hech narsa sotib ololmaydi, keyin yana ${TAX_S - SHUT_S} soniya narxlar 2 baravar qimmat.` },
  bomb: { grp: 'Hujum', icon: '💣', name: 'Bomba', price: ECON.price.legend, text: `Raqibga bomba tushadi: ${BOMB_S} soniyada portlaydi. Uni boshqa o‘yinchiga tegib topshirish mumkin (senga ham qaytishi mumkin!). Portlagan o‘yinchi labirint boshiga uloqtiriladi va ${ECON.bomb} tanga yo‘qotadi.` },
  bandit: { grp: 'Hayvonlar', icon: '📯', name: 'Qaroqchi chaqirish', price: ECON.price.rare, text: 'Qaroqchi raqibni quvadi: 5–10 tanga oladi, puli kam bo‘lsa qamoqqa tashlaydi.' },
  sic: { grp: 'Hayvonlar', icon: '🚐', name: 'Ovchini yuborish', price: ECON.price.rare, text: 'Ovchi Burgut raqibning izidan tushib, uni quvadi.' },
  swap: { grp: 'Joy almashtirish', icon: '🔀', name: 'Joy almashtirish', price: ECON.price.legend, text: 'Oldinda ketayotgan raqib bilan o‘rningni almashtirasan.' },
  chaos: { grp: 'Joy almashtirish', all: true, icon: '🌪️', name: 'Tartibsizlik', price: ECON.price.epic, text: 'Hamma o‘yinchi (sen ham) joylari tasodifan almashadi — yetakchi ortga, ortda qolgan oldinga!' },
  cleanse: { grp: 'Himoya', self: true, icon: '🧼', name: 'Tozalash', price: ECON.price.common, text: 'Senga qilingan hamma xalaqit (muz, yelim, aralash boshqaruv, akleroz, maska, teskari dunyo…) yo‘qoladi.' },
  radar: { grp: 'Himoya', self: true, icon: '📡', name: 'Radar', price: ECON.price.common, text: `${RADAR_S} soniya atrofdagi yashirin tuzoqlarni ko‘rsatadi; ustiga bossang tuzoq zararsizlanadi (+${ECON.disarm} 💰).` },
};
const FOE_KEYS = Object.keys(TOOLS);
const TARGET_KEYS = FOE_KEYS.filter((k) => !TOOLS[k].self && !TOOLS[k].all);   // raqib tanlanadigan sehrlar
// Qo‘yib ketiladigan tuzoqlar: o‘zing turgan joyga qo‘yasan, raqib bossa ishlaydi (faqat o‘zing ko‘rasan). Teleport tuzog‘ida manzilni o‘zing ochgan joylardan tanlaysan.
const PTRAPS = {
  tport: { icon: '🌀', name: 'Teleport tuzog‘i', price: ECON.price.rare, fx: 'tport', text: 'Raqib bossa — sen o‘zing ochgan joylardan tanlagan manzilga uloqtiriladi.' },
  tglue: { icon: '🍯', name: 'Yelim tuzog‘i', price: ECON.price.common, fx: 'glue', text: 'Raqib bossa — 20 soniya sekin yuradi.' },
  tfog: { icon: '🌫️', name: 'Tuman tuzog‘i', price: ECON.price.common, fx: 'fogbomb', text: 'Raqib bossa — atrofdagi xaritasi yana tumanga burkanadi.' },
  tice: { icon: '❄️', name: 'Muz tuzog‘i', price: ECON.price.rare, fx: 'freeze', text: 'Raqib bossa — 8 soniya qotib qoladi.' },
  tamn: { icon: '🧠', name: 'Akleroz tuzog‘i', price: ECON.price.rare, fx: 'amnesia', text: 'Raqib bossa — 1 daqiqa ochgan joylari ko‘rinmaydi.' },
  tbait: { icon: '🪙', name: 'Soxta tanga', price: ECON.price.common, fx: 'rand', text: 'Raqibga haqiqiy pul xaltasiga o‘xshab ko‘rinadi. Olgan odam tasodifiy hazilga tushadi: yelim, muz, tuman, aralash boshqaruv, teskari dunyo, maska yoki cho‘ntagi bo‘shaydi.' },
};
const BAIT_FX = ['glue', 'freeze', 'fogbomb', 'scramble', 'flip', 'mask', 'steal'];   // soxta tanga bosilganda tasodifiy tanlanadigan hazillar
const trapFx = (kind) => (PTRAPS[kind].fx === 'rand' ? pickRand(BAIT_FX) : PTRAPS[kind].fx);
const PTRAP_KEYS = Object.keys(PTRAPS);
const PLACE_KEYS = PTRAP_KEYS.concat('wall');   // sumkada saqlanadigan qo‘yib ketiladigan narsalar (tuzoqlar + devor)
const PT_MAX = 3, PT_LIFE = 180, PICK_MIN = 3;   // bir odam ko‘pi bilan 3 ta tuzoq qo‘yadi; 3 daqiqadan keyin eskiradi
const DUEL_R = 3, DUEL_S = 10, DUEL_COUNT = 3, DUEL_COOL = 40, DUEL_ASK_S = 10;
const DIRS = ['up', 'right', 'down', 'left'];
const DVEC = { up: [0, -1], right: [1, 0], down: [0, 1], left: [-1, 0] };
const ARROW = { up: '↑', right: '→', down: '↓', left: '←' };
const dirName = (d) => (d[0] > 0 ? 'right' : d[0] < 0 ? 'left' : d[1] < 0 ? 'up' : 'down');
export { T, walk, beastFloor, DIFFS, L3, ECON, MIRROR_S, AMNESIA_S, BOMB_R, BOMB_PASS_LOCK, BOMB_BACK_S, FLIP_S, MASK_S, LIAR_S, SHUT_S, TAX_S, RADAR_S, STEAL_R, REVENGE_S, BOMB_S, MASKS, maskOf, SP, V, TRAPS, TRAP_IX, BEASTS, BEAST_KINDS, OBST, PORTAL, CHEST, ITEMS, ITEM_IX, RB, RIDDLES, ri, nf, cap, pickN, choices, DAYS, MONTHS, hhmm, roman, WCATS, WCAT_KEYS, clash, ANALOG, ANTON, CAPS, YOUNG, VOICES, LEGS, GOODS, SHAPES, QGEN, LOOKS, ABIL, VAN_LOOK, PCOLORS, DEF_NAME, BOT_NAMES, SLOTS, ACT_KEYS, TOOLS, FOE_KEYS, TARGET_KEYS, PTRAPS, BAIT_FX, trapFx, PTRAP_KEYS, PLACE_KEYS, PT_MAX, PT_LIFE, PICK_MIN, DUEL_R, DUEL_S, DUEL_COUNT, DUEL_COOL, DUEL_ASK_S, DIRS, DVEC, ARROW, dirName };
