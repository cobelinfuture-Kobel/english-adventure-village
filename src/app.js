const app = document.querySelector('#app');
const BUILD_VERSION = 'u06-writing360-preview-r1-20261010';
const ADMIN_WRITING_PREVIEW = new URLSearchParams(window.location.search).get('admin') === 'writing360';
const ATLAS_PART_URLS = Array.from({ length: 6 }, (_, index) => `./assets/anchor-v1/atlas.b64.part${index + 1}?v=${BUILD_VERSION}`);

async function installApprovedPixelAtlas() {
  const parts = await Promise.all(ATLAS_PART_URLS.map((url) => fetch(url).then((response) => {
    if (!response.ok) throw new Error(`Asset atlas part failed: ${url}`);
    return response.text();
  })));
  document.documentElement.style.setProperty('--anchor-atlas', `url(\"data:image/png;base64,${parts.join('')}\")`);
}

await installApprovedPixelAtlas();

const writingPreviewPromise = ADMIN_WRITING_PREVIEW
  ? fetch('./data/writing360-pilot15-preview.json').then((response) => response.json())
  : Promise.resolve(null);

const [missionsData, rewardRules, itemData, resourceManifest, writingPreviewData] = await Promise.all([
  fetch('./data/missions.json').then((response) => response.json()),
  fetch('./data/reward-rules.json').then((response) => response.json()),
  fetch('./data/items.json').then((response) => response.json()),
  fetch('./data/resource-manifest.json').then((response) => response.json()),
  writingPreviewPromise
]);

const missions = missionsData.missions;
const writingPreviewPilots = writingPreviewData?.pilots || [];

const learners = {
  james: { id: 'james', name: 'James', sprite: 'james' },
  cyndi: { id: 'cyndi', name: 'Cyndi', sprite: 'cyndi' }
};

const STORAGE_PREFIX = 'eav.rc01.learner.';
let learner = null;
let state = null;
let activeMissionId = null;
let missionProgress = {};

const WRITING_PREVIEW_STORAGE_KEY = 'eav.admin.writing360.preview.v1';
let writingPreviewState = loadWritingPreviewState();

function loadWritingPreviewState() {
  const base = { completedEntries: [], attempts: {}, lastEntryId: null };
  try {
    const raw = localStorage.getItem(WRITING_PREVIEW_STORAGE_KEY);
    return raw ? { ...base, ...JSON.parse(raw) } : base;
  } catch {
    return base;
  }
}

function saveWritingPreviewState() {
  localStorage.setItem(WRITING_PREVIEW_STORAGE_KEY, JSON.stringify(writingPreviewState));
}

function normalizeWritingAnswer(value) {
  return String(value || '').trim().replace(/\s+/g, ' ');
}

function writingStageEntries(stage) {
  return writingPreviewPilots.filter((entry) => entry.stage === stage);
}

function writingEntryComplete(entry) {
  return writingPreviewState.completedEntries.includes(entry.writing_entry_id);
}

function writingStageMastered(stage) {
  const entries = writingStageEntries(stage);
  return entries.length > 0 && entries.every(writingEntryComplete);
}

function nextWritingStage() {
  return writingPreviewData?.stage_order?.find((stage) => !writingStageMastered(stage.stage))?.stage || 4;
}

function missionById(missionId) {
  return missions.find((mission) => mission.mission_id === missionId);
}

function missionCompleted(mission) {
  return state?.completedActivities?.includes(mission.activity_id) ?? false;
}

function nextMission() {
  return missions.find((mission) => !missionCompleted(mission)) || missions[0];
}

function missionStatusLabel(mission) {
  return missionCompleted(mission) ? '完成' : mission.mission_id === nextMission().mission_id ? '下一個任務' : '可挑戰';
}

function sprite(group, name, label = '', extraClass = '') {
  return `<span class="sprite atlas-${group} sprite-${name} ${extraClass}" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}></span>`;
}

