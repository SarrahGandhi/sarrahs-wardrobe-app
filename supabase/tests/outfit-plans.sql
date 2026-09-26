create function pg_temp.assert_true(ok boolean, message text) returns void
language plpgsql as $$ begin
  if ok is distinct from true then raise exception 'FAIL: %', message; end if;
end $$;
create function pg_temp.expect_error(statement text, expected_state text) returns void
language plpgsql as $$ begin
  begin execute statement;
  exception when others then
    if SQLSTATE = expected_state then return; end if;
    raise exception 'Expected %, got %: %', expected_state, SQLSTATE, SQLERRM;
  end;
  raise exception 'Expected error %, statement succeeded', expected_state;
end $$;
insert into auth.users(id, raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000008', '{}'),
 ('00000000-0000-4000-8000-000000000009', '{}');
insert into public.wardrobe_items(id,user_id,name,category) values
 ('10000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008','Shirt','top'),
 ('20000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008','Jeans','bottom'),
 ('10000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000009','Boots','shoes');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000008', false);
select public.save_outfit_plan('30000000-0000-4000-8000-000000000008','Dinner',-5,'Snow','indoor','No heels',array['Warm'],array['10000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000008']::uuid[]);
select public.save_outfit_plan('30000000-0000-4000-8000-000000000008','Dinner',-5,'Snow','indoor','No heels',array['Warm'],array['10000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000008']::uuid[]);
select pg_temp.assert_true((select count(*)=2 from public.outfit_plan_items), 'multi-selection saved once');
select pg_temp.assert_true((select temperature_c=-5 and setting='indoor' and instructions='No heels' and style_preferences=array['Warm'] from public.outfit_plans where id='30000000-0000-4000-8000-000000000008'), 'all inputs saved');
select pg_temp.expect_error($q$select public.save_outfit_plan('40000000-0000-4000-8000-000000000008','Work',null,null,null,null,'{}',array['10000000-0000-4000-8000-000000000009']::uuid[])$q$,'22023');
select pg_temp.assert_true(not exists(select 1 from public.outfit_plans where id='40000000-0000-4000-8000-000000000008'), 'no partial foreign-item plan');
select public.save_outfit_plan('50000000-0000-4000-8000-000000000008','Casual',null,null,null,null,'{}','{}');
select pg_temp.expect_error($q$select public.save_outfit_plan('60000000-0000-4000-8000-000000000008',' ',null,null,null,null,'{}','{}')$q$,'23514');
select pg_temp.expect_error($q$select public.save_outfit_plan('60000000-0000-4000-8000-000000000008','Work',80,null,null,null,'{}','{}')$q$,'23514');
select pg_temp.expect_error($q$insert into public.outfit_plan_items(user_id,plan_id,wardrobe_item_id) values('00000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000008','10000000-0000-4000-8000-000000000009')$q$,'23503');
update public.wardrobe_items set archived_at=now() where id='20000000-0000-4000-8000-000000000008';
select pg_temp.expect_error($q$select public.save_outfit_plan('60000000-0000-4000-8000-000000000008','Work',null,null,null,null,'{}',array['20000000-0000-4000-8000-000000000008']::uuid[])$q$,'22023');
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',false);
select pg_temp.assert_true((select count(*)=0 from public.outfit_plan_items), 'other account cannot read selections');
delete from public.outfit_plan_items;
select set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',false);
select pg_temp.assert_true((select count(*)=2 from public.outfit_plan_items), 'other account cannot delete selections');
delete from public.outfit_plans where id='30000000-0000-4000-8000-000000000008';
select pg_temp.assert_true((select count(*)=0 from public.outfit_plan_items), 'plan delete cascades');
reset role;
set role anon;
select pg_temp.expect_error($q$select public.save_outfit_plan('60000000-0000-4000-8000-000000000008','Work',null,null,null,null,'{}','{}')$q$,'42501');
reset role;
select 'PASS: outfit plan inputs, atomic saves, retries, ownership, optional inputs and cascades';
