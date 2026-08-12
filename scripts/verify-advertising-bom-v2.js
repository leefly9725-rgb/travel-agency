"use strict";

const { spawnSync } = require("node:child_process");
const { scrubDatabaseEnv } = require("./scrub-database-env");

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

const result = spawnSync(
  process.execPath,
  ["--test", "--test-isolation=none", ...files],
  { stdio: "inherit", env: scrubDatabaseEnv(process.env) },
);

process.exit(result.status == null ? 1 : result.status);
