const fs = require("node:fs");
const path = require("node:path");

function parseEnvLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return null;
  }

  const equalIndex = trimmed.indexOf("=");
  if (equalIndex === -1) {
    return null;
  }

  const key = trimmed.slice(0, equalIndex).trim();
  if (!key) {
    return null;
  }

  let value = trimmed.slice(equalIndex + 1).trim();
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    value = value.slice(1, -1);
  }

  return { key, value };
}

function loadEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env");
  if (!fs.existsSync(envPath)) {
    return;
  }

  const raw = fs.readFileSync(envPath, "utf8");
  raw.split(/\r?\n/).forEach((line) => {
    const parsed = parseEnvLine(line);
    if (!parsed) {
      return;
    }

    if (process.env[parsed.key] === undefined) {
      process.env[parsed.key] = parsed.value;
    }
  });
}

module.exports = {
  loadEnvFile,
};
