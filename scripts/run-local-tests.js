"use strict";

const { spawnSync } = require("node:child_process");
const { scrubDatabaseEnv } = require("./scrub-database-env");

const result = spawnSync(
  process.execPath,
  ["--test", "--test-isolation=none", ...process.argv.slice(2)],
  { stdio: "inherit", env: scrubDatabaseEnv(process.env) },
);

process.exit(result.status == null ? 1 : result.status);
