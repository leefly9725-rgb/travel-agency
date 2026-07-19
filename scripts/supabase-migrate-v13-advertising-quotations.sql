-- LDS OPS Advertising Production Quotation V1 — V13
-- Additive and repeatable. Run in a non-production Supabase test project first.

create table if not exists public.advertising_quote_number_counters (
  entity_code text not null,
  quote_year integer not null,
  last_value bigint not null default 0,
  primary key (entity_code, quote_year)
);

create table if not exists public.advertising_materials (id text primary key, data jsonb not null default '{}'::jsonb, is_active boolean not null default true, updated_by uuid, updated_at timestamptz not null default now());
create table if not exists public.advertising_processes (id text primary key, data jsonb not null default '{}'::jsonb, is_active boolean not null default true, updated_by uuid, updated_at timestamptz not null default now());
create table if not exists public.advertising_material_process_rules (id text primary key, material_id text not null, process_id text not null, data jsonb not null default '{}'::jsonb, is_active boolean not null default true, updated_by uuid, updated_at timestamptz not null default now(), unique(material_id, process_id));
create table if not exists public.advertising_service_catalog (id text primary key, data jsonb not null default '{}'::jsonb, is_active boolean not null default true, updated_by uuid, updated_at timestamptz not null default now());
create table if not exists public.quotation_entities_or_letterheads (id text primary key, code text not null unique, data jsonb not null default '{}'::jsonb, is_active boolean not null default true, updated_by uuid, updated_at timestamptz not null default now());

