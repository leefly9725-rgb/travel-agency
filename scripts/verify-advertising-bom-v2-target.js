"use strict";

const TEST_REF = "uidfqpksuvebsrbnlyzl";
const PRODUCTION_REF = "ymbwmoxydgcmawkttbgi";

function assertAdvertisingBomTestTarget(value) {
  let hostname;
  try {
    hostname = new URL(String(value || "")).hostname.toLowerCase();
  } catch {
    throw new Error(`TEST_PROJECT_REQUIRED: expected ${TEST_REF}, received invalid URL`);
  }

  const ref = hostname.split(".")[0];
  if (ref === PRODUCTION_REF) {
    throw new Error(`PRODUCTION_ZERO_WRITE: ${PRODUCTION_REF}`);
  }
  if (hostname !== `${TEST_REF}.supabase.co`) {
    throw new Error(`TEST_PROJECT_REQUIRED: expected ${TEST_REF}, received ${ref || "empty"}`);
  }
  return ref;
}

if (require.main === module) {
  const ref = assertAdvertisingBomTestTarget(process.env.SUPABASE_URL);
  process.stdout.write(`Verified LDS-OPS-TEST project ref: ${ref}\n`);
}

module.exports = {
  TEST_REF,
  PRODUCTION_REF,
  assertAdvertisingBomTestTarget,
};
