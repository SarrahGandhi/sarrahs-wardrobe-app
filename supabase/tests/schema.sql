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
 ('00000000-0000-4000-8000-000000000001', '{"display_name":"Alice"}'),
 ('00000000-0000-4000-8000-000000000002', '{"display_name":"Bob"}');
select pg_temp.assert_true((select count(*) = 2 from public.profiles), 'profile trigger');
select pg_temp.assert_true((select count(*) = 8 from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relkind='r' and c.relrowsecurity), 'RLS enabled on all eight tables');

set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', false);
insert into public.wardrobe_items(id, name, category) values
 ('10000000-0000-4000-8000-000000000002', 'Bob shirt', 'top');
insert into public.outfit_plans(id, occasion) values
 ('20000000-0000-4000-8000-000000000002', 'Dinner');
insert into public.outfit_recommendations(id, outfit_plan_id, kind, title) values
 ('30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000002', 'safe_choice', 'Bob look');
insert into public.outfit_recommendation_items(id, outfit_recommendation_id, wardrobe_item_id, role) values
 ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000002', 'top');
insert into public.saved_looks(id, outfit_recommendation_id) values
 ('50000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002');
insert into public.outfit_feedback(id, outfit_recommendation_id) values
 ('60000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000002');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
insert into public.wardrobe_items(id, name, category, season, material, style_tags, warmth_level) values
 ('10000000-0000-4000-8000-000000000001', 'Alice shirt', 'top', '{spring,summer}', '{cotton,linen}', '{minimal}', 2);
insert into public.outfit_plans(id, occasion, anchor_item_id) values
 ('20000000-0000-4000-8000-000000000001', 'Lunch', '10000000-0000-4000-8000-000000000001');
insert into public.outfit_recommendations(id, outfit_plan_id, kind, title) values
 ('30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'safe_choice', 'Alice look');
insert into public.outfit_recommendation_items(id, outfit_recommendation_id, wardrobe_item_id, role) values
 ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'top');
insert into public.saved_looks(id, outfit_recommendation_id) values
 ('50000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001');
insert into public.outfit_feedback(id, outfit_recommendation_id, worn, worn_on, rating, reaction, feedback_text) values
 ('60000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', true, current_date, 5, 'love', 'Comfortable');

-- Test every ownership policy rather than just a representative table.
do $$
declare t text; affected integer;
begin
  foreach t in array array['wardrobe_items','outfit_plans','outfit_recommendations',
    'outfit_recommendation_items','saved_looks','outfit_feedback'] loop
    execute format('select count(*) from public.%I', t) into affected;
    perform pg_temp.assert_true(affected=1, t || ': only own row visible');
    execute format('update public.%I set updated_at = now()', t);
    get diagnostics affected = row_count;
    perform pg_temp.assert_true(affected=1, t || ': own update works');
    execute format('update public.%I set updated_at = now() where user_id = %L', t, '00000000-0000-4000-8000-000000000002');
    get diagnostics affected = row_count;
    perform pg_temp.assert_true(affected=0, t || ': other user update blocked');
    execute format('delete from public.%I where user_id = %L', t, '00000000-0000-4000-8000-000000000002');
    get diagnostics affected = row_count;
    perform pg_temp.assert_true(affected=0, t || ': other user delete blocked');
    perform pg_temp.expect_error(format('update public.%I set user_id = %L', t, '00000000-0000-4000-8000-000000000002'), '42501');
    perform pg_temp.expect_error(format('update public.%I set created_at = %L', t, '2000-01-01'), '42501');
    perform pg_temp.expect_error(format('update public.%I set id = gen_random_uuid()', t), '42501');
    -- Clone the own row while forging the other owner; all required fields remain valid.
    perform pg_temp.expect_error(format('insert into public.%1$I select (jsonb_populate_record(null::public.%1$I, to_jsonb(x) || jsonb_build_object(''id'', gen_random_uuid(), ''user_id'', ''00000000-0000-4000-8000-000000000002''))).* from public.%1$I x', t), '42501');
  end loop;
end $$;

