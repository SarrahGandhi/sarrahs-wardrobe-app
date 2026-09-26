-- Multiple owned starting pieces, plus the manually chosen indoor/outdoor setting.
alter table public.outfit_plans add column setting text
  check (setting in ('indoor', 'outdoor', 'both'));
create table public.outfit_plan_items (
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  plan_id uuid not null,
  wardrobe_item_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (plan_id, wardrobe_item_id),
  foreign key (user_id, plan_id) references public.outfit_plans(user_id, id) on delete cascade,
  foreign key (user_id, wardrobe_item_id) references public.wardrobe_items(user_id, id) on delete no action
);
create index outfit_plan_items_owner_item_idx on public.outfit_plan_items(user_id, wardrobe_item_id);
alter table public.outfit_plan_items enable row level security;
revoke all on public.outfit_plan_items from public, anon, authenticated;
grant select, insert, delete on public.outfit_plan_items to authenticated;
grant all on public.outfit_plan_items to service_role;
create policy owner_select on public.outfit_plan_items for select to authenticated using ((select auth.uid()) = user_id);
create policy owner_insert on public.outfit_plan_items for insert to authenticated with check ((select auth.uid()) = user_id);
create policy owner_delete on public.outfit_plan_items for delete to authenticated using ((select auth.uid()) = user_id);
insert into public.outfit_plan_items(user_id, plan_id, wardrobe_item_id)
  select user_id, id, anchor_item_id from public.outfit_plans where anchor_item_id is not null;

-- A single transaction avoids partial plans; a stable client UUID makes retries safe.
create function public.save_outfit_plan(
  p_id uuid, p_occasion text, p_temperature_c numeric, p_weather_summary text,
  p_setting text, p_instructions text, p_style_preferences text[], p_item_ids uuid[]
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare item_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if exists(select 1 from public.outfit_plans where id = p_id and user_id = auth.uid()) then return p_id; end if;
  if p_item_ids is null or array_position(p_item_ids, null) is not null then
    raise exception 'Invalid starting pieces' using errcode = '22023';
  end if;
  foreach item_id in array p_item_ids loop
    if not exists(select 1 from public.wardrobe_items where id = item_id and user_id = auth.uid() and archived_at is null) then
      raise exception 'Starting piece unavailable' using errcode = '22023';
    end if;
  end loop;
  insert into public.outfit_plans(id, user_id, occasion, temperature_c, weather_summary, setting, instructions, style_preferences, anchor_item_id)
  values(p_id, auth.uid(), btrim(p_occasion), p_temperature_c, p_weather_summary, p_setting, p_instructions, p_style_preferences, p_item_ids[1]);
  insert into public.outfit_plan_items(user_id, plan_id, wardrobe_item_id)
    select auth.uid(), p_id, selected_id from (select distinct unnest(p_item_ids) as selected_id) selected;
  return p_id;
end $$;
revoke all on function public.save_outfit_plan(uuid,text,numeric,text,text,text,text[],uuid[]) from public, anon;
grant execute on function public.save_outfit_plan(uuid,text,numeric,text,text,text,text[],uuid[]) to authenticated;
