-- LDS OPS Advertising Intelligent BOM V2 -- V14
-- Future test target only: LDS-OPS-TEST / uidfqpksuvebsrbnlyzl.
-- Production ymbwmoxydgcmawkttbgi is permanent zero-write scope.
-- This review artifact is not self-authorizing. Do not execute it against any
-- Supabase project without a separate approval and same-session target proof.
-- Additive and repeatable after the V13 advertising quotation migration.

create schema if not exists private;

create table if not exists public.advertising_price_versions (
  id text primary key,
  catalog_type text not null constraint advertising_price_versions_catalog_type_check
    check (catalog_type in ('materials','processes','services')),
  catalog_id text not null,
  version_number integer not null constraint advertising_price_versions_version_number_check
    check (version_number > 0),
  currency text not null constraint advertising_price_versions_currency_check
    check (currency in ('EUR','RSD')),
  cost_unit_price numeric(14,4) not null constraint advertising_price_versions_cost_check
    check (cost_unit_price >= 0),
  sale_unit_price numeric(14,4) not null constraint advertising_price_versions_sale_check
    check (sale_unit_price >= 0),
  minimum_sale_unit_price numeric(14,4) constraint advertising_price_versions_minimum_sale_check
    check (minimum_sale_unit_price is null or minimum_sale_unit_price >= 0),
  minimum_charge numeric(14,4) not null default 0 constraint advertising_price_versions_minimum_charge_check
    check (minimum_charge >= 0),
  effective_from date not null,
  change_reason text not null constraint advertising_price_versions_reason_check
    check (length(trim(change_reason)) > 0),
  supplier_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  constraint advertising_price_versions_catalog_version_key
    unique(catalog_type,catalog_id,version_number)
);

create table if not exists public.advertising_quote_bom_lines (
  id text primary key,
  quote_id text not null references public.advertising_quotes(id) on delete cascade,
  quote_item_id text references public.advertising_quote_items(id) on delete cascade,
  position integer not null default 0 constraint advertising_quote_bom_lines_position_check
    check (position >= 0),
  line_type text not null constraint advertising_quote_bom_lines_type_check
    check (line_type in ('material','process','labor','installation','transport','design','discount','surcharge','adjustment')),
  catalog_type text constraint advertising_quote_bom_lines_catalog_type_check
    check (catalog_type is null or catalog_type in ('materials','processes','services')),
  catalog_id text,
  price_version_id text references public.advertising_price_versions(id) on delete restrict,
  description_snapshot text not null,
  unit_snapshot text not null,
  quantity numeric(14,4) not null constraint advertising_quote_bom_lines_quantity_check
    check (quantity >= 0),
  source_currency text not null constraint advertising_quote_bom_lines_source_currency_check
    check (source_currency in ('EUR','RSD')),
  quote_currency text not null constraint advertising_quote_bom_lines_quote_currency_check
    check (quote_currency in ('EUR','RSD')),
  cost_unit_price_source numeric(14,4) not null constraint advertising_quote_bom_lines_cost_unit_check
    check (cost_unit_price_source >= 0),
  sale_unit_price_source numeric(14,4) not null constraint advertising_quote_bom_lines_sale_unit_check
    check (sale_unit_price_source >= 0),
  cost_amount numeric(14,2) not null constraint advertising_quote_bom_lines_cost_amount_check
    check (cost_amount >= 0),
  sale_amount numeric(14,2) not null constraint advertising_quote_bom_lines_sale_amount_check
    check ((line_type = 'discount' and sale_amount <= 0) or (line_type <> 'discount' and sale_amount >= 0)),
  customer_visible boolean not null default true,
  supplier_snapshot jsonb not null default '{}'::jsonb,
  internal_notes text not null default '',
  constraint advertising_quote_bom_lines_catalog_reference_check check (
    (line_type = 'discount' and catalog_type is null and catalog_id is null and price_version_id is null)
    or
    (line_type <> 'discount' and catalog_type is not null and catalog_id is not null and price_version_id is not null)
  )
);

alter table public.advertising_quotes
  add column if not exists pricing_engine text not null default 'legacy_v1';
alter table public.advertising_quotes
  add column if not exists fx_snapshot jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.advertising_quotes'::regclass
      and conname = 'advertising_quotes_pricing_engine_check'
  ) then
    alter table public.advertising_quotes
      add constraint advertising_quotes_pricing_engine_check
      check (pricing_engine in ('legacy_v1','bom_v2'));
  end if;
