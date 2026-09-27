import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import NativeAbortController from 'abort-controller/dist/abort-controller.js';
function load(file, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, Request, Response, TextDecoder, AbortSignal, setTimeout, clearTimeout, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
const contract = load('supabase/functions/_shared/outfitRecommendations.ts');
const { createOutfitHandler } = load('supabase/functions/recommend-outfits/handler.ts', { '../_shared/outfitRecommendations.ts': contract });
const provider = load('supabase/functions/recommend-outfits/openai.ts', { '../_shared/outfitRecommendations.ts': contract });
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const wardrobe = [{ id: id(1), name: 'Blue jeans', category: 'bottom' }, { id: id(2), name: 'Cotton shirt', category: 'top' }, { id: id(3), name: 'Black heels', category: 'shoes' }, { id: id(4), name: 'Gold hoops', category: 'jewellery' }];
const input = { occasion: 'Dinner', custom_occasion_description: '', weather: { temperature_c: 22, condition: 'Clear' }, setting: 'indoor', styling_request: 'No heels. I want to wear jeans', preference_chips: ['Minimal'], required_wardrobe_item_ids: [id(2)], available_wardrobe_items: wardrobe };
const part = n => ({ wardrobe_item_id: id(n), role: 'Base' });
const result = () => ({ status: 'ok', reason: '', recommendations: [...contract.recommendationTitles].map(title => ({ title, items: [part(1), part(2)], accessories: [part(4)], hairstyle: 'Loose hair', makeup: 'Optional natural makeup', why_this_works: 'Relaxed proportions.' })) });
const request = (body = input, token = 'valid') => new Request('https://edge.test', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
function fixture(overrides = {}) {
  const calls = [];
  const deps = { configured: () => true, authenticate: async token => token === 'valid' ? { wardrobe: async () => wardrobe, consumeQuota: async () => true } : null,
    generate: async body => { calls.push(body); return result(); }, audit: async () => true, ...overrides };
  return { calls, handle: createOutfitHandler(deps) };
}
test('request contract rejects malformed weather, missing requirements, duplicates and oversized inputs', () => {
  contract.validateOutfitRequest(input);
  for (const invalid of [{ ...input, weather: null }, { ...input, weather: { ...input.weather, temperature_c: 100 } }, { ...input, required_wardrobe_item_ids: [id(99)] }, { ...input, available_wardrobe_items: [wardrobe[0], wardrobe[0]] }, { ...input, styling_request: 'x'.repeat(4001) }, { ...input, setting: 'somewhere' }]) assert.throws(() => contract.validateOutfitRequest(invalid));
});
test('all three outfits must have known IDs, anchors, jeans, roles and correct accessory categories', () => {
  contract.validateOutfitResult(result(), input);
  const mutations = [r => r.recommendations.pop(), r => r.recommendations[1].items.push(part(99)), r => r.recommendations[2].items.splice(1, 1), r => r.recommendations[0].items.push(part(3)), r => r.recommendations[1].items.shift(), r => r.recommendations[0].accessories.push(part(3)), r => r.recommendations[0].items.push(part(1)), r => r.recommendations[1].items[0].role = '', r => r.recommendations[0].title = 'Invented'];
  for (const mutate of mutations) { const value = result(); mutate(value); assert.throws(() => contract.validateOutfitResult(value, input)); }
  assert.throws(() => contract.validateOutfitResult({ status: 'impossible', reason: '', recommendations: [] }, input));
});
test('authentication, foreign IDs and body limits fail before AI', async () => {
  const f = fixture();
  assert.equal((await f.handle(request(input, 'wrong'))).status, 401);
  assert.equal((await f.handle(new Request('https://edge.test'))).status, 405);
  assert.equal((await f.handle(request({ ...input, available_wardrobe_items: [...wardrobe, { id: id(99), name: 'Foreign', category: 'top' }] }))).status, 409);
  assert.equal((await f.handle(request({ x: 'x'.repeat(750001) }))).status, 413);
  assert.equal(f.calls.length, 0);
});
test('server replaces spoofed attributes and strips unrelated data before generation', async () => {
  const f = fixture();
  const response = await f.handle(request({ ...input, user_id: 'victim', available_wardrobe_items: wardrobe.map(item => ({ ...item, name: 'Spoofed', image_url: 'secret' })) }));
  assert.equal(response.status, 200);
  assert.equal(f.calls[0].available_wardrobe_items[0].name, 'Blue jeans');
  assert.equal(f.calls[0].user_id, undefined);
  assert.equal(f.calls[0].available_wardrobe_items[0].image_url, undefined);
  assert.deepEqual(await response.json(), result());
});
test('semantic audit rejection and provider invalid outputs are never returned as outfits', async () => {
  assert.equal((await fixture({ audit: async () => false }).handle(request())).status, 422);
  const bad = result(); bad.recommendations[0].items.push(part(99));
  assert.equal((await fixture({ generate: async () => bad }).handle(request())).status, 502);
  const response = await fixture({ generate: async () => { throw new Error('secret provider key'); } }).handle(request());
  assert.equal(response.status, 502); assert.doesNotMatch(await response.text(), /secret/);
});
test('wardrobe deletion during generation invalidates response; quota prevents AI', async () => {
  let reads = 0;
  const access = { wardrobe: async () => ++reads === 1 ? wardrobe : wardrobe.slice(1), consumeQuota: async () => true };
  assert.equal((await fixture({ authenticate: async () => access }).handle(request())).status, 409);
  const f = fixture({ authenticate: async () => ({ ...access, wardrobe: async () => wardrobe, consumeQuota: async () => false }) });
  assert.equal((await f.handle(request())).status, 429); assert.equal(f.calls.length, 0);
});
test('empty wardrobe and impossible requirements return explanations without partial outfits', async () => {
  const empty = { ...input, required_wardrobe_item_ids: [], available_wardrobe_items: [] };
  const f = fixture(); const response = await f.handle(request(empty));
  assert.equal((await response.json()).status, 'impossible'); assert.equal(f.calls.length, 0);
  const impossible = { status: 'impossible', reason: 'The required heels conflict with no heels.', recommendations: [] };
  assert.deepEqual(await (await fixture({ generate: async () => impossible }).handle(request())).json(), impossible);
});
test('provider uses strict JSON, private server key and handles incomplete/refused/malformed output', async () => {
  let sent;
  const fetcher = async (url, options) => { sent = { url, ...options }; return Response.json({ status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: JSON.stringify(result()) }] }] }); };
  await provider.providerJSON(input, provider.instructions, contract.outfitSchema, 'server-secret', 'test-model', fetcher);
  const body = JSON.parse(sent.body);
  assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.equal(sent.headers.Authorization, 'Bearer server-secret');
  for (const value of [{ status: 'incomplete', output: [] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'refusal' }] }] }, { status: 'completed', output: [{ type: 'message', content: [{ type: 'output_text', text: 'bad json' }] }] }]) {
    await assert.rejects(provider.providerJSON(input, '', {}, 'key', 'model', async () => Response.json(value)));
  }
});
test('mobile supports React Native abort signals while sending paginated wardrobe and all planning inputs', async () => {
  let invocation; const offsets = [];
  const mobile = load('src/services/supabase/outfitRecommendations.ts', {
    './client': { requireSupabase: () => ({ functions: { invoke: async (name, options) => { invocation = { name, options }; return { data: result(), error: null }; } } }) },
    './wardrobe': { wardrobePageSize: 2, listWardrobe: async (user, filters, offset) => { offsets.push(offset); return wardrobe.slice(offset, offset + 2); } },
    '@/utils/outfitPlan': { planInputs: () => ({ p_temperature_c: 22 }) },
    '../../../supabase/functions/_shared/outfitRecommendations': contract,
  });
  const controller = new NativeAbortController();
  const signal = controller.signal;
  assert.equal(signal.throwIfAborted, undefined);
  const draft = { occasion: 'Dinner', description: 'With friends', temperature: '22', condition: 'Clear', setting: 'indoor', instructions: input.styling_request, preferences: ['Minimal'] };
  const response = await mobile.recommendOutfits('user', draft, [id(2)], signal);
  assert.deepEqual(offsets, [0, 2, 4]);
  assert.equal(invocation.name, 'recommend-outfits'); assert.equal(invocation.options.signal, signal);
  assert.equal(invocation.options.body.custom_occasion_description, 'With friends');
  assert.equal(invocation.options.body.available_wardrobe_items.length, 4);
  assert.equal(invocation.options.body.available_wardrobe_items[0].name, 'Blue jeans');
  assert.equal(invocation.options.body.styling_request, input.styling_request);
  assert.equal(response.result.recommendations.length, 3);
  controller.abort();
  await assert.rejects(mobile.recommendOutfits('user', draft, [id(2)], signal), { name: 'AbortError' });
  assert.deepEqual(offsets, [0, 2, 4]);
});
test('unconfigured provider and invalid JSON fail safely', async () => {
  const f = fixture({ configured: () => false });
  assert.equal((await f.handle(request())).status, 503); assert.equal(f.calls.length, 0);
  const broken = new Request('https://edge.test', { method: 'POST', headers: { authorization: 'Bearer valid', 'content-type': 'application/json' }, body: '{' });
  assert.equal((await fixture().handle(broken)).status, 400);
});
test('mobile distinguishes a missing deployment and server failures from a connection failure', async () => {
  for (const [status, expected] of [[404, /not deployed/], [502, /couldn’t generate valid recommendations/], [503, /not configured/], [undefined, /Check your connection/]]) {
    const mobile = load('src/services/supabase/outfitRecommendations.ts', {
      './client': { requireSupabase: () => ({ functions: { invoke: async () => ({ data: null, error: { context: { status } } }) } }) },
      './wardrobe': { wardrobePageSize: 40, listWardrobe: async () => wardrobe },
      '@/utils/outfitPlan': { planInputs: () => ({ p_temperature_c: null }) },
      '../../../supabase/functions/_shared/outfitRecommendations': contract,
    });
    const draft = { occasion: 'Dinner', description: '', temperature: '', condition: '', setting: null, instructions: '', preferences: [] };
    await assert.rejects(mobile.recommendOutfits('user', draft, [], new NativeAbortController().signal), expected);
  }
});
const groq = load('supabase/functions/recommend-outfits/groq.ts', { './openai.ts': provider });
const gemini = load('supabase/functions/recommend-outfits/gemini.ts', { './openai.ts': provider });
const routing = load('supabase/functions/recommend-outfits/provider.ts', { './openai.ts': provider, './groq.ts': groq, './gemini.ts': gemini });
test('Groq sends strict JSON schema and server key, rejecting incomplete output', async () => {
  let sent;
  const fetcher = async (url, options) => { sent = { url, ...options }; return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result()) } }] }); };
  const response = await groq.groqJSON(input, provider.instructions, contract.outfitSchema, 'groq-server-key', groq.groqDefaultModel, fetcher);
  assert.equal(response.recommendations.length, 3);
  assert.equal(sent.url, 'https://api.groq.com/openai/v1/chat/completions');
  const body = JSON.parse(sent.body);
  assert.equal(body.response_format.json_schema.strict, true);
  assert.equal(body.model, 'openai/gpt-oss-120b');
  assert.equal(sent.headers.Authorization, 'Bearer groq-server-key');
  for (const choice of [{ finish_reason: 'length', message: { content: '{}' } }, { finish_reason: 'stop', message: { refusal: 'no', content: '{}' } }, { finish_reason: 'stop', message: { content: 'not json' } }]) {
    await assert.rejects(groq.groqJSON(input, '', {}, 'key', groq.groqDefaultModel, async () => Response.json({ choices: [choice] })));
  }
});
test('Groq failures propagate safe actionable codes without raw provider details', async () => {
  for (const [status, code] of [[429, 'ai_rate_limited'], [401, 'ai_key_invalid'], [500, 'ai_provider_failed'], [400, 'ai_request_rejected'], [413, 'ai_request_too_large']]) {
    const generate = () => groq.groqJSON(input, '', {}, 'key', groq.groqDefaultModel, async () => Response.json({ error: { message: 'secret provider details' } }, { status }));
    const response = await fixture({ generate }).handle(request());
    const body = await response.json();
    assert.equal(body.error, code); assert.doesNotMatch(JSON.stringify(body), /secret provider details/);
  }
});
test('default provider is Gemini with no automatic fallback', () => {
  assert.equal(routing.configuredOutfitProvider(name => ({ OPENAI_API_KEY: 'paid-key' })[name]), null);
  assert.ok(routing.configuredOutfitProvider(name => ({ GEMINI_API_KEY: 'gemini-key', OUTFIT_RECOMMENDATION_MODEL: 'old-openai-model' })[name]));
  assert.equal(routing.configuredOutfitProvider(name => ({ OUTFIT_AI_PROVIDER: 'unknown', GROQ_API_KEY: 'key' })[name]), null);
});
test('mobile shows the provider rate-limit message instead of the account hourly limit', async () => {
  const mobile = load('src/services/supabase/outfitRecommendations.ts', {
    './client': { requireSupabase: () => ({ functions: { invoke: async () => ({ data: null, error: { context: Response.json({ error: 'ai_rate_limited', message: 'untrusted' }, { status: 429 }) } }) } }) },
    './wardrobe': { wardrobePageSize: 40, listWardrobe: async () => wardrobe },
    '@/utils/outfitPlan': { planInputs: () => ({ p_temperature_c: null }) },
    '../../../supabase/functions/_shared/outfitRecommendations': contract,
  });
  await assert.rejects(mobile.recommendOutfits('user', { occasion: 'Dinner', description: '', condition: '', instructions: '', preferences: [], setting: null }, [], new NativeAbortController().signal), /free-tier limit/);
});
test('request-specific schemas restrict IDs to owned pieces and their correct category', () => {
  const schema = contract.outfitSchemaFor(input);
  const fields = schema.properties.recommendations.items.properties;
  assert.deepEqual(JSON.parse(JSON.stringify(fields.items.items.properties.wardrobe_item_id.enum)), [id(1), id(2), id(3)]);
  assert.deepEqual(JSON.parse(JSON.stringify(fields.accessories.items.properties.wardrobe_item_id.enum)), [id(4)]);
  const noAccessories = contract.outfitSchemaFor({ ...input, available_wardrobe_items: wardrobe.slice(0, 3) });
  assert.equal(noAccessories.properties.recommendations.items.properties.accessories.maxItems, 0);
  assert.equal(contract.outfitSchema.properties.recommendations.items.properties.items.items.properties.wardrobe_item_id.enum, undefined);
});
test('provider uses compact IDs and restores only owned IDs before validation', async () => {
  let schema, sent;
  const p = provider.outfitProvider('key', 'model', async (request, instructions, supplied) => {
    schema = supplied; sent = request;
    const response = result();
    for (const look of response.recommendations) for (const part of [...look.items, ...look.accessories]) {
      part.wardrobe_item_id = `w${Number(part.wardrobe_item_id.slice(-12))}`;
    }
    return response;
  });
  const generated = await p.generate(input);
  assert.ok(schema.properties.recommendations.items.properties.items.items.properties.wardrobe_item_id.enum.includes('w1'));
  assert.equal(sent.required_wardrobe_item_ids[0], 'w2');
  contract.validateOutfitResult(generated, input);
  const untrusted = provider.outfitProvider('key', 'model', async () => result());
  const awaitedInvalid = await untrusted.generate(input);
  assert.throws(() => contract.validateOutfitResult(awaitedInvalid, input));
});
test('audit retains all constraints but only sends selected wardrobe attributes', async () => {
  let sent;
  const p = provider.outfitProvider('key', 'model', async request => { sent = request; return { valid: true }; });
  assert.equal(await p.audit(input, result()), true);
  assert.equal(sent.request.available_wardrobe_items.length, 3);
  assert.equal(sent.request.styling_request, input.styling_request);
  assert.deepEqual(sent.request.required_wardrobe_item_ids, input.required_wardrobe_item_ids);
  assert.ok(!sent.request.available_wardrobe_items.some(item => item.id === id(3)));
});
test('no-heels permits seeded flat footwear with no heel tags but still rejects heels', () => {
  const flats = { id: id(5), name: 'White flat sneakers', category: 'shoes', subcategory: 'flat sneakers', style_tags: ['comfortable', 'flat', 'no heel'] };
  const request = { ...input, available_wardrobe_items: [...wardrobe, flats] };
  const response = result();
  response.recommendations.forEach(look => look.items.push(part(5)));
  contract.validateOutfitResult(response, request);
  assert.throws(() => contract.validateOutfitResult(response, { ...request,
    available_wardrobe_items: [...wardrobe, { ...flats, name: 'High heels', subcategory: 'heels' }] }));
});
test('Groq retries its own schema failure once within the same deadline', async () => {
  const signals = [];
  const response = await groq.groqJSON(input, '', {}, 'key', groq.groqDefaultModel, async (_url, options) => {
    signals.push(options.signal);
    if (signals.length === 1) return Response.json({ error: { code: 'json_validate_failed', failed_generation: 'private output' } }, { status: 400 });
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result()) } }] });
  });
  assert.equal(response.recommendations.length, 3);
  assert.equal(signals.length, 2);
  assert.equal(signals[0], signals[1]);
});
test('Groq stops after two schema failures and never retries configuration errors', async () => {
  for (const [providerCode, expected, count] of [['json_validate_failed', 'ai_invalid_response', 2], ['invalid_model', 'ai_request_rejected', 1]]) {
    let calls = 0;
    await assert.rejects(groq.groqJSON(input, '', {}, 'key', groq.groqDefaultModel, async () => {
      calls++;
      return Response.json({ error: { code: providerCode, message: 'private details' } }, { status: 400 });
    }), error => error.code === expected && !error.message.includes('private'));
    assert.equal(calls, count);
  }
});
test('Groq waits for a short rate limit and retries with the same deadline', async () => {
  let calls = 0; let firstSignal; const waits = [];
  const response = await groq.groqJSON(input, '', {}, 'key', groq.groqDefaultModel, async (_url, options) => {
    calls++;
    if (calls === 1) { firstSignal = options.signal; return Response.json({}, { status: 429, headers: { 'retry-after': '2' } }); }
    assert.equal(options.signal, firstSignal);
    return Response.json({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(result()) } }] });
  }, async (ms, signal) => { waits.push(ms); assert.equal(signal, firstSignal); });
  assert.equal(calls, 2); assert.deepEqual(waits, [2250]); assert.equal(response.recommendations.length, 3);
});
test('Groq never repeatedly retries rate limits or waits for daily limits', async () => {
  for (const value of ['2', '86400', 'invalid', null]) {
    let calls = 0; let waits = 0;
    await assert.rejects(groq.groqJSON(input, '', {}, 'key', groq.groqDefaultModel, async () => {
      calls++; return Response.json({}, { status: 429, headers: value === null ? {} : { 'retry-after': value } });
    }, async () => { waits++; }), error => error.code === 'ai_rate_limited');
    assert.equal(calls, value === '2' ? 2 : 1); assert.equal(waits, value === '2' ? 1 : 0);
  }
});

