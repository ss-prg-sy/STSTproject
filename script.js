/*
 * 運動でモンスターを倒すダイエットゲーム（MVP）
 * 担当: Bさん（戦闘処理／セーブ選択UI／演出）
 *
 * 仕様書 STSTproject.md の「5. 最小版（MVP）の範囲」に対応：
 *   - 運動を1種類だけ記録できる（腕立て10回）
 *   - 記録するとモンスターに固定ダメージ（＝プレイヤーの攻撃力）が入る
 *   - HPバーが減り、0になったら「討伐！」と表示される
 *   - セーブスロットを選んでプレイヤーごとにデータを保存できる
 */

(() => {
  "use strict";

  const STORAGE_KEY = "dietGame_saves_v1";
  const SLOT_COUNT = 3;
  const EXERCISE_LABEL = "腕立て10回";
  const BASE_ATTACK = 10;
  const ATTACK_GROWTH_PER_LEVEL = 5;
  const BASE_MONSTER_HP = 100;
  const MONSTER_HP_GROWTH = 40;
  const MONSTER_NAMES = ["スライム", "ゴブリン", "ワイルドボア", "オーガ", "ドラゴン"];

  /** @typedef {{
   *   playerName: string,
   *   level: number,
   *   attackPower: number,
   *   defeatCount: number,
   *   history: {date: string, label: string, damage: number}[],
   *   monsterHp: number,
   *   monsterMaxHp: number,
   *   monsterName: string,
   * }} SaveData
   */

  // ---------- セーブデータ管理 ----------

  function loadAllSaves() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return Array(SLOT_COUNT).fill(null);
      const parsed = JSON.parse(raw);
      const arr = Array(SLOT_COUNT).fill(null);
      for (let i = 0; i < SLOT_COUNT; i++) arr[i] = parsed[i] || null;
      return arr;
    } catch (e) {
      console.error("セーブデータの読み込みに失敗しました", e);
      return Array(SLOT_COUNT).fill(null);
    }
  }

  function saveAllSaves(saves) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(saves));
  }

  function newSaveData(playerName) {
    return {
      playerName,
      level: 1,
      attackPower: BASE_ATTACK,
      defeatCount: 0,
      history: [],
      monsterHp: BASE_MONSTER_HP,
      monsterMaxHp: BASE_MONSTER_HP,
      monsterName: MONSTER_NAMES[0],
    };
  }

  function monsterNameForLevel(level) {
    const idx = Math.min(level - 1, MONSTER_NAMES.length - 1);
    return MONSTER_NAMES[idx];
  }

  // ---------- アプリ状態 ----------

  let saves = loadAllSaves();
  let currentSlot = -1;
  let pendingNewSlot = -1;

  // ---------- 画面切り替え ----------

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((el) => {
      el.classList.toggle("active", el.id === id);
    });
  }

  // ---------- スロット選択画面 ----------

  function renderSlots() {
    const list = document.getElementById("slot-list");
    list.innerHTML = "";
    saves.forEach((save, i) => {
      const card = document.createElement("div");
      if (save) {
        card.className = "slot-card";
        card.innerHTML = `
          <div class="slot-title">スロット${i + 1}：${escapeHtml(save.playerName)}</div>
          <div class="slot-sub">Lv.${save.level}　討伐数 ${save.defeatCount}　攻撃力 ${save.attackPower}</div>
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
    saves[pendingNewSlot] = newSaveData(name);
    saveAllSaves(saves);
    enterGame(pendingNewSlot);
  }

  // ---------- ゲーム画面 ----------

  function enterGame(slotIndex) {
    currentSlot = slotIndex;
    showScreen("screen-game");
    renderGame();
  }

  function currentSave() {
    return saves[currentSlot];
  }

  function renderGame() {
    const save = currentSave();
    document.getElementById("player-name").textContent = save.playerName;
    document.getElementById("player-level").textContent = `Lv.${save.level}`;
    document.getElementById("monster-name").textContent = save.monsterName;
    document.getElementById("stat-attack").textContent = save.attackPower;
    document.getElementById("stat-defeat").textContent = save.defeatCount;
    document.getElementById("stat-records").textContent = save.history.length;
    updateHpBar(save, false);
    renderHistory(save);
  }

  function updateHpBar(save, animate) {
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
      li.innerHTML = `<span>${escapeHtml(h.date)}　${escapeHtml(h.label)}</span><span>-${h.damage}</span>`;
      list.appendChild(li);
    });
  }

  // ---------- 戦闘処理（Bさん担当） ----------

  function recordExercise() {
    const save = currentSave();
    if (!save) return;

    const btn = document.getElementById("btn-record");
    btn.disabled = true;

    const damage = save.attackPower;
    save.monsterHp = Math.max(0, save.monsterHp - damage);
    save.history.push({
      date: formatDate(new Date()),
      label: EXERCISE_LABEL,
      damage,
    });

    playHitAnimation(damage);
    updateHpBar(save, true);
    renderHistory(save);
    document.getElementById("stat-records").textContent = save.history.length;

    if (save.monsterHp <= 0) {
      setTimeout(() => defeatMonster(save, btn), 550);
    } else {
      saveAllSaves(saves);
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
    const banner = document.getElementById("defeat-banner");
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");

    save.defeatCount += 1;
    save.level += 1;
    save.attackPower += ATTACK_GROWTH_PER_LEVEL;
    save.monsterMaxHp = BASE_MONSTER_HP + (save.level - 1) * MONSTER_HP_GROWTH;
    save.monsterHp = save.monsterMaxHp;
    save.monsterName = monsterNameForLevel(save.level);

    saveAllSaves(saves);

    setTimeout(() => {
      banner.classList.remove("show");
      renderGame();
      btn.disabled = false;
    }, 1400);
  }

  function formatDate(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
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

  // ---------- 起動 ----------

  renderSlots();
  showScreen("screen-slots");
})();
