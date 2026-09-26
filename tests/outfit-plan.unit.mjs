import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
const exports = {};
runInNewContext(ts.transpileModule(readFileSync('src/utils/outfitPlan.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, { exports });
const draft = { occasion: 'Work', description: '', temperature: '', condition: '', setting: null, instructions: '', preferences: [] };
test('only occasion is required, and Other requires meaningful text', () => {
  assert.equal(exports.planInputs(draft).p_temperature_c, null);
  assert.throws(() => exports.planInputs({ ...draft, occasion: '' }), /occasion/);
  assert.throws(() => exports.planInputs({ ...draft, occasion: 'Other', description: '   ' }), /occasion/);
  assert.equal(exports.planInputs({ ...draft, occasion: 'Other', description: '  Gallery opening  ' }).p_occasion, 'Gallery opening');
  assert.equal(exports.planInputs({ ...draft, description: 'Presentation' }).p_occasion, 'Work: Presentation');
});
test('temperature preserves zero and negatives, handles decimal comma, rejects invalid data', () => {
  for (const [raw, expected] of [['0', 0], ['-5', -5], ['22,5', 22.5]]) {
    assert.equal(exports.planInputs({ ...draft, temperature: raw }).p_temperature_c, expected);
  }
  for (const raw of ['NaN', 'Infinity', '30C', '1e2', '0x20', '71', '-101', '22.345']) {
    assert.throws(() => exports.planInputs({ ...draft, temperature: raw }), /temperature/);
  }
});
test('natural language and style choices are retained without interpretation', () => {
  const result = exports.planInputs({ ...draft, condition: '  Rain  ', instructions: ' No heels. Use my black boots. ', preferences: ['Feminine', 'Warm'], setting: 'both' });
  assert.equal(result.p_instructions, 'No heels. Use my black boots.');
  assert.equal(result.p_weather_summary, 'Rain');
  assert.equal(result.p_setting, 'both');
  assert.deepEqual(result.p_style_preferences, ['Feminine', 'Warm']);
});
