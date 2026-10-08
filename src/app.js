const app = document.querySelector("#app");

const [activity, rewardRules, itemData, resourceManifest] = await Promise.all([
  fetch("./data/demo-activity.json").then((response) => response.json()),
  fetch("./data/reward-rules.json").then((response) => response.json()),
  fetch("./data/items.json").then((response) => response.json()),
  fetch("./data/resource-manifest.json").then((response) => response.json())
]);

const learners = {
  james: { id: "james", name: "James", avatar: "J" },
  cyndi: { id: "cyndi", name: "Cyndi", avatar: "C" }
};

const STORAGE_PREFIX = "eav.rc01.learner.";
let learner = null;
let state = null;

function newState() {
  return {
    version: 1,
    coins: 0,
    materials: {
      MAT_WOOD: 0,
      MAT_PAPER: 0
    },
    collection: [],
    completedActivities: [],
    rewardHistory: []
  };
}

function loadState(learnerId) {
  const raw = localStorage.getItem(STORAGE_PREFIX + learnerId);
  if (!raw) return newState();

  try {
    return { ...newState(), ...JSON.parse(raw) };
  } catch {
    return newState();
  }
}

function saveState() {
  if (!learner || !state) return;
  localStorage.setItem(STORAGE_PREFIX + learner.id, JSON.stringify(state));
}

function item(itemId) {
  return itemData.items.find((entry) => entry.item_id === itemId);
}

function recipe(recipeId) {
  return itemData.recipes.find((entry) => entry.recipe_id === recipeId);
}

function header(title) {
  const paper = state?.materials?.MAT_PAPER ?? 0;
  const wood = state?.materials?.MAT_WOOD ?? 0;
  return `
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">E</div>
        <div>
          <div>English Adventure Village</div>
          <small>${title}</small>
        </div>
      </div>
      ${learner ? `
        <div class="statbar">
          <span class="stat">👤 ${learner.name}</span>
          <span class="stat">🪙 ${state.coins}</span>
          <span class="stat">Wood ${wood}</span>
          <span class="stat">Paper ${paper}</span>
        </div>` : ""}
    </div>
  `;
}

function bind(selector, handler) {
  const node = document.querySelector(selector);
  if (node) node.addEventListener("click", handler);
}

function renderLearnerSelect() {
  learner = null;
  state = null;

  app.innerHTML = `
    ${header("RC01 · First Playable Vertical Slice")}
    <section class="panel pixel-frame">
      <h1>誰要學習？</h1>
      <p class="lead">不需要密碼。每位學習者會在這台瀏覽器保存自己的進度。</p>
      <div class="learner-grid">
        ${Object.values(learners).map((entry) => `
          <article class="learner-card">
            <div class="brand-mark" aria-hidden="true">${entry.avatar}</div>
            <h2>${entry.name}</h2>
            <button data-learner="${entry.id}">進入村莊</button>
          </article>
        `).join("")}
      </div>
    </section>
  `;

  document.querySelectorAll("[data-learner]").forEach((button) => {
    button.addEventListener("click", () => {
      learner = learners[button.dataset.learner];
      state = loadState(learner.id);
      renderVillage();
    });
  });
}

