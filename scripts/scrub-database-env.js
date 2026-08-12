"use strict";

function databaseEnvironmentKey(key) {
  return (
    /SUPABASE|DATABASE|POSTGRES|POSTGREST|PGRST/i.test(key) ||
    /^PG[A-Z0-9_]*$/i.test(key) ||
    /^DB(?:_|$)/i.test(key)
  );
}

function scrubDatabaseEnv(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(([key]) => !databaseEnvironmentKey(key)),
  );
}

module.exports = { databaseEnvironmentKey, scrubDatabaseEnv };
