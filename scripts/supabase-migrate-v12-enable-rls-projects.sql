-- ============================================================
-- Migration v12: Enable RLS for project tables shown as UNRESTRICTED
--
-- Supabase Table Editor shows UNRESTRICTED when RLS is disabled.
-- LDS-OPS accesses these tables through server APIs using the server-side
-- Supabase REST helper. With SUPABASE_SERVICE_ROLE_KEY configured, service_role
-- bypasses RLS, so no direct anon/authenticated data policy is required here.
--
-- This migration intentionally does not use FORCE ROW LEVEL SECURITY. Forcing
-- RLS is unnecessary for service_role access and can create avoidable
-- production risk if ownership or runtime roles differ from local assumptions.
-- ============================================================

-- ── 1. Enable RLS so Table Editor / Security Advisor stop reporting disabled RLS

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_execution_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.projects NO FORCE ROW LEVEL SECURITY;
ALTER TABLE public.project_execution_items NO FORCE ROW LEVEL SECURITY;


-- ── 2. Do not leave broad direct-client policies on internal project tables

-- These policy names are intentionally listed for compatibility with prior
-- experiments or manual SQL runs. The current production path is backend API +
-- service_role, not direct frontend Supabase reads/writes.
DROP POLICY IF EXISTS projects_authenticated_select ON public.projects;
DROP POLICY IF EXISTS projects_authenticated_insert ON public.projects;
DROP POLICY IF EXISTS projects_authenticated_update ON public.projects;
DROP POLICY IF EXISTS projects_authenticated_delete ON public.projects;
DROP POLICY IF EXISTS projects_authenticated_all ON public.projects;
DROP POLICY IF EXISTS projects_anon_select ON public.projects;
DROP POLICY IF EXISTS projects_public_select ON public.projects;

DROP POLICY IF EXISTS project_execution_items_authenticated_select ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_authenticated_insert ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_authenticated_update ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_authenticated_delete ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_authenticated_all ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_anon_select ON public.project_execution_items;
DROP POLICY IF EXISTS project_execution_items_public_select ON public.project_execution_items;


-- ── 3. Defensive cleanup for any remaining unsafe broad policies on these tables

DO $$
DECLARE
  policy_row record;
BEGIN
  FOR policy_row IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('projects', 'project_execution_items')
      AND (
        'public' = ANY(roles)
        OR 'anon' = ANY(roles)
        OR lower(replace(coalesce(qual, ''), ' ', '')) IN ('true', '(true)')
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


-- ── 4. Guardrail: fail loudly if RLS is still disabled after this migration

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('projects', 'project_execution_items')
      AND c.relrowsecurity IS DISTINCT FROM TRUE
  ) THEN
    RAISE EXCEPTION 'RLS must be enabled on public.projects and public.project_execution_items';
  END IF;
END $$;
