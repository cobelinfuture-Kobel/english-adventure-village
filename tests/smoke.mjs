import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const manifest = await readJson('data/resource-manifest.json');
const missionsData = await readJson('data/missions.json');
const rewards = await readJson('data/reward-rules.json');
const items = await readJson('data/items.json');
const writingPreview = await readJson('data/writing360-pilot15-preview.json');
const html = await readFile('index.html', 'utf8');
const app = await readFile('src/app.js', 'utf8');
const css = await readFile('styles.css', 'utf8');

const expected = new Map([
  ['U06-READ360-E003', 'First, I am Tom. I am near the front door at home. My school bag is under the small table. Two books are in the bag. The bag is for school. School is my next place. I can bring a bag to school. My hands are free.'],
  ['U06-READ360-E089', 'Leo is in his bedroom after school. Two books are on the floor. A cloth is on the desk. His bedroom is not tidy now. Leo is near the books. Leo can clean a room without help. The room is tidy after the task.'],
  ['U06-READ360-E093', 'Tom is in the home hallway. The front door is open. His family is inside the house. The hallway is quiet. Tom is near the door. Tom can close the door by himself. The door is at the front of the house. The family is inside.'],
  ['U06-READ360-E154', 'Mia is in the school media room. A camera is on the table. Her friend is near the bright wall. The class display is on the wall. Mia can take a photo of the display. The picture is clear.']
]);

assert.equal(manifest.bridge_mode, 'READ_ONLY_PINNED_SNAPSHOT');
assert.equal(manifest.source_repo, 'cobelinfuture-Kobel/English_Learning_DB');
assert.equal(manifest.source_commit, '3f498e7336e6df9feb4e8f16d5b39aaf46eb03df');
assert.equal(manifest.resources.length, 4);
assert.deepEqual(manifest.resources.map((resource) => resource.entry_id), [...expected.keys()]);
assert.ok(manifest.resources.every((resource) => resource.blob_sha === 'd607187e881c4b335fc60df1c3015836eadba395'));
assert.ok(manifest.resources.every((resource) => resource.local_projection === 'data/missions.json'));

assert.equal(missionsData.schema_version, 'eav.rc02.missions.v1');
assert.equal(missionsData.missions.length, 4);
assert.equal(new Set(missionsData.missions.map((mission) => mission.mission_id)).size, 4);
assert.equal(new Set(missionsData.missions.map((mission) => mission.activity_id)).size, 4);
assert.deepEqual(missionsData.missions.map((mission) => mission.interaction_type), [
  'FIND_OBJECT', 'CLEAN_ROOM', 'CLOSE_DOOR', 'TAKE_PHOTO'
]);
assert.deepEqual(missionsData.missions.map((mission) => mission.family_id), [
  'SIMPLE_CONNECTED_STORY', 'PROBLEM_SOLUTION', 'DAILY_LIFE_NOTE', 'PICTURE_LINKED_DESCRIPTION'
]);
for (const mission of missionsData.missions) {
  assert.equal(mission.paragraph, expected.get(mission.reading_entry_id));
  assert.equal(mission.authority.gpt56_semantic_review, 'PASS');
  assert.equal(mission.authority.family_purpose_review, 'PASS');
  assert.equal(mission.authority.unit01_to_unit06_grammar_ceiling_review, 'PASS');
  assert.equal(mission.authority.human_pilot_status, 'APPROVED_BY_OPERATOR');
  assert.doesNotMatch(JSON.stringify(mission), /A2\+?|A2PLUS/i);
}
assert.equal(missionsData.missions[0].activity_id, 'RC01-U06-FIND-BAG-E003');

assert.equal(rewards.mastery_writes_allowed, false);
assert.equal(rewards.events.RC01_FIRST_CLEAR.coins, 10);
assert.equal(rewards.events.RC01_FIRST_CLEAR.materials.MAT_PAPER, 1);

const wood = items.items.find((entry) => entry.item_id === 'MAT_WOOD');
const bookshelf = items.items.find((entry) => entry.item_id === 'OBJ_BOOKSHELF');
const recipe = items.recipes.find((entry) => entry.recipe_id === 'REC_BOOKSHELF');
assert.equal(wood.canonical_name, 'Wood');
assert.equal(bookshelf.canonical_name, 'Bookshelf');
assert.deepEqual(recipe.requires, { MAT_WOOD: 1, MAT_PAPER: 1 });