create table if not exists public.advertising_quotes (
  id text primary key,
  quote_number text not null unique,
  entity_id text references public.quotation_entities_or_letterheads(id),
  status text not null default 'draft',
  mode text not null default 'standard',
  client_name text not null default '',
  project_name text not null default '',
  currency text not null default 'EUR',
  owner_id uuid not null,
  data jsonb not null default '{}'::jsonb,
  calculation_snapshot jsonb not null default '{}'::jsonb,
  entity_snapshot jsonb not null default '{}'::jsonb,
  terms_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.advertising_quote_items (id text primary key, quote_id text not null references public.advertising_quotes(id) on delete cascade, group_id text, customer_visible boolean not null default true, position integer not null default 0, data jsonb not null default '{}'::jsonb);
create table if not exists public.advertising_quote_item_processes (id text primary key, quote_item_id text not null references public.advertising_quote_items(id) on delete cascade, position integer not null default 0, data jsonb not null default '{}'::jsonb);
create table if not exists public.advertising_quote_additional_fees (id text primary key, quote_id text not null references public.advertising_quotes(id) on delete cascade, category text not null default 'other', customer_visible boolean not null default true, position integer not null default 0, data jsonb not null default '{}'::jsonb);
create table if not exists public.advertising_quote_files (id text primary key, quote_id text not null references public.advertising_quotes(id) on delete cascade, storage_path text not null, file_name text not null, mime_type text not null default '', size_bytes bigint not null default 0, created_by uuid, created_at timestamptz not null default now());
create table if not exists public.advertising_quote_adjustment_logs (id bigint generated always as identity primary key, quote_id text references public.advertising_quotes(id) on delete cascade, quote_item_id text, catalog_type text, catalog_id text, field_name text not null, old_value jsonb, new_value jsonb, reason text not null, user_id uuid not null, created_at timestamptz not null default now());

insert into public.quotation_entities_or_letterheads(id,code,data,is_active) values
('lds','LDS','{"code":"LDS","nameZh":"泷鼎晟国际旅行社","nameEn":"LDS International Travel","quotePrefix":"LDS-ADV"}',true),
('ema','EMA','{"code":"EMA","nameZh":"EMA Media","nameEn":"EMA Media","quotePrefix":"EMA-ADV"}',true)
on conflict(id) do nothing;
insert into public.advertising_materials(id,data,is_active) values
('pvc-3','{"nameZh":"3mm PVC发泡板","nameEn":"3mm Forex / PVC Foam Board","specification":"1220×2440×3mm","costPrice":9.5,"suggestedSalePrice":14.25,"minimumSalePrice":9.5,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":3,"supplierName":"EMA"}',true),
('acp-3','{"nameZh":"铝塑复合板","nameEn":"Aluminium Composite Panel","specification":"1220×2440×3mm","costPrice":18.5,"suggestedSalePrice":27.75,"minimumSalePrice":18.5,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":3,"supplierName":"EMA"}',true),
('acp-4','{"nameZh":"铝塑复合板","nameEn":"Aluminium Composite Panel","specification":"1220×2440×4mm","costPrice":21.5,"suggestedSalePrice":32.25,"minimumSalePrice":21.5,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":4,"supplierName":"EMA"}',true),
('acrylic-2','{"nameZh":"透明亚克力","nameEn":"Clear Acrylic","specification":"1220×2440×2mm","costPrice":19,"suggestedSalePrice":28.5,"minimumSalePrice":19,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":2,"supplierName":"EMA"}',true),
('acrylic-3','{"nameZh":"透明亚克力","nameEn":"Clear Acrylic","specification":"1220×2440×3mm","costPrice":26,"suggestedSalePrice":39,"minimumSalePrice":26,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":3,"supplierName":"EMA"}',true),
('acrylic-5','{"nameZh":"透明亚克力","nameEn":"Clear Acrylic","specification":"1220×2440×5mm","costPrice":42,"suggestedSalePrice":63,"minimumSalePrice":42,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":5,"supplierName":"EMA"}',true),
('acrylic-10','{"nameZh":"透明亚克力","nameEn":"Clear Acrylic","specification":"1220×2440×10mm","costPrice":82,"suggestedSalePrice":123,"minimumSalePrice":82,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":10,"supplierName":"EMA"}',true),
('aluminum-08','{"nameZh":"铝板","nameEn":"Aluminium Sheet","specification":"1220×2440×0.8mm","costPrice":24.5,"suggestedSalePrice":36.75,"minimumSalePrice":24.5,"defaultMarkupRate":50,"currency":"EUR","unit":"sqm","sheetWidthMm":1220,"sheetHeightMm":2440,"thicknessMm":0.8,"supplierName":"EMA"}',true)
on conflict(id) do nothing;
insert into public.advertising_processes(id,data,is_active) values
('uv','{"nameZh":"UV平板打印","nameEn":"UV Flatbed Printing","unit":"sqm","costPrice":15.5,"suggestedSalePrice":23.25,"defaultMarkupRate":50,"defaultMinimumFee":35,"supportsDoubleSide":true}',true),
('sticker','{"nameZh":"写真车贴","nameEn":"Self-adhesive Printing","unit":"sqm","costPrice":15,"suggestedSalePrice":22.5,"defaultMarkupRate":50,"defaultMinimumFee":35,"supportsDoubleSide":true}',true),
('engraving','{"nameZh":"雕刻","nameEn":"Engraving","unit":"sqm","costPrice":7.5,"suggestedSalePrice":11.25,"defaultMarkupRate":50,"defaultMinimumFee":35,"supportsDoubleSide":false}',true),
('laser-cut','{"nameZh":"激光切割","nameEn":"Laser Cutting","unit":"sqm","costPrice":9,"suggestedSalePrice":13.5,"defaultMarkupRate":50,"defaultMinimumFee":35,"supportsDoubleSide":false}',true),
('laser-engrave','{"nameZh":"激光雕刻","nameEn":"Laser Engraving","unit":"sqm","costPrice":12,"suggestedSalePrice":18,"defaultMarkupRate":50,"defaultMinimumFee":35,"supportsDoubleSide":false}',true),
('cnc','{"nameZh":"CNC切割","nameEn":"CNC Cutting","unit":"sqm","costPrice":12.5,"suggestedSalePrice":18.75,"defaultMarkupRate":50,"defaultMinimumFee":35,"supportsDoubleSide":false}',true),
('heat-bend','{"nameZh":"热弯","nameEn":"Heat Bending","unit":"sqm","costPrice":10,"suggestedSalePrice":15,"defaultMarkupRate":50,"defaultMinimumFee":35,"supportsDoubleSide":false}',true),
('groove-bend','{"nameZh":"开槽折弯","nameEn":"Groove Bending","unit":"sqm","costPrice":0,"suggestedSalePrice":0,"defaultMinimumFee":35,"requiresManualQuote":true}',true),
('lamination','{"nameZh":"覆膜","nameEn":"Lamination","unit":"sqm","costPrice":5,"suggestedSalePrice":7.5,"defaultMinimumFee":35,"supportsDoubleSide":true}',true),
('drilling','{"nameZh":"打孔","nameEn":"Drilling","unit":"fixed","costPrice":1,"suggestedSalePrice":1.5,"defaultMinimumFee":35}',true),
('custom-shape','{"nameZh":"异形加工","nameEn":"Custom Shaping","unit":"fixed","costPrice":0,"suggestedSalePrice":0,"requiresManualQuote":true,"defaultMinimumFee":35}',true),
('assembly','{"nameZh":"组装加工","nameEn":"Assembly","unit":"fixed","costPrice":0,"suggestedSalePrice":0,"requiresManualQuote":true,"defaultMinimumFee":35}',true),
('other','{"nameZh":"其他自定义加工","nameEn":"Other Custom Processing","unit":"fixed","costPrice":0,"suggestedSalePrice":0,"requiresManualQuote":true,"defaultMinimumFee":35}',true)
on conflict(id) do nothing;
insert into public.advertising_material_process_rules(id,material_id,process_id,data,is_active) values
('pvc-3-uv','pvc-3','uv','{}',true),('pvc-3-sticker','pvc-3','sticker','{}',true),('pvc-3-engraving','pvc-3','engraving','{}',true),
('acp-3-engraving','acp-3','engraving','{}',true),('acp-3-uv','acp-3','uv','{}',true),('acp-3-groove-bend','acp-3','groove-bend','{}',true),
('acp-4-engraving','acp-4','engraving','{}',true),('acp-4-uv','acp-4','uv','{}',true),('acp-4-groove-bend','acp-4','groove-bend','{}',true),
('acrylic-2-laser-cut','acrylic-2','laser-cut','{}',true),('acrylic-2-uv','acrylic-2','uv','{}',true),('acrylic-3-heat-bend','acrylic-3','heat-bend','{}',true),('acrylic-3-engraving','acrylic-3','engraving','{}',true),('acrylic-3-uv','acrylic-3','uv','{}',true),('acrylic-5-heat-bend','acrylic-5','heat-bend','{}',true),('acrylic-5-laser-engrave','acrylic-5','laser-engrave','{}',true),('acrylic-5-uv','acrylic-5','uv','{}',true),('acrylic-10-laser-engrave','acrylic-10','laser-engrave','{}',true),('acrylic-10-uv','acrylic-10','uv','{}',true),('aluminum-08-engraving','aluminum-08','engraving','{}',true),('aluminum-08-uv','aluminum-08','uv','{}',true)
on conflict(id) do nothing;
insert into public.advertising_service_catalog(id,data,is_active) values
('delivery','{"nameZh":"配送费","nameEn":"Delivery","category":"delivery","unit":"trip","costPrice":0,"suggestedSalePrice":150}',true),
('installation','{"nameZh":"安装费","nameEn":"Installation","category":"installation","unit":"fixed","costPrice":0,"suggestedSalePrice":0,"requiresManualQuote":true}',true),
('design','{"nameZh":"设计费","nameEn":"Design","category":"design","unit":"hour","costPrice":0,"suggestedSalePrice":0}',true),
('measurement','{"nameZh":"测量费","nameEn":"Site Measurement","category":"measurement","unit":"trip","costPrice":0,"suggestedSalePrice":0}',true),
('high-access','{"nameZh":"高空作业费","nameEn":"High Access","category":"construction","unit":"hour","costPrice":0,"suggestedSalePrice":0}',true),
('rush','{"nameZh":"加急费","nameEn":"Rush Fee","category":"urgent","unit":"fixed","costPrice":0,"suggestedSalePrice":0}',true)
on conflict(id) do nothing;

create index if not exists idx_advertising_quotes_owner on public.advertising_quotes(owner_id, updated_at desc);
create index if not exists idx_advertising_quotes_filters on public.advertising_quotes(entity_id, status, mode, updated_at desc);
create index if not exists idx_advertising_quote_items_quote on public.advertising_quote_items(quote_id, position);
create index if not exists idx_advertising_processes_item on public.advertising_quote_item_processes(quote_item_id, position);
create index if not exists idx_advertising_fees_quote on public.advertising_quote_additional_fees(quote_id, position);
create index if not exists idx_advertising_files_quote on public.advertising_quote_files(quote_id);
create index if not exists idx_advertising_rules_material on public.advertising_material_process_rules(material_id, is_active);
create index if not exists idx_advertising_logs_quote on public.advertising_quote_adjustment_logs(quote_id, created_at desc);

insert into public.resources(code,name_zh,group_name,sort_order) values
  ('advertising_quote','广告制作报价','报价业务',35),
  ('advertising_catalog','广告价格库','主数据',65)
on conflict(code) do nothing;
insert into public.permissions(code,resource_id,action) values
  ('advertising_quote.view',(select id from public.resources where code='advertising_quote'),'view'),
  ('advertising_quote.create',(select id from public.resources where code='advertising_quote'),'create'),
  ('advertising_quote.edit',(select id from public.resources where code='advertising_quote'),'edit'),
  ('advertising_quote.delete',(select id from public.resources where code='advertising_quote'),'delete'),
  ('advertising_quote.export',(select id from public.resources where code='advertising_quote'),'export'),
  ('advertising_quote.cost_view',(select id from public.resources where code='advertising_quote'),'cost_view'),
  ('advertising_quote.audit_view',(select id from public.resources where code='advertising_quote'),'audit_view'),
  ('advertising_catalog.manage',(select id from public.resources where code='advertising_catalog'),'manage')
on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code='admin' and p.code like 'advertising_%'
on conflict(role_id,permission_id) do nothing;
insert into public.role_permissions(role_id,permission_id)
select r.id,p.id from public.roles r cross join public.permissions p
where r.code in ('standard_quote_staff','project_quote_staff') and p.code in ('advertising_quote.view','advertising_quote.create','advertising_quote.edit','advertising_quote.export')
on conflict(role_id,permission_id) do nothing;

create schema if not exists private;
create or replace function private.is_advertising_admin() returns boolean
language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id where ur.user_id=auth.uid() and r.code='admin') $$;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;
revoke execute on function private.is_advertising_admin() from public, anon;
grant execute on function private.is_advertising_admin() to authenticated, service_role;

