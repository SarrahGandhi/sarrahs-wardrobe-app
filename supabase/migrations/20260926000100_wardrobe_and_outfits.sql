-- Requires 20260925000100_profiles.sql. Apply once, in migration order.
begin;

create type public.wardrobe_category as enum
  ('top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'jewellery', 'accessory');
create type public.clothing_fit as enum ('fitted', 'regular', 'relaxed', 'oversized');
create type public.clothing_season as enum ('spring', 'summer', 'autumn', 'winter');
create type public.outfit_formality as enum
  ('casual', 'smart_casual', 'business', 'semi_formal', 'formal');
create type public.sleeve_length as enum
  ('sleeveless', 'short', 'elbow', 'three_quarter', 'long');
create type public.recommendation_kind as enum
  ('safe_choice', 'more_stylish', 'something_different');
create type public.outfit_reaction as enum ('love', 'like', 'neutral', 'dislike');

create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  image_url text check (image_url ~* '^https?://[^[:space:]]+$' and char_length(image_url) <= 4096),
  product_url text check (product_url ~* '^https?://[^[:space:]]+$' and char_length(product_url) <= 4096),
  name text not null check (char_length(btrim(name)) between 1 and 200),
  brand text check (char_length(brand) <= 200),
  category public.wardrobe_category not null,
  subcategory text check (char_length(subcategory) <= 100),
  primary_colour text check (char_length(primary_colour) <= 100),
  secondary_colours text[] not null default '{}',
  pattern text check (char_length(pattern) <= 100),
  material text[] not null default '{}',
  fit public.clothing_fit,
  season public.clothing_season[] not null default '{}',
  formality public.outfit_formality,
  style_tags text[] not null default '{}',
  warmth_level smallint check (warmth_level between 1 and 5),
  sleeve_length public.sleeve_length,
  neckline text check (char_length(neckline) <= 100),
  favourite boolean not null default false,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  check (array_position(secondary_colours, null) is null),
  check (array_position(material, null) is null),
  check (array_position(season, null) is null),
  check (array_position(style_tags, null) is null)
);

create table public.outfit_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  occasion text not null check (char_length(btrim(occasion)) between 1 and 200),
  planned_for date,
  location text check (char_length(location) <= 300),
  temperature_c numeric(5,2) check (temperature_c between -100 and 70),
  feels_like_c numeric(5,2) check (feels_like_c between -100 and 70),
  precipitation_probability smallint check (precipitation_probability between 0 and 100),
  weather_summary text check (char_length(weather_summary) <= 500),
  weather_observed_at timestamptz,
  formality public.outfit_formality,
  style_preferences text[] not null default '{}',
  preferred_colours text[] not null default '{}',
  excluded_categories public.wardrobe_category[] not null default '{}',
  anchor_item_id uuid,
  instructions text check (char_length(instructions) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, anchor_item_id)
    references public.wardrobe_items(user_id, id) on delete no action,
  check (array_position(style_preferences, null) is null),
  check (array_position(preferred_colours, null) is null),
  check (array_position(excluded_categories, null) is null)
);

create table public.outfit_recommendations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  outfit_plan_id uuid not null,
  kind public.recommendation_kind not null,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  explanation text check (char_length(explanation) <= 8000),
  styling_notes text check (char_length(styling_notes) <= 4000),
  generation_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(generation_metadata) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, id),
  foreign key (user_id, outfit_plan_id)
    references public.outfit_plans(user_id, id) on delete cascade
);

create table public.outfit_recommendation_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  outfit_recommendation_id uuid not null,
  wardrobe_item_id uuid not null,
  role public.wardrobe_category not null,
  position smallint not null default 0 check (position >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (outfit_recommendation_id, wardrobe_item_id),
  foreign key (user_id, outfit_recommendation_id)
    references public.outfit_recommendations(user_id, id) on delete cascade,
  foreign key (user_id, wardrobe_item_id)
    references public.wardrobe_items(user_id, id) on delete no action
);

create table public.saved_looks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  outfit_recommendation_id uuid not null,
  name text check (char_length(btrim(name)) between 1 and 200),
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, outfit_recommendation_id),
  foreign key (user_id, outfit_recommendation_id)
    references public.outfit_recommendations(user_id, id) on delete cascade
);