end
$$;

create index if not exists idx_advertising_price_versions_effective
  on public.advertising_price_versions(catalog_type, catalog_id, effective_from desc, version_number desc);
create index if not exists idx_advertising_quote_bom_lines_quote
  on public.advertising_quote_bom_lines(quote_id, position);

insert into public.advertising_service_catalog(id,data,is_active)
values (
  'production-labor',
  '{"nameZh":"制作人工","nameEn":"Production Labor","category":"labor","unit":"hour","costPrice":5,"suggestedSalePrice":10,"minimumSalePrice":0,"defaultMinimumFee":0,"currency":"EUR"}'::jsonb,
  true
)
on conflict(id) do nothing;

with catalog_rows as (
  select 'materials'::text as catalog_type, id, data, updated_by
  from public.advertising_materials
  union all
  select 'processes'::text, id, data, updated_by
  from public.advertising_processes
  union all
  select 'services'::text, id, data, updated_by
  from public.advertising_service_catalog
)
insert into public.advertising_price_versions (
  id,
  catalog_type,
  catalog_id,
  version_number,
  currency,
  cost_unit_price,
  sale_unit_price,
  minimum_sale_unit_price,
  minimum_charge,
  effective_from,
  change_reason,
  supplier_snapshot,
  created_by
)
select
  'APV-' || md5(catalog_type || ':' || id || ':1'),
  catalog_type,
  id,
  1,
  coalesce(nullif(data->>'currency',''),'EUR'),
  coalesce(nullif(data->>'costPrice','')::numeric,0),
  coalesce(nullif(data->>'suggestedSalePrice','')::numeric,0),
  nullif(data->>'minimumSalePrice','')::numeric,
  coalesce(nullif(data->>'defaultMinimumFee','')::numeric,0),
  '2026-01-01'::date,
  'V1 catalog baseline',
  jsonb_strip_nulls(jsonb_build_object('supplierName',data->>'supplierName')),
  coalesce(updated_by,'00000000-0000-0000-0000-000000000000'::uuid)
from catalog_rows
on conflict do nothing;

create or replace function private.prevent_advertising_price_version_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'ADVERTISING_PRICE_VERSION_IMMUTABLE';
end
$$;

revoke execute on function private.prevent_advertising_price_version_mutation()
  from public, anon, authenticated;

drop trigger if exists advertising_price_versions_immutable
  on public.advertising_price_versions;
create trigger advertising_price_versions_immutable
before update or delete on public.advertising_price_versions
for each row execute function private.prevent_advertising_price_version_mutation();

create or replace function private.prevent_advertising_quote_fx_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
declare
  v_rate_date date;
