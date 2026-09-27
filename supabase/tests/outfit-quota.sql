-- Runs only in the disposable database created by tests/database.integration.mjs.
create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %', message; end if;
end $$;
create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$ begin
  begin
    execute statement;
  exception when others then
    if SQLSTATE = expected_state then return; end if;
    raise exception 'Expected %, got %: %', expected_state, SQLSTATE, SQLERRM;
  end;
  raise exception 'Expected error %, statement succeeded: %', expected_state, statement;
end $$;


insert into auth.users(id, raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000010', '{}'),
 ('00000000-0000-4000-8000-000000000011', '{}');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000010', false);
do $$ begin
  for i in 1..10 loop
    perform pg_temp.assert_true(public.consume_outfit_recommendation_quota(), 'first ten requests accepted');
  end loop;
  perform pg_temp.assert_true(not public.consume_outfit_recommendation_quota(), 'eleventh request denied');
end $$;
select pg_temp.expect_error('delete from private.outfit_recommendation_quotas', '42501');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000011', false);
select pg_temp.assert_true(public.consume_outfit_recommendation_quota(), 'another user has independent quota');
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.expect_error('select public.consume_outfit_recommendation_quota()', '42501');
reset role;
set role anon;
select pg_temp.expect_error('select public.consume_outfit_recommendation_quota()', '42501');
reset role;
update private.outfit_recommendation_quotas set window_start = now() - interval '2 hours'
where user_id='00000000-0000-4000-8000-000000000010';
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000010', false);
select pg_temp.assert_true(public.consume_outfit_recommendation_quota(), 'expired window resets');
reset role;
delete from auth.users where id in ('00000000-0000-4000-8000-000000000010', '00000000-0000-4000-8000-000000000011');
select pg_temp.assert_true((select count(*) = 0 from private.outfit_recommendation_quotas), 'account deletion clears quota');
select 'PASS: outfit rate limit, independent accounts, expiry, authentication and tamper protection' as result;