function newState() {
  return {
    version: 1,
    coins: 0,
    materials: { MAT_WOOD: 0, MAT_PAPER: 0 },
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
        </div>` : ''}
    </div>
  `;
}

function bind(selector, handler) {
  const node = document.querySelector(selector);
  if (node) node.addEventListener('click', handler);
}

function renderLearnerSelect() {
  learner = null;
  state = null;

  app.innerHTML = `
    ${header('Choose a learner')}
    <section class="hero-board pixel-frame">
      <h1>誰要學習？</h1>
      <p class="lead">選擇自己的角色。這台瀏覽器會分開保存兩位學習者的進度。</p>
      <div class="learner-grid">
        ${Object.values(learners).map((entry) => `
          <article class="learner-card">
            <div class="learner-art">${sprite('characters', entry.sprite, entry.name)}</div>
            <div>
              <h2>${entry.name}</h2>
              <div class="small-note">My English Adventure</div>
            </div>
            <button class="primary" data-learner="${entry.id}">進入村莊</button>
          </article>
        `).join('')}
      </div>
      ${ADMIN_WRITING_PREVIEW ? `
        <section class="admin-preview-launch">
          <div>
            <strong>Writing360 · 管理者預覽</strong>
            <p>HOLD 期間只開放 Pilot15 內部驗收；不寫入 James / Cyndi 的正式學習進度。</p>
          </div>
          <button id="open-writing-preview" class="secondary">開啟 Writing360 Pilot15</button>
        </section>
      ` : ''}
    </section>
  `;

  document.querySelectorAll('[data-learner]').forEach((button) => {
    button.addEventListener('click', () => {
      learner = learners[button.dataset.learner];
      state = loadState(learner.id);
      renderVillage();
    });
  });

  bind('#open-writing-preview', () => renderWritingPreviewHome());
}

function renderWritingPreviewHome() {
  if (!ADMIN_WRITING_PREVIEW || !writingPreviewData?.admission?.admin_preview_allowed) {
    renderLearnerSelect();
    return;
  }

  const completed = writingPreviewPilots.filter(writingEntryComplete).length;
  const recommendedStage = nextWritingStage();

  app.innerHTML = `
    ${header('Writing360 Admin Preview')}
    <section class="game-window pixel-frame writing-preview-shell">
      <div class="writing-preview-head">
        <div>
          <span class="preview-badge">HOLD · ADMIN PREVIEW ONLY</span>
          <h1>Unit 06 Writing360 · Pilot15</h1>
          <p class="lead">15 筆已人工核准 Pilot，用來驗收網站四階段 Writing 功能。學生正式入口仍關閉。</p>
        </div>
        <div class="mission-count">${completed} / ${writingPreviewPilots.length}</div>
      </div>

      <div class="writing-stage-grid">
        ${writingPreviewData.stage_order.map((stage) => {
          const entries = writingStageEntries(stage.stage);
          const stageDone = entries.filter(writingEntryComplete).length;
          const mastered = writingStageMastered(stage.stage);
          return `
            <article class="writing-stage-card ${stage.stage === recommendedStage ? 'writing-stage-current' : ''}">
              <div class="mission-card-topline">
                <span class="mission-number">Stage ${stage.stage}</span>
                <span class="mission-status">${mastered ? 'Preview Mastered' : stage.stage === recommendedStage ? '建議下一階段' : '可預覽'}</span>
              </div>
              <h2>${stage.label_zh_tw}</h2>
              <div class="mission-family">${stage.operation}</div>
              <p>${stageDone} / ${entries.length} Pilot 完成</p>
              <button class="${stage.stage === recommendedStage ? 'primary' : 'secondary'}" data-writing-stage="${stage.stage}">查看此階段</button>
            </article>
          `;
        }).join('')}
      </div>

      <section class="preview-boundary">
        <strong>Release gate</strong>
        <span>Admin preview: ON</span>
        <span>Learner release: OFF</span>
        <span>Full360 admission: HOLD</span>
      </section>

      <button id="writing-preview-back" class="secondary">回到學習者選擇</button>
    </section>
  `;

  document.querySelectorAll('[data-writing-stage]').forEach((button) => {
    button.addEventListener('click', () => renderWritingStage(Number(button.dataset.writingStage)));
  });
  bind('#writing-preview-back', () => renderLearnerSelect());
}

function renderWritingStage(stageNumber) {
  if (!ADMIN_WRITING_PREVIEW || !writingPreviewData) return renderLearnerSelect();
  const stageMeta = writingPreviewData.stage_order.find((stage) => stage.stage === stageNumber);
  const entries = writingStageEntries(stageNumber);
  if (!stageMeta) return renderWritingPreviewHome();

  app.innerHTML = `
    ${header('Writing360 · Stage ' + stageNumber)}
    <section class="game-window pixel-frame writing-preview-shell">
      <div class="writing-preview-head">
        <div>
          <span class="preview-badge">Pilot15 Preview</span>
          <h1>Stage ${stageNumber} · ${stageMeta.label_zh_tw}</h1>
          <p class="lead">${stageMeta.operation}</p>
        </div>
        <div class="mission-count">${entries.filter(writingEntryComplete).length} / ${entries.length}</div>
      </div>

      <div class="writing-entry-grid">
        ${entries.map((entry) => `
          <article class="writing-entry-card ${writingEntryComplete(entry) ? 'mission-complete' : ''}">
            <div class="mission-card-topline">
              <span class="mission-number">${entry.pilot_id}</span>
              <span class="mission-status">${writingEntryComplete(entry) ? 'E2E PASS' : entry.support}</span>
            </div>
            <h2>${entry.title}</h2>
            <div class="mission-family">${entry.writing_entry_id}</div>
            <p>${entry.target_chunk_surfaces.join(' · ')}</p>
            <button class="secondary" data-writing-entry="${entry.writing_entry_id}">${writingEntryComplete(entry) ? '重新預覽' : '開始預覽'}</button>
          </article>
        `).join('')}
      </div>

      <div class="mission-footer-actions">
        <button id="writing-stage-home" class="secondary">四階段總覽</button>
        <button id="writing-stage-back" class="secondary">回到學習者選擇</button>
      </div>
    </section>
  `;

  document.querySelectorAll('[data-writing-entry]').forEach((button) => {
    button.addEventListener('click', () => renderWritingActivity(button.dataset.writingEntry));
  });
  bind('#writing-stage-home', () => renderWritingPreviewHome());
  bind('#writing-stage-back', () => renderLearnerSelect());
}

function renderWritingActivity(writingEntryId, result = null) {
  if (!ADMIN_WRITING_PREVIEW || !writingPreviewData) return renderLearnerSelect();
  const entry = writingPreviewPilots.find((item) => item.writing_entry_id === writingEntryId);
  if (!entry) return renderWritingPreviewHome();

  writingPreviewState.lastEntryId = writingEntryId;
  saveWritingPreviewState();

  app.innerHTML = `
    ${header('Writing360 · ' + entry.pilot_id)}
    <section class="writing-activity-layout">
      <aside class="writing-fact-panel pixel-frame">
        <span class="preview-badge">HOLD Preview</span>
        <h1>${entry.title}</h1>
        <div class="mission-family">${entry.operation}</div>
        <h2>Fact card</h2>
        <dl class="fact-card-list">
          ${entry.fact_card.map((fact) => `<div><dt>${fact.label}</dt><dd>${fact.value}</dd></div>`).join('')}
        </dl>
        ${entry.word_bank.length ? `
          <h2>Word bank</h2>
          <div class="word-bank">${entry.word_bank.map((word) => `<span>${word}</span>`).join('')}</div>
        ` : ''}
      </aside>

      <section class="writing-work-panel pixel-frame">
        <h1>${entry.title}</h1>
        <p class="writing-instruction">${entry.instruction}</p>

        ${entry.given_model ? `
          <div class="worked-example">
            <strong>Model</strong>
            <p>${entry.given_model}</p>
          </div>
        ` : entry.worked_example?.complete_sentence ? `
          <div class="worked-example">
            <strong>Worked example</strong>
            <p>${entry.worked_example.complete_sentence}</p>
          </div>
        ` : ''}

        <form id="writing-answer-form" class="writing-answer-form">
          ${entry.sentence_frames.map((frame, index) => `
            <label class="writing-sentence-row">
              <span>Sentence ${index + 1}</span>
              <small>${frame}</small>
              ${entry.hints[index] ? `<em>${entry.hints[index]}</em>` : ''}
              <input type="text" name="sentence-${index}" autocomplete="off" spellcheck="false" aria-label="Sentence ${index + 1}" />
            </label>
          `).join('')}
          <button type="submit" class="primary">檢查答案</button>
        </form>

        ${result ? `
          <section class="writing-result ${result.allCorrect ? 'writing-result-pass' : 'writing-result-retry'}">
            <h2>${result.allCorrect ? 'Pilot E2E PASS' : '再檢查一次'}</h2>
            <ol>
              ${result.lines.map((line) => `<li class="${line.correct ? 'answer-pass' : 'answer-retry'}">${line.correct ? '✓' : '△'} Sentence ${line.number}</li>`).join('')}
            </ol>
            ${!result.allCorrect ? `
              <details>
                <summary>管理者：送出後查看 canonical model answer</summary>
                ${entry.model_answer.map((answer) => `<p>${answer}</p>`).join('')}
              </details>
            ` : ''}
          </section>
        ` : ''}

        <div class="mission-footer-actions">
          <button id="writing-entry-stage" class="secondary">回 Stage ${entry.stage}</button>
          <button id="writing-entry-home" class="secondary">四階段總覽</button>
        </div>
      </section>
    </section>
  `;

  const form = document.querySelector('#writing-answer-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const lines = entry.model_answer.map((expected, index) => {
      const actual = normalizeWritingAnswer(formData.get(`sentence-${index}`));
      return {
        number: index + 1,
        actual,
        expected,
        correct: actual === normalizeWritingAnswer(expected)
      };
    });
    const allCorrect = lines.every((line) => line.correct);
    writingPreviewState.attempts[entry.writing_entry_id] = (writingPreviewState.attempts[entry.writing_entry_id] || 0) + 1;
    if (allCorrect && !writingEntryComplete(entry)) {
      writingPreviewState.completedEntries.push(entry.writing_entry_id);
    }
    saveWritingPreviewState();
    renderWritingActivity(entry.writing_entry_id, { allCorrect, lines });
  });

  bind('#writing-entry-stage', () => renderWritingStage(entry.stage));
  bind('#writing-entry-home', () => renderWritingPreviewHome());
}