function renderVillage(message = "") {
  app.innerHTML = `
    ${header("My Village")}
    <section class="village" aria-label="Pixel village demo">
      <div class="path"></div>
      <div class="building home"><span class="building-label">Mission House</span></div>
      <div class="building shop"><span class="building-label">Shop</span></div>
      <div class="building craft"><span class="building-label">Craft</span></div>
      <div class="building collection"><span class="building-label">Collection</span></div>
      <div class="player" title="${learner.name}"></div>
    </section>

    ${message ? `<p class="feedback">${message}</p>` : ""}

    <section class="panel pixel-frame">
      <h2>Unit 06 Demo</h2>
      <p class="lead">真正的英文內容來自 English_Learning_DB；遊戲只負責呈現、互動與獎勵。</p>
      <div class="action-grid">
        <article class="action-card">
          <h3>📖 Mission</h3>
          <p>${activity.game_projection.mission_title_zh_tw}</p>
          <button id="start-mission" class="primary">開始任務</button>
        </article>
        <article class="action-card">
          <h3>🏪 Shop</h3>
          <p>用 Coins 購買通用材料。</p>
          <button id="open-shop" class="secondary">前往商店</button>
        </article>
        <article class="action-card">
          <h3>🔨 Craft</h3>
          <p>把 Wood + Paper 合成 Bookshelf。</p>
          <button id="open-craft" class="secondary">前往合成</button>
        </article>
        <article class="action-card">
          <h3>📦 Collection</h3>
          <p>查看已經合成的物品。</p>
          <button id="open-collection" class="secondary">查看收藏</button>
        </article>
      </div>
      <p class="small-note">Source pin: ${resourceManifest.source_commit.slice(0, 12)} · ${activity.reading_entry_id}</p>
      <button id="change-learner" class="secondary">切換學習者</button>
    </section>
  `;

  bind("#start-mission", renderMission);
  bind("#open-shop", renderShop);
  bind("#open-craft", renderCraft);
  bind("#open-collection", renderCollection);
  bind("#change-learner", renderLearnerSelect);
}

function renderMission() {
  const completed = state.completedActivities.includes(activity.activity_id);

  app.innerHTML = `
    ${header("Mission · " + activity.game_projection.mission_title_zh_tw)}
    <section class="mission-card">
      <article class="reading-note">
        <span class="source-tag">Canonical · ${activity.reading_entry_id}</span>
        <h2>${activity.display_shell.title}</h2>
        <p>${activity.paragraph}</p>
        <p class="feedback">${activity.game_projection.instruction_zh_tw}</p>
        ${completed ? '<p class="small-note">這個 activity 已完成；重玩不會重複發放獎勵。</p>' : ""}
      </article>

      <div class="room" aria-label="Tom home room">
        <div class="object door" title="front door"></div>
        <div class="object small-table" title="small table"></div>
        <button class="object bag clickable-object" id="school-bag" aria-label="school bag" title="school bag"></button>
        <div class="object books" title="books"></div>
      </div>
    </section>
    <section class="panel pixel-frame">
      <button id="mission-back" class="secondary">回村莊</button>
    </section>
  `;

  bind("#school-bag", completeMission);
  bind("#mission-back", () => renderVillage());
}

function completeMission() {
  const alreadyCompleted = state.completedActivities.includes(activity.activity_id);

  if (!alreadyCompleted) {
    const reward = rewardRules.events.RC01_FIRST_CLEAR;
    state.coins += reward.coins;
    for (const [materialId, amount] of Object.entries(reward.materials)) {
      state.materials[materialId] = (state.materials[materialId] || 0) + amount;
    }
    state.completedActivities.push(activity.activity_id);
    state.rewardHistory.push({
      event: "RC01_FIRST_CLEAR",
      activityId: activity.activity_id,
      awardedAt: new Date().toISOString()
    });
    saveState();
  }

  renderReward(alreadyCompleted);
}

function renderReward(repeatClear) {
  app.innerHTML = `
    ${header("Mission Clear")}
    <section class="reward-card pixel-frame">
      <p class="reward-big">★</p>
      <h1>${repeatClear ? "再次找到 school bag" : "Mission Clear!"}</h1>
      ${repeatClear ? `
        <p>這是重玩紀錄，不重複發放 Coins 或材料。</p>
      ` : `
        <div class="reward-list">
          <span class="reward-chip">🪙 +10 Coins</span>
          <span class="reward-chip">📄 +1 Paper</span>
        </div>
      `}
      <button id="reward-village" class="primary">回村莊</button>
    </section>
  `;

  bind("#reward-village", () => renderVillage(repeatClear ? "重玩完成，獎勵未重複計算。" : "獎勵已保存到這位學習者的本機紀錄。"));
}