create table public.outfit_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  outfit_recommendation_id uuid not null,
  worn boolean not null default false,
  worn_on date,
  rating smallint check (rating between 1 and 5),
  reaction public.outfit_reaction,
  feedback_text text check (char_length(feedback_text) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, outfit_recommendation_id),
  foreign key (user_id, outfit_recommendation_id)
    references public.outfit_recommendations(user_id, id) on delete cascade,
  check (worn_on is null or worn)
);

-- Leading user_id supports RLS and the main per-user list/filter queries.
create index wardrobe_items_user_created_idx on public.wardrobe_items(user_id, created_at desc);
create index wardrobe_items_active_category_idx on public.wardrobe_items(user_id, category)
  where archived_at is null;
create index wardrobe_items_favourites_idx on public.wardrobe_items(user_id, created_at desc)
  where favourite and archived_at is null;
create index wardrobe_items_style_tags_idx on public.wardrobe_items using gin(style_tags);
create index wardrobe_items_season_idx on public.wardrobe_items using gin(season);
create index outfit_plans_user_created_idx on public.outfit_plans(user_id, created_at desc);
create index outfit_plans_anchor_idx on public.outfit_plans(user_id, anchor_item_id);
create index outfit_recommendations_plan_idx on public.outfit_recommendations(user_id, outfit_plan_id, created_at desc);
create index outfit_recommendation_items_order_idx
  on public.outfit_recommendation_items(user_id, outfit_recommendation_id, position);
create index outfit_recommendation_items_wardrobe_idx
  on public.outfit_recommendation_items(user_id, wardrobe_item_id);
create index saved_looks_user_created_idx on public.saved_looks(user_id, created_at desc);
create index outfit_feedback_user_created_idx on public.outfit_feedback(user_id, created_at desc);
-- UNIQUE constraints already index saved-look/feedback ownership and recommendation FKs.

-- Database-owned timestamps and immutable identity/ownership, including privileged writes.
create function public.protect_owned_record()
returns trigger language plpgsql set search_path = '' as $$
begin
  if TG_OP = 'UPDATE' then
    if new.id is distinct from old.id or new.user_id is distinct from old.user_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Record identity, owner and creation time cannot be changed'
        using errcode = '42501';
    end if;
  else
    new.created_at = clock_timestamp();
  end if;
  new.updated_at = clock_timestamp();
  return new;
end;
$$;
revoke all on function public.protect_owned_record() from public, anon, authenticated;

-- Apply identical ownership rules to all six new tables. profiles retains its stricter
-- existing policy: Auth creates it, and clients can only read/edit their own public fields.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'wardrobe_items', 'outfit_plans', 'outfit_recommendations',
    'outfit_recommendation_items', 'saved_looks', 'outfit_feedback'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated', table_name);
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_delete on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create trigger protect_owned_record before insert or update on public.%I for each row execute function public.protect_owned_record()', table_name);
  end loop;
end;
$$;

comment on column public.wardrobe_items.season is 'Multiple seasons allowed; empty means unspecified. Select all four for year-round use.';
comment on column public.wardrobe_items.warmth_level is '1 = very light, 5 = very warm; NULL = unknown.';
comment on column public.wardrobe_items.image_url is 'Stable HTTP(S) image URL, not an expiring signed URL. Storage bucket policies are configured separately.';
comment on column public.wardrobe_items.archived_at is 'Archive referenced items to preserve saved outfits. Hard deletion requires removing references first.';
comment on column public.outfit_plans.anchor_item_id is 'Optional owned wardrobe piece to build the outfit around.';
comment on column public.outfit_recommendations.generation_metadata is 'Non-secret generation provenance, e.g. model and prompt version. Core outfit data lives in typed columns and relations.';
comment on column public.outfit_recommendation_items.role is 'Styling role can differ from the item category; multiple pieces may share a role.';
comment on table public.saved_looks is 'Bookmark of a recommendation, not a frozen copy. Later edits to the recommendation or its pieces are reflected here.';
comment on table public.outfit_feedback is 'One current editable feedback record per user and recommendation, not a wear-event log.';

commit;