-- Same-owner composite FKs reject links to Bob's existing rows.
select pg_temp.expect_error($q$update public.outfit_plans set anchor_item_id='10000000-0000-4000-8000-000000000002'$q$, '23503');
select pg_temp.expect_error($q$update public.outfit_recommendations set outfit_plan_id='20000000-0000-4000-8000-000000000002'$q$, '23503');
select pg_temp.expect_error($q$update public.outfit_recommendation_items set wardrobe_item_id='10000000-0000-4000-8000-000000000002'$q$, '23503');
select pg_temp.expect_error($q$update public.outfit_recommendation_items set outfit_recommendation_id='30000000-0000-4000-8000-000000000002'$q$, '23503');
select pg_temp.expect_error($q$update public.saved_looks set outfit_recommendation_id='30000000-0000-4000-8000-000000000002'$q$, '23503');
select pg_temp.expect_error($q$update public.outfit_feedback set outfit_recommendation_id='30000000-0000-4000-8000-000000000002'$q$, '23503');
select pg_temp.expect_error($q$insert into public.saved_looks(outfit_recommendation_id) values ('30000000-0000-4000-8000-000000000001')$q$, '23505');
select pg_temp.expect_error($q$insert into public.outfit_feedback(outfit_recommendation_id) values ('30000000-0000-4000-8000-000000000001')$q$, '23505');
select pg_temp.expect_error($q$insert into public.outfit_recommendation_items(outfit_recommendation_id, wardrobe_item_id, role) values ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'top')$q$, '23505');
select pg_temp.expect_error($q$update public.wardrobe_items set warmth_level=6$q$, '23514');
select pg_temp.expect_error($q$update public.wardrobe_items set name=' '$q$, '23514');
select pg_temp.expect_error($q$update public.wardrobe_items set image_url='file:///private/image.jpg'$q$, '23514');
select pg_temp.expect_error($q$update public.wardrobe_items set category='invalid'$q$, '22P02');
select pg_temp.expect_error($q$update public.outfit_feedback set rating=0$q$, '23514');
select pg_temp.expect_error($q$update public.outfit_feedback set worn=false$q$, '23514');
select pg_temp.expect_error($q$update public.outfit_plans set precipitation_probability=101$q$, '23514');
select pg_temp.expect_error($q$update public.outfit_recommendations set generation_metadata='[]'$q$, '23514');
select pg_temp.expect_error($q$delete from public.wardrobe_items$q$, '23503');
update public.wardrobe_items set archived_at=now(), updated_at='2000-01-01';
select pg_temp.assert_true((select updated_at > created_at and updated_at > '2000-01-01' from public.wardrobe_items), 'server controls update timestamp');
select pg_temp.assert_true((select count(*)=1 from public.saved_looks), 'archiving retains saved look');

-- Multiple items can occupy the same role (layering).
insert into public.wardrobe_items(id, name, category) values
 ('10000000-0000-4000-8000-000000000003', 'Second top', 'top');
insert into public.outfit_recommendation_items(outfit_recommendation_id, wardrobe_item_id, role, position) values
 ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000003', 'top', 1);
select pg_temp.assert_true((select count(*)=2 from public.outfit_recommendation_items), 'layering supported');

reset role;
set role anon;
do $$ declare t text; begin
  foreach t in array array['profiles','wardrobe_items','outfit_plans','outfit_recommendations',
    'outfit_recommendation_items','saved_looks','outfit_feedback'] loop
    perform pg_temp.expect_error(format('select * from public.%I', t), '42501');
    perform pg_temp.expect_error(format('delete from public.%I', t), '42501');
  end loop;
end $$;
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.assert_true((select count(*)=0 from public.wardrobe_items), 'missing JWT exposes no rows');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);
-- Removing a bookmark/feedback does not remove the recommendation.
delete from public.saved_looks;
delete from public.outfit_feedback;
select pg_temp.assert_true((select count(*)=1 from public.outfit_recommendations), 'unsaving preserves recommendation');
insert into public.saved_looks(outfit_recommendation_id) values ('30000000-0000-4000-8000-000000000001');
insert into public.outfit_feedback(outfit_recommendation_id) values ('30000000-0000-4000-8000-000000000001');
delete from public.outfit_plans;
select pg_temp.assert_true((select count(*)=0 from public.outfit_recommendations), 'plan cascades recommendations');
select pg_temp.assert_true((select count(*)=0 from public.outfit_recommendation_items), 'plan cascades item links');
select pg_temp.assert_true((select count(*)=0 from public.saved_looks), 'plan cascades saves');
select pg_temp.assert_true((select count(*)=0 from public.outfit_feedback), 'plan cascades feedback');
delete from public.wardrobe_items;
reset role;
-- Account deletion must succeed even with NO ACTION wardrobe references in Bob's graph.
delete from auth.users where id='00000000-0000-4000-8000-000000000002';
do $$ declare t text; remaining integer; begin
  foreach t in array array['wardrobe_items','outfit_plans','outfit_recommendations',
    'outfit_recommendation_items','saved_looks','outfit_feedback'] loop
    execute format('select count(*) from public.%I', t) into remaining;
    perform pg_temp.assert_true(remaining=0, t || ': account cascade');
  end loop;
end $$;
select 'PASS: ownership, CRUD, foreign keys, validation, timestamps, layering, and cascades' as result;