begin
  if new.fx_snapshot is not distinct from old.fx_snapshot then
    return new;
  end if;
  if coalesce(old.fx_snapshot,'{}'::jsonb) <> '{}'::jsonb then
    raise exception using
      errcode = '55000',
      message = 'ADVERTISING_FX_SNAPSHOT_IMMUTABLE';
  end if;
  if coalesce(new.fx_snapshot,'{}'::jsonb) = '{}'::jsonb then
    return new;
  end if;
  if new.pricing_engine <> 'bom_v2'
     or coalesce(jsonb_typeof(new.fx_snapshot),'') <> 'object' then
    raise exception using
      errcode = '22023',
      message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;
  if (select count(*) from jsonb_object_keys(new.fx_snapshot)) <> 5
     or coalesce(new.fx_snapshot->>'baseCurrency','') <> 'EUR'
     or coalesce(new.fx_snapshot->>'quoteCurrency','') <> new.currency
     or coalesce(new.fx_snapshot->>'quoteCurrency','') not in ('EUR','RSD')
     or coalesce(trim(new.fx_snapshot->>'source'),'') = ''
     or coalesce(new.fx_snapshot->>'rate','') !~ '^[0-9]+([.][0-9]+)?$'
     or coalesce(new.fx_snapshot->>'rateDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using
      errcode = '22023',
      message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;
  if (new.fx_snapshot->>'rate')::numeric <= 0 then
    raise exception using
      errcode = '22023',
      message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;
  begin
    v_rate_date := (new.fx_snapshot->>'rateDate')::date;
  exception when others then
    raise exception using
      errcode = '22023',
      message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end;
  if to_char(v_rate_date,'YYYY-MM-DD') <> new.fx_snapshot->>'rateDate' then
    raise exception using
      errcode = '22023',
      message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;
  return new;
end
$$;

revoke execute on function private.prevent_advertising_quote_fx_snapshot_mutation()
  from public, anon, authenticated;

drop trigger if exists advertising_quotes_fx_snapshot_immutable
  on public.advertising_quotes;
create trigger advertising_quotes_fx_snapshot_immutable
before update of fx_snapshot on public.advertising_quotes
for each row execute function private.prevent_advertising_quote_fx_snapshot_mutation();

create or replace function public.save_advertising_quote_v2(
  p_quote jsonb,
  p_bom_lines jsonb,
  p_fx_snapshot jsonb
) returns public.advertising_quotes
language plpgsql
security definer
set search_path=''
as $$
declare
  v_id text := coalesce(nullif(p_quote->>'id',''),'ADV-' || gen_random_uuid()::text);
  v_entity_id text := coalesce(nullif(p_quote->>'entityId',''),'lds');
  v_owner uuid;
  v_existing_owner uuid;
  v_existing_fx jsonb;
  v_fx jsonb;
  v_currency text := coalesce(nullif(p_quote->>'currency',''),'EUR');
  v_code text;
  v_prefix text;
  v_number text;
  v_year integer := extract(year from now())::integer;
  v_sequence bigint;
  v_rate_date date;
  v_quote_date date;
  v_item jsonb;
  v_line jsonb;
  v_item_id text;
  v_quote_item_id text;
  v_version public.advertising_price_versions%rowtype;
  v_row public.advertising_quotes;
begin
  perform pg_advisory_xact_lock(hashtextextended('advertising_quote:' || v_id,0));

  begin
    v_owner := (p_quote->>'ownerId')::uuid;
  exception when others then
    raise exception using errcode = '22023', message = 'ADVERTISING_QUOTE_OWNER_INVALID';
  end;
  if v_owner is null then
    raise exception using errcode = '22023', message = 'ADVERTISING_QUOTE_OWNER_INVALID';
  end if;
  if coalesce(trim(p_quote->>'clientName'),'') = ''
     or coalesce(trim(p_quote->>'projectName'),'') = '' then
    raise exception using errcode = '22023', message = 'ADVERTISING_QUOTE_REQUIRED_FIELDS_INVALID';
  end if;
  if coalesce(p_quote->>'pricingEngine','') <> 'bom_v2'
     or v_currency not in ('EUR','RSD') then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_QUOTE_INVALID';
  end if;
  if coalesce(jsonb_typeof(p_quote->'items'),'') <> 'array'
     or coalesce(jsonb_typeof(p_bom_lines),'') <> 'array' then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_PAYLOAD_INVALID';
  end if;
  if coalesce(p_quote->>'quoteDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_QUOTE_DATE_INVALID';
  end if;
  begin
    v_quote_date := (p_quote->>'quoteDate')::date;
  exception when others then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_QUOTE_DATE_INVALID';
  end;
  if to_char(v_quote_date,'YYYY-MM-DD') <> p_quote->>'quoteDate' then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_QUOTE_DATE_INVALID';
  end if;

  if coalesce(jsonb_typeof(p_fx_snapshot),'') <> 'object' then
    raise exception using errcode = '22023', message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;
  if (select count(*) from jsonb_object_keys(p_fx_snapshot)) <> 5
     or coalesce(p_fx_snapshot->>'baseCurrency','') <> 'EUR'
     or coalesce(p_fx_snapshot->>'quoteCurrency','') <> v_currency
     or coalesce(p_fx_snapshot->>'quoteCurrency','') not in ('EUR','RSD')
     or coalesce(trim(p_fx_snapshot->>'source'),'') = ''
     or coalesce(p_fx_snapshot->>'rate','') !~ '^[0-9]+([.][0-9]+)?$'
     or coalesce(p_fx_snapshot->>'rateDate','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = '22023', message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;
  if (p_fx_snapshot->>'rate')::numeric <= 0 then
    raise exception using errcode = '22023', message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;
  begin
    v_rate_date := (p_fx_snapshot->>'rateDate')::date;
  exception when others then
    raise exception using errcode = '22023', message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end;
  if to_char(v_rate_date,'YYYY-MM-DD') <> p_fx_snapshot->>'rateDate' then
    raise exception using errcode = '22023', message = 'ADVERTISING_FX_SNAPSHOT_INVALID';
  end if;

  select owner_id, fx_snapshot
  into v_existing_owner, v_existing_fx
  from public.advertising_quotes
  where id = v_id
  for update;
  if found and v_existing_owner <> v_owner then
    raise exception using errcode = '42501', message = 'ADVERTISING_QUOTE_OWNERSHIP_INVALID';
  end if;
  if found and coalesce(v_existing_fx,'{}'::jsonb) <> '{}'::jsonb
     and v_existing_fx <> p_fx_snapshot then
    raise exception using errcode = '55000', message = 'ADVERTISING_FX_SNAPSHOT_IMMUTABLE';
  end if;
  v_fx := case
    when coalesce(v_existing_fx,'{}'::jsonb) = '{}'::jsonb then p_fx_snapshot
    else v_existing_fx
  end;

  if exists (
    select 1
    from jsonb_array_elements(p_quote->'items') item
    where coalesce(trim(item->>'id'),'') = ''
       or (item ? 'quoteId' and item->>'quoteId' <> v_id)
  ) or exists (
    select 1
    from jsonb_array_elements(p_quote->'items') item
    group by item->>'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'ADVERTISING_QUOTE_ITEM_ID_INVALID';
  end if;

  if exists (
    select 1
    from public.advertising_quote_items stored_item
    join jsonb_array_elements(p_quote->'items') item
      on item->>'id' = stored_item.id
    where stored_item.quote_id <> v_id
  ) then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_ITEM_OWNERSHIP_INVALID';
  end if;

  for v_line in select value from jsonb_array_elements(p_bom_lines) loop
    v_quote_item_id := nullif(v_line->>'quoteItemId','');
    if coalesce(trim(v_line->>'id'),'') = ''
       or coalesce(v_line->>'quoteId','') <> v_id then
      raise exception using errcode = '22023', message = 'ADVERTISING_BOM_LINE_ID_INVALID';
    end if;
    if v_quote_item_id is not null and not exists (
      select 1 from jsonb_array_elements(p_quote->'items') item
      where item->>'id' = v_quote_item_id
    ) then
      raise exception using errcode = '22023', message = 'ADVERTISING_BOM_ITEM_OWNERSHIP_INVALID';
    end if;
    if coalesce(v_line->>'lineType','') not in (
      'material','process','labor','installation','transport','design','discount','surcharge','adjustment'
    ) then
      raise exception using errcode = '22023', message = 'ADVERTISING_BOM_LINE_TYPE_INVALID';
    end if;
    if coalesce(v_line->>'sourceCurrency','') not in ('EUR','RSD')
       or coalesce(v_line->>'quoteCurrency','') <> v_currency then
      raise exception using errcode = '22023', message = 'ADVERTISING_BOM_LINE_CURRENCY_INVALID';
    end if;
    if coalesce(jsonb_typeof(v_line->'quantity') <> 'number',true)
       or coalesce(jsonb_typeof(v_line->'costUnitPriceSource') <> 'number',true)
       or coalesce(jsonb_typeof(v_line->'saleUnitPriceSource') <> 'number',true)
       or coalesce(jsonb_typeof(v_line->'costAmount') <> 'number',true)
       or coalesce(jsonb_typeof(v_line->'saleAmount') <> 'number',true)
       or (v_line->>'quantity')::numeric < 0
       or (v_line->>'costUnitPriceSource')::numeric < 0
       or (v_line->>'saleUnitPriceSource')::numeric < 0
       or (v_line->>'costAmount')::numeric < 0 then
      raise exception using errcode = '22023', message = 'ADVERTISING_BOM_LINE_AMOUNT_INVALID';
    end if;

    if v_line->>'lineType' = 'discount' then
      if v_quote_item_id is not null
         or nullif(v_line->>'catalogType','') is not null
         or nullif(v_line->>'catalogId','') is not null
         or nullif(v_line->>'priceVersionId','') is not null
         or (v_line->>'saleAmount')::numeric > 0 then
        raise exception using errcode = '22023', message = 'ADVERTISING_BOM_DISCOUNT_INVALID';
      end if;
    else
      if coalesce(v_line->>'catalogType','') not in ('materials','processes','services')
         or coalesce(trim(v_line->>'catalogId'),'') = ''
         or coalesce(trim(v_line->>'priceVersionId'),'') = ''
         or (v_line->>'saleAmount')::numeric < 0 then
        raise exception using errcode = '22023', message = 'ADVERTISING_BOM_PRICE_REFERENCE_INVALID';
      end if;
      select * into v_version
      from public.advertising_price_versions
      where id = v_line->>'priceVersionId'
        and catalog_type = v_line->>'catalogType'
        and catalog_id = v_line->>'catalogId'
        and currency = v_line->>'sourceCurrency';
      if not found then
        raise exception using errcode = '22023', message = 'ADVERTISING_BOM_PRICE_REFERENCE_INVALID';
      end if;
      if (v_line->>'costUnitPriceSource')::numeric <> v_version.cost_unit_price
         or (v_line->>'saleUnitPriceSource')::numeric <> v_version.sale_unit_price
         or v_version.effective_from > v_quote_date
         or exists (
           select 1
           from public.advertising_price_versions newer
           where newer.catalog_type = v_version.catalog_type
             and newer.catalog_id = v_version.catalog_id
             and newer.effective_from <= v_quote_date
             and (newer.effective_from,newer.version_number) > (v_version.effective_from,v_version.version_number)
         ) then
        raise exception using errcode = '22023', message = 'ADVERTISING_BOM_PRICE_EVIDENCE_INVALID';
      end if;
    end if;
  end loop;

  if exists (
    select 1
    from jsonb_array_elements(p_bom_lines) line
    group by line->>'id'
    having count(*) > 1
  ) then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_LINE_ID_INVALID';
  end if;

  if exists (
    select 1
    from public.advertising_quote_bom_lines stored_line
    join jsonb_array_elements(p_bom_lines) line
      on line->>'id' = stored_line.id
    where stored_line.quote_id <> v_id
  ) then
    raise exception using errcode = '22023', message = 'ADVERTISING_BOM_LINE_ID_INVALID';
  end if;

  select code, coalesce(data->>'quotePrefix',code || '-ADV')
  into v_code, v_prefix
  from public.quotation_entities_or_letterheads
  where id = v_entity_id and is_active = true;
  if v_code is null then
    raise exception using errcode = '22023', message = 'ADVERTISING_QUOTATION_ENTITY_UNAVAILABLE';
  end if;

  select quote_number into v_number
  from public.advertising_quotes
  where id = v_id;
  if v_number is null then
    insert into public.advertising_quote_number_counters(entity_code,quote_year,last_value)
    values(v_code,v_year,1)
    on conflict(entity_code,quote_year) do update
      set last_value = public.advertising_quote_number_counters.last_value + 1
    returning last_value into strict v_sequence;
    v_number := v_prefix || '-' || v_year || '-' || lpad(v_sequence::text,4,'0');
  end if;

  insert into public.advertising_quotes (
    id, quote_number, entity_id, status, mode, client_name, project_name,
    currency, owner_id, data, calculation_snapshot, entity_snapshot,
    terms_snapshot, pricing_engine, fx_snapshot, updated_at
  ) values (
    v_id,
    v_number,
    v_entity_id,
    coalesce(p_quote->>'status','draft'),
    coalesce(p_quote->>'mode','standard'),
    trim(p_quote->>'clientName'),
    trim(p_quote->>'projectName'),
    v_currency,
    v_owner,
    p_quote,
    coalesce(p_quote->'calculationSnapshot','{}'::jsonb),
    (select data || jsonb_build_object('id',id,'code',code,'isActive',is_active)
       from public.quotation_entities_or_letterheads where id = v_entity_id),
    coalesce((select terms_snapshot from public.advertising_quotes where id = v_id),'{}'::jsonb),
    'bom_v2',
    v_fx,
    now()
  )
  on conflict(id) do update set
    status = excluded.status,
    mode = excluded.mode,
    client_name = excluded.client_name,
    project_name = excluded.project_name,
    currency = excluded.currency,
    data = excluded.data,
    calculation_snapshot = excluded.calculation_snapshot,
    terms_snapshot = excluded.terms_snapshot,
    pricing_engine = 'bom_v2',
    fx_snapshot = v_fx,
    updated_at = now();

  delete from public.advertising_quote_bom_lines where quote_id=v_id;
  delete from public.advertising_quote_items where quote_id=v_id;
  delete from public.advertising_quote_additional_fees where quote_id=v_id;

  for v_item in select value from jsonb_array_elements(p_quote->'items') loop
    v_item_id := v_item->>'id';
    insert into public.advertising_quote_items(
      id, quote_id, group_id, customer_visible, position, data
    ) values (
      v_item_id,
      v_id,
      nullif(v_item->>'groupId',''),
      coalesce((v_item->>'customerVisible')::boolean,true),
      coalesce((v_item->>'position')::integer,0),
      v_item
    );
  end loop;

  for v_line in select value from jsonb_array_elements(p_bom_lines) loop
    insert into public.advertising_quote_bom_lines (
      id, quote_id, quote_item_id, position, line_type, catalog_type,
      catalog_id, price_version_id, description_snapshot, unit_snapshot,
      quantity, source_currency, quote_currency, cost_unit_price_source,
      sale_unit_price_source, cost_amount, sale_amount, customer_visible,
      supplier_snapshot, internal_notes
    ) values (
      v_line->>'id',
      v_id,
      nullif(v_line->>'quoteItemId',''),
      coalesce((v_line->>'position')::integer,0),
      v_line->>'lineType',
      nullif(v_line->>'catalogType',''),
      nullif(v_line->>'catalogId',''),
      nullif(v_line->>'priceVersionId',''),
      coalesce(v_line->>'descriptionSnapshot',''),
      coalesce(v_line->>'unitSnapshot',''),
      (v_line->>'quantity')::numeric,
      v_line->>'sourceCurrency',
      v_line->>'quoteCurrency',
      (v_line->>'costUnitPriceSource')::numeric,
      (v_line->>'saleUnitPriceSource')::numeric,
      (v_line->>'costAmount')::numeric,
      (v_line->>'saleAmount')::numeric,
      coalesce((v_line->>'customerVisible')::boolean,true),
      coalesce(v_line->'supplierSnapshot','{}'::jsonb),
      coalesce(v_line->>'internalNotes','')
    );
  end loop;

  select * into v_row from public.advertising_quotes where id = v_id;
  return v_row;
end
$$;

create or replace function public.save_advertising_catalog_entry_v2(
  p_kind text,
  p_item jsonb,
  p_price_version jsonb,
  p_user_id uuid
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_catalog_id text := nullif(trim(p_item->>'id'),'');
  v_metadata jsonb;
  v_version_number integer;
  v_effective_from date;
  v_price_row public.advertising_price_versions;
  v_item_row jsonb;
begin
  if p_user_id is null then
    raise exception using errcode = '22023', message = 'ADVERTISING_CATALOG_USER_INVALID';
  end if;
  if p_kind is null or p_kind not in ('materials','processes','services') or v_catalog_id is null then
    raise exception using errcode = '22023', message = 'ADVERTISING_CATALOG_KIND_INVALID';
  end if;
  if coalesce(trim(p_price_version->>'changeReason'),'') = '' then
    raise exception using errcode = '22023', message = 'ADJUSTMENT_REASON_REQUIRED';
  end if;
  if coalesce(jsonb_typeof(p_price_version),'') <> 'object'
     or coalesce(p_price_version->>'currency','') not in ('EUR','RSD')
     or coalesce(p_price_version->>'effectiveFrom','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
     or coalesce(jsonb_typeof(p_price_version->'costUnitPrice') <> 'number',true)
     or coalesce(jsonb_typeof(p_price_version->'saleUnitPrice') <> 'number',true)
     or (p_price_version ? 'minimumSaleUnitPrice'
         and p_price_version->'minimumSaleUnitPrice' <> 'null'::jsonb
         and jsonb_typeof(p_price_version->'minimumSaleUnitPrice') <> 'number')
     or (p_price_version ? 'minimumCharge'
         and jsonb_typeof(p_price_version->'minimumCharge') <> 'number') then
    raise exception using errcode = '22023', message = 'ADVERTISING_PRICE_VERSION_INVALID';
  end if;
  if (p_price_version->>'costUnitPrice')::numeric < 0
     or (p_price_version->>'saleUnitPrice')::numeric < 0
     or coalesce((p_price_version->>'minimumSaleUnitPrice')::numeric,0) < 0
     or coalesce((p_price_version->>'minimumCharge')::numeric,0) < 0 then
    raise exception using errcode = '22023', message = 'ADVERTISING_PRICE_VERSION_INVALID';
  end if;
  begin
    v_effective_from := (p_price_version->>'effectiveFrom')::date;
  exception when others then
    raise exception using errcode = '22023', message = 'ADVERTISING_PRICE_VERSION_INVALID';
  end;
  if to_char(v_effective_from,'YYYY-MM-DD') <> p_price_version->>'effectiveFrom' then
    raise exception using errcode = '22023', message = 'ADVERTISING_PRICE_VERSION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_kind || ':' || v_catalog_id,0));
  select coalesce(max(version_number),0) + 1
  into v_version_number
  from public.advertising_price_versions
  where catalog_type = p_kind and catalog_id = v_catalog_id;

  v_metadata := p_item - array[
    'costPrice','suggestedSalePrice','minimumSalePrice','defaultMinimumFee',
    'currency','effectiveFrom','adjustmentReason'
  ];

  case p_kind
    when 'materials' then
      insert into public.advertising_materials(id,data,is_active,updated_by,updated_at)
      values(v_catalog_id,v_metadata,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set
        data = public.advertising_materials.data || excluded.data,
        is_active = excluded.is_active,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning to_jsonb(advertising_materials) into v_item_row;
    when 'processes' then
      insert into public.advertising_processes(id,data,is_active,updated_by,updated_at)
      values(v_catalog_id,v_metadata,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set
        data = public.advertising_processes.data || excluded.data,
        is_active = excluded.is_active,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning to_jsonb(advertising_processes) into v_item_row;
    when 'services' then
      insert into public.advertising_service_catalog(id,data,is_active,updated_by,updated_at)
      values(v_catalog_id,v_metadata,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set
        data = public.advertising_service_catalog.data || excluded.data,
        is_active = excluded.is_active,
        updated_by = excluded.updated_by,
        updated_at = now()
      returning to_jsonb(advertising_service_catalog) into v_item_row;
  end case;

  insert into public.advertising_price_versions (
    id, catalog_type, catalog_id, version_number, currency, cost_unit_price,
    sale_unit_price, minimum_sale_unit_price, minimum_charge, effective_from,
    change_reason, supplier_snapshot, created_by
  ) values (
    'APV-' || gen_random_uuid()::text,
    p_kind,
    v_catalog_id,
    v_version_number,
    p_price_version->>'currency',
    (p_price_version->>'costUnitPrice')::numeric,
    (p_price_version->>'saleUnitPrice')::numeric,
    (p_price_version->>'minimumSaleUnitPrice')::numeric,
    coalesce((p_price_version->>'minimumCharge')::numeric,0),
    v_effective_from,
    trim(p_price_version->>'changeReason'),
    coalesce(p_price_version->'supplierSnapshot','{}'::jsonb),
    p_user_id
  )
  returning * into v_price_row;

  return jsonb_build_object(
    'item',v_item_row,
    'priceVersion',jsonb_build_object(
      'id',v_price_row.id,
      'catalogType',v_price_row.catalog_type,
      'catalogId',v_price_row.catalog_id,
      'versionNumber',v_price_row.version_number,
      'currency',v_price_row.currency,
      'costUnitPrice',v_price_row.cost_unit_price,
      'saleUnitPrice',v_price_row.sale_unit_price,
      'minimumSaleUnitPrice',v_price_row.minimum_sale_unit_price,
      'minimumCharge',v_price_row.minimum_charge,
      'effectiveFrom',v_price_row.effective_from,
      'changeReason',v_price_row.change_reason,
      'supplierSnapshot',v_price_row.supplier_snapshot,
      'createdBy',v_price_row.created_by,
      'createdAt',v_price_row.created_at
    )
  );
end
$$;

alter table public.advertising_price_versions enable row level security;
alter table public.advertising_quote_bom_lines enable row level security;

revoke all on public.advertising_price_versions from public, anon, authenticated;
revoke all on public.advertising_quote_bom_lines from public, anon, authenticated;
grant select, insert on public.advertising_price_versions to service_role;
grant select, insert, update, delete on public.advertising_quote_bom_lines to service_role;

revoke execute on function public.save_advertising_quote_v2(jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.save_advertising_quote_v2(jsonb,jsonb,jsonb)
  to service_role;
revoke execute on function public.save_advertising_catalog_entry_v2(text,jsonb,jsonb,uuid)
  from public, anon, authenticated;
grant execute on function public.save_advertising_catalog_entry_v2(text,jsonb,jsonb,uuid)
  to service_role;

-- Rollback strategy (manual, separately authorized, and backup-gated): remove the
-- two V2 RPCs and immutable trigger, remove V2-only rows/tables in reverse FK
-- order, then remove the two additive quote columns. V1 RPCs stay untouched.
