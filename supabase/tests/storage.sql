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

-- Metadata policy tests; actual binary upload limits are enforced by Storage API.
insert into auth.users(id, raw_user_meta_data) values
 ('00000000-0000-4000-8000-000000000004', '{}'),
 ('00000000-0000-4000-8000-000000000005', '{}');
select pg_temp.assert_true((select not public and file_size_limit = 5242880 and allowed_mime_types = array['image/jpeg'] from storage.buckets where id='wardrobe-images'), 'private JPEG bucket with 5MB limit');
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', false);
insert into storage.objects(bucket_id, name) values ('wardrobe-images', '00000000-0000-4000-8000-000000000004/10000000-0000-4000-8000-000000000004.jpg');
select pg_temp.assert_true((select count(*) = 1 from storage.objects), 'owner reads image');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values ('wardrobe-images','00000000-0000-4000-8000-000000000005/10000000-0000-4000-8000-000000000004.jpg')$q$, '42501');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values ('wardrobe-images','00000000-0000-4000-8000-000000000004/../escape.jpg')$q$, '42501');
select pg_temp.expect_error($q$insert into public.wardrobe_items(name,category,image_path) values ('Top','top','00000000-0000-4000-8000-000000000005/10000000-0000-4000-8000-000000000004.jpg')$q$, '23514');
insert into public.wardrobe_items(name,category,image_path) values ('Top','top','00000000-0000-4000-8000-000000000004/10000000-0000-4000-8000-000000000004.jpg');
select pg_temp.expect_error($q$update public.wardrobe_items set image_url='https://example.com/photo.jpg' where image_path is not null$q$, '23514');
delete from storage.objects;
select pg_temp.assert_true((select count(*) = 1 from storage.objects), 'referenced photo cannot be deleted');
update storage.objects set name='replacement.jpg';
select pg_temp.assert_true((select name like '%.jpg' and name <> 'replacement.jpg' from storage.objects), 'uploads cannot be overwritten');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000005', false);
select pg_temp.assert_true((select count(*) = 0 from storage.objects), 'other user cannot read photos');
delete from storage.objects;
reset role;
-- Even a pre-existing permissive SELECT cannot expose this private bucket.
create policy unrelated_broad_read on storage.objects for select to public using (true);
set role authenticated;
select pg_temp.assert_true((select count(*) = 0 from storage.objects), 'restrictive guard prevents broad policy leaks');
reset role;
set role anon;
select set_config('request.jwt.claim.sub', '', false);
select pg_temp.assert_true((select count(*) = 0 from storage.objects), 'anonymous cannot read photos');
select pg_temp.expect_error($q$insert into storage.objects(bucket_id,name) values ('wardrobe-images','00000000-0000-4000-8000-000000000004/10000000-0000-4000-8000-000000000009.jpg')$q$, '42501');
reset role;
drop policy unrelated_broad_read on storage.objects;
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', false);
delete from public.wardrobe_items where image_path is not null;
delete from storage.objects;
select pg_temp.assert_true((select count(*) = 0 from storage.objects), 'owner can clean up unreferenced photo');
reset role;
delete from auth.users where id in ('00000000-0000-4000-8000-000000000004', '00000000-0000-4000-8000-000000000005');
select 'PASS: private storage, owner paths, anonymous/cross-user isolation, cleanup, and image source checks' as result;