function renderVillage(message = '') {
  const featuredMission = nextMission();

  app.innerHTML = `
    ${header('My Village')}
    <section class="village" aria-label="English Adventure Village">
      <div class="path-h"></div>
      <div class="path-v"></div>

      <div class="village-prop prop-tree-a">${sprite('props', 'tree-deciduous', 'tree')}</div>
      <div class="village-prop prop-tree-b">${sprite('props', 'tree-pine', 'pine tree')}</div>
      <div class="village-prop prop-tree-c">${sprite('props', 'tree-deciduous', 'tree')}</div>
      <div class="village-prop prop-pond">${sprite('props', 'pond', 'pond')}</div>
      <div class="village-prop prop-sign">${sprite('props', 'signpost', 'signpost')}</div>
      <div class="village-prop prop-flowers-a">${sprite('props', 'flowers', 'flowers')}</div>
      <div class="village-prop prop-flowers-b">${sprite('props', 'flowers', 'flowers')}</div>
      <div class="village-prop prop-rock">${sprite('props', 'rock', 'rock')}</div>
      <div class="village-prop prop-fence-a">${sprite('props', 'fence', 'fence')}</div>
      <div class="village-prop prop-fence-b">${sprite('props', 'fence', 'fence')}</div>

      <button class="building-button building-home" data-nav="mission-house" aria-label="Mission House">
        ${sprite('buildings', 'mission-house', 'Mission House')}
        <span>Mission House</span>
      </button>
      <button class="building-button building-shop" data-nav="shop" aria-label="Shop">
        ${sprite('buildings', 'shop', 'Shop')}
        <span>Shop</span>
      </button>
      <button class="building-button building-craft" data-nav="craft" aria-label="Craft House">
        ${sprite('buildings', 'craft-house', 'Craft House')}
        <span>Craft</span>
      </button>
      <button class="building-button building-collection" data-nav="collection" aria-label="Collection House">
        ${sprite('buildings', 'collection-house', 'Collection House')}
        <span>Collection</span>
      </button>

      <div class="player-art player-${learner.id}">${sprite('characters', learner.sprite, learner.name)}</div>
    </section>

    ${message ? `<p class="feedback">${message}</p>` : ''}

    <section class="quest-strip pixel-frame">
      <div>
        <h2>Next Mission · ${featuredMission.game_projection.mission_title_zh_tw}</h2>
        <p>${featuredMission.game_projection.instruction_zh_tw}</p>
        <div class="mission-progress-summary">Unit 06 · ${state.completedActivities.filter((activityId) => missions.some((mission) => mission.activity_id === activityId)).length} / ${missions.length} missions complete</div>
      </div>
      <div class="quest-actions">
        <button id="start-mission" class="primary">開始下一個任務</button>
        <button id="open-mission-house" class="secondary">Mission House</button>
        <button id="change-learner" class="secondary">切換學習者</button>
      </div>
    </section>

    <details class="dev-details">
      <summary>Developer info</summary>
      <div>Source pin: ${resourceManifest.source_commit.slice(0, 12)} · 4 canonical Reading360 entries</div>
      <div>Visual asset anchor: cozy-16bit-pixel-rpg-v1</div>
      <div>Build: ${BUILD_VERSION}</div>
    </details>
  `;

  document.querySelectorAll('[data-nav]').forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.dataset.nav;
      if (target === 'mission-house') renderMissionHouse();
      if (target === 'shop') renderShop();
      if (target === 'craft') renderCraft();
      if (target === 'collection') renderCollection();
    });
  });

  bind('#start-mission', () => renderMission(featuredMission.mission_id));
  bind('#open-mission-house', () => renderMissionHouse());
  bind('#change-learner', () => renderLearnerSelect());
}