test('Gemini sends JSON schema and a server-only key to generateContent', async () => {
  let sent;
  const value = await gemini.geminiJSON(input, provider.instructions, contract.outfitSchema, 'server-secret', gemini.geminiDefaultModel, async (url, options) => {
    sent = { url, ...options, body: JSON.parse(options.body) };
    return Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ thought: true, text: 'ignore internal reasoning' }, { text: JSON.stringify(result()) }] } }] });
  });
  assert.equal(value.status, 'ok');
  assert.equal(sent.url, `https://generativelanguage.googleapis.com/v1beta/models/${gemini.geminiDefaultModel}:generateContent`);
  assert.equal(sent.headers['x-goog-api-key'], 'server-secret');
  assert.equal(sent.url.includes('server-secret'), false);
  assert.equal(sent.body.generationConfig.responseMimeType, 'application/json');
  assert.equal(sent.body.generationConfig.thinkingConfig.thinkingLevel, 'low');
  assert.equal(sent.body.generationConfig.maxOutputTokens, 16_384);
  assert.deepEqual(sent.body.generationConfig.responseJsonSchema, JSON.parse(JSON.stringify(contract.outfitSchema)));
  assert.equal(sent.body.systemInstruction.parts[0].text, provider.instructions);
  assert.deepEqual(JSON.parse(sent.body.contents[0].parts[0].text), input);
  assert.ok(sent.signal);
});
test('Gemini rejects blocked, truncated, empty, oversized and malformed output', async () => {
  for (const payload of [
    { promptFeedback: { blockReason: 'SAFETY' } },
    { candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'not json' }] } }] },
    { candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'x'.repeat(30_001) }] } }] },
  ]) await assert.rejects(gemini.geminiJSON(input, '', {}, 'key', gemini.geminiDefaultModel, async () => Response.json(payload)), error => error.code === 'ai_invalid_response');
});
test('Gemini failures expose safe error codes and never fall back to another provider', async () => {
  for (const [status, code] of [[429, 'ai_rate_limited'], [403, 'ai_key_invalid'], [400, 'ai_request_rejected'], [404, 'ai_request_rejected'], [413, 'ai_request_too_large'], [500, 'ai_provider_failed']]) {
    let calls = 0;
    await assert.rejects(gemini.geminiJSON(input, '', {}, 'key', gemini.geminiDefaultModel, async () => {
      calls++;
      return Response.json({ error: { message: 'private provider data' } }, { status });
    }), error => error.code === code && !error.message.includes('private'));
    assert.equal(calls, 1);
  }
  assert.equal(routing.configuredOutfitProvider(name => ({ GROQ_API_KEY: 'other-key' })[name]), null);
  assert.equal(routing.configuredOutfitProvider(name => ({ GEMINI_API_KEY: '  ' })[name]), null);
  assert.ok(routing.configuredOutfitProvider(name => ({ OUTFIT_AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'key', GEMINI_OUTFIT_MODEL: gemini.geminiDefaultModel })[name]));
});

