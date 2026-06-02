-- ============================================================
-- Migration v11: Supabase Security Advisor fixes
-- Fixes:
--   1. RLS Disabled in Public: projects, project_execution_items
--   2. Function Search Path Mutable: known public trigger/RPC functions
--   3. RLS Policy Always True: exchange/project/supplier-cost policies
--
-- Production compatibility:
--   - App data access continues to go through the server-side Supabase REST helper.
--   - Server-side access must use SUPABASE_SERVICE_ROLE_KEY; service_role bypasses RLS.
--   - No anon policy is added for internal project/cost tables.
--   - No table/column shape is changed.
-- ============================================================

-- ── 1. Enable RLS on public tables reported as disabled ─────────────────────

ALTER TABLE IF EXISTS public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.project_execution_items ENABLE ROW LEVEL SECURITY;

-- These tables are internal business data and are accessed by LDS-OPS through
-- server APIs. Do not add broad direct client policies here.
DROP POLICY IF EXISTS projects_authenticated_select ON public.projects;
DROP POLICY IF EXISTS projects_authenticated_insert ON public.projects;
DROP POLICY IF EXISTS projects_authenticated_update ON public.projects;
DROP POLICY IF EXISTS projects_authenticated_delete ON public.projects;

DROP POLICY IF EXISTS project_execution_items_authenticated_select ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_authenticated_insert ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_authenticated_update ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_authenticated_delete ON public.project_execution_items;


-- ── 2. Remove policies that Security Advisor reports as always-true ─────────

-- project_tasks is internal execution data. Direct client access is denied by
-- default; server API + service_role remains the write/read path.
DROP POLICY IF EXISTS project_tasks_authenticated_all ON public.project_tasks;

-- supplier invoice imports and supplier project cost entries are sensitive
-- internal supplier/cost data. Direct client access is denied by default.
DROP POLICY IF EXISTS "Authenticated users can read supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports;
DROP POLICY IF EXISTS "Authenticated users can insert supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports;
DROP POLICY IF EXISTS "Authenticated users can update supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports;
DROP POLICY IF EXISTS "Authenticated users can delete supplier_invoice_text_imports"
  ON public.supplier_invoice_text_imports;

DROP POLICY IF EXISTS "spce authenticated select" ON public.supplier_project_cost_entries;
DROP POLICY IF EXISTS "spce authenticated insert" ON public.supplier_project_cost_entries;
DROP POLICY IF EXISTS "spce authenticated update" ON public.supplier_project_cost_entries;
DROP POLICY IF EXISTS "spce authenticated delete" ON public.supplier_project_cost_entries;

-- exchange_rates is operational configuration. Authenticated users may read
-- active data directly, but writes stay service-role-only through server APIs.
DROP POLICY IF EXISTS "exchange_rates authenticated select" ON public.exchange_rates;
DROP POLICY IF EXISTS "exchange_rates authenticated insert" ON public.exchange_rates;
DROP POLICY IF EXISTS "exchange_rates authenticated update" ON public.exchange_rates;
DROP POLICY IF EXISTS "exchange_rates authenticated delete" ON public.exchange_rates;
DROP POLICY IF EXISTS exchange_rates_authenticated_select ON public.exchange_rates;

CREATE POLICY exchange_rates_authenticated_select
  ON public.exchange_rates
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
        AND up.is_active IS TRUE
    )
  );

-- Defensive cleanup for any manually created always-true policies on the same
-- advisor-reported tables. Leaves non-true policies untouched.
DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN (
        'exchange_rates',
        'project_tasks',
        'supplier_invoice_text_imports',
        'supplier_project_cost_entries'
      )
      AND (
        lower(replace(coalesce(qual, ''), ' ', '')) IN ('true', '(true)')
        OR lower(replace(coalesce(with_check, ''), ' ', '')) IN ('true', '(true)')
      )
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON %I.%I',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  END LOOP;
END $$;


-- ── 3. Fix mutable function search_path warnings ────────────────────────────

-- set_updated_at() and handle_new_user() are defined in existing repo SQL.
-- submit_quote_for_review/review_quote/reopen_quote are RPCs used by server/app.js;
-- alter all deployed overloads if they exist, without replacing business logic.
DO $$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid, p.proname, pg_get_function_identity_arguments(p.oid) AS identity_args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN (
        'set_updated_at',
        'submit_quote_for_review',
        'review_quote',
        'reopen_quote',
        'handle_new_user'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public, pg_temp',
      fn.proname,
      fn.identity_args
    );
  END LOOP;
END $$;
