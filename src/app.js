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
          <span class="stat">${learner.name}</span>
          <span class="stat">Coins ${state.coins}</span>
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
    ${header("Choose a learner")}
    <section class="hero-board pixel-frame">
      <h1>誰要學習？</h1>
      <p class="lead">選擇自己的角色。這台瀏覽器會分開保存兩位學習者的進度。</p>
      <div class="learner-grid">
        ${Object.values(learners).map((entry) => `
          <article class="learner-card">
            <div class="learner-avatar" aria-hidden="true">${entry.avatar}</div>
            <div>
              <h2>${entry.name}</h2>
              <div class="small-note">My English Adventure</div>
            </div>
            <button class="primary" data-learner="${entry.id}">進入村莊</button>
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
    <section class="village" aria-label="English Adventure Village">
      <div class="path-h"></div>
      <div class="path-v"></div>
      <div class="pond" aria-hidden="true"></div>

      <div class="tree t1"></div><div class="tree t2"></div>
      <div class="tree t3"></div><div class="tree t4"></div>
      <div class="tree t5"></div><div class="tree t6"></div>
      <div class="flower f1"></div><div class="flower f2"></div><div class="flower f3"></div>
      <div class="rock r1"></div><div class="rock r2"></div>
      <div class="fence f1"></div><div class="fence f2"></div>
      <div class="signpost">Unit 06</div>

      <button class="building home" data-nav="mission" aria-label="Mission House">
        <span class="building-label">Mission House</span>
      </button>
      <button class="building shop" data-nav="shop" aria-label="Shop">
        <span class="building-label">Shop</span>
      </button>
      <button class="building craft" data-nav="craft" aria-label="Craft">
        <span class="building-label">Craft</span>
      </button>
      <button class="building collection" data-nav="collection" aria-label="Collection">
        <span class="building-label">Collection</span>
      </button>

      <div class="player" title="${learner.name}"></div>
    </section>

    ${message ? `<p class="feedback">${message}</p>` : ""}

    <section class="quest-strip pixel-frame">
      <div>
        <h2>Today's Mission · ${activity.game_projection.mission_title_zh_tw}</h2>
        <p>閱讀提示，在房間裡找到 Tom 的 school bag。</p>
      </div>
      <div class="quest-actions">
        <button id="start-mission" class="primary">開始任務</button>
        <button id="change-learner" class="secondary">切換學習者</button>
      </div>
    </section>

    <details class="dev-details">
      <summary>Developer info</summary>
      <div>Source pin: ${resourceManifest.source_commit.slice(0, 12)} · ${activity.reading_entry_id}</div>
    </details>
  `;

  document.querySelectorAll("[data-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.nav;
      if (target === "mission") renderMission();
      if (target === "shop") renderShop();
      if (target === "craft") renderCraft();
      if (target === "collection") renderCollection();
    });
  });

  bind("#start-mission", () => renderMission());
  bind("#change-learner", () => renderLearnerSelect());
}

function renderMission() {
  const completed = state.completedActivities.includes(activity.activity_id);

  app.innerHTML = `
    ${header("Mission · " + activity.game_projection.mission_title_zh_tw)}
    <section class="mission-shell">
      <div class="mission-titlebar">
        <h1>Find Tom's school bag</h1>
        <div class="target-chip">Target: school bag</div>
      </div>

      <div class="mission-grid">
        <article class="reading-note">
          <div class="note-tab">Tom's Note</div>
          <h2>${activity.display_shell.title}</h2>
          <p>${activity.paragraph}</p>
          <p class="feedback">${activity.game_projection.instruction_zh_tw}</p>
          ${completed ? '<p class="small-note">已完成：重玩不會再次取得 Coins 或 Paper。</p>' : ""}
          <details class="dev-details">
            <summary>Developer info</summary>
            <div>Canonical · ${activity.reading_entry_id}</div>
          </details>
        </article>

        <div class="room" aria-label="Tom home room">
          <div class="wall-strip"></div>
          <div class="window"></div>
          <div class="bed"></div>
          <div class="rug"></div>
          <div class="plant"></div>
          <div class="object door" title="front door"></div>
          <div class="object small-table" title="small table"></div>
          <button class="object bag clickable-object" id="school-bag" aria-label="school bag" title="school bag"></button>
          <div class="object books" title="books"></div>
        </div>
      </div>

      <section class="panel pixel-frame">
        <button id="mission-back" class="secondary">回村莊</button>
      </section>
    </section>
  `;

  bind("#school-bag", () => completeMission());
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
          <span class="reward-chip">+10 Coins</span>
          <span class="reward-chip">+1 Paper</span>
        </div>
      `}
      <button id="reward-village" class="primary">回村莊</button>
    </section>
  `;

  bind("#reward-village", () => renderVillage(repeatClear ? "重玩完成，獎勵未重複計算。" : "任務獎勵已放進你的背包。"));
}

