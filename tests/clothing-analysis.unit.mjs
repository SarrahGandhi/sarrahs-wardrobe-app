import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function load(file, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, Request, Response, Blob, Uint8Array, TextDecoder, AbortSignal, btoa,
    require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const contract = load('supabase/functions/_shared/clothingAnalysis.ts');
const handlerModule = load('supabase/functions/analyze-clothing/handler.ts', { '../_shared/clothingAnalysis.ts': contract });
const provider = load('supabase/functions/analyze-clothing/openai.ts', { '../_shared/clothingAnalysis.ts': contract });
const mapper = load('src/utils/clothingSuggestions.ts');
const empty = Object.fromEntries(contract.clothingAnalysisSchema.required.map(key => [key, null]));
const valid = { ...empty, suggested_name: 'Cream linen shirt', category: 'top', primary_colour: 'cream', possible_material: ['linen'], season: ['summer'], warmth_level: 1, sleeve_length: 'long' };
const user = '00000000-0000-4000-8000-000000000001';
const path = `${user}/10000000-0000-4000-8000-000000000001.jpg`;
function fixture(overrides = {}) {
  const calls = [];
  const deps = {
    configured: () => true,
    authenticate: async token => token === 'valid' ? {
      userId: user,
      consumeQuota: async () => { calls.push('quota'); return true; },
      download: async value => { calls.push(value); return new Blob([new Uint8Array([255, 216, 255, 0])], { type: 'image/jpeg' }); },
    } : null,
    analyze: async () => { calls.push('ai'); return valid; }, ...overrides,
  };
  return { calls, handle: handlerModule.createAnalysisHandler(deps) };
}
const request = (body = { image_path: path }, token = 'valid') => new Request('https://edge.test/analyze-clothing', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
test('nullable exact schema accepts unknown attributes and rejects malformed, extra, missing, out-of-range, or inapplicable attributes', () => {
  assert.equal(contract.validateClothingAnalysis(empty), empty);
  assert.equal(contract.validateClothingAnalysis(valid), valid);
  for (const value of [{ ...valid, surprise: true }, { ...valid, category: 'hat' }, { ...valid, warmth_level: 6 }, { ...valid, warmth_level: 2.5 }, { ...valid, season: 'summer' }, { ...valid, secondary_colours: [null] }, { ...valid, possible_material: ['x'.repeat(101)] }, { ...valid, suggested_name: '' }, { ...valid, category: 'bag', neckline: 'round' }]) assert.throws(() => contract.validateClothingAnalysis(value));
  const missing = { ...valid }; delete missing.fit;
  assert.throws(() => contract.validateClothingAnalysis(missing));
});
test('handler rejects missing/invalid credentials, methods, URL payloads and foreign paths before AI', async () => {
  const { handle, calls } = fixture();
  assert.equal((await handle(request(undefined, 'wrong'))).status, 401);
  assert.equal((await handle(new Request('https://edge.test', { method: 'POST' }))).status, 401);
  assert.equal((await handle(new Request('https://edge.test'))).status, 405);
  assert.equal((await handle(request({ image_url: 'https://attacker.test' }))).status, 400);
  assert.equal((await handle(request({ image_path: `other-user/${path}` }))).status, 403);
  assert.equal((await handle(request({ image_path: path, user_id: user }))).status, 400);
  assert.deepEqual(calls, []);
});
test('bounded request bodies, preflight and missing configuration fail safely', async () => {
  const { handle } = fixture();
  assert.equal((await handle(request({ image_path: 'a'.repeat(2000) }))).status, 413);
  assert.equal((await handle(new Request('https://edge.test', { method: 'OPTIONS' }))).status, 204);
  const unconfigured = fixture({ configured: () => false });
  assert.equal((await unconfigured.handle(request())).status, 503);
  assert.deepEqual(unconfigured.calls, []);
});
test('owned image is downloaded and validated; response contains suggestions only', async () => {
  const { handle, calls } = fixture();
  const response = await handle(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { analysis: valid });
  assert.deepEqual(calls, ['quota', path, 'ai']);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});
test('rate limit, missing photos, bad MIME and bad JPEG bytes never call AI', async () => {
  for (const [quota, photo, expected] of [
    [false, null, 429], [true, null, 404],
    [true, new Blob(['abc'], { type: 'text/plain' }), 422],
    [true, new Blob(['abc'], { type: 'image/jpeg' }), 422],
  ]) {
    const f = fixture({ authenticate: async () => ({ userId: user, consumeQuota: async () => quota, download: async () => photo }) });
    assert.equal((await f.handle(request())).status, expected);
    assert.deepEqual(f.calls, []);
  }
});
test('provider failures and invalid outputs are sanitized for manual fallback', async () => {
  for (const analyze of [async () => { throw new Error('secret key private provider payload'); }, async () => ({ ...valid, warmth_level: 100 })]) {
    const { handle } = fixture({ analyze });
    const response = await handle(request());
    assert.equal(response.status, 502);
    const body = await response.text();
    assert.match(body, /manually/);
    assert.doesNotMatch(body, /secret|private provider/);
  }
});
test('provider request uses image bytes, strict JSON schema, server key and no response storage', async () => {
  let sent;
  const fetcher = async (url, options) => {
    sent = { url, ...options };
    return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(valid) }] }] });
  };
  await provider.analyzeWithOpenAI(new Uint8Array([255, 216, 255]), 'server-only-test', undefined, fetcher);
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  const body = JSON.parse(sent.body);
  assert.equal(body.store, false);
  assert.equal(body.text.format.strict, true);
  assert.match(body.input[0].content[1].image_url, /^data:image\/jpeg;base64,/);
  assert.equal(sent.headers.Authorization, 'Bearer server-only-test');
  assert.ok(sent.signal instanceof AbortSignal);
});
test('provider refusals, incomplete responses, invalid JSON and non-200 responses are rejected', async () => {
  for (const response of [
    { status: 'incomplete', output: [] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal', refusal: 'no' }] }] },
    { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'invalid json' }] }] },
  ]) await assert.rejects(provider.analyzeWithOpenAI(new Uint8Array([255,216,255]), 'test', undefined, async () => Response.json(response)));
  await assert.rejects(provider.analyzeWithOpenAI(new Uint8Array([255,216,255]), 'test', undefined, async () => new Response('private detail', { status: 429 })));
});
test('suggestions map into a draft without inventing brand or writing data; null arrays become empty', () => {
  const draft = { id: 'draft', user_id: user, brand: null, category: 'top', image_path: path };
  const result = mapper.applyClothingSuggestions(draft, valid);
  assert.equal(result.name, valid.suggested_name);
  assert.equal(JSON.stringify(result.material), '["linen"]');
  assert.equal(JSON.stringify(result.secondary_colours), '[]');
  assert.equal(result.brand, null);
  assert.equal(result.id, draft.id);
  assert.equal(result.image_path, path);
  assert.equal(draft.name, undefined);
});
test('mobile analysis calls only the Edge Function with a path and never saves rows', async () => {
  let invocation;
  const clientModule = load('src/services/supabase/clothingAnalysis.ts', {
    './client': { requireSupabase: () => ({ functions: { invoke: async (name, options) => { invocation = { name, options }; return { data: { analysis: valid }, error: null }; } } }) },
    '../../../supabase/functions/_shared/clothingAnalysis': contract,
  });
  const controller = new AbortController();
  assert.equal(await clientModule.analyzeWardrobeImage(path, controller.signal), valid);
  assert.equal(invocation.name, 'analyze-clothing');
  assert.equal(JSON.stringify(invocation.options.body), JSON.stringify({ image_path: path }));
  assert.equal(invocation.options.signal, controller.signal);
  assert.equal(invocation.options.timeout, 45000);
});
