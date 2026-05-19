-- ── B1-05D Migration v10 ─────────────────────────────────────────────────────
-- Adds: exchange_rates, supplier_project_cost_entries tables
-- Adds: target_supplier_cost_entry_id column to supplier_invoice_text_imports
-- All operations are idempotent (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).

-- ── 1. exchange_rates ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id                text         PRIMARY KEY,
  base_currency     text         NOT NULL,
  quote_currency    text         NOT NULL,
  rate              numeric      NOT NULL,
  rate_date         date         NOT NULL,
  source            text         NOT NULL DEFAULT 'manual',
  notes             text         NOT NULL DEFAULT '',
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

-- Semantic: 1 base_currency = rate quote_currency
-- Example: base=EUR, quote=RSD, rate=117.20 means 1 EUR = 117.20 RSD
-- RSD → EUR: rsd_amount / rate
-- EUR → RSD: eur_amount * rate

CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_date
  ON public.exchange_rates (base_currency, quote_currency, rate_date DESC);
CREATE INDEX IF NOT EXISTS idx_exchange_rates_pair_created
  ON public.exchange_rates (base_currency, quote_currency, created_at DESC);

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "exchange_rates authenticated select" ON public.exchange_rates;
CREATE POLICY "exchange_rates authenticated select" ON public.exchange_rates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "exchange_rates authenticated insert" ON public.exchange_rates;
CREATE POLICY "exchange_rates authenticated insert" ON public.exchange_rates
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "exchange_rates authenticated update" ON public.exchange_rates;
CREATE POLICY "exchange_rates authenticated update" ON public.exchange_rates
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "exchange_rates authenticated delete" ON public.exchange_rates;
CREATE POLICY "exchange_rates authenticated delete" ON public.exchange_rates
  FOR DELETE TO authenticated USING (true);

-- Seed default EUR/RSD operational rate (only if no EUR/RSD pair exists yet)
INSERT INTO public.exchange_rates (
  id, base_currency, quote_currency, rate, rate_date, source, notes, created_at, updated_at
)
SELECT
  'ER-EUR-RSD-seed',
  'EUR',
  'RSD',
  117.20,
  current_date,
  'manual_seed',
  'Initial operational EUR/RSD rate for LDS cost conversion; can be updated later.',
  now(),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM public.exchange_rates
  WHERE base_currency = 'EUR' AND quote_currency = 'RSD'
);


-- ── 2. supplier_project_cost_entries ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.supplier_project_cost_entries (
  id                          text         PRIMARY KEY,
  project_id                  text         NOT NULL,
  supplier_project_cost_id    text         NOT NULL DEFAULT '',
  supplier_id                 text         NOT NULL DEFAULT '',
  supplier_display            text         NOT NULL DEFAULT '',

  entry_type                  text         NOT NULL DEFAULT 'invoice',
  source_type                 text         NOT NULL DEFAULT 'invoice_text',
  source_import_id            text         NOT NULL DEFAULT '',

  invoice_number              text         NOT NULL DEFAULT '',
  invoice_date                date,

  original_currency           text         NOT NULL DEFAULT 'EUR',
  original_amount             numeric,
  original_subtotal_amount    numeric,
  original_tax_amount         numeric,

  project_currency            text         NOT NULL DEFAULT 'EUR',
  exchange_rate               numeric,
  exchange_rate_date          date,
  exchange_rate_source        text         NOT NULL DEFAULT '',
  converted_amount            numeric,

  conversion_method           text         NOT NULL DEFAULT 'same_currency',
  cost_status                 text         NOT NULL DEFAULT 'confirmed',
  notes                       text         NOT NULL DEFAULT '',

  created_at                  timestamptz  NOT NULL DEFAULT now(),
  updated_at                  timestamptz  NOT NULL DEFAULT now(),

  CONSTRAINT spce_entry_type_check
    CHECK (entry_type IN ('invoice', 'manual', 'adjustment')),
  CONSTRAINT spce_source_type_check
    CHECK (source_type IN ('invoice_text', 'ocr', 'manual', 'import')),
  CONSTRAINT spce_conversion_method_check
    CHECK (conversion_method IN ('same_currency', 'auto', 'manual_override')),
  CONSTRAINT spce_cost_status_check
    CHECK (cost_status IN ('pending', 'confirmed', 'disputed'))
);

CREATE INDEX IF NOT EXISTS idx_spce_project_id
  ON public.supplier_project_cost_entries (project_id);
CREATE INDEX IF NOT EXISTS idx_spce_supplier_project_cost_id
  ON public.supplier_project_cost_entries (supplier_project_cost_id);
CREATE INDEX IF NOT EXISTS idx_spce_project_supplier
  ON public.supplier_project_cost_entries (project_id, supplier_display);
CREATE INDEX IF NOT EXISTS idx_spce_source_import_id
  ON public.supplier_project_cost_entries (source_import_id);
CREATE INDEX IF NOT EXISTS idx_spce_invoice_number
  ON public.supplier_project_cost_entries (invoice_number)
  WHERE invoice_number <> '';

ALTER TABLE public.supplier_project_cost_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spce authenticated select" ON public.supplier_project_cost_entries;
CREATE POLICY "spce authenticated select" ON public.supplier_project_cost_entries
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "spce authenticated insert" ON public.supplier_project_cost_entries;
CREATE POLICY "spce authenticated insert" ON public.supplier_project_cost_entries
  FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "spce authenticated update" ON public.supplier_project_cost_entries;
CREATE POLICY "spce authenticated update" ON public.supplier_project_cost_entries
  FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "spce authenticated delete" ON public.supplier_project_cost_entries;
CREATE POLICY "spce authenticated delete" ON public.supplier_project_cost_entries
  FOR DELETE TO authenticated USING (true);


-- ── 3. Extend supplier_invoice_text_imports ───────────────────────────────────
ALTER TABLE public.supplier_invoice_text_imports
  ADD COLUMN IF NOT EXISTS target_supplier_cost_entry_id text NOT NULL DEFAULT '';