function renderMissionHouse() {
  const featuredMission = nextMission();

  app.innerHTML = `
    ${header('Mission House')}
    <section class="game-window pixel-frame mission-house-window">
      <div class="mission-house-header">
        <div>
          <h1>Unit 06 Mission House</h1>
          <p class="lead">選一個任務開始今天的冒險。四個任務都可以挑戰。</p>
        </div>
        <div class="mission-count">${missions.filter(missionCompleted).length} / ${missions.length}</div>
      </div>
      <div class="mission-card-grid">
        ${missions.map((mission, index) => {
          const complete = missionCompleted(mission);
          const featured = mission.mission_id === featuredMission.mission_id;
          return `
            <article class="mission-card ${complete ? 'mission-complete' : ''} ${featured ? 'mission-featured' : ''}">
              <div class="mission-card-topline">
                <span class="mission-number">M${String(index + 1).padStart(2, '0')}</span>
                <span class="mission-status">${missionStatusLabel(mission)}</span>
              </div>
              <h2>${mission.game_projection.mission_title_zh_tw}</h2>
              <div class="mission-family">${mission.display_shell.label}</div>
              <p>${mission.game_projection.instruction_zh_tw}</p>
              <button class="${featured ? 'primary' : 'secondary'}" data-mission-id="${mission.mission_id}">${complete ? '重玩任務' : '進入任務'}</button>
            </article>
          `;
        }).join('')}
      </div>
      <button id="mission-house-back" class="secondary">回村莊</button>
    </section>
  `;

  document.querySelectorAll('[data-mission-id]').forEach((button) => {
    button.addEventListener('click', () => renderMission(button.dataset.missionId));
  });
  bind('#mission-house-back', () => renderVillage());
}

