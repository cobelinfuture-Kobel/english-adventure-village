import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const readJson = async (path) => JSON.parse(await readFile(path, "utf8"));

const manifest = await readJson("data/resource-manifest.json");
const activity = await readJson("data/demo-activity.json");
const rewards = await readJson("data/reward-rules.json");
const items = await readJson("data/items.json");
const html = await readFile("index.html", "utf8");
const app = await readFile("src/app.js", "utf8");

const expectedParagraph =
  "First, I am Tom. I am near the front door at home. My school bag is under the small table. Two books are in the bag. The bag is for school. School is my next place. I can bring a bag to school. My hands are free.";

assert.equal(manifest.bridge_mode, "READ_ONLY_PINNED_SNAPSHOT");
assert.equal(manifest.source_repo, "cobelinfuture-Kobel/English_Learning_DB");
assert.equal(manifest.source_commit, "3f498e7336e6df9feb4e8f16d5b39aaf46eb03df");
assert.equal(
  manifest.resources[0].path,
  "product/a1fs_v1_2_1/data/unit06_reading360_360.json"
);
assert.equal(manifest.resources[0].entry_id, "U06-READ360-E003");

assert.equal(activity.reading_entry_id, "U06-READ360-E003");
assert.equal(activity.paragraph, expectedParagraph);
assert.equal(activity.authority.gpt56_semantic_review, "PASS");
assert.equal(activity.authority.human_pilot_status, "APPROVED_BY_OPERATOR");

assert.equal(rewards.mastery_writes_allowed, false);
assert.equal(rewards.events.RC01_FIRST_CLEAR.coins, 10);
assert.equal(rewards.events.RC01_FIRST_CLEAR.materials.MAT_PAPER, 1);

const wood = items.items.find((entry) => entry.item_id === "MAT_WOOD");
const bookshelf = items.items.find((entry) => entry.item_id === "OBJ_BOOKSHELF");
const recipe = items.recipes.find((entry) => entry.recipe_id === "REC_BOOKSHELF");
assert.equal(wood.canonical_name, "Wood");
assert.equal(bookshelf.canonical_name, "Bookshelf");
assert.deepEqual(recipe.requires, { MAT_WOOD: 1, MAT_PAPER: 1 });

assert.match(html, /src\/app\.js/);
assert.match(app, /localStorage/);
assert.match(app, /completedActivities/);
assert.doesNotMatch(app, /sk-[A-Za-z0-9_-]{10,}/);
assert.doesNotMatch(app, /English_Learning_DB\/main/);

console.log("RC01 smoke checks PASS");
