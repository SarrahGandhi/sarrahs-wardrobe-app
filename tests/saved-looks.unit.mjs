import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
function service(failTable) {
  const calls = [];
  const exports = {};
  const client = { from: table => ({ upsert: async (rows, options) => {
    calls.push({ table, rows, options });
    return { error: table === failTable ? new Error('offline') : null };
  } }) };
  runInNewContext(ts.transpileModule(readFileSync('src/services/supabase/savedLooks.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: () => ({ requireSupabase: () => client }) });
  return { ...exports, calls };
}
const entry = { id: 'stable-id', planId: 'plan', draft: { occasion: 'Dinner' }, requiredIds: ['shirt'],
  wardrobe: [{ id: 'shirt', category: 'top' }, { id: 'bag', category: 'bag' }],
  look: { title: 'Safe Choice', items: [{ wardrobe_item_id: 'shirt', role: 'A relaxed layer' }], accessories: [{ wardrobe_item_id: 'bag', role: 'Finishing touch' }], why_this_works: 'Balanced.', hairstyle: 'Loose', makeup: 'Natural' } };
test('save uses stable IDs, real wardrobe categories, and bookmarks only after pieces persist', async () => {
  const api = service();
  await api.saveLook('owner', entry);
  assert.deepEqual(api.calls.map(call => call.table), ['outfit_recommendations', 'outfit_recommendation_items', 'saved_looks']);
  assert.equal(api.calls[0].rows.id, entry.id);
  assert.equal(api.calls[0].rows.user_id, 'owner');
  assert.equal(api.calls[0].rows.generation_metadata.look.hairstyle, 'Loose');
  assert.equal(api.calls[1].rows[0].role, 'top');
  assert.equal(api.calls[1].rows[1].role, 'bag');
  assert.equal(api.calls[2].options.ignoreDuplicates, true);
});
test('partial persistence errors never create a successful bookmark', async () => {
  const api = service('outfit_recommendation_items');
  await assert.rejects(api.saveLook('owner', entry), /offline/);
  assert.equal(api.calls.some(call => call.table === 'saved_looks'), false);
});
test('missing pieces cannot silently create an incomplete saved look', async () => {
  const api = service();
  await assert.rejects(api.saveLook('owner', { ...entry, wardrobe: [] }), /unavailable/);
  assert.equal(api.calls.some(call => call.table === 'saved_looks'), false);
});
