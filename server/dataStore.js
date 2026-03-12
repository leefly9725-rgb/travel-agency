const fs = require("node:fs");
const path = require("node:path");

function resolveDataFile() {
  const configuredPath = process.env.DATA_FILE || "./data/seed.json";
  return path.resolve(process.cwd(), configuredPath);
}

function loadSeedData() {
  const filePath = resolveDataFile();
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function saveSeedData(data) {
  const filePath = resolveDataFile();
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  loadSeedData,
  resolveDataFile,
  saveSeedData,
};