function renderMission(missionId) {
  const mission = missionById(missionId);
  if (!mission) return renderMissionHouse();

  activeMissionId = missionId;
  missionProgress = {};
  const completed = missionCompleted(mission);

  app.innerHTML = `
    ${header('Mission · ' + mission.game_projection.mission_title_zh_tw)}
    <section class="mission-shell">
      <div class="mission-titlebar">
        <h1>${mission.game_projection.mission_title_zh_tw}</h1>
        <div class="target-chip">目標：${mission.game_projection.target_label}</div>
      </div>

      <div class="mission-grid">
        <article class="reading-note">
          <div class="note-tab">${mission.display_shell.label}</div>
          <h2>${mission.display_shell.title}</h2>
          <p>${mission.paragraph}</p>
          <p class="feedback">${mission.game_projection.instruction_zh_tw}</p>
          ${completed ? '<p class="small-note">已完成：重玩不會再次取得 Coins 或 Paper。</p>' : ''}
          <details class="dev-details">
            <summary>Developer info</summary>
            <div>Canonical · ${mission.reading_entry_id}</div>
            <div>${mission.family_id} · ${mission.interaction_type}</div>
          </details>
        </article>

        ${renderMissionScene(mission)}
      </div>

      <section class="panel pixel-frame mission-footer-actions">
        <button id="mission-list" class="secondary">Mission House</button>
        <button id="mission-back" class="secondary">回村莊</button>
      </section>
    </section>
  `;

  bindMissionScene(mission);
  bind('#mission-list', () => renderMissionHouse());
  bind('#mission-back', () => renderVillage());
}