alter table public.advertising_quote_number_counters enable row level security;
alter table public.advertising_materials enable row level security;
alter table public.advertising_processes enable row level security;
alter table public.advertising_material_process_rules enable row level security;
alter table public.advertising_service_catalog enable row level security;
alter table public.quotation_entities_or_letterheads enable row level security;
alter table public.advertising_quotes enable row level security;
alter table public.advertising_quote_items enable row level security;
alter table public.advertising_quote_item_processes enable row level security;
alter table public.advertising_quote_additional_fees enable row level security;
alter table public.advertising_quote_files enable row level security;
alter table public.advertising_quote_adjustment_logs enable row level security;

do $$ declare t text; begin
  foreach t in array array['advertising_materials','advertising_processes','advertising_material_process_rules','advertising_service_catalog','quotation_entities_or_letterheads','advertising_quotes','advertising_quote_items','advertising_quote_item_processes','advertising_quote_additional_fees','advertising_quote_files','advertising_quote_adjustment_logs'] loop
    execute format('drop policy if exists advertising_admin_all on public.%I',t);
    execute format('create policy advertising_admin_all on public.%I for all to authenticated using ((select private.is_advertising_admin())) with check ((select private.is_advertising_admin()))',t);
  end loop;
end $$;
-- Staff intentionally have no direct base-table policy: JSON snapshots contain cost data.
-- They use the Node API, which checks RBAC and removes sensitive fields server-side.
revoke all on public.advertising_quote_number_counters from anon, authenticated;
revoke all on public.advertising_quote_adjustment_logs from anon, authenticated;
revoke all on public.advertising_materials, public.advertising_processes, public.advertising_material_process_rules, public.advertising_service_catalog from anon;
revoke all on public.advertising_quotes, public.advertising_quote_items, public.advertising_quote_item_processes, public.advertising_quote_additional_fees, public.advertising_quote_files from anon;
grant select,insert,update,delete on public.advertising_materials, public.advertising_processes, public.advertising_material_process_rules, public.advertising_service_catalog, public.quotation_entities_or_letterheads to authenticated;
grant select,insert,update,delete on public.advertising_quotes, public.advertising_quote_items, public.advertising_quote_item_processes, public.advertising_quote_additional_fees, public.advertising_quote_files to authenticated;
grant select on public.advertising_quote_adjustment_logs to authenticated;

