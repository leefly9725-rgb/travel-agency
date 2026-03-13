const fs = require("node:fs");
const path = require("node:path");

const bundledDataFile = path.resolve(__dirname, "..", "data", "seed.json");
const runtimeTempDir = process.env.TEMP || process.env.TMPDIR || "/tmp";
const vercelRuntimeDataFile = path.join(runtimeTempDir, "lds-ops-seed.json");

function shouldUseVercelTempFile() {
  return Boolean(process.env.VERCEL) && !process.env.DATA_FILE;
}

function resolveDataFile() {
  if (process.env.DATA_FILE) {
    return path.resolve(process.cwd(), process.env.DATA_FILE);
  }

  if (shouldUseVercelTempFile()) {
    return vercelRuntimeDataFile;
  }

  return bundledDataFile;
}

function ensureRuntimeDataFile(filePath) {
  if (fs.existsSync(filePath)) {
    return;
  }

  if (!fs.existsSync(bundledDataFile)) {
    throw new Error(`找不到默认数据文件：${bundledDataFile}`);
  }

  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.copyFileSync(bundledDataFile, filePath);
}

function loadSeedData() {
  const filePath = resolveDataFile();
  ensureRuntimeDataFile(filePath);
  const raw = fs.readFileSync(filePath, "utf8");
  return JSON.parse(raw);
}

function saveSeedData(data) {
  const filePath = resolveDataFile();
  ensureRuntimeDataFile(filePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

module.exports = {
  bundledDataFile,
  loadSeedData,
  resolveDataFile,
  saveSeedData,
  shouldUseVercelTempFile,
  vercelRuntimeDataFile,
};
