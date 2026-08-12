# Advertising Intelligent BOM V2 Test-Release Gate

This runbook prepares evidence for a later LDS-OPS-TEST review. Completing it does not authorize a database migration, environment-variable change, Preview change, deployment, promotion, push, or production write.

## 1. Baseline and commit evidence

Start from the approved baseline `da9ce7c86009ac741fb1cbdea5eaf8e948b9f9b3`. Record the candidate commit, branch, recent task commits, and a clean worktree before and after verification:

```bash
git rev-parse HEAD
git branch --show-current
git log --oneline --decorate -8
git status --short
git diff --stat da9ce7c86009ac741fb1cbdea5eaf8e948b9f9b3..HEAD
```

Stop if the worktree contains unreviewed code, screenshots, browser metadata, local data, credentials, or temporary files.

## 2. Automated and sensitive-value checks

Run all checks locally from the candidate tree:

```bash
npm run test:advertising-bom-v2
npm test
git diff --check
rg -n "SUPABASE_SERVICE_ROLE_KEY|serviceRoleKey|ymbwmoxydgcmawkttbgi" web api server scripts
rg -n "hostile-(full-)?(anon|service-role)-dummy|strict-date-(anon|service-role)-dummy" tests
```

The focused and full suites must have zero failures, skips, cancellations, and unfinished tests. `git diff --check` must produce no output. Inspect every match in `web/`, `api/`, `server/`, and `scripts/`: no service-role literal may exist, server/script matches must be config lookup, environment scrubbing, or offline target-guard behavior, and production ref `ymbwmoxydgcmawkttbgi` must not appear in executable browser or API code. The second scan deliberately finds hostile dummy values used by local-only tests; confirm every match remains under `tests/`, is non-secret test data, and is never copied into application code.

Both `npm test` and the focused verifier must be proven fail-closed under hostile ambient database configuration. They share the same local runner policy, remove every Supabase, database, Postgres/PostgREST, `PG*`, and `DB_*` variable from the environment passed to child tests, preserve child output, and return the child test status. Any test run that attempts a remote database request blocks release preparation. Do not replace these commands with raw `node --test`, because that bypasses the environment boundary.

## 3. Browser and export matrix

Use a copied local JSON data file and a local server only. Keep screenshots, traces, generated exports, console logs, and browser metadata outside the repository.

Verify:

- 1440×900, 768×1024, and 390×844 layouts.
- Tab and Shift+Tab reach quote fields, calculate/save controls, price tabs, history, and exports; arrow keys operate price-library tabs.
- No document-level horizontal overflow at 390 px; wide tables may scroll only inside their table container.
- New EUR and RSD V2 quotes calculate and save; an existing V2 quote keeps its first saved FX snapshot.
- A V1 quote reopens and saves through the legacy editor without acquiring V2 evidence.
- Price history shows active version, currency, effective date, and visibly inactive future versions.
- Customer export excludes costs, supplier/version evidence, internal notes, and BOM details.
- Internal export is unmistakably marked and contains persisted BOM detail.
- Browser console has no application errors or warnings and all application requests succeed.

For one saved V2 quote, record these independent reconciliations:

1. Customer detail-row sale sum, after applying discount and VAT according to the stored quote, equals `totalIncludingVat`.
2. Internal persisted BOM sale sum equals `subtotalExcludingVat`.
3. The customer and internal views report the same quote total.

Any mismatch blocks test-release preparation.

## 4. Static migration review only

Review `scripts/supabase-migrate-v14-advertising-intelligent-bom-v2.sql` without executing it. Confirm:

- DDL is additive and repeatable.
- Price-version update/delete protection is append-only.
- Both V1 RPC definitions remain present and unchanged.
- New tables have RLS enabled and privileged functions/grants remain service-role-only.
- V2 quote persistence validates ownership, immutable FX, and exact referenced version evidence.

Rollback is not authorized by this runbook. If separately authorized later, it requires a verified backup and reverse-order removal in LDS-OPS-TEST only. Production rollback or schema mutation is outside scope.

## 5. Hard target gate for any later database session

This section is a prerequisite for a separately authorized future database operation; it is not authorization to perform one.

In the same terminal/database session that would perform the future operation:

1. Run the offline guard:

   ```bash
   SUPABASE_URL=https://uidfqpksuvebsrbnlyzl.supabase.co \
     node scripts/verify-advertising-bom-v2-target.js
   ```

2. Independently read back the connected project's displayed name and ref in that same session.
3. Require an exact simultaneous match:

   ```text
   LDS-OPS-TEST / uidfqpksuvebsrbnlyzl
   ```

4. Stop immediately if the name, ref, connection, session, candidate commit, migration hash, or approved payload differs or cannot be verified. Reconnecting starts a new session and requires both checks again.

The guard alone is insufficient. A previous-session screenshot, saved CLI link, environment variable, local config, or remembered project name is insufficient.

## 6. Authorized test target identity

The only possible target for a separately approved future migration is:

```text
Project name: LDS-OPS-TEST
Project ref:  uidfqpksuvebsrbnlyzl
```

The exact name and ref must both be verified in the same live session immediately before every database write.

## 7. Permanent production zero-write target

Production ref `ymbwmoxydgcmawkttbgi` is permanent zero-write scope. Never run migration, SQL, REST mutation, RPC mutation, repair, rollback, or test-data creation against it. Encountering this ref requires an immediate stop.

## 8. Authorization boundary

Passing every item above establishes local evidence only. It does not authorize:

- applying or rolling back a migration;
- changing Supabase or Vercel environment variables;
- changing a Preview environment;
- deploying or promoting any build;
- pushing commits or tags;
- writing to LDS-OPS-TEST;
- writing to production under any circumstance.

Each later mutation, Preview change, deployment, promotion, or push requires separate explicit authorization and fresh scope/identity checks. Production remains zero-write regardless of any later test authorization.
