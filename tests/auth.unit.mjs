import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { createHash, randomFillSync } from 'node:crypto';
import ts from 'typescript';

function loadTypeScript(file, imports = {}, globals = {}) {
  const source = readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  const context = { exports, ...globals, require: (name) => { assert.ok(name in imports, `Unexpected dependency: ${name}`); return imports[name]; } };
  runInNewContext(outputText, context, { filename: file });
  return { exports, context };
}

test('auth validation and errors never expose provider internals', () => {
  const { exports: validation } = loadTypeScript('src/utils/authValidation.ts');
  assert.equal(validation.validateEmail(' sarrah@example.com '), null);
  assert.ok(validation.validateEmail('invalid-email'));
  assert.ok(validation.validatePassword('short'));
  assert.equal(validation.validatePassword('Long-enough-password'), null);
  assert.match(validation.authErrorMessage({ code: 'invalid_credentials' }), /incorrect/);
  assert.match(validation.authErrorMessage({ code: 'otp_expired' }), /expired/);
  assert.ok(!validation.authErrorMessage(new Error('private server detail')).includes('private server detail'));
});

test('native PKCE supplies secure randomness and SHA-256 without replacing existing crypto', async () => {
  const expoCrypto = {
    getRandomValues: (array) => randomFillSync(array),
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    digest: async (algorithm, input) => {
      assert.equal(algorithm, 'SHA-256');
      const bytes = createHash('sha256').update(input).digest();
      return Uint8Array.from(bytes).buffer;
    },
  };
  const { context } = loadTypeScript('src/services/auth/pkceCrypto.native.ts', { 'expo-crypto': expoCrypto });
  const random = new Uint32Array(56);
  assert.equal(context.crypto.getRandomValues(random), random);
  assert.ok(random.some((value) => value !== 0));
  const hash = await context.crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc'));
  assert.equal(Buffer.from(hash).toString('hex'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.throws(() => context.crypto.subtle.digest('MD5', new Uint8Array()), /Only SHA-256/);
  const existing = { getRandomValues: () => {}, subtle: { digest: () => {} } };
  const preserved = loadTypeScript('src/services/auth/pkceCrypto.native.ts', { 'expo-crypto': expoCrypto }, { crypto: existing });
  assert.equal(preserved.context.crypto, existing);
  assert.equal(preserved.context.crypto.subtle, existing.subtle);
});

test('callback deduplicates code exchange and rejects a cached link after logout', async () => {
  let calls = 0;
  let session = { user: { id: 'test-user' } };
  const client = { auth: {
    exchangeCodeForSession: async () => { calls++; return { data: { session }, error: null }; },
    getSession: async () => ({ data: { session }, error: null }),
  } };
  const { exports: callback } = loadTypeScript('src/services/auth/callback.ts', { '@/services/supabase/client': { requireSupabase: () => client } });
  await Promise.all([callback.completeAuthCallback('one-use-code'), callback.completeAuthCallback('one-use-code')]);
  assert.equal(calls, 1);
  session = null;
  await assert.rejects(callback.completeAuthCallback('one-use-code'), /already been used/);
});
