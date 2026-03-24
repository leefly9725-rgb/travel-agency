create table if not exists public.quotes (
  id text primary key,
  quote_number text not null,
  project_id text not null default '',
  client_name text not null,
  project_name text not null,
  contact_name text not null,
  contact_phone text not null default '',
  language text not null default 'zh-CN',
  currency text not null default 'EUR',
  start_date date not null,
  end_date date not null,
  trip_date date not null,
  travel_days integer not null default 1,
  destination text not null,
  pax_count integer not null default 0,
  notes text not null default '',
  data_quality jsonb not null default '{}'::jsonb,
  -- v2: 报价模式与汇总金额
  pricing_mode text not null default 'standard',
  total_cost   numeric(14, 2) not null default 0,
  total_sales  numeric(14, 2) not null default 0,
  total_profit numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quote_items (
  id bigserial primary key,
  quote_id text not null references public.quotes(id) on delete cascade,
  type text not null,
  name text not null,
  unit text not null,
  supplier text not null default '',
  currency text not null default 'EUR',
  quantity numeric(12, 2) not null default 1,
  cost numeric(14, 2) not null default 0,
  price numeric(14, 2) not null default 0,
  notes text not null default '',
  position integer not null default 0
);

create table if not exists public.hotel_details (
  id bigserial primary key,
  quote_item_id bigint not null references public.quote_items(id) on delete cascade,
  room_type text not null,
  room_count integer not null default 1,
  nights integer not null default 1,
  cost_nightly_rate numeric(14, 2) not null default 0,
  price_nightly_rate numeric(14, 2) not null default 0,
  currency text not null default 'EUR',
  notes text not null default '',
  position integer not null default 0
);

create table if not exists public.vehicle_details (
  id bigserial primary key,
  quote_item_id bigint not null references public.quote_items(id) on delete cascade,
  detail_type text not null,
  vehicle_model text not null,
  vehicle_count integer not null default 1,
  pricing_unit text not null default 'trip',
  cost_unit_price numeric(14, 2) not null default 0,
  price_unit_price numeric(14, 2) not null default 0,
  currency text not null default 'EUR',
  notes text not null default '',
  position integer not null default 0
);

create table if not exists public.service_details (
  id bigserial primary key,
  quote_item_id bigint not null references public.quote_items(id) on delete cascade,
  service_role text not null,
  service_language text not null,
  service_duration text not null,
  quantity integer not null default 1,
  cost_unit_price numeric(14, 2) not null default 0,
  price_unit_price numeric(14, 2) not null default 0,
  currency text not null default 'EUR',
  notes text not null default '',
  position integer not null default 0
);

create table if not exists public.receptions (
  id text primary key,
  project_id text not null default '',
  task_type text not null,
  title text not null,
  assignee text not null,
  due_time timestamptz not null,
  status text not null,
  location text not null,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.templates (
  id text primary key,
  name text not null,
  description text not null default '',
  is_built_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.template_items (
  id bigserial primary key,
  template_id text not null references public.templates(id) on delete cascade,
  type text not null,
  name text not null,
  unit text not null,
  currency text not null default 'EUR',
  quantity numeric(12, 2) not null default 1,
  notes text not null default '',
  position integer not null default 0
);

create table if not exists public.documents (
  id text primary key,
  title text not null,
  category text not null,
  language text not null default 'zh-CN',
  updated_at text not null
);

create index if not exists idx_quote_items_quote_id on public.quote_items (quote_id);
create index if not exists idx_hotel_details_quote_item_id on public.hotel_details (quote_item_id);
create index if not exists idx_vehicle_details_quote_item_id on public.vehicle_details (quote_item_id);
create index if not exists idx_service_details_quote_item_id on public.service_details (quote_item_id);
create index if not exists idx_template_items_template_id on public.template_items (template_id);

-- Supplier price library
create table if not exists public.suppliers (
  id text primary key,
  name text not null,
  contact text not null default '',
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.supplier_items (
  id bigserial primary key,
  supplier_id text not null references public.suppliers(id) on delete cascade,
  category text not null,
  name_zh text not null,
  name_en text not null default '',
  unit text not null,
  cost_price numeric(14, 2) not null default 0,
  spec text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_supplier_items_supplier_id on public.supplier_items (supplier_id);
create index if not exists idx_supplier_items_category on public.supplier_items (category);

create table if not exists public.service_catalog_candidates (
  id bigserial primary key,
  project_group_code text not null default '',
  service_type_code text not null default '',
  service_name text not null,
  specification text not null default '',
  unit text not null default '',
  cost_price numeric(14, 2) not null default 0,
  supplier_id text not null default '',
  supplier_category text not null default '',
  source_quote_id text not null default '',
  notes text not null default '',
  status text not null default 'pending',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_service_catalog_candidates_status on public.service_catalog_candidates (status);
create index if not exists idx_service_catalog_candidates_service_name on public.service_catalog_candidates (service_name);

-- Project-based quotation tables (v2: linked to quotes via quotation_id)
create table if not exists public.quotation_projects (
  id text primary key,
  -- v2: FK 关联主报价单（NULL = 旧独立记录，兼容保留）
  quotation_id text references public.quotes(id) on delete cascade,
  -- 旧字段保留
  name text not null default '',
  client text not null default '',
  event_date date,
  venue text not null default '',
  pax_count integer not null default 0,
  currency text not null default 'EUR',
  status text not null default 'draft',
  notes text not null default '',
  -- v2 新增字段
  project_type  text not null default 'event',
  project_title text not null default '',
  sort_order integer not null default 0,
  project_cost_total   numeric(14, 2) not null default 0,
  project_sales_total  numeric(14, 2) not null default 0,
  project_profit_total numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.quotation_project_items (
  id bigserial primary key,
  project_id text not null references public.quotation_projects(id) on delete cascade,
  -- 旧字段保留
  group_name text not null default '',
  name_zh text not null default '',
  name_en text not null default '',
  unit text not null default '套',
  quantity numeric(12, 2) not null default 1,
  cost_price numeric(14, 2) not null default 0,
  sell_price numeric(14, 2) not null default 0,
  supplier text not null default '',
  notes text not null default '',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  -- v2 新增字段
  item_type               text not null default 'misc',
  item_category           text not null default '',
  item_name               text not null default '',
  specification           text not null default '',
  currency                text not null default 'EUR',
  supplier_id             text not null default '',
  supplier_catalog_item_id text not null default '',
  cost_unit_price         numeric(14, 2) not null default 0,
  sales_unit_price        numeric(14, 2) not null default 0,
  cost_subtotal           numeric(14, 2) not null default 0,
  sales_subtotal          numeric(14, 2) not null default 0,
  extra_json              jsonb not null default '{}'::jsonb,
  created_at              timestamptz not null default timezone('utc', now()),
  updated_at              timestamptz not null default timezone('utc', now())
);

create index if not exists idx_quotation_project_items_project_id on public.quotation_project_items (project_id);
create index if not exists idx_quotation_projects_quotation_id    on public.quotation_projects (quotation_id);
create index if not exists idx_quotes_pricing_mode                on public.quotes (pricing_mode);
