/*
 * 運動でモンスターを倒すダイエットゲーム（MVP）
 * 担当: Bさん（戦闘処理／セーブ選択UI／演出）
 *
 * 対応Issue（github.com/ss-prg-sy/STSTproject）:
 *   #2 セーブデータ共通処理（localStorage / version・slots構造）
 *   #3 セーブスロット選択画面（新規作成・続きから・最終プレイ日時表示）
 *   #4 運動記録→固定ダメージ→HPバー反映、履歴は直近50件まで
 *   #5 討伐処理（HP0→討伐演出→討伐数+1→レベル再計算→次モンスター出現）
 *   #6 運動メニューのランダム提案ボタン（第1段階：リストからランダム）
 *
 * 補足: #6の提案リストの中身はAさんがDESIGN.mdを元に用意する想定。
 *       DESIGN.mdが未作成のため、ここでは仮リストを置いている。
 */

(() => {
  "use strict";

  const STORAGE_KEY = "dietGame_saves_v2";
  const STORAGE_VERSION = 1;
  const SLOT_COUNT = 3;
  const HISTORY_LIMIT = 50; // 直近50件、51件目で最古を削除（Issue #4）
  const BASE_MONSTER_HP = 100;
  const MONSTER_HP_GROWTH = 40;

  // ---------- 怪物データ（第3段階：薄暗い森・恐め獣寄り） ----------
  // 各怪物は名前・落とすおとしもの(drop)・体パーツ(parts)を持つ。
  // 表示は「共通defs ＋ 森背景 ＋ parts」を組み立てて1枚のSVGにする。

  const MONSTER_DEFS = `
    <radialGradient id="air" cx="50%" cy="40%" r="72%"><stop offset="0%" stop-color="#2f3d38"/><stop offset="45%" stop-color="#1e2925"/><stop offset="100%" stop-color="#0e1512"/></radialGradient>
    <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#18201c"/><stop offset="100%" stop-color="#0a0f0d"/></linearGradient>
    <linearGradient id="ray" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#b8ccb0" stop-opacity="0.22"/><stop offset="100%" stop-color="#b8ccb0" stop-opacity="0"/></linearGradient>
    <radialGradient id="eyeglow" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="#fff6c9"/><stop offset="35%" stop-color="#ffd24d"/><stop offset="75%" stop-color="#e8891f"/><stop offset="100%" stop-color="#7a3d0c"/></radialGradient>
    <radialGradient id="eyehalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ffcf5a" stop-opacity="0.85"/><stop offset="100%" stop-color="#ffcf5a" stop-opacity="0"/></radialGradient>
    <radialGradient id="redglow" cx="50%" cy="50%" r="55%"><stop offset="0%" stop-color="#ffe0d0"/><stop offset="40%" stop-color="#ff6b5a"/><stop offset="100%" stop-color="#7a1a10"/></radialGradient>
    <radialGradient id="redhalo" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#ff6b5a" stop-opacity="0.85"/><stop offset="100%" stop-color="#ff6b5a" stop-opacity="0"/></radialGradient>
    <radialGradient id="mBody" cx="42%" cy="24%" r="84%"><stop offset="0%" stop-color="#e8e4da"/><stop offset="45%" stop-color="#c1baaa"/><stop offset="100%" stop-color="#655f56"/></radialGradient>
    <radialGradient id="mMuz" cx="50%" cy="30%" r="72%"><stop offset="0%" stop-color="#efeae0"/><stop offset="100%" stop-color="#9d9486"/></radialGradient>
    <radialGradient id="pBody" cx="42%" cy="26%" r="84%"><stop offset="0%" stop-color="#e8c66a"/><stop offset="50%" stop-color="#b98f37"/><stop offset="100%" stop-color="#5e441a"/></radialGradient>
    <radialGradient id="pTop" cx="45%" cy="30%" r="75%"><stop offset="0%" stop-color="#6a4326"/><stop offset="100%" stop-color="#3a2413"/></radialGradient>
    <radialGradient id="dBody" cx="42%" cy="24%" r="86%"><stop offset="0%" stop-color="#8fc79a"/><stop offset="50%" stop-color="#4f8f5c"/><stop offset="100%" stop-color="#1f3d28"/></radialGradient>
    <radialGradient id="dBelly" cx="50%" cy="35%" r="70%"><stop offset="0%" stop-color="#cfe6b0"/><stop offset="100%" stop-color="#7fa869"/></radialGradient>
    <radialGradient id="oBody" cx="45%" cy="26%" r="82%"><stop offset="0%" stop-color="#f2ede2"/><stop offset="55%" stop-color="#cfc7b4"/><stop offset="100%" stop-color="#8a8271"/></radialGradient>
    <radialGradient id="oShell" cx="50%" cy="40%" r="70%"><stop offset="0%" stop-color="#e05a4a"/><stop offset="100%" stop-color="#7e2018"/></radialGradient>
    <filter id="blur1"><feGaussianBlur stdDeviation="3"/></filter>
    <filter id="blur2"><feGaussianBlur stdDeviation="6"/></filter>
    <filter id="softsh" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur in="SourceAlpha" stdDeviation="3"/><feOffset dy="4"/><feComponentTransfer><feFuncA type="linear" slope="0.5"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>
    <filter id="fur" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.9 0.4" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="6" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="furedge" x="-30%" y="-30%" width="160%" height="160%"><feTurbulence type="fractalNoise" baseFrequency="0.85 0.5" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="9" xChannelSelector="R" yChannelSelector="G"/></filter>
    <filter id="scale" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="turbulence" baseFrequency="0.15 0.15" numOctaves="2" seed="5" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="4"/></filter>
  `;

  const FOREST_BG = `
    <rect width="300" height="270" fill="url(#air)"/>
    <g filter="url(#blur2)" opacity="0.75"><rect x="24" y="26" width="18" height="170" rx="8" fill="#141c18"/><rect x="126" y="8" width="24" height="188" rx="10" fill="#121a17"/><rect x="214" y="34" width="16" height="162" rx="8" fill="#141c18"/><rect x="256" y="16" width="22" height="180" rx="10" fill="#111917"/></g>
    <polygon points="118,0 150,0 116,214 90,214" fill="url(#ray)" filter="url(#blur1)"/>
    <polygon points="180,0 200,0 174,206 158,206" fill="url(#ray)" opacity="0.7" filter="url(#blur1)"/>
    <g filter="url(#blur1)"><rect x="2" y="0" width="30" height="255" rx="10" fill="#0b110f"/><rect x="270" y="0" width="34" height="262" rx="12" fill="#0a100e"/></g>
    <ellipse cx="150" cy="255" rx="195" ry="42" fill="url(#ground)"/>
    <ellipse cx="150" cy="214" rx="145" ry="24" fill="#8fa89b" opacity="0.13" filter="url(#blur2)"/>
    <ellipse cx="150" cy="244" rx="66" ry="12" fill="#000" opacity="0.5" filter="url(#blur1)"/>
  `;

  const MONSTERS = [
    {
      name: "モチグマ",
      drop: "のびもち",
      parts: `<g transform="translate(150,150)">
        <ellipse cx="-40" cy="62" rx="21" ry="17" fill="url(#mBody)" filter="url(#softsh)"/><ellipse cx="40" cy="62" rx="21" ry="17" fill="url(#mBody)" filter="url(#softsh)"/>
        <g filter="url(#furedge)"><path d="M0 -2 C-40 -2 -52 22 -49 47 C-46 72 -24 80 0 80 C24 80 46 72 49 47 C52 22 40 -2 0 -2 Z" fill="url(#mBody)"/></g>
        <ellipse cx="-35" cy="46" rx="14" ry="26" fill="url(#mBody)" filter="url(#softsh)" transform="rotate(10 -35 46)"/><ellipse cx="35" cy="46" rx="14" ry="26" fill="url(#mBody)" filter="url(#softsh)" transform="rotate(-10 35 46)"/>
        <g fill="#221e1a"><path d="M-44 70 l-3 7 l4 -2 Z"/><path d="M-38 72 l-2 7 l4 -2 Z"/><path d="M44 70 l3 7 l-4 -2 Z"/><path d="M38 72 l2 7 l-4 -2 Z"/></g>
        <path d="M-26 -42 Q-36 -60 -18 -52 Z" fill="url(#mBody)" filter="url(#softsh)"/><path d="M26 -42 Q36 -60 18 -52 Z" fill="url(#mBody)" filter="url(#softsh)"/>
        <g filter="url(#furedge)"><path d="M0 -54 C-28 -54 -35 -30 -33 -10 C-31 12 -16 24 0 24 C16 24 31 12 33 -10 C35 -30 28 -54 0 -54 Z" fill="url(#mBody)"/></g>
        <ellipse cx="-14" cy="-18" rx="10" ry="8" fill="#39342d" opacity="0.6"/><ellipse cx="14" cy="-18" rx="10" ry="8" fill="#39342d" opacity="0.6"/>
        <circle cx="-14" cy="-18" r="10" fill="url(#eyehalo)"/><circle cx="14" cy="-18" r="10" fill="url(#eyehalo)"/><circle cx="-14" cy="-18" r="5.2" fill="url(#eyeglow)"/><circle cx="14" cy="-18" r="5.2" fill="url(#eyeglow)"/>
        <ellipse cx="-14" cy="-18" rx="1.4" ry="4.4" fill="#180d03"/><ellipse cx="14" cy="-18" rx="1.4" ry="4.4" fill="#180d03"/>
        <ellipse cx="0" cy="4" rx="15" ry="12" fill="url(#mMuz)" filter="url(#softsh)"/><ellipse cx="0" cy="-2" rx="5.5" ry="4" fill="#241f1a"/>
        <path d="M-10 10 Q0 17 10 10" fill="none" stroke="#241f1a" stroke-width="2.4" stroke-linecap="round"/><path d="M-5 12 l-2 7 l4 -3 Z" fill="#f3efe6"/><path d="M5 12 l2 7 l-4 -3 Z" fill="#f3efe6"/>
      </g>`,
    },
    {
      name: "ドカプリン",
      drop: "ぷるゼリー",
      parts: `<g transform="translate(150,150)">
        <ellipse cx="-42" cy="66" rx="20" ry="15" fill="url(#pBody)" filter="url(#softsh)"/><ellipse cx="42" cy="66" rx="20" ry="15" fill="url(#pBody)" filter="url(#softsh)"/>
        <path d="M-52 6 L52 6 L44 70 Q0 84 -44 70 Z" fill="url(#pBody)" filter="url(#softsh)"/>
        <path d="M-52 8 Q-40 -8 -30 6 Q-16 -14 0 4 Q16 -14 30 6 Q40 -8 52 8 Q40 22 0 20 Q-40 22 -52 8 Z" fill="url(#pTop)" filter="url(#softsh)"/>
        <path d="M-30 6 l-3 12 M0 4 l0 14 M30 6 l3 12" stroke="#2a1a0e" stroke-width="3" stroke-linecap="round"/>
        <ellipse cx="-16" cy="30" rx="9" ry="8" fill="#2a1608" opacity="0.6"/><ellipse cx="16" cy="30" rx="9" ry="8" fill="#2a1608" opacity="0.6"/>
        <circle cx="-16" cy="30" r="10" fill="url(#redhalo)"/><circle cx="16" cy="30" r="10" fill="url(#redhalo)"/><circle cx="-16" cy="30" r="5" fill="url(#redglow)"/><circle cx="16" cy="30" r="5" fill="url(#redglow)"/>
        <ellipse cx="-16" cy="30" rx="1.4" ry="4" fill="#1a0603"/><ellipse cx="16" cy="30" rx="1.4" ry="4" fill="#1a0603"/>
        <path d="M-14 48 Q0 58 14 48" fill="none" stroke="#2a1a0e" stroke-width="2.5" stroke-linecap="round"/><path d="M-8 50 l-2 8 l4 -3 Z" fill="#f3efe6"/><path d="M8 50 l2 8 l-4 -3 Z" fill="#f3efe6"/><path d="M0 51 l-2 6 l4 0 Z" fill="#f3efe6"/>
      </g>`,
    },
    {
      name: "ネボスケ竜",
      drop: "ねぼけうろこ",
      parts: `<g transform="translate(150,150)">
        <ellipse cx="-46" cy="60" rx="20" ry="14" fill="url(#dBody)" filter="url(#softsh)"/><ellipse cx="46" cy="60" rx="20" ry="14" fill="url(#dBody)" filter="url(#softsh)"/>
        <g filter="url(#scale)"><path d="M-6 8 C-52 6 -64 30 -58 50 C-52 70 -24 76 4 74 C40 72 58 56 56 38 C54 20 34 10 -6 8 Z" fill="url(#dBody)"/></g>
        <ellipse cx="6" cy="52" rx="26" ry="20" fill="url(#dBelly)" opacity="0.85"/>
        <g fill="#2f5a3c"><path d="M-34 6 l-8 -16 l14 8 Z"/><path d="M-14 2 l-6 -18 l14 10 Z"/><path d="M8 2 l-4 -18 l14 12 Z"/></g>
        <g filter="url(#scale)"><ellipse cx="30" cy="24" rx="26" ry="21" fill="url(#dBody)" filter="url(#softsh)"/></g>
        <path d="M44 24 Q64 22 62 34 Q58 42 44 38 Z" fill="url(#dBody)"/><ellipse cx="60" cy="30" rx="2.5" ry="2" fill="#1e2f22"/>
        <path d="M20 6 Q14 -8 26 -4 Z" fill="#dfe6c8"/><path d="M38 6 Q34 -10 46 -2 Z" fill="#dfe6c8"/>
        <ellipse cx="26" cy="22" rx="8" ry="7" fill="#1e3327" opacity="0.6"/><circle cx="26" cy="22" r="9" fill="url(#eyehalo)"/><circle cx="26" cy="22" r="4.6" fill="url(#eyeglow)"/><ellipse cx="26" cy="22" rx="1.3" ry="4" fill="#140d02"/>
        <path d="M48 38 l-1 7 l4 -4 Z" fill="#f3efe6"/><path d="M40 40 l-1 6 l3 -3 Z" fill="#f3efe6"/>
      </g>`,
    },
    {
      name: "オニギリガニ",
      drop: "こめつぶ",
      parts: `<g transform="translate(150,150)">
        <g stroke="#7e2018" stroke-width="5" stroke-linecap="round" fill="none"><path d="M-30 60 Q-46 66 -52 78"/><path d="M-24 66 Q-38 74 -42 86"/><path d="M30 60 Q46 66 52 78"/><path d="M24 66 Q38 74 42 86"/></g>
        <path d="M-44 40 Q-64 34 -60 20 Q-52 12 -46 24 Q-40 16 -36 28 Z" fill="url(#oShell)" filter="url(#softsh)"/><path d="M44 40 Q64 34 60 20 Q52 12 46 24 Q40 16 36 28 Z" fill="url(#oShell)" filter="url(#softsh)"/>
        <path d="M-40 44 Q-30 30 -18 40 Z" fill="url(#oShell)" opacity="0.9"/><path d="M40 44 Q30 30 18 40 Z" fill="url(#oShell)" opacity="0.9"/>
        <path d="M0 -40 Q-34 -34 -40 48 Q0 60 40 48 Q34 -34 0 -40 Z" fill="url(#oBody)" filter="url(#softsh)"/>
        <path d="M-30 20 L30 20 L24 52 Q0 60 -24 52 Z" fill="#22301f"/>
        <ellipse cx="-14" cy="2" rx="9" ry="8" fill="#34302a" opacity="0.5"/><ellipse cx="14" cy="2" rx="9" ry="8" fill="#34302a" opacity="0.5"/>
        <circle cx="-14" cy="2" r="9" fill="url(#eyehalo)"/><circle cx="14" cy="2" r="9" fill="url(#eyehalo)"/><circle cx="-14" cy="2" r="4.6" fill="url(#eyeglow)"/><circle cx="14" cy="2" r="4.6" fill="url(#eyeglow)"/>
        <ellipse cx="-14" cy="2" rx="1.3" ry="3.8" fill="#140d02"/><ellipse cx="14" cy="2" rx="1.3" ry="3.8" fill="#140d02"/>
        <path d="M-10 30 Q0 38 10 30" fill="none" stroke="#141a12" stroke-width="2.4" stroke-linecap="round"/><path d="M-5 32 l-2 7 l4 -3 Z" fill="#f3efe6"/><path d="M5 32 l2 7 l-4 -3 Z" fill="#f3efe6"/>
      </g>`,
    },
  ];

  // 森背景つきの1枚SVGを組み立てる
  function buildMonsterSvg(monster) {
    return `<svg viewBox="0 0 300 270" xmlns="http://www.w3.org/2000/svg"><defs>${MONSTER_DEFS}</defs>${FOREST_BG}${monster.parts}</svg>`;
  }

  // ---------- 換算ロジック（第2段階：SPEC.md 5.1 / 5.2） ----------
  // ダメージ = 基準値 × 運動係数 × 量
  const BASE_VALUE = 1; // 基準値（全体スケール調整用。当面は1固定）

  /** 運動の定義。coef は「1単位あたりのダメージ」、unitSize は入力1単位が何個ぶんか。
   *  例: プランクは「10秒 = 1単位」なので unitSize=10（秒入力を10で割って単位数にする）。*/
  const EXERCISES = [
    { id: "pushup",   name: "腕立て伏せ",     unit: "回", coef: 2,  unitSize: 1,  defaultAmount: 10 },
    { id: "squat",    name: "スクワット",     unit: "回", coef: 2,  unitSize: 1,  defaultAmount: 15 },
    { id: "jump",     name: "その場ジャンプ", unit: "秒", coef: 5,  unitSize: 10, defaultAmount: 30 },
    { id: "plank",    name: "プランク",       unit: "秒", coef: 8,  unitSize: 10, defaultAmount: 30 },
    { id: "walk",     name: "ウォーキング",   unit: "km", coef: 15, unitSize: 1,  defaultAmount: 2  },
    { id: "run",      name: "ランニング",     unit: "km", coef: 40, unitSize: 1,  defaultAmount: 2  },
  ];

  const INITIAL_ATTACK = 20; // セーブ作成時の初期攻撃力の表示用（第3段階の装備ボーナスの土台）

  /** 換算式でダメージを算出する。量は「入力値 ÷ unitSize」で単位数に直す。 */
  function calcDamage(exercise, amount, equipBonus) {
    const units = amount / exercise.unitSize;
    const base = BASE_VALUE * exercise.coef * units;
    return Math.round(base) + (equipBonus || 0);
  }

  // 装備ボーナスの合計（各そうびの level × bonusPerLevel の総和）
  function totalEquipBonus(save) {
    if (!save.equipment) return 0;
    return save.equipment.reduce((sum, eq) => sum + eq.level * eq.bonusPerLevel, 0);
  }

  // Issue #6: 仮の運動メニューリスト（Aさんが用意する正式リストに差し替え予定）
  const MENU_SUGGESTIONS = [
    "腕立て伏せ 10回",
    "スクワット 15回",
    "腹筋 15回",
    "その場ジャンプ 30秒",
    "プランク 30秒",
    "階段の昇り降り 2分",
  ];

  /** @typedef {{
   *   playerName: string,
   *   level: number,
   *   attackPower: number,
   *   defeatCount: number,
   *   history: {date: string, label: string, damage: number}[],
   *   monsterHp: number,
   *   monsterMaxHp: number,
   *   monsterName: string,
   *   lastPlayedAt: string,
   * }} SaveData
   */

  // ---------- セーブデータ共通処理（Issue #2） ----------
  // 構造: { version: number, slots: (SaveData|null)[] }

  function initStorage() {
    return { version: STORAGE_VERSION, slots: Array(SLOT_COUNT).fill(null) };
  }

  function loadStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return initStorage();
      const parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.slots)) return initStorage();
      const slots = Array(SLOT_COUNT).fill(null);
      for (let i = 0; i < SLOT_COUNT; i++) slots[i] = parsed.slots[i] || null;
      return { version: parsed.version || STORAGE_VERSION, slots };
    } catch (e) {
      console.error("セーブデータの読み込みに失敗しました", e);
      return initStorage();
    }
  }

  function saveStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  }

  function getSlot(index) {
    return storage.slots[index];
  }

  function setSlot(index, data) {
    storage.slots[index] = data;
    saveStorage();
  }

  function newSaveData(playerName) {
    return {
      playerName,
      level: 1,
      attackPower: INITIAL_ATTACK,
      defeatCount: 0,
      history: [],
      monsterHp: BASE_MONSTER_HP,
      monsterMaxHp: BASE_MONSTER_HP,
      monsterName: MONSTERS[0].name,
      items: {},
      equipment: [
        { name: "もちもちグローブ", level: 0, bonusPerLevel: 5, cost: { "のびもち": 3 } },
        { name: "ぷるぷるハリセン", level: 0, bonusPerLevel: 8, cost: { "ぷるゼリー": 3 } },
      ],
      lastPlayedAt: nowString(),
    };
  }

  function monsterForLevel(level) {
    // 討伐ごとに次の怪物へ。levelではなく討伐回数で巡回させたいので
    // 呼び出し側から通し番号を渡す（下位互換のためlevelでも動く）
    const idx = (level - 1) % MONSTERS.length;
    return MONSTERS[idx];
  }

  // 討伐数から次に出す怪物を決める（倒すたびに変わる）
  function monsterForDefeatCount(count) {
    const idx = count % MONSTERS.length;
    return MONSTERS[idx];
  }

  function nowString() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  // ---------- アプリ状態 ----------

  let storage = loadStorage();
  let currentSlot = -1;
  let pendingNewSlot = -1;

  // ---------- 画面切り替え ----------

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  // ---------- スロット選択画面（Issue #3） ----------

  function renderSlots() {
    const list = document.getElementById("slot-list");
    list.innerHTML = "";
    storage.slots.forEach((save, i) => {
      const card = document.createElement("div");
      if (save) {
        card.className = "slot-card";
        card.innerHTML = `
          <div class="slot-title">スロット${i + 1}：${escapeHtml(save.playerName)}</div>
          <div class="slot-sub">Lv.${save.level}　討伐数 ${save.defeatCount}　攻撃力 ${save.attackPower}</div>
          <div class="slot-sub">最終プレイ：${escapeHtml(save.lastPlayedAt || "-")}</div>
        `;
        card.addEventListener("click", () => enterGame(i));
      } else {
        card.className = "slot-card empty";
        card.innerHTML = `<div class="slot-title">スロット${i + 1}：空</div><div class="slot-sub">タップして新規作成</div>`;
        card.addEventListener("click", () => startCreateSave(i));
      }
      list.appendChild(card);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function startCreateSave(slotIndex) {
    pendingNewSlot = slotIndex;
    document.getElementById("new-player-name").value = "";
    showScreen("screen-newplayer");
    document.getElementById("new-player-name").focus();
  }

  function confirmCreateSave() {
    const input = document.getElementById("new-player-name");
    const name = input.value.trim() || "プレイヤー";
    setSlot(pendingNewSlot, newSaveData(name));
    enterGame(pendingNewSlot);
  }

  // ---------- ゲーム画面 ----------

  function enterGame(slotIndex) {
    currentSlot = slotIndex;
    const save = getSlot(slotIndex);
    save.lastPlayedAt = nowString();
    saveStorage();
    showScreen("screen-game");
    document.getElementById("menu-suggest-result").textContent = "";
    setupExerciseSelect();
    renderGame();
  }

  function currentSave() {
    return getSlot(currentSlot);
  }

  // 運動選択ドロップダウンを組み立てる（初回のみ）
  function setupExerciseSelect() {
    const select = document.getElementById("exercise-select");
    if (select.options.length > 0) return; // 既に組み立て済みなら何もしない
    EXERCISES.forEach((ex) => {
      const opt = document.createElement("option");
      opt.value = ex.id;
      opt.textContent = ex.name;
      select.appendChild(opt);
    });
    select.addEventListener("change", onExerciseChange);
    onExerciseChange(); // 初期表示の単位・既定量をそろえる
  }

  // 選んだ運動に合わせて、単位表示と既定の量を切り替える
  function onExerciseChange() {
    const ex = selectedExercise();
    document.getElementById("exercise-unit").textContent = ex.unit;
    document.getElementById("exercise-amount").value = ex.defaultAmount;
  }

  function selectedExercise() {
    const id = document.getElementById("exercise-select").value;
    return EXERCISES.find((e) => e.id === id) || EXERCISES[0];
  }

  function renderGame() {
    const save = currentSave();
    document.getElementById("player-name").textContent = save.playerName;
    document.getElementById("player-level").textContent = `Lv.${save.level}`;
    document.getElementById("monster-name").textContent = save.monsterName;
    renderMonsterSprite(save.monsterName);
    document.getElementById("stat-attack").textContent = save.attackPower + totalEquipBonus(save);
    document.getElementById("stat-defeat").textContent = save.defeatCount;
    document.getElementById("stat-records").textContent = save.history.length;
    updateHpBar(save);
    renderHistory(save);
  }

  function renderMonsterSprite(name) {
    const monster = MONSTERS.find((m) => m.name === name) || MONSTERS[0];
    document.getElementById("monster-sprite").innerHTML = buildMonsterSvg(monster);
  }

  function updateHpBar(save) {
    const pct = Math.max(0, Math.min(100, (save.monsterHp / save.monsterMaxHp) * 100));
    const fill = document.getElementById("hp-bar-fill");
    fill.style.width = pct + "%";
    document.getElementById("hp-text").textContent = `${Math.max(0, save.monsterHp)} / ${save.monsterMaxHp}`;
  }

  function renderHistory(save) {
    const list = document.getElementById("history-list");
    list.innerHTML = "";
    if (save.history.length === 0) {
      list.innerHTML = `<li class="history-empty">まだ記録がありません</li>`;
      return;
    }
    // 新しい記録を上に表示
    [...save.history].reverse().forEach((h) => {
      const li = document.createElement("li");
      li.innerHTML = `
        <div class="hist-main">
          <span class="hist-label">${escapeHtml(h.label)}</span>
          <span class="hist-damage">-${h.damage}</span>
        </div>
        <div class="hist-date">${escapeHtml(h.date)}</div>
      `;
      list.appendChild(li);
    });
  }

  // ---------- 戦闘処理（Issue #4, #5） ----------

  function recordExercise() {
    const save = currentSave();
    if (!save) return;

    const ex = selectedExercise();
    const amount = parseInt(document.getElementById("exercise-amount").value, 10);
    if (!Number.isFinite(amount) || amount <= 0) {
      alert("運動量を1以上で入力してください");
      return;
    }

    const btn = document.getElementById("btn-record");
    btn.disabled = true;

    const damage = calcDamage(ex, amount, totalEquipBonus(save));
    save.monsterHp = Math.max(0, save.monsterHp - damage);
    save.history.push({
      date: nowString(),
      label: `${ex.name} ${amount}${ex.unit}`,
      damage,
    });
    // Issue #4: 直近50件まで。51件目で最古を削除
    while (save.history.length > HISTORY_LIMIT) {
      save.history.shift();
    }
    save.lastPlayedAt = nowString();

    playHitAnimation(damage);
    updateHpBar(save);
    renderHistory(save);
    document.getElementById("stat-records").textContent = save.history.length;

    if (save.monsterHp <= 0) {
      setTimeout(() => defeatMonster(save, btn), 550);
    } else {
      saveStorage();
      setTimeout(() => (btn.disabled = false), 400);
    }
  }

  function playHitAnimation(damage) {
    const sprite = document.getElementById("monster-sprite");
    sprite.classList.remove("hit");
    void sprite.offsetWidth; // reflow でアニメーションを再トリガー
    sprite.classList.add("hit");

    const popup = document.getElementById("damage-popup");
    popup.textContent = `-${damage}`;
    popup.classList.remove("show");
    void popup.offsetWidth;
    popup.classList.add("show");
  }

  function defeatMonster(save, btn) {
    // 今倒した怪物のおとしものを付与（次の怪物に切り替える前に取得する）
    const defeated = MONSTERS.find((m) => m.name === save.monsterName) || MONSTERS[0];
    if (!save.items) save.items = {}; // 古いセーブ互換
    save.items[defeated.drop] = (save.items[defeated.drop] || 0) + 1;

    const banner = document.getElementById("defeat-banner");
    banner.innerHTML = `退治！<br><span class="defeat-drop">${escapeHtml(defeated.drop)} を手に入れた！</span>`;
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");

    // Issue #5: 討伐数+1 → level = floor(討伐数/3)+1 で再計算 → 次モンスターHP満タン
    save.defeatCount += 1;
    save.level = Math.floor(save.defeatCount / 3) + 1;
    save.monsterMaxHp = BASE_MONSTER_HP + (save.level - 1) * MONSTER_HP_GROWTH;
    save.monsterHp = save.monsterMaxHp;
    save.monsterName = monsterForDefeatCount(save.defeatCount).name;

    saveStorage();

    setTimeout(() => {
      banner.classList.remove("show");
      renderGame();
      btn.disabled = false;
    }, 1400);
  }

  // ---------- もちもの画面（第3段階：おとしもの） ----------

  function openItems() {
    renderItems();
    renderEquipment();
    showScreen("screen-items");
  }

  function renderItems() {
    const save = currentSave();
    const list = document.getElementById("items-list");
    list.innerHTML = "";
    const items = save.items || {};
    const names = Object.keys(items).filter((k) => items[k] > 0);
    if (names.length === 0) {
      list.innerHTML = `<li class="items-empty">まだ何も持っていません。<br>怪物を退治すると手に入ります。</li>`;
      return;
    }
    names.forEach((name) => {
      const li = document.createElement("li");
      li.className = "item-row";
      li.innerHTML = `<span class="item-name">${escapeHtml(name)}</span><span class="item-count">×${items[name]}</span>`;
      list.appendChild(li);
    });
  }

  // そうび一覧を描画（強化ボタン・必要素材・効果つき）
  function renderEquipment() {
    const save = currentSave();
    const wrap = document.getElementById("equip-list");
    wrap.innerHTML = "";
    if (!save.equipment) save.equipment = [];
    save.equipment.forEach((eq, i) => {
      const costText = Object.entries(eq.cost)
        .map(([mat, n]) => `${mat} ×${n}`)
        .join("、");
      const canAfford = Object.entries(eq.cost).every(
        ([mat, n]) => (save.items[mat] || 0) >= n
      );
      const nextBonus = (eq.level + 1) * eq.bonusPerLevel;
      const row = document.createElement("div");
      row.className = "equip-row";
      row.innerHTML = `
        <div class="equip-info">
          <div class="equip-name">${escapeHtml(eq.name)} <span class="equip-lv">Lv.${eq.level}</span></div>
          <div class="equip-effect">攻撃力 +${eq.level * eq.bonusPerLevel} → +${nextBonus}</div>
          <div class="equip-cost">強化に必要：${escapeHtml(costText)}</div>
        </div>
        <button class="btn btn-small equip-btn" data-index="${i}" ${canAfford ? "" : "disabled"}>強化</button>
      `;
      wrap.appendChild(row);
    });
    // 強化ボタンにイベントを付ける
    wrap.querySelectorAll(".equip-btn").forEach((btn) => {
      btn.addEventListener("click", () => upgradeEquipment(parseInt(btn.dataset.index, 10)));
    });
  }

  // そうびを強化する（素材を消費してlevelを+1）
  function upgradeEquipment(index) {
    const save = currentSave();
    const eq = save.equipment[index];
    if (!eq) return;
    // 必要素材が足りているか確認
    const canAfford = Object.entries(eq.cost).every(
      ([mat, n]) => (save.items[mat] || 0) >= n
    );
    if (!canAfford) return;
    // 素材を消費
    Object.entries(eq.cost).forEach(([mat, n]) => {
      save.items[mat] -= n;
    });
    eq.level += 1;
    saveStorage();
    // 表示を更新
    renderItems();
    renderEquipment();
  }

  // ---------- 運動メニュー提案（Issue #6） ----------

  function suggestMenu() {
    const idx = Math.floor(Math.random() * MENU_SUGGESTIONS.length);
    document.getElementById("menu-suggest-result").textContent = `→ ${MENU_SUGGESTIONS[idx]}`;
  }

  // ---------- イベント登録 ----------

  document.getElementById("btn-create-cancel").addEventListener("click", () => {
    showScreen("screen-slots");
  });
  document.getElementById("btn-create-confirm").addEventListener("click", confirmCreateSave);
  document.getElementById("new-player-name").addEventListener("keydown", (e) => {
    if (e.key === "Enter") confirmCreateSave();
  });
  document.getElementById("btn-back-slots").addEventListener("click", () => {
    renderSlots();
    showScreen("screen-slots");
  });
  document.getElementById("btn-record").addEventListener("click", recordExercise);
  document.getElementById("btn-suggest-menu").addEventListener("click", suggestMenu);
  document.getElementById("btn-open-items").addEventListener("click", openItems);
  document.getElementById("btn-items-back").addEventListener("click", () => {
    renderGame();
    showScreen("screen-game");
  });

  // ---------- 起動 ----------

  renderSlots();
  showScreen("screen-slots");
})();
