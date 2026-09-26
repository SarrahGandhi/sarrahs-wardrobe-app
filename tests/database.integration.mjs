import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

// Never reads .env or contacts hosted Supabase. Use a disposable database in the
// project's local PostgreSQL container, leaving its real database untouched.
const container = 'supabase_db_sarrahs-wardrobe-app';
const database = `wardrobe_schema_test_${randomUUID().replaceAll('-', '')}`;
function sql(db, input) {
  return execFileSync('docker', ['exec', '-i', container, 'psql', '-X', '-q',
    '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1'],
  { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}
const storageBootstrap = `
  create schema storage;
  create table storage.buckets(id text primary key, name text not null, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid default gen_random_uuid() primary key,
    bucket_id text references storage.buckets(id), name text not null, unique(bucket_id, name));
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1] $$;
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated, anon;
  grant select, insert, update, delete on storage.objects to authenticated, anon;
  grant execute on function storage.foldername(text) to authenticated, anon;
`;
try {
  sql('postgres', `create database ${database};`);
  // Reproduce only Supabase's auth identity boundary. PostgreSQL itself enforces
  // real grants, RLS, triggers, and FKs; existing cluster roles are reused.
  sql(database, `
    create schema auth;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon, service_role;
    grant execute on function auth.uid() to authenticated, anon, service_role;
  `);
  sql(database, readFileSync('supabase/migrations/20260925000100_profiles.sql', 'utf8'));
  sql(database, readFileSync('supabase/migrations/20260926000100_wardrobe_and_outfits.sql', 'utf8'));
  sql(database, storageBootstrap);
  sql(database, readFileSync('supabase/migrations/20260926000200_wardrobe_images.sql', 'utf8'));
  const output = sql(database, readFileSync('supabase/tests/schema.sql', 'utf8'));
  console.log(output.split('\n').filter(line => line.includes('PASS:')).join('\n').trim());
  console.log(sql(database, readFileSync('supabase/tests/storage.sql', 'utf8')).split('\n').filter(line => line.includes('PASS:')).join('\n').trim());
  // Repeat against the copy/paste fresh-project artifact inside this disposable DB.
  sql(database, 'drop schema storage cascade; drop schema public cascade; delete from auth.users; create schema public; grant usage on schema public to authenticated, anon, service_role;');
  sql(database, storageBootstrap);
  sql(database, readFileSync('supabase/sql/full_schema.sql', 'utf8'));
  const freshOutput = sql(database, readFileSync('supabase/tests/schema.sql', 'utf8'));
  sql(database, readFileSync('supabase/tests/storage.sql', 'utf8'));
  console.log('Combined fresh-project SQL: ' + freshOutput.split('\n').filter(line => line.includes('PASS:')).join('\n').trim());
} catch (error) {
  console.error(error.stderr?.toString() || error.message);
  process.exitCode = 1;
} finally {
  sql('postgres', `drop database if exists ${database} with (force);`);
}