function renderMissionScene(mission) {
  if (mission.interaction_type === 'FIND_OBJECT') {
    return `
      <div class="room scene-find-bag" aria-label="Tom home room">
        <div class="room-wall"></div>
        <div class="room-object room-window">${sprite('room', 'window', 'window')}</div>
        <div class="room-object room-bed">${sprite('room', 'bed', 'bed')}</div>
        <div class="room-object room-rug">${sprite('room', 'rug', 'rug')}</div>
        <div class="room-object room-plant">${sprite('room', 'plant', 'plant')}</div>
        <div class="room-object room-door">${sprite('room', 'door', 'door')}</div>
        <div class="room-object room-table">${sprite('room', 'small-table', 'small table')}</div>
        <button class="room-target room-bag" id="school-bag" aria-label="school bag">
          ${sprite('room', 'school-bag', 'school bag')}
        </button>
        <div class="room-object room-books">${sprite('room', 'books', 'books')}</div>
      </div>
    `;
  }

  if (mission.interaction_type === 'CLEAN_ROOM') {
    return `
      <div class="room scene-clean-room" aria-label="Leo bedroom">
        <div class="room-wall"></div>
        <div class="room-object clean-bed">${sprite('room', 'bed', 'bed')}</div>
        <div class="room-object clean-desk">${sprite('room', 'small-table', 'desk')}</div>
        <div class="cloth-on-desk" role="img" aria-label="cloth"></div>
        <button class="room-target floor-book floor-book-a" data-clean-book="a" aria-label="book on the floor">
          <span class="book-cover"></span><span class="book-pages"></span>
        </button>
        <button class="room-target floor-book floor-book-b" data-clean-book="b" aria-label="book on the floor">
          <span class="book-cover"></span><span class="book-pages"></span>
        </button>
        <div class="scene-status" id="clean-status">0 / 2 books</div>
      </div>
    `;
  }

  if (mission.interaction_type === 'CLOSE_DOOR') {
    return `
      <div class="room scene-hallway" aria-label="home hallway">
        <div class="hallway-wall"></div>
        <div class="hallway-mat"></div>
        <div class="hallway-family">家人在屋內</div>
        <button class="room-target hallway-door door-open-state" id="front-door" aria-label="open front door">
          <span class="doorway-shadow"></span>
          ${sprite('room', 'door', 'front door')}
        </button>
        <div class="scene-status" id="door-status">front door = open</div>
      </div>
    `;
  }

  return `
    <div class="room scene-media-room" aria-label="school media room">
      <div class="media-wall"></div>
      <div class="class-display" role="img" aria-label="class display">
        <span class="display-card display-card-a"></span>
        <span class="display-card display-card-b"></span>
        <span class="display-card display-card-c"></span>
        <strong>class display</strong>
      </div>
      <div class="media-table">${sprite('room', 'small-table', 'table')}</div>
      <div class="media-friend">${sprite('characters', 'cyndi', 'friend')}</div>
      <button class="camera-on-table" id="take-photo" aria-label="camera">
        <span class="camera-lens"></span>
        <span class="camera-label">camera</span>
      </button>
      <div class="photo-flash" id="photo-flash"></div>
      <div class="scene-status">按 camera 拍 class display</div>
    </div>
  `;
}

