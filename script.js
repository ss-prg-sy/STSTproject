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
  const EXERCISE_LABEL = "腕立て10回";
  const FIXED_DAMAGE = 20; // MVPでは固定ダメージで割り切る（Issue #4 補足）
  const HISTORY_LIMIT = 50; // 直近50件、51件目で最古を削除（Issue #4）
  const BASE_MONSTER_HP = 100;
  const MONSTER_HP_GROWTH = 40;
  const MONSTER_NAMES = ["スライム", "ゴブリン", "ワイルドボア", "オーガ", "ドラゴン"];

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
      attackPower: FIXED_DAMAGE,
      defeatCount: 0,
      history: [],
      monsterHp: BASE_MONSTER_HP,
      monsterMaxHp: BASE_MONSTER_HP,
      monsterName: MONSTER_NAMES[0],
      lastPlayedAt: nowString(),
    };
  }

  function monsterNameForLevel(level) {
    const idx = Math.min(level - 1, MONSTER_NAMES.length - 1);
    return MONSTER_NAMES[idx];
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
    renderGame();
  }

  function currentSave() {
    return getSlot(currentSlot);
  }

  function renderGame() {
    const save = currentSave();
    document.getElementById("player-name").textContent = save.playerName;
    document.getElementById("player-level").textContent = `Lv.${save.level}`;
    document.getElementById("monster-name").textContent = save.monsterName;
    document.getElementById("stat-attack").textContent = save.attackPower;
    document.getElementById("stat-defeat").textContent = save.defeatCount;
    document.getElementById("stat-records").textContent = save.history.length;
    updateHpBar(save);
    renderHistory(save);
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
      li.innerHTML = `<span>${escapeHtml(h.date)}　${escapeHtml(h.label)}</span><span>-${h.damage}</span>`;
      list.appendChild(li);
    });
  }

  // ---------- 戦闘処理（Issue #4, #5） ----------

  function recordExercise() {
    const save = currentSave();
    if (!save) return;

    const btn = document.getElementById("btn-record");
    btn.disabled = true;

    const damage = FIXED_DAMAGE;
    save.monsterHp = Math.max(0, save.monsterHp - damage);
    save.history.push({
      date: nowString(),
      label: EXERCISE_LABEL,
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
    const banner = document.getElementById("defeat-banner");
    banner.classList.remove("show");
    void banner.offsetWidth;
    banner.classList.add("show");

    // Issue #5: 討伐数+1 → level = floor(討伐数/3)+1 で再計算 → 次モンスターHP満タン
    save.defeatCount += 1;
    save.level = Math.floor(save.defeatCount / 3) + 1;
    save.monsterMaxHp = BASE_MONSTER_HP + (save.level - 1) * MONSTER_HP_GROWTH;
    save.monsterHp = save.monsterMaxHp;
    save.monsterName = monsterNameForLevel(save.level);

    saveStorage();

    setTimeout(() => {
      banner.classList.remove("show");
      renderGame();
      btn.disabled = false;
    }, 1400);
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

  // ---------- 起動 ----------

  renderSlots();
  showScreen("screen-slots");
})();
