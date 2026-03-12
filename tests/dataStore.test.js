const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

function clearModule(modulePath) {
  delete require.cache[require.resolve(modulePath)];
}

test("dataStore uses bundled seed file by default", () => {
  clearModule("../server/dataStore");
  delete process.env.DATA_FILE;
  delete process.env.VERCEL;

  const store = require("../server/dataStore");
  assert.equal(store.resolveDataFile(), path.join(process.cwd(), "data", "seed.json"));
});

test("dataStore uses temp runtime file on Vercel and seeds it automatically", () => {
  clearModule("../server/dataStore");
  delete process.env.DATA_FILE;
  process.env.VERCEL = "1";

  const store = require("../server/dataStore");
  const runtimeFile = store.resolveDataFile();
  if (fs.existsSync(runtimeFile)) {
    fs.unlinkSync(runtimeFile);
  }

  const data = store.loadSeedData();
  assert.equal(Array.isArray(data.quotes), true);
  assert.equal(fs.existsSync(runtimeFile), true);

  fs.unlinkSync(runtimeFile);
  delete process.env.VERCEL;
});
