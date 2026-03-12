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