create or replace function public.save_advertising_quote(p_quote jsonb) returns public.advertising_quotes
language plpgsql security definer set search_path=''
as $$
declare v_id text:=coalesce(nullif(p_quote->>'id',''),'ADV-'||gen_random_uuid()::text); v_entity_id text:=coalesce(nullif(p_quote->>'entityId',''),'lds'); v_code text; v_prefix text; v_number text; v_year integer:=extract(year from now())::integer; v_sequence bigint; v_owner uuid:=(p_quote->>'ownerId')::uuid; v_row public.advertising_quotes; v_item jsonb; v_process jsonb; v_fee jsonb; v_log jsonb; v_item_id text;
begin
  if v_owner is null then raise exception 'ownerId is required'; end if;
  if coalesce(trim(p_quote->>'clientName'),'')='' or coalesce(trim(p_quote->>'projectName'),'')='' then
    raise exception 'clientName and projectName are required';
  end if;
  select code,coalesce(data->>'quotePrefix',code||'-ADV') into v_code,v_prefix from public.quotation_entities_or_letterheads where id=v_entity_id and is_active=true;
  if v_code is null then raise exception 'quotation entity is unavailable'; end if;
  select quote_number into v_number from public.advertising_quotes where id=v_id;
  if v_number is null then
    insert into public.advertising_quote_number_counters(entity_code,quote_year,last_value) values(v_code,v_year,1)
    on conflict(entity_code,quote_year) do update set last_value=public.advertising_quote_number_counters.last_value+1 returning last_value into strict v_sequence;
    v_number:=v_prefix||'-'||v_year||'-'||lpad(v_sequence::text,4,'0');
  end if;
  insert into public.advertising_quotes(id,quote_number,entity_id,status,mode,client_name,project_name,currency,owner_id,data,calculation_snapshot,entity_snapshot,terms_snapshot,updated_at)
  values(v_id,v_number,v_entity_id,coalesce(p_quote->>'status','draft'),coalesce(p_quote->>'mode','standard'),trim(p_quote->>'clientName'),trim(p_quote->>'projectName'),coalesce(p_quote->>'currency','EUR'),v_owner,p_quote,p_quote->'calculationSnapshot',(select data || jsonb_build_object('id',id,'code',code,'isActive',is_active) from public.quotation_entities_or_letterheads where id=v_entity_id),coalesce((select terms_snapshot from public.advertising_quotes where id=v_id),'{}'::jsonb),now())
  on conflict(id) do update set status=excluded.status,mode=excluded.mode,client_name=excluded.client_name,project_name=excluded.project_name,currency=excluded.currency,data=excluded.data,calculation_snapshot=excluded.calculation_snapshot,terms_snapshot=excluded.terms_snapshot,updated_at=now();
  delete from public.advertising_quote_items where quote_id=v_id; delete from public.advertising_quote_additional_fees where quote_id=v_id;
  for v_item in select value from jsonb_array_elements(coalesce(p_quote->'items','[]'::jsonb)) loop
    if not exists (
      select 1 from public.advertising_materials
      where id=v_item->>'materialId' and is_active=true
    ) then raise exception 'material is unavailable'; end if;
    v_item_id:=coalesce(nullif(v_item->>'id',''),'ADI-'||gen_random_uuid()::text);
    insert into public.advertising_quote_items(id,quote_id,group_id,customer_visible,position,data) values(v_item_id,v_id,v_item->>'groupId',coalesce((v_item->>'customerVisible')::boolean,true),coalesce((v_item->>'position')::integer,0),v_item);
    for v_process in select value from jsonb_array_elements(coalesce(v_item->'processes','[]'::jsonb)) loop
      if not exists (
        select 1 from public.advertising_material_process_rules
        where material_id=v_item->>'materialId' and process_id=v_process->>'processId' and is_active=true
      ) then raise exception 'material/process combination is unavailable'; end if;
      insert into public.advertising_quote_item_processes(id,quote_item_id,position,data) values(coalesce(nullif(v_process->>'id',''),'ADP-'||gen_random_uuid()::text),v_item_id,coalesce((v_process->>'position')::integer,0),v_process);
    end loop;
  end loop;
  for v_fee in select value from jsonb_array_elements(coalesce(p_quote->'additionalFees','[]'::jsonb)) loop insert into public.advertising_quote_additional_fees(id,quote_id,category,customer_visible,position,data) values(coalesce(nullif(v_fee->>'id',''),'ADF-'||gen_random_uuid()::text),v_id,coalesce(v_fee->>'category','other'),coalesce((v_fee->>'customerVisible')::boolean,true),coalesce((v_fee->>'position')::integer,0),v_fee); end loop;
  for v_log in select value from jsonb_array_elements(coalesce(p_quote->'adjustmentLogs','[]'::jsonb)) loop
    if coalesce(trim(v_log->>'reason'),'')='' then raise exception 'adjustment reason is required'; end if;
    insert into public.advertising_quote_adjustment_logs(quote_id,quote_item_id,field_name,old_value,new_value,reason,user_id) values(v_id,v_log->>'quoteItemId',v_log->>'fieldName',v_log->'oldValue',v_log->'newValue',v_log->>'reason',coalesce((v_log->>'userId')::uuid,v_owner));
  end loop;
  select * into v_row from public.advertising_quotes where id=v_id; return v_row;