const atlasParts = await Promise.all(
  Array.from({ length: 6 }, (_, index) => readFile(`assets/anchor-v1/atlas.b64.part${index + 1}`, 'utf8'))
);
const atlasBuffer = Buffer.from(atlasParts.join(''), 'base64');
assert.deepEqual([...atlasBuffer.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(atlasBuffer.readUInt32BE(16), 96);
assert.equal(atlasBuffer.readUInt32BE(20), 360);

const itemSprite = await readFile('assets/anchor-v1/items-128.png');
assert.deepEqual([...itemSprite.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
assert.equal(itemSprite.readUInt32BE(16), 128);
assert.equal(itemSprite.readUInt32BE(20), 96);

assert.match(html, /styles\.css\?v=u06-writing360-preview-r1-20261010/);
assert.match(html, /src\/app\.js\?v=u06-writing360-preview-r1-20261010/);
assert.match(app, /BUILD_VERSION = 'u06-writing360-preview-r1-20261010'/);
assert.match(app, /fetch\('\.\/data\/missions\.json'\)/);
assert.doesNotMatch(app, /fetch\('\.\/data\/demo-activity\.json'\)/);
assert.match(app, /function renderMissionHouse\(\)/);
assert.match(app, /function renderMissionScene\(mission\)/);
assert.match(app, /FIND_OBJECT/);
assert.match(app, /CLEAN_ROOM/);
assert.match(app, /CLOSE_DOOR/);
assert.match(app, /take-photo/);
assert.match(app, /localStorage/);
assert.match(css, /mission-card-grid/);
assert.match(css, /scene-clean-room/);
assert.match(css, /scene-hallway/);
assert.match(css, /scene-media-room/);
assert.match(css, /floor-book/);
assert.match(css, /door-open-state/);
assert.match(css, /camera-on-table/);
assert.doesNotMatch(app, /camera-control/);

assert.equal(writingPreview.schema_version, 'eav.u06.writing360.pilot15.preview.v1');
assert.equal(writingPreview.source_repo, 'cobelinfuture-Kobel/English_Learning_DB');
assert.equal(writingPreview.source_commit, 'd49ff9b4181589c42f01230f0152f49f56378241');
assert.equal(writingPreview.source_blob_sha, '6f3dd9db3e102a9d23c0066d59e9c20d9b85f1b7');
assert.equal(writingPreview.admission.full360_status, 'HOLD_FULL360_NOT_ADMITTED');
assert.equal(writingPreview.admission.admin_preview_allowed, true);
assert.equal(writingPreview.admission.learner_release_allowed, false);
assert.equal(writingPreview.admission.pilot_only, true);
assert.equal(writingPreview.admission.approved_pilot_count, 15);
assert.equal(writingPreview.admission.human_acceptance_status, 'PILOT15_APPROVED_BY_OPERATOR');
assert.equal(writingPreview.pilots.length, 15);
assert.ok(writingPreview.pilots.every((entry) => entry.human_review_status === 'OPERATOR_APPROVED'));
assert.deepEqual(writingPreview.stage_order.map((stage) => stage.operation), [
  'TABLE_TO_SENTENCES',
  'COPY_AND_CHANGE',
  'SENTENCE_PLAN',
  'GUIDED_MINI_TEXT'
]);
assert.deepEqual(
  Object.fromEntries(writingPreview.stage_order.map((stage) => [
    stage.operation,
    writingPreview.pilots.filter((entry) => entry.operation === stage.operation).length
  ])),
  {
    TABLE_TO_SENTENCES: 4,
    COPY_AND_CHANGE: 4,
    SENTENCE_PLAN: 4,
    GUIDED_MINI_TEXT: 3
  }
);
assert.equal(new Set(writingPreview.pilots.map((entry) => entry.writing_entry_id)).size, 15);
assert.ok(writingPreview.pilots.every((entry) => Array.isArray(entry.fact_card) && entry.fact_card.length > 0));
assert.ok(writingPreview.pilots.every((entry) => Array.isArray(entry.model_answer) && entry.model_answer.length >= 2));
assert.ok(writingPreview.pilots.every((entry) => entry.full_model_text === entry.model_answer.join(' ')));

assert.match(app, /ADMIN_WRITING_PREVIEW/);
assert.match(app, /get\('admin'\) === 'writing360'/);
assert.match(app, /writing360-pilot15-preview\.json/);
assert.match(app, /eav\.admin\.writing360\.preview\.v1/);
assert.match(app, /function renderWritingPreviewHome\(\)/);
assert.match(app, /function renderWritingStage\(stageNumber\)/);
assert.match(app, /function renderWritingActivity\(writingEntryId, result = null\)/);
assert.match(app, /Learner release: OFF/);
assert.match(app, /Full360 admission: HOLD/);
assert.match(css, /writing-preview-shell/);
assert.match(css, /writing-activity-layout/);

assert.doesNotMatch(app, /sk-[A-Za-z0-9_-]{10,}/);
assert.doesNotMatch(app, /English_Learning_DB\/main/);

console.log('RC02 + Unit06 Writing360 Pilot15 admin-preview smoke checks PASS');