test('Gemini retries capacity failures once with another Flash model and the same schema', async () => {
  const calls = [];
  const output = await gemini.geminiJSON(input, provider.instructions, contract.outfitSchema, 'key', gemini.geminiDefaultModel, async (url, options) => {
    calls.push({ url, options });
    return calls.length === 1 ? Response.json({ error: { message: 'busy' } }, { status: 503 })
      : Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: JSON.stringify(result()) }] } }] });
  });
  assert.equal(output.status, 'ok');
  assert.equal(calls.length, 2);
  assert.match(calls[1].url, /gemini-3\.7-flash/);
  assert.equal(calls[0].options.body, calls[1].options.body);
  assert.equal(calls[0].options.signal, calls[1].options.signal);
});
test('Gemini does not override a deliberately selected model or retry non-capacity errors', async () => {
  for (const [model, status] of [['gemini-3.7-flash', 503], [gemini.geminiDefaultModel, 429]]) {
    let calls = 0;
    await assert.rejects(gemini.geminiJSON(input, '', {}, 'key', model, async () => {
      calls++;
      return Response.json({}, { status });
    }));
    assert.equal(calls, 1);
  }
});

test('hard requirements reject unknown heel heights and explicitly excluded jeans', () => {
  const boots = { id: id(5), name: 'Black boots', category: 'shoes' };
  const response = result(); response.recommendations.forEach(look => look.items.push(part(5)));
  assert.throws(() => contract.validateOutfitResult(response, { ...input, available_wardrobe_items: [...wardrobe, boots] }), /Heel height unknown/);
  contract.validateOutfitResult(response, { ...input, available_wardrobe_items: [...wardrobe, { ...boots, subcategory: 'Flat boots' }] });
  assert.throws(() => contract.validateOutfitResult(result(), { ...input, styling_request: 'No jeans.' }), /Jeans forbidden/);
  assert.throws(() => contract.validateOutfitResult(result(), { ...input, styling_request: 'I don’t want jeans.' }), /Jeans forbidden/);
  const trousers = { ...wardrobe[0], name: 'Linen trousers' };
  assert.throws(() => contract.validateOutfitResult(result(), { ...input, styling_request: 'I want jeans.', available_wardrobe_items: [trousers, ...wardrobe.slice(1)] }), /Jeans required/);
});
test('audit only accepts its exact boolean contract', async () => {
  for (const verdict of [{ valid: true, extra: 'untrusted' }, { valid: 'true' }, null, []]) {
    assert.equal(await provider.outfitProvider('key', 'model', async () => verdict).audit(input, result()), false);
  }
});


test('exhausted Gemini capacity returns a specific temporary-unavailability code', async () => {
  let calls = 0;
  await assert.rejects(gemini.geminiJSON(input, '', {}, 'key', gemini.geminiDefaultModel, async () => {
    calls++; return Response.json({}, { status: 503 });
  }), error => error.code === 'ai_temporarily_unavailable');
  assert.equal(calls, 2);
  const response = await fixture({ generate: async () => { throw Object.assign(new Error('private'), { code: 'ai_temporarily_unavailable' }); } }).handle(request());
  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.match(payload.message, /temporarily busy/);
  assert.doesNotMatch(payload.message, /not configured|private/);
});