end $$;
revoke execute on function public.save_advertising_quote(jsonb) from public, anon, authenticated;
grant execute on function public.save_advertising_quote(jsonb) to service_role;

create or replace function public.save_advertising_catalog_entry(
  p_kind text,
  p_item jsonb,
  p_logs jsonb,
  p_user_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  v_result jsonb;
  v_log jsonb;
begin
  if p_user_id is null then raise exception 'userId is required'; end if;
  if coalesce(trim(p_item->>'id'),'')='' then raise exception 'catalog id is required'; end if;

  case p_kind
    when 'materials' then
      insert into public.advertising_materials(id,data,is_active,updated_by,updated_at)
      values(p_item->>'id',p_item,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set data=excluded.data,is_active=excluded.is_active,updated_by=excluded.updated_by,updated_at=now()
      returning to_jsonb(advertising_materials) into v_result;
    when 'processes' then
      insert into public.advertising_processes(id,data,is_active,updated_by,updated_at)
      values(p_item->>'id',p_item,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set data=excluded.data,is_active=excluded.is_active,updated_by=excluded.updated_by,updated_at=now()
      returning to_jsonb(advertising_processes) into v_result;
    when 'rules' then
      insert into public.advertising_material_process_rules(id,material_id,process_id,data,is_active,updated_by,updated_at)
      values(p_item->>'id',p_item->>'materialId',p_item->>'processId',p_item,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set material_id=excluded.material_id,process_id=excluded.process_id,data=excluded.data,is_active=excluded.is_active,updated_by=excluded.updated_by,updated_at=now()
      returning to_jsonb(advertising_material_process_rules) into v_result;
    when 'services' then
      insert into public.advertising_service_catalog(id,data,is_active,updated_by,updated_at)
      values(p_item->>'id',p_item,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set data=excluded.data,is_active=excluded.is_active,updated_by=excluded.updated_by,updated_at=now()
      returning to_jsonb(advertising_service_catalog) into v_result;
    when 'entities' then
      insert into public.quotation_entities_or_letterheads(id,code,data,is_active,updated_by,updated_at)
      values(p_item->>'id',p_item->>'code',p_item,coalesce((p_item->>'isActive')::boolean,true),p_user_id,now())
      on conflict(id) do update set code=excluded.code,data=excluded.data,is_active=excluded.is_active,updated_by=excluded.updated_by,updated_at=now()
      returning to_jsonb(quotation_entities_or_letterheads) into v_result;
    else
      raise exception 'invalid advertising catalog kind';
  end case;

  for v_log in select value from jsonb_array_elements(coalesce(p_logs,'[]'::jsonb)) loop
    if coalesce(trim(v_log->>'reason'),'')='' then raise exception 'adjustment reason is required'; end if;
    insert into public.advertising_quote_adjustment_logs(catalog_type,catalog_id,field_name,old_value,new_value,reason,user_id)
    values(p_kind,p_item->>'id',v_log->>'fieldName',v_log->'oldValue',v_log->'newValue',v_log->>'reason',p_user_id);
  end loop;
  return v_result;
end $$;
revoke execute on function public.save_advertising_catalog_entry(text,jsonb,jsonb,uuid) from public, anon, authenticated;
grant execute on function public.save_advertising_catalog_entry(text,jsonb,jsonb,uuid) to service_role;

-- Rollback requires a backup and drops only the advertising objects in reverse FK order.