function renderShop(message = "") {
  const wood = item("MAT_WOOD");

  app.innerHTML = `
    ${header("Shop")}
    <section class="panel pixel-frame">
      <h1>Shop</h1>
      <p class="lead">RC01 只開放一種通用材料。</p>
      ${message ? `<p class="feedback">${message}</p>` : ""}
      <div class="item-row">
        <div>
          <strong>${wood.canonical_name}</strong> · ${wood.display_name_zh_tw}
          <div class="small-note">材料名稱採通用名稱。</div>
        </div>
        <button id="buy-wood" class="shop-button" ${state.coins < wood.shop_price_coins ? "disabled" : ""}>
          ${wood.shop_price_coins} Coins
        </button>
      </div>
      <div class="inventory">
        <span>🪙 Coins: ${state.coins}</span>
        <span>Wood: ${state.materials.MAT_WOOD}</span>
        <span>Paper: ${state.materials.MAT_PAPER}</span>
      </div>
      <button id="shop-back" class="secondary">回村莊</button>
    </section>
  `;

  bind("#buy-wood", () => {
    if (state.coins < wood.shop_price_coins) return;
    state.coins -= wood.shop_price_coins;
    state.materials.MAT_WOOD += 1;
    saveState();
    renderShop("購買完成：Wood +1");
  });
  bind("#shop-back", () => renderVillage());
}

function renderCraft(message = "") {
  const bookshelfRecipe = recipe("REC_BOOKSHELF");
  const hasBookshelf = state.collection.includes(bookshelfRecipe.produces_item_id);
  const canCraft = !hasBookshelf &&
    state.materials.MAT_WOOD >= bookshelfRecipe.requires.MAT_WOOD &&
    state.materials.MAT_PAPER >= bookshelfRecipe.requires.MAT_PAPER;

  app.innerHTML = `
    ${header("Craft")}
    <section class="panel pixel-frame">
      <h1>Craft</h1>
      <p class="lead">Wood ×1 + Paper ×1 → Bookshelf</p>
      ${message ? `<p class="feedback">${message}</p>` : ""}
      <div class="inventory">
        <span>Wood: ${state.materials.MAT_WOOD}</span>
        <span>Paper: ${state.materials.MAT_PAPER}</span>
      </div>
      <button id="craft-bookshelf" class="craft-button" ${canCraft ? "" : "disabled"}>
        ${hasBookshelf ? "Bookshelf 已收藏" : "Craft Bookshelf"}
      </button>
      <button id="craft-back" class="secondary">回村莊</button>
    </section>
  `;

  bind("#craft-bookshelf", () => {
    if (!canCraft) return;
    state.materials.MAT_WOOD -= bookshelfRecipe.requires.MAT_WOOD;
    state.materials.MAT_PAPER -= bookshelfRecipe.requires.MAT_PAPER;
    state.collection.push(bookshelfRecipe.produces_item_id);
    saveState();
    renderCraft("合成完成：Bookshelf 已加入 Collection。");
  });
  bind("#craft-back", () => renderVillage());
}

function renderCollection() {
  const bookshelf = item("OBJ_BOOKSHELF");
  const owned = state.collection.includes(bookshelf.item_id);

  app.innerHTML = `
    ${header("Collection")}
    <section class="panel pixel-frame">
      <h1>Collection</h1>
      <div class="collection-grid">
        <article class="collection-card">
          <div class="reward-big">${owned ? "📚" : "?"}</div>
          <h2>${owned ? bookshelf.canonical_name : "Locked"}</h2>
          <p>${owned ? bookshelf.display_name_zh_tw : "完成 Mission → Shop → Craft 來解鎖。"}</p>
        </article>
      </div>
      <button id="collection-back" class="secondary">回村莊</button>
    </section>
  `;

  bind("#collection-back", () => renderVillage());
}

renderLearnerSelect();