function renderShop(message = "") {
  const wood = item("MAT_WOOD");

  app.innerHTML = `
    ${header("Shop")}
    <section class="game-window pixel-frame">
      <div class="window-grid">
        <aside class="npc-panel">
          <div class="npc-portrait" aria-hidden="true">S</div>
          <h2>Village Shop</h2>
          <p>需要材料嗎？今天可以買 Wood。</p>
        </aside>

        <div class="item-board">
          <h1>Shop</h1>
          ${message ? `<p class="feedback">${message}</p>` : ""}
          <article class="item-card">
            <div class="item-icon" aria-hidden="true">W</div>
            <div class="item-meta">
              <strong>${wood.canonical_name}</strong>
              <span>${wood.display_name_zh_tw}</span>
              <small>Common crafting material</small>
            </div>
            <button id="buy-wood" class="shop-button" ${state.coins < wood.shop_price_coins ? "disabled" : ""}>
              ${wood.shop_price_coins} Coins
            </button>
          </article>
          <div class="inventory">
            <span>Coins: ${state.coins}</span>
            <span>Wood: ${state.materials.MAT_WOOD}</span>
            <span>Paper: ${state.materials.MAT_PAPER}</span>
          </div>
          <button id="shop-back" class="secondary">回村莊</button>
        </div>
      </div>
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
    <section class="game-window pixel-frame">
      <div class="window-grid">
        <aside class="npc-panel">
          <div class="npc-portrait" aria-hidden="true">C</div>
          <h2>Craft Table</h2>
          <p>把材料組合成可以收藏的物品。</p>
        </aside>

        <div class="item-board">
          <h1>Bookshelf Recipe</h1>
          ${message ? `<p class="feedback">${message}</p>` : ""}
          <div class="recipe-card">
            <div class="recipe-slot">
              <div>
                <div class="item-icon" aria-hidden="true">W</div>
                <strong>Wood ×1</strong>
              </div>
            </div>
            <div class="recipe-symbol">+</div>
            <div class="recipe-slot">
              <div>
                <div class="item-icon" aria-hidden="true">P</div>
                <strong>Paper ×1</strong>
              </div>
            </div>
            <div class="recipe-symbol">→</div>
            <div class="recipe-slot">
              <div>
                <div class="item-icon" aria-hidden="true">B</div>
                <strong>Bookshelf</strong>
              </div>
            </div>
          </div>
          <div class="inventory">
            <span>Wood: ${state.materials.MAT_WOOD}</span>
            <span>Paper: ${state.materials.MAT_PAPER}</span>
          </div>
          <button id="craft-bookshelf" class="craft-button" ${canCraft ? "" : "disabled"}>
            ${hasBookshelf ? "Bookshelf 已收藏" : "Craft Bookshelf"}
          </button>
          <button id="craft-back" class="secondary">回村莊</button>
        </div>
      </div>
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

  const futureSlots = ["Chair", "Lamp", "Plant", "Mailbox", "Desk"];

  app.innerHTML = `
    ${header("Collection")}
    <section class="game-window pixel-frame">
      <h1>My Collection</h1>
      <p class="lead">完成任務、購買材料並合成物品，慢慢把收藏冊填滿。</p>
      <div class="collection-grid">
        <article class="collection-card ${owned ? "" : "locked"}">
          <div class="collection-icon">${owned ? "B" : "?"}</div>
          <h2>${owned ? bookshelf.canonical_name : "Bookshelf"}</h2>
          <p>${owned ? bookshelf.display_name_zh_tw : "Locked · Mission → Shop → Craft"}</p>
        </article>
        ${futureSlots.map((name) => `
          <article class="collection-card locked">
            <div class="collection-icon">?</div>
            <h2>${name}</h2>
            <p>Coming later</p>
          </article>
        `).join("")}
      </div>
      <button id="collection-back" class="secondary">回村莊</button>
    </section>
  `;

  bind("#collection-back", () => renderVillage());
}

renderLearnerSelect();
