import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

function load(file, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, URL, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const form = load('src/utils/wardrobeForm.ts');
const draft = Object.fromEntries(form.textFields.map(([key]) => [key, '']));
test('edit validation trims names, clears optional values, parses and deduplicates arrays', () => {
  const result = form.parseWardrobeDraft({ ...draft, name: '  Linen shirt  ', material: 'cotton, linen, cotton, ', warmth_level: '3' });
  assert.equal(result.name, 'Linen shirt');
  assert.equal(result.brand, null);
  assert.equal(result.warmth_level, 3);
  assert.equal(JSON.stringify(result.material), '["cotton","linen"]');
  assert.equal(result.image_url, null);
  assert.ok(!('user_id' in result));
});
test('edit validation rejects blank names, invalid warmth and non-HTTP image/product URLs', () => {
  assert.throws(() => form.parseWardrobeDraft(draft), /name/);
  for (const warmth_level of ['0', '6', 'x']) assert.throws(() => form.parseWardrobeDraft({ ...draft, name: 'Top', warmth_level }), /Warmth/);
  for (const image_url of ['javascript:alert(1)', 'file:///photo', 'https://example.com/a b']) assert.throws(() => form.parseWardrobeDraft({ ...draft, name: 'Top', image_url }), /URL/);
});

function serviceFixture() {
  const requests = [];
  let status = 200;
  let body = [];
  const client = createClient('https://wardrobe.example.test', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    requests.push({ url: new URL(url), ...init });
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  } } });
  const service = load('src/services/supabase/wardrobe.ts', { './client': { requireSupabase: () => client } });
  return { requests, service, respond: (value, code = 200) => { body = value; status = code; } };
}
const user = '00000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000001';
test('real Supabase query builder combines ownership, active/category/favourite filters and pagination', async () => {
  const { service, requests } = serviceFixture();
  await service.listWardrobe(user, { search: 'linen, "white" 50%_', category: 'top', favourites: true }, 40);
  const params = requests[0].url.searchParams;
  assert.equal(params.get('user_id'), `eq.${user}`);
  assert.equal(params.get('archived_at'), 'is.null');
  assert.equal(params.get('category'), 'eq.top');
  assert.equal(params.get('favourite'), 'eq.true');
  assert.equal(params.get('offset'), '40');
  assert.equal(params.get('limit'), '40');
  assert.match(params.get('or'), /name\.ilike/);
  assert.match(params.get('or'), /brand\.ilike/);
  assert.equal(service.searchPattern('50%_'), JSON.stringify('%50\\%\\_%'));
});
test('detail/update/delete are owner-scoped and missing IDs do not trigger requests', async () => {
  const { service, requests, respond } = serviceFixture();
  assert.equal(await service.getWardrobeItem(user, 'not-a-uuid'), null);
  assert.equal(requests.length, 0);
  respond({ id, user_id: user, favourite: true });
  await service.getWardrobeItem(user, id);
  await service.updateWardrobeItem(user, id, { favourite: true });
  await service.deleteWardrobeItem(user, id);
  for (const request of requests) {
    assert.equal(request.url.searchParams.get('user_id'), `eq.${user}`);
    assert.equal(request.url.searchParams.get('id'), `eq.${id}`);
  }
  assert.equal(requests[1].method, 'PATCH');
  assert.equal(requests[1].body, '{"favourite":true}');
  assert.equal(requests[2].method, 'DELETE');
});
test('server failures propagate and linked-item deletion has an actionable message', async () => {
  const { service, respond } = serviceFixture();
  respond({ code: '23503', message: 'private internal details' }, 409);
  await assert.rejects(service.deleteWardrobeItem(user, id), error => error.code === '23503');
  assert.match(service.wardrobeError({ code: '23503' }), /outfit plan/);
  assert.ok(!service.wardrobeError(new Error('private')).includes('private'));
});
test('outfit brief verifies owned active anchor before writing the plan', async () => {
  const { service, respond, requests } = serviceFixture();
  respond(null);
  await assert.rejects(service.saveAnchoredPlan(user, id, 'Dinner', ''), /unavailable/);
  assert.equal(requests.length, 1);
  respond({ id, user_id: user });
  await service.saveAnchoredPlan(user, id, ' Dinner ', ' Minimal ');
  const body = JSON.parse(requests.at(-1).body);
  assert.equal(body.user_id, user);
  assert.equal(body.anchor_item_id, id);
  assert.equal(body.occasion, 'Dinner');
  assert.equal(body.instructions, 'Minimal');
});
