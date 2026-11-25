/*
 * おしよせ！かいぶつ
 * 草原のむこうから押しよせる怪物を、タップで追いかえすゲーム。
 * 怪物が柵まで来るとライフが減り、ライフが0になったらゲームオーバー。
 *
 * ファイル構成
 *   art.js    … 怪物の絵（SVG）
 *   script.js … ゲームの動き（このファイル）
 *   style.css … 画面のデザイン
 */
(() => {
  "use strict";

  const { MONSTER_DEFS, MONSTERS } = window.ART;

  /* =========================================================
   * 調整しやすい設定
   * ========================================================= */
  const LIVES = 3;                  // ライフの数
  const COMBO_TIME = 2.2;           // この秒数たたかないとコンボが切れる
  const FEVER_COMBO = 20;           // このコンボ数でフィーバー
  const FEVER_TIME = 7;             // フィーバーの秒数
  const LEVEL_SECONDS = 25;         // この秒数ごとにレベルアップ（速くなる）
  const APPEAR_Z = 0.13;            // 出てきた直後（これより奥）はたたけない
  const AMMO_MAX = 6;               // 玉の最大数
  const RELOAD_SEC = 0.7;           // 玉が1発もどるまでの秒数
  const BEST_KEY = "stst_oshiyose_best_v1";
  const SOUND_KEY = "stst_oshiyose_sound_v1";

  // 怪物の種類（art は art.js の MONSTERS の何番目の絵か）
  const TYPES = [
    { art: 0, hp: 2, speed: 0.075, points: 20, size: 1.0,  move: "bounce", tip: "2回たたく" },
    { art: 1, hp: 1, speed: 0.125, points: 10, size: 0.86, move: "wobble", tip: "足がはやい" },
    { art: 2, hp: 3, speed: 0.17,  points: 30, size: 1.06, move: "nap",    tip: "寝てる間なら一撃！" },
    { art: 3, hp: 1, speed: 0.09,  points: 15, size: 0.86, move: "zigzag", tip: "横にうろうろ" },
  ];

  // 点数ごとの称号
  const RANKS = [
    [0,    "見習いの見張り番"],
    [300,  "村の見張り番"],
    [800,  "草原の守り手"],
    [1600, "かいぶつハンター"],
    [3000, "伝説の門番"],
    [5000, "怪物たちの天敵"],
  ];

  /* =========================================================
   * 画面の部品
   * ========================================================= */
  const $ = (id) => document.getElementById(id);
  const stage = $("stage");
  const cv = $("game");
  const ctx = cv.getContext("2d");
  const ui = {
    hud: $("hud"), score: $("score"), hudBest: $("hud-best"), lives: $("lives"),
    combo: $("combo"), banner: $("banner"), ammo: $("ammo"),
    start: $("start"), startBest: $("start-best"), howto: $("howto"), sound: $("btn-sound"),
    pause: $("pause"), over: $("over"),
    final: $("final"), record: $("record"), rank: $("rank"),
    overReason: $("over-reason"),
    stKills: $("st-kills"), stCombo: $("st-combo"), stBest: $("st-best"),
  };

  /* =========================================================
   * 保存（ベストスコアと音のON/OFFだけ）
   * ========================================================= */
  function load(key, fallback) {
    try { const v = localStorage.getItem(key); return v === null ? fallback : JSON.parse(v); }
    catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }
  let best = load(BEST_KEY, 0);
  let soundOn = load(SOUND_KEY, true);

  /* =========================================================
   * 音（ファイルを使わず、その場で鳴らす）
   * ========================================================= */
  let actx = null;
  function unlockAudio() {
    if (actx) { if (actx.state === "suspended") actx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) actx = new AC();
  }
  function tone(freq, dur, type = "square", vol = 0.08, slide = 1, delay = 0) {
    if (!soundOn || !actx) return;
    const t = actx.currentTime + delay;
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }
  const sfx = {
    hit:   (c) => tone(420 + Math.min(c, 40) * 22, 0.07, "triangle", 0.14, 1.4),
    kill:  (c) => { const f = 620 + Math.min(c, 40) * 26; tone(f, 0.09, "square", 0.05, 1.5); tone(f * 1.5, 0.12, "triangle", 0.08, 1.2, 0.05); },
    miss:  () => tone(170, 0.09, "sine", 0.12, 0.6),
    empty: () => tone(90, 0.05, "square", 0.06, 1),
    hurt:  () => { tone(240, 0.35, "sawtooth", 0.07, 0.35); tone(120, 0.4, "square", 0.05, 0.5, 0.05); },
    star:  () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, "triangle", 0.09, 1, i * 0.06)),
    fever: () => [659, 784, 988, 1319, 988, 1319].forEach((f, i) => tone(f, 0.1, "square", 0.05, 1, i * 0.07)),
    level: () => [392, 523, 659].forEach((f, i) => tone(f, 0.12, "triangle", 0.08, 1, i * 0.08)),
    life:  () => [784, 1047].forEach((f, i) => tone(f, 0.14, "sine", 0.12, 1, i * 0.08)),
    over:  () => [523, 440, 349, 262].forEach((f, i) => tone(f, 0.22, "triangle", 0.1, 0.97, i * 0.16)),
  };

  // スマホをブルッとふるわせる（対応している機種だけ）
  function vibrate(pattern) {
    if (soundOn && navigator.vibrate) { try { navigator.vibrate(pattern); } catch (e) {} }
  }

  /* =========================================================
   * 怪物の絵を、ゲームで使う画像に変換しておく
   * ========================================================= */
  const SPRITE_H = 220; // 画像の高さ（ピクセル）
  const sprites = [];

  function measureParts(parts) {
    const ns = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(ns, "svg");
    svg.setAttribute("width", "300");
    svg.setAttribute("height", "300");
    svg.style.cssText = "position:absolute;left:-9999px;top:0;visibility:hidden";
    svg.innerHTML = `<defs>${MONSTER_DEFS}</defs><g>${parts}</g>`;
    document.body.appendChild(svg);
    const box = svg.lastElementChild.getBBox();
    svg.remove();
    return box;
  }
  function loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  function tinted(source, color) {
    const c = document.createElement("canvas");
    c.width = source.width; c.height = source.height;
    const g = c.getContext("2d");
    g.drawImage(source, 0, 0);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = color;
    g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  async function makeSprite(parts) {
    const b = measureParts(parts);
    const pad = 12;
    const vx = b.x - pad, vy = b.y - pad, vw = b.width + pad * 2, vh = b.height + pad * 2;
    const w = Math.ceil(vw * SPRITE_H / vh), h = SPRITE_H;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${vx} ${vy} ${vw} ${vh}"><defs>${MONSTER_DEFS}</defs>${parts}</svg>`;
    const img = await loadImage("data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg));
    const base = document.createElement("canvas");
    base.width = w; base.height = h;
    base.getContext("2d").drawImage(img, 0, 0, w, h);
    return {
      img: base,
      flash: tinted(base, "#ffffff"),
      gold: tinted(base, "rgba(255,196,40,.55)"),
      ratio: w / h,
      url: base.toDataURL(),
    };
  }

  /* =========================================================
   * 画面サイズと遠近（奥ほど小さく、手前ほど大きく）
   * ========================================================= */
  let W = 0, H = 0, DPR = 1;
  let horizonY = 0, fenceY = 0, baseH = 0;
  let bg = null;

  function resize() {
    const r = stage.getBoundingClientRect();
    DPR = Math.min(2, window.devicePixelRatio || 1);
    W = r.width; H = r.height;
    cv.width = Math.round(W * DPR);
    cv.height = Math.round(H * DPR);
    horizonY = H * 0.31;
    fenceY = H * 0.83;
    baseH = Math.min(W * 0.36, H * 0.21);
    bg = drawBackground();
  }

  // z: 0=地平線 1=柵　xn: -1=左 1=右
  function project(z, xn) {
    const p = z * (0.55 + 0.45 * z);
    const y = horizonY + (fenceY - horizonY) * p;
    const spread = 0.72 + 0.28 * p;   // 奥でも横に広がるように
    return { x: W / 2 + xn * W * 0.44 * spread, y, s: 0.3 + 0.7 * p };
  }

  function drawBackground() {
    const c = document.createElement("canvas");
    c.width = Math.round(W * DPR); c.height = Math.round(H * DPR);
    const g = c.getContext("2d");
    g.scale(DPR, DPR);

    // 空
    const sky = g.createLinearGradient(0, 0, 0, horizonY + 20);
    sky.addColorStop(0, "#5a5b9e");
    sky.addColorStop(0.55, "#c66b7a");
    sky.addColorStop(1, "#f2a46e");
    g.fillStyle = sky; g.fillRect(0, 0, W, horizonY + 30);

    // 太陽
    const sx = W / 2, sy = horizonY - H * 0.02;
    const sun = g.createRadialGradient(sx, sy, 0, sx, sy, W * 0.38);
    sun.addColorStop(0, "rgba(255,242,192,1)");
    sun.addColorStop(0.35, "rgba(255,191,106,.55)");
    sun.addColorStop(1, "rgba(255,191,106,0)");
    g.fillStyle = sun; g.fillRect(0, 0, W, horizonY + 30);
    g.fillStyle = "rgba(255,240,184,.95)";
    g.beginPath(); g.arc(sx, sy, W * 0.09, 0, Math.PI * 2); g.fill();

    // 雲
    g.fillStyle = "rgba(232,138,106,.45)";
    [[0.2, 0.32, 0.12], [0.78, 0.22, 0.1], [0.55, 0.12, 0.07]].forEach(([x, y, r]) => {
      g.beginPath(); g.ellipse(W * x, horizonY * y + 40, W * r, W * r * 0.28, 0, 0, Math.PI * 2); g.fill();
    });

    // 遠くの丘
    const hill = g.createLinearGradient(0, horizonY - 40, 0, horizonY + 10);
    hill.addColorStop(0, "#9c7a6a"); hill.addColorStop(1, "#6e5548");
    g.fillStyle = hill;
    g.beginPath();
    g.moveTo(0, horizonY - 6);
    g.quadraticCurveTo(W * 0.25, horizonY - 46, W * 0.52, horizonY - 14);
    g.quadraticCurveTo(W * 0.78, horizonY + 6, W, horizonY - 26);
    g.lineTo(W, horizonY + 10); g.lineTo(0, horizonY + 10); g.closePath(); g.fill();

    // 草原
    const grass = g.createLinearGradient(0, horizonY, 0, H);
    grass.addColorStop(0, "#8a9a52"); grass.addColorStop(0.6, "#6c7d3c"); grass.addColorStop(1, "#4e5c30");
    g.fillStyle = grass; g.fillRect(0, horizonY, W, H - horizonY);

    // 奥行きのしま模様
    for (let i = 0; i < 12; i += 2) {
      const a = project(i / 12, 0).y, b = project((i + 1) / 12, 0).y;
      g.fillStyle = "rgba(255,255,220,.05)";
      g.fillRect(0, a, W, b - a);
    }
    // 道（中央へ集まる線）
    g.strokeStyle = "rgba(60,70,30,.18)"; g.lineWidth = 1;
    for (let k = -1; k <= 1; k += 0.5) {
      const far = project(0, k), near = project(1.2, k);
      g.beginPath(); g.moveTo(far.x, far.y); g.lineTo(near.x, near.y); g.stroke();
    }

    // 草
    g.strokeStyle = "rgba(61,73,31,.55)"; g.lineCap = "round";
    for (let i = 0; i < 70; i++) {
      const z = Math.random(), p = project(z, Math.random() * 2.2 - 1.1);
      const h = 3 + 9 * p.s;
      g.lineWidth = 1 + p.s;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x - h * 0.3, p.y - h); g.stroke();
      g.beginPath(); g.moveTo(p.x + 2, p.y); g.lineTo(p.x + 2 + h * 0.2, p.y - h * 0.9); g.stroke();
    }

    // 柵より手前（自分たちの拠点）
    g.fillStyle = "#5b4a32";
    g.fillRect(0, fenceY + 6, W, H - fenceY);
    g.fillStyle = "rgba(0,0,0,.12)";
    for (let x = 8; x < W; x += 34) { g.beginPath(); g.ellipse(x, fenceY + 40 + (x % 3) * 10, 14, 6, 0, 0, Math.PI * 2); g.fill(); }

    // 柵
    const postW = 10, gap = 30;
    g.fillStyle = "#c08a52";
    g.fillRect(0, fenceY - 26, W, 7);
    g.fillRect(0, fenceY - 10, W, 7);
    for (let x = 6; x < W; x += gap) {
      g.fillStyle = "#a8743f";
      g.beginPath();
      g.moveTo(x, fenceY + 10); g.lineTo(x, fenceY - 34); g.lineTo(x + postW / 2, fenceY - 40); g.lineTo(x + postW, fenceY - 34); g.lineTo(x + postW, fenceY + 10);
      g.closePath(); g.fill();
      g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x + 1, fenceY - 33, 2, 40);
    }
    g.fillStyle = "rgba(0,0,0,.18)"; g.fillRect(0, fenceY + 8, W, 4);
    return c;
  }

  /* =========================================================
   * ゲームの状態
   * ========================================================= */
  let mode = "loading";   // loading / title / play / paused / dying / over
  let monsters = [], popups = [], particles = [];
  let star = null;
  let score = 0, lives = LIVES, kills = 0, combo = 0, maxCombo = 0, comboT = 0;
  let fever = 0, nextFever = FEVER_COMBO;
  let elapsed = 0, level = 1, spawnT = 0, starT = 0;
  let shake = 0, hurtFlash = 0, slowmo = 0;
  let ammo = AMMO_MAX, reloadT = 0;
  let isNewBest = false;
  let overReason = "";

  function resetGame() {
    monsters = []; popups = []; particles = []; star = null;
    score = 0; lives = LIVES; kills = 0; combo = 0; maxCombo = 0; comboT = 0;
    fever = 0; nextFever = FEVER_COMBO;
    elapsed = 0; level = 1; spawnT = 0.6; starT = 25 + Math.random() * 10;
    shake = 0; hurtFlash = 0; slowmo = 0; isNewBest = false;
    ammo = AMMO_MAX; reloadT = 0; overReason = "";
  }

  // 時間がたつほど、いろんな怪物が・速く・たくさん来る
  function pickType() {
    const t = elapsed;
    const weights = [
      3,                         // モチグマ
      4,                         // ドカプリン
      t > 15 ? 1.6 : 0,          // ネボスケ竜
      t > 6 ? 3 : 0,             // オニギリガニ
    ];
    let r = Math.random() * weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < weights.length; i++) { if ((r -= weights[i]) < 0) return i; }
    return 0;
  }
  function spawnMonster(demo) {
    const typeIndex = demo ? Math.floor(Math.random() * TYPES.length) : pickType();
    const type = TYPES[typeIndex];
    const xn = Math.random() * 1.9 - 0.95;
    monsters.push({
      type, typeIndex, z: 0, xn, baseXn: xn, hp: type.hp,
      t: Math.random() * 10, gold: !demo && elapsed > 8 && Math.random() < 0.05,
      napping: false, napT: 1.6 + Math.random() * 1.4,
      flashT: 0, kb: 0, dying: 0, demo: !!demo,
    });
  }
  function speedFactor() { return 1 + (level - 1) * 0.13; }
  function spawnInterval() {
    const base = Math.max(0.36, 1.45 - elapsed * 0.016);
    return fever > 0 ? base * 0.5 : base;
  }

  /* =========================================================
   * 表示の更新
   * ========================================================= */
  const HEART = (on) => `<svg viewBox="0 0 24 24" class="${on ? "" : "off"}"><path d="M12 21s-7.5-4.6-9.6-9.2C.8 8.2 3 4.5 6.6 4.5c2.1 0 3.6 1.2 5.4 3.2 1.8-2 3.3-3.2 5.4-3.2 3.6 0 5.8 3.7 4.2 7.3C19.5 16.4 12 21 12 21z" fill="#ff5a4e" stroke="#fff" stroke-width="1.6"/></svg>`;
  function updateHud() {
    ui.score.textContent = score;
    ui.hudBest.textContent = Math.max(best, score);
    ui.lives.innerHTML = Array.from({ length: LIVES }, (_, i) => HEART(i < lives)).join("");
  }
  function updateAmmo() {
    const free = fever > 0;
    let html = "";
    for (let i = 0; i < AMMO_MAX; i++) html += `<i class="${free || i < ammo ? "on" : ""}"></i>`;
    ui.ammo.innerHTML = html + `<span>${free ? "うちほうだい！" : ammo === 0 ? "たまぎれ" : "たま"}</span>`;
    ui.ammo.classList.toggle("empty", !free && ammo === 0);
    ui.ammo.classList.toggle("low", !free && ammo > 0 && ammo <= 2);
    ui.ammo.classList.toggle("free", free);
  }
  function useAmmo() {
    if (fever > 0) return true;
    if (ammo <= 0) return false;
    ammo -= 1;
    updateAmmo();
    return true;
  }
  function comboMul() { return Math.min(4, 1 + Math.floor(combo / 5) * 0.5); }
  function updateCombo() {
    if (combo >= 3) {
      const mul = comboMul() * (fever > 0 ? 2 : 1);
      const left = nextFever - combo;
      const hint = fever > 0 ? "フィーバー中！ うちほうだい" : `点数 ×${mul}　フィーバーまであと${left}`;
      ui.combo.innerHTML = `<b>${combo}</b>コンボ<span class="mul">${hint}</span>`;
      ui.combo.classList.add("show");
    } else {
      ui.combo.classList.remove("show");
    }
    ui.combo.classList.toggle("fever", fever > 0);
  }
  function showBanner(text) {
    ui.banner.textContent = text;
    ui.banner.classList.remove("show");
    void ui.banner.offsetWidth; // アニメーションを最初から
    ui.banner.classList.add("show");
  }
  function popup(x, y, text, color = "#fff", size = 22) {
    popups.push({ x, y, text, color, size, t: 0 });
  }
  function burst(x, y, color, n = 12, power = 1) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (80 + Math.random() * 220) * power;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 120, t: 0, life: 0.5 + Math.random() * 0.4, color, r: 2 + Math.random() * 4 });
    }
  }
  function updateSoundBtn() { ui.sound.textContent = soundOn ? "音：オン" : "音：オフ"; }

  /* =========================================================
   * たたく
   * ========================================================= */
  function monsterBox(m) {
    const p = project(m.z, m.xn);
    const h = baseH * p.s * m.type.size;
    const w = h * sprites[m.type.art].ratio;
    return { x: p.x, y: p.y, w, h, s: p.s };
  }

  function onTap(x, y) {
    if (mode !== "play") return;

    // 流れ星
    if (star && Math.hypot(star.x - x, star.y - y) < 48) {
      useStar();
      return;
    }

    const inBox = (m, minSize) => {
      const b = monsterBox(m);
      const w = Math.max(b.w * 1.15, minSize), h = Math.max(b.h * 1.1, minSize);
      return x > b.x - w / 2 && x < b.x + w / 2 && y > b.y - h && y < b.y + 10;
    };

    // 手前の怪物を優先
    let target = null;
    for (const m of monsters) {
      if (m.dying || m.z < APPEAR_Z) continue;   // 出てきたばかりの怪物はまだたたけない
      if (inBox(m, 40) && (!target || m.z > target.z)) target = m;
    }

    // 倒したばかりの怪物の上をたたいた分は、空振りにしない（連打の2発目以降）
    // 玉も減らないし、コンボも切れない
    if (!target && monsters.some((m) => m.dying && !m.reached && m.dying < 0.4 && inBox(m, 44))) return;

    // 玉がないと撃てない
    if (!useAmmo()) {
      sfx.empty();
      popup(x, y, "たまぎれ！", "#ffd0c8", 18);
      ui.ammo.classList.remove("shake"); void ui.ammo.offsetWidth; ui.ammo.classList.add("shake");
      return;
    }

    if (target) hitMonster(target);
    else missTap(x, y);

    // 玉を使い切ったらゲームオーバー（最後の1発でたおせば、1発もどるのでセーフ）
    if (mode === "play" && fever <= 0 && ammo === 0) outOfAmmo();
  }

  function hitMonster(m) {
    const b = monsterBox(m);
    const critical = m.type.move === "nap" && m.napping;
    m.hp -= critical ? m.hp : 1;
    m.flashT = 0.09;
    m.kb = 0.5;
    combo += 1;
    comboT = COMBO_TIME;
    maxCombo = Math.max(maxCombo, combo);

    if (m.hp <= 0) {
      const mul = comboMul() * (fever > 0 ? 2 : 1) * (m.gold ? 5 : 1) * (critical ? 2 : 1);
      const pts = Math.round(m.type.points * mul);
      score += pts;
      kills += 1;
      m.dying = 0.001;
      if (ammo < AMMO_MAX) { ammo += 1; updateAmmo(); }
      sfx.kill(combo);
      shake = Math.max(shake, 5);
      burst(b.x, b.y - b.h * 0.5, m.gold ? "#ffd84a" : "#fff3c4", m.gold ? 26 : 14, b.s + 0.4);
      popup(b.x, b.y - b.h, critical ? `寝こみ一撃！ +${pts}` : `+${pts}`, m.gold ? "#ffd84a" : "#fff", critical || m.gold ? 30 : 24);
      if (m.gold && lives < LIVES) {
        lives += 1;
        sfx.life();
        popup(b.x, b.y - b.h - 34, "ライフ +1", "#ff8a80", 22);
      }
    } else {
      sfx.hit(combo);
      burst(b.x, b.y - b.h * 0.5, "#ffffff", 6, b.s);
    }

    if (combo >= nextFever) {
      fever = FEVER_TIME;
      nextFever = combo + 25;
      sfx.fever();
      showBanner("フィーバー！");
      updateAmmo();
    }
    updateHud();
    updateCombo();
  }

  function missTap(x, y) {
    sfx.miss();
    if (combo >= 3) popup(x, y, "スカッ", "rgba(255,255,255,.85)", 18);
    combo = 0;
    updateCombo();
  }

  function useStar() {
    sfx.star();
    burst(star.x, star.y, "#fff7b0", 30, 1.3);
    star = null;
    shake = 10;
    // 画面の怪物ぜんぶに1ダメージ（1回でたおせる怪物だけ消える）
    let got = 0;
    for (const m of monsters) {
      if (m.dying || m.z < APPEAR_Z) continue;
      const b = monsterBox(m);
      m.hp -= 1; m.flashT = 0.12; m.kb = 0.5;
      burst(b.x, b.y - b.h * 0.5, "#fff3c4", 8, b.s + 0.3);
      if (m.hp <= 0) {
        got += Math.round(m.type.points * (fever > 0 ? 2 : 1) * (m.gold ? 5 : 1));
        kills += 1; m.dying = 0.001;
      }
    }
    score += got;
    showBanner(got ? `ながれ星！ +${got}` : "ながれ星！");
    updateHud();
  }

  function outOfAmmo() {
    overReason = "たまぎれ…";
    showBanner("たまぎれ！");
    sfx.hurt();
    vibrate([80, 60, 200]);
    shake = 14; hurtFlash = 0.5;
    combo = 0; updateCombo();
    mode = "dying";
    slowmo = 1.2;
  }

  function monsterReached(m) {
    m.dying = 0.001;
    m.reached = true;
    lives -= 1;
    combo = 0;
    shake = 16; hurtFlash = 0.5;
    vibrate(lives <= 0 ? [80, 60, 200] : 120);
    sfx.hurt();
    updateHud(); updateCombo();
    if (lives <= 0) {
      overReason = "柵を突破された…";
      mode = "dying";
      slowmo = 1.2;
    }
  }

  /* =========================================================
   * 毎フレームの動き
   * ========================================================= */
  function update(dt) {
    const playing = mode === "play" || mode === "dying";
    if (mode === "dying") {
      slowmo -= dt;
      dt *= 0.25;
      if (slowmo <= 0) { gameOver(); return; }
    }

    if (mode === "play") {
      elapsed += dt;
      const newLevel = 1 + Math.floor(elapsed / LEVEL_SECONDS);
      if (newLevel > level) { level = newLevel; sfx.level(); showBanner(`レベル ${level}`); }

      spawnT -= dt;
      if (spawnT <= 0) { spawnMonster(false); spawnT = spawnInterval(); }

      if (comboT > 0) { comboT -= dt; if (comboT <= 0 && combo > 0) { combo = 0; updateCombo(); } }
      if (fever > 0) { fever -= dt; if (fever <= 0) { updateCombo(); updateAmmo(); } }
      if (ammo < AMMO_MAX) {
        reloadT += dt;
        if (reloadT >= RELOAD_SEC) { reloadT = 0; ammo += 1; updateAmmo(); }
      } else reloadT = 0;

      starT -= dt;
      if (starT <= 0 && !star) {
        const fromLeft = Math.random() < 0.5;
        star = { x: fromLeft ? -30 : W + 30, y: H * (0.1 + Math.random() * 0.1), vx: (fromLeft ? 1 : -1) * W / 2.2, t: 0 };
        starT = 30 + Math.random() * 15;
      }
    } else if (mode === "title") {
      spawnT -= dt;
      if (spawnT <= 0) { spawnMonster(true); spawnT = 1.4; }
    }

    if (star) {
      star.t += dt;
      star.x += star.vx * dt;
      star.y += Math.sin(star.t * 3) * 0.4;
      if (star.x < -60 || star.x > W + 60) star = null;
    }

    const sf = playing ? speedFactor() : 0.7;
    for (const m of monsters) {
      m.t += dt;
      if (m.flashT > 0) m.flashT -= dt;
      if (m.dying) { m.dying += dt; continue; }

      let speed = m.type.speed * sf * (m.gold ? 1.25 : 1);
      switch (m.type.move) {
        case "wobble":
          m.xn = m.baseXn + Math.sin(m.t * 3) * 0.08;
          break;
        case "zigzag":
          m.xn = Math.max(-0.95, Math.min(0.95, m.baseXn + Math.sin(m.t * 2.3) * 0.38));
          break;
        case "nap":
          m.napT -= dt;
          // 寝る時間は短め（0.8秒）、起きて歩く時間は長め（2.2〜3.5秒）
          if (m.napT <= 0) { m.napping = !m.napping; m.napT = m.napping ? 0.8 : 2.2 + Math.random() * 1.3; }
          if (m.napping) speed = 0;
          break;
      }
      // たたかれると少し押しもどされる
      if (m.kb > 0) { m.z -= m.kb * 0.06 * dt * 10; m.kb = Math.max(0, m.kb - dt * 3); }
      m.z = Math.max(0, m.z + speed * dt);

      if (m.z >= 1) {
        if (m.demo || mode !== "play") { m.dying = 0.001; m.reached = true; }
        else monsterReached(m);
      }
    }
    monsters = monsters.filter((m) => !(m.dying && m.dying > 0.4));

    for (const p of particles) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 600 * dt; }
    particles = particles.filter((p) => p.t < p.life);
    for (const p of popups) p.t += dt;
    popups = popups.filter((p) => p.t < 0.9);

    if (shake > 0) shake = Math.max(0, shake - dt * 40);
    if (hurtFlash > 0) hurtFlash -= dt;
  }

  /* =========================================================
   * 描画
   * ========================================================= */
  function draw(time) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    ctx.drawImage(bg, 0, 0, W, H);

    if (fever > 0) {
      ctx.fillStyle = `rgba(255,200,60,${0.12 + Math.sin(time / 120) * 0.06})`;
      ctx.fillRect(0, 0, W, H);
    }

    const sorted = monsters.slice().sort((a, b) => a.z - b.z);
    for (const m of sorted) drawMonster(m, time);

    if (star) drawStar(star, time);

    for (const p of particles) {
      ctx.globalAlpha = 1 - p.t / p.life;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;

    ctx.textAlign = "center";
    ctx.lineJoin = "round";
    for (const p of popups) {
      const k = p.t / 0.9;
      ctx.globalAlpha = 1 - k * k;
      ctx.font = `800 ${p.size * (k < 0.15 ? 0.7 + k * 2 : 1)}px "M PLUS Rounded 1c", sans-serif`;
      ctx.lineWidth = 5; ctx.strokeStyle = "rgba(59,42,36,.85)";
      ctx.strokeText(p.text, p.x, p.y - k * 40);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y - k * 40);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (hurtFlash > 0) {
      const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.2, W / 2, H / 2, H * 0.75);
      g.addColorStop(0, "rgba(232,68,58,0)");
      g.addColorStop(1, `rgba(232,68,58,${hurtFlash})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
  }

  function drawMonster(m, time) {
    const spr = sprites[m.type.art];
    const b = monsterBox(m);
    let { x, y, w, h } = b;
    // 出てきたばかりは うっすら（まだたたけない）
    let alpha = m.z < APPEAR_Z ? 0.2 + (m.z / APPEAR_Z) * 0.35 : 1;
    let rot = 0, sx = 1, sy = 1;

    switch (m.type.move) {
      case "bounce": y -= Math.abs(Math.sin(m.t * 6)) * h * 0.08; break;
      case "wobble": sx = 1 + Math.sin(m.t * 12) * 0.05; sy = 1 - Math.sin(m.t * 12) * 0.05; break;
      case "zigzag": rot = Math.sin(m.t * 9) * 0.06; break;
      case "nap": if (m.napping) rot = -0.12; else y -= Math.abs(Math.sin(m.t * 10)) * h * 0.05; break;
    }
    if (m.dying) {
      const k = m.dying / 0.4;
      if (m.reached) { alpha *= 1 - k; }
      else { alpha *= 1 - k; sx *= 1 + k * 0.5; sy *= 1 - k * 0.6; y -= k * h * 0.2; }
    }

    // 影
    ctx.globalAlpha = alpha * 0.35;
    ctx.fillStyle = "#2a3016";
    ctx.beginPath(); ctx.ellipse(b.x, b.y, w * 0.38, h * 0.08, 0, 0, Math.PI * 2); ctx.fill();

    ctx.globalAlpha = alpha;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.scale(sx, sy);
    if (m.gold) {
      ctx.shadowColor = "rgba(255,210,60,.95)";
      ctx.shadowBlur = 18 + Math.sin(time / 90) * 6;
    }
    const img = m.flashT > 0 || (m.dying && !m.reached) ? spr.flash : (m.gold ? spr.gold : spr.img);
    ctx.drawImage(img, -w / 2, -h, w, h);
    ctx.restore();
    ctx.shadowBlur = 0;

    // 残り体力（2回以上たたく怪物だけ）
    if (m.type.hp > 1 && !m.dying && m.z > 0.08) {
      const r = Math.max(3, 5 * b.s), gap = r * 2.8;
      const total = m.type.hp, x0 = b.x - (total - 1) * gap / 2;
      for (let i = 0; i < total; i++) {
        ctx.fillStyle = i < m.hp ? "#ff5a4e" : "rgba(255,255,255,.4)";
        ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x0 + i * gap, b.y - h - r * 2.2, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
    // 寝ているしるし
    if (m.napping && !m.dying) {
      ctx.font = `800 ${Math.max(12, 22 * b.s)}px "M PLUS Rounded 1c", sans-serif`;
      ctx.fillStyle = "#fff";
      ctx.textAlign = "left";
      const bob = Math.sin(time / 200) * 4;
      ctx.fillText("Zz", b.x + w * 0.25, b.y - h * 0.9 + bob);
      // 「今なら一撃」がわかるように、頭の上にふきだし
      if (m.z >= APPEAR_Z) {
        const fs = Math.max(11, 15 * b.s + 3);
        ctx.font = `800 ${fs}px "M PLUS Rounded 1c", sans-serif`;
        ctx.textAlign = "center";
        const label = "ねてる！一撃チャンス";
        const tw = ctx.measureText(label).width + 14, th = fs + 10;
        const bx = b.x, by = b.y - h - th - 8 - Math.max(3, 5 * b.s) * 3;
        const blink = 0.75 + Math.sin(time / 110) * 0.25;
        ctx.globalAlpha = blink;
        ctx.fillStyle = "#ffc93c";
        ctx.beginPath(); ctx.roundRect(bx - tw / 2, by, tw, th, th / 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(bx - 5, by + th); ctx.lineTo(bx + 5, by + th); ctx.lineTo(bx, by + th + 6); ctx.fill();
        ctx.fillStyle = "#3b2a24";
        ctx.fillText(label, bx, by + th / 2 + fs * 0.36);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawStar(s, time) {
    // しっぽ
    const dir = s.vx > 0 ? -1 : 1;
    for (let i = 1; i <= 8; i++) {
      ctx.globalAlpha = 0.5 - i * 0.055;
      ctx.fillStyle = "#fff7b0";
      ctx.beginPath(); ctx.arc(s.x + dir * i * 9, s.y + Math.sin(s.t * 3 - i * 0.3) * 2, 9 - i * 0.8, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(time / 300);
    ctx.shadowColor = "rgba(255,240,150,1)"; ctx.shadowBlur = 20;
    ctx.fillStyle = "#ffe14d"; ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 9 : 22, a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  /* =========================================================
   * 画面の切りかえ
   * ========================================================= */
  function showTitle() {
    mode = "title";
    resetGame();
    ui.hud.hidden = true;
    ui.ammo.hidden = true;
    ui.over.hidden = true;
    ui.pause.hidden = true;
    ui.start.hidden = false;
    ui.startBest.textContent = best;
    ui.combo.classList.remove("show");
  }
  function startGame() {
    unlockAudio();
    resetGame();
    mode = "play";
    ui.start.hidden = true;
    ui.over.hidden = true;
    ui.hud.hidden = false;
    updateHud(); updateCombo(); updateAmmo();
    ui.ammo.hidden = false;
    showBanner("スタート！");
  }
  function gameOver() {
    mode = "over";
    isNewBest = score > best;
    if (isNewBest) { best = score; save(BEST_KEY, best); }
    sfx.over();
    ui.overReason.textContent = "ゲームオーバー：" + overReason;
    ui.final.textContent = score;
    ui.record.hidden = !isNewBest;
    ui.rank.textContent = "称号：" + RANKS.filter(([min]) => score >= min).pop()[1];
    ui.stKills.textContent = kills;
    ui.stCombo.textContent = maxCombo;
    ui.stBest.textContent = best;
    ui.combo.classList.remove("show");
    ui.over.hidden = false;
  }
  function pauseGame() {
    if (mode !== "play") return;
    mode = "paused";
    ui.pause.hidden = false;
  }
  function resumeGame() {
    if (mode !== "paused") return;
    unlockAudio();
    ui.pause.hidden = true;
    mode = "play";
  }

  /* =========================================================
   * 操作
   * ========================================================= */
  stage.addEventListener("pointerdown", (e) => {
    if (e.target !== cv) return;
    e.preventDefault();
    const r = cv.getBoundingClientRect();
    onTap(e.clientX - r.left, e.clientY - r.top);
  });
  $("btn-start").addEventListener("click", startGame);
  $("btn-retry").addEventListener("click", startGame);
  $("btn-title").addEventListener("click", showTitle);
  $("btn-pause").addEventListener("click", pauseGame);
  $("btn-resume").addEventListener("click", resumeGame);
  $("btn-quit").addEventListener("click", showTitle);
  ui.sound.addEventListener("click", () => {
    soundOn = !soundOn;
    save(SOUND_KEY, soundOn);
    updateSoundBtn();
    if (soundOn) { unlockAudio(); sfx.hit(5); }
  });
  document.addEventListener("contextmenu", (e) => e.preventDefault());
  document.addEventListener("dblclick", (e) => e.preventDefault());
  document.addEventListener("visibilitychange", () => { if (document.hidden) pauseGame(); });
  window.addEventListener("resize", resize);

  /* =========================================================
   * はじめに
   * ========================================================= */
  let last = 0;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (mode !== "paused" && mode !== "over") update(dt);
    draw(now);
    requestAnimationFrame(loop);
  }

  async function init() {
    resize();
    updateSoundBtn();
    for (const m of MONSTERS) sprites.push(await makeSprite(m.parts));
    ui.howto.innerHTML = TYPES.map((t) =>
      `<li><img src="${sprites[t.art].url}" alt=""><span><b>${MONSTERS[t.art].name}</b><small>${t.tip}</small></span></li>`
    ).join("");
    const startBtn = $("btn-start");
    startBtn.disabled = false;
    startBtn.textContent = "スタート";
    showTitle();
    requestAnimationFrame((t) => { last = t; loop(t); });
  }
  init();
})();
