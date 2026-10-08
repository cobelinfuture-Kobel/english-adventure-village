import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const readJson = async (path) => JSON.parse(await readFile(path, 'utf8'));

const manifest = await readJson('data/resource-manifest.json');
const activity = await readJson('data/demo-activity.json');
const rewards = await readJson('data/reward-rules.json');
const items = await readJson('data/items.json');
const html = await readFile('index.html', 'utf8');
const app = await readFile('src/app.js', 'utf8');
const css = await readFile('styles.css', 'utf8');

const expectedParagraph =
  'First, I am Tom. I am near the front door at home. My school bag is under the small table. Two books are in the bag. The bag is for school. School is my next place. I can bring a bag to school. My hands are free.';

assert.equal(manifest.bridge_mode, 'READ_ONLY_PINNED_SNAPSHOT');
assert.equal(manifest.source_repo, 'cobelinfuture-Kobel/English_Learning_DB');
assert.equal(manifest.source_commit, '3f498e7336e6df9feb4e8f16d5b39aaf46eb03df');
assert.equal(manifest.resources[0].entry_id, 'U06-READ360-E003');
assert.equal(activity.reading_entry_id, 'U06-READ360-E003');
assert.equal(activity.paragraph, expectedParagraph);
assert.equal(activity.authority.gpt56_semantic_review, 'PASS');
assert.equal(activity.authority.human_pilot_status, 'APPROVED_BY_OPERATOR');
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

assert.match(html, /src\/app\.js/);
assert.match(app, /localStorage/);
assert.match(app, /cozy-16bit-pixel-rpg-v1/);
assert.match(app, /sprite\('buildings', 'mission-house'/);
assert.match(app, /sprite\('room', 'school-bag'/);
assert.match(app, /sprite\('items', 'bookshelf'/);
assert.match(app, /installApprovedPixelAtlas/);
assert.match(app, /atlas\.b64\.part/);
assert.match(css, /atlas-characters/);
assert.match(css, /atlas-buildings/);
assert.match(css, /atlas-room/);
assert.match(css, /atlas-items/);
assert.match(css, /--anchor-atlas/);
assert.match(css, /background-size: 384px 1440px/);
assert.doesNotMatch(app, /\[object PointerEvent\]/);
assert.doesNotMatch(app, /sk-[A-Za-z0-9_-]{10,}/);
assert.doesNotMatch(app, /English_Learning_DB\/main/);

console.log('ASSET-INTEGRATION-R1 smoke checks PASS');
