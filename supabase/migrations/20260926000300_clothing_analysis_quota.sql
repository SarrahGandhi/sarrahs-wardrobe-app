begin;
create schema if not exists private;
create table private.clothing_analysis_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_start timestamptz not null default now(),
  requests integer not null default 0 check (requests between 0 and 20)
);
alter table private.clothing_analysis_quotas enable row level security;
revoke all on private.clothing_analysis_quotas from public, anon, authenticated;
-- Atomic per-account limit, shared across Edge instances. Caller cannot reset its window.
create function public.consume_clothing_analysis_quota() returns boolean
language plpgsql security definer set search_path = '' as $$
declare account_id uuid := auth.uid(); accepted uuid;
begin
  if account_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into private.clothing_analysis_quotas as quota(user_id, window_start, requests)
  values (account_id, now(), 1)
  on conflict (user_id) do update set
    window_start = case when quota.window_start <= now() - interval '1 hour' then now() else quota.window_start end,
    requests = case when quota.window_start <= now() - interval '1 hour' then 1 else quota.requests + 1 end
  where quota.window_start <= now() - interval '1 hour' or quota.requests < 20
  returning user_id into accepted;
  return accepted is not null;
end;
$$;
revoke all on function public.consume_clothing_analysis_quota() from public, anon;
grant execute on function public.consume_clothing_analysis_quota() to authenticated;
commit;