function bindMissionScene(mission) {
  if (mission.interaction_type === 'FIND_OBJECT') {
    bind('#school-bag', () => completeMission(mission));
    return;
  }

  if (mission.interaction_type === 'CLEAN_ROOM') {
    document.querySelectorAll('[data-clean-book]').forEach((button) => {
      button.addEventListener('click', () => {
        const bookId = button.dataset.cleanBook;
        if (missionProgress[bookId]) return;
        missionProgress[bookId] = true;
        button.classList.add('book-cleaned');
        const count = Object.keys(missionProgress).length;
        const status = document.querySelector('#clean-status');
        if (status) status.textContent = `${count} / 2 books`;
        if (count === 2) setTimeout(() => completeMission(mission), 350);
      });
    });
    return;
  }

  if (mission.interaction_type === 'CLOSE_DOOR') {
    bind('#front-door', () => {
      const door = document.querySelector('#front-door');
      if (!door || missionProgress.closed) return;
      missionProgress.closed = true;
      door.classList.remove('door-open-state');
      door.classList.add('door-closed-state');
      const status = document.querySelector('#door-status');
      if (status) status.textContent = 'front door = closed';
      setTimeout(() => completeMission(mission), 450);
    });
    return;
  }

  bind('#take-photo', () => {
    if (missionProgress.photoTaken) return;
    missionProgress.photoTaken = true;
    const flash = document.querySelector('#photo-flash');
    if (flash) flash.classList.add('flash-active');
    setTimeout(() => completeMission(mission), 500);
  });
}

function completeMission(mission) {
  const alreadyCompleted = missionCompleted(mission);

  if (!alreadyCompleted) {
    const reward = rewardRules.events.RC01_FIRST_CLEAR;
    state.coins += reward.coins;
    for (const [materialId, amount] of Object.entries(reward.materials)) {
      state.materials[materialId] = (state.materials[materialId] || 0) + amount;
    }
    state.completedActivities.push(mission.activity_id);
    state.rewardHistory.push({
      event: 'RC01_FIRST_CLEAR',
      missionId: mission.mission_id,
      activityId: mission.activity_id,
      awardedAt: new Date().toISOString()
    });
    saveState();
  }

  renderReward(mission, alreadyCompleted);
}

function renderReward(mission, repeatClear) {
  app.innerHTML = `
    ${header('Mission Clear')}
    <section class="reward-card pixel-frame">
      <p class="reward-big">★</p>
      <h1>${repeatClear ? '再次完成任務' : 'Mission Clear!'}</h1>
      <h2>${mission.game_projection.mission_title_zh_tw}</h2>
      ${repeatClear ? `
        <p>這是重玩紀錄，不重複發放 Coins 或材料。</p>
      ` : `
        <div class="reward-list">
          <span class="reward-chip">+10 Coins</span>
          <span class="reward-chip item-reward">${sprite('items', 'paper', 'Paper')} +1 Paper</span>
        </div>
      `}
      <div class="reward-actions">
        <button id="reward-next" class="primary">下一個任務</button>
        <button id="reward-house" class="secondary">Mission House</button>
        <button id="reward-village" class="secondary">回村莊</button>
      </div>
    </section>
  `;

  bind('#reward-next', () => renderMission(nextMission().mission_id));
  bind('#reward-house', () => renderMissionHouse());
  bind('#reward-village', () => renderVillage(repeatClear ? '重玩完成，獎勵未重複計算。' : '任務獎勵已放進你的背包。'));
}

