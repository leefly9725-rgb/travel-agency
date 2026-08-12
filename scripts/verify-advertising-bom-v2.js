"use strict";

const { spawnSync } = require("node:child_process");

const files = [
  "tests/advertisingBomCalculator.test.js",
  "tests/advertisingBomMigration.test.js",
  "tests/advertisingFxSnapshot.test.js",
  "tests/advertisingQuotationCalculator.test.js",
  "tests/advertisingQuoteStore.test.js",
  "tests/advertisingSecurity.test.js",
  "tests/advertisingQuotationExport.test.js",
  "tests/api.test.js",
];

const databaseEnvironmentKey = (key) => (
  /SUPABASE|DATABASE|POSTGRES|POSTGREST|PGRST/i.test(key) ||
  /^PG[A-Z0-9_]*$/i.test(key) ||
  /^DB(?:_|$)/i.test(key)
);
const localEnvironment = Object.fromEntries(
  Object.entries(process.env).filter(([key]) => !databaseEnvironmentKey(key)),
);

const result = spawnSync(
  process.execPath,
  ["--test", "--test-isolation=none", ...files],
  { stdio: "inherit", env: localEnvironment },
);

process.exit(result.status == null ? 1 : result.status);