function renderShop(message = '') {
  const wood = item('MAT_WOOD');

  app.innerHTML = `
    ${header('Shop')}
    <section class="game-window pixel-frame">
      <div class="window-grid">
        <aside class="npc-panel">
          <div class="npc-sprite">${sprite('characters', 'shopkeeper', 'Shopkeeper')}</div>
          <h2>Village Shop</h2>
          <p>需要材料嗎？今天可以買 Wood。</p>
        </aside>

        <div class="item-board">
          <h1>Shop</h1>
          ${message ? `<p class="feedback">${message}</p>` : ''}
          <article class="item-card">
            <div class="item-art">${sprite('items', 'wood', 'Wood')}</div>
            <div class="item-meta">
              <strong>${wood.canonical_name}</strong>
              <span>${wood.display_name_zh_tw}</span>
              <small>Common crafting material</small>
            </div>
            <button id="buy-wood" class="shop-button" ${state.coins < wood.shop_price_coins ? 'disabled' : ''}>
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

  bind('#buy-wood', () => {
    if (state.coins < wood.shop_price_coins) return;
    state.coins -= wood.shop_price_coins;
    state.materials.MAT_WOOD += 1;
    saveState();
    renderShop('購買完成：Wood +1');
  });
  bind('#shop-back', () => renderVillage());
}

function renderCraft(message = '') {
  const bookshelfRecipe = recipe('REC_BOOKSHELF');
  const hasBookshelf = state.collection.includes(bookshelfRecipe.produces_item_id);
  const canCraft = !hasBookshelf &&
    state.materials.MAT_WOOD >= bookshelfRecipe.requires.MAT_WOOD &&
    state.materials.MAT_PAPER >= bookshelfRecipe.requires.MAT_PAPER;

  app.innerHTML = `
    ${header('Craft')}
    <section class="game-window pixel-frame">
      <div class="window-grid">
        <aside class="npc-panel">
          <div class="npc-sprite">${sprite('characters', 'crafter', 'Crafter')}</div>
          <h2>Craft Table</h2>
          <p>把材料組合成可以收藏的物品。</p>
        </aside>

        <div class="item-board">
          <h1>Bookshelf Recipe</h1>
          ${message ? `<p class="feedback">${message}</p>` : ''}
          <div class="recipe-card">
            <div class="recipe-slot"><div>${sprite('items', 'wood', 'Wood')}<strong>Wood ×1</strong></div></div>
            <div class="recipe-symbol">+</div>
            <div class="recipe-slot"><div>${sprite('items', 'paper', 'Paper')}<strong>Paper ×1</strong></div></div>
            <div class="recipe-symbol">→</div>
            <div class="recipe-slot"><div>${sprite('items', 'bookshelf', 'Bookshelf')}<strong>Bookshelf</strong></div></div>
          </div>
          <div class="inventory">
            <span>Wood: ${state.materials.MAT_WOOD}</span>
            <span>Paper: ${state.materials.MAT_PAPER}</span>
          </div>
          <button id="craft-bookshelf" class="craft-button" ${canCraft ? '' : 'disabled'}>
            ${hasBookshelf ? 'Bookshelf 已收藏' : 'Craft Bookshelf'}
          </button>
          <button id="craft-back" class="secondary">回村莊</button>
        </div>
      </div>
    </section>
  `;

  bind('#craft-bookshelf', () => {
    if (!canCraft) return;
    state.materials.MAT_WOOD -= bookshelfRecipe.requires.MAT_WOOD;
    state.materials.MAT_PAPER -= bookshelfRecipe.requires.MAT_PAPER;
    state.collection.push(bookshelfRecipe.produces_item_id);
    saveState();
    renderCraft('合成完成：Bookshelf 已加入 Collection。');
  });
  bind('#craft-back', () => renderVillage());
}

function renderCollection() {
  const bookshelf = item('OBJ_BOOKSHELF');
  const owned = state.collection.includes(bookshelf.item_id);
  const futureSlots = ['Chair', 'Lamp', 'Plant', 'Mailbox', 'Desk'];

  app.innerHTML = `
    ${header('Collection')}
    <section class="game-window pixel-frame">
      <h1>My Collection</h1>
      <p class="lead">完成任務、購買材料並合成物品，慢慢把收藏冊填滿。</p>
      <div class="collection-grid">
        <article class="collection-card ${owned ? '' : 'locked'}">
          <div class="collection-art ${owned ? '' : 'collection-art-locked'}">${sprite('items', 'bookshelf', 'Bookshelf')}</div>
          <h2>Bookshelf</h2>
          <p>${owned ? bookshelf.display_name_zh_tw : 'Locked · Mission → Shop → Craft'}</p>
        </article>
        ${futureSlots.map((name) => `
          <article class="collection-card locked">
            <div class="collection-silhouette" aria-hidden="true"></div>
            <h2>${name}</h2>
            <p>Coming later</p>
          </article>
        `).join('')}
      </div>
      <button id="collection-back" class="secondary">回村莊</button>
    </section>
  `;

  bind('#collection-back', () => renderVillage());
}

renderLearnerSelect();
