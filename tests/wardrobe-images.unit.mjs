import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';

function load(file, imports = {}) {
  const { outputText } = ts.transpileModule(readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const exports = {};
  runInNewContext(outputText, { exports, atob, Uint8Array, ArrayBuffer, require: name => { assert.ok(name in imports, name); return imports[name]; } });
  return exports;
}
function fixture() {
  const requests = [];
  const responses = [];
  const client = createClient('https://wardrobe.example.test', 'sb_publishable_test', { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: async (url, init) => {
    requests.push({ url: new URL(url), ...init });
    const next = responses.shift();
    assert.ok(next, `Unexpected HTTP request ${url}`);
    return new Response(JSON.stringify(next.body), { status: next.status || 200, headers: { 'Content-Type': 'application/json' } });
  } } });
  return { requests, responses, service: load('src/services/supabase/wardrobeImages.ts', { './client': { requireSupabase: () => client } }) };
}
const user = '00000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000001';
const path = `${user}/${id}.jpg`;
test('photo upload uses private owner path, JPEG bytes, and no overwrite', async () => {
  const { service, requests, responses } = fixture();
  responses.push({ body: { Key: `wardrobe-images/${path}` } });
  assert.equal(await service.uploadWardrobePhoto(user, id, '/9j/'), path);
  assert.ok(requests[0].body instanceof ArrayBuffer);
  assert.equal(Buffer.from(requests[0].body).toString('hex'), 'ffd8ff');
  assert.match(requests[0].url.pathname, new RegExp(`/wardrobe-images/${path}$`));
  assert.equal(new Headers(requests[0].headers).get('content-type'), 'image/jpeg');
  assert.equal(new Headers(requests[0].headers).get('x-upsert'), 'false');
  assert.throws(() => service.imageBytes(''), /photo/);
  assert.throws(() => service.imageBytes('A'.repeat(8 * 1024 * 1024)), /large/);
});
test('private paths reject cross-user access and traversal without network calls', async () => {
  const { service, requests } = fixture();
  assert.equal(service.ownedImagePath(user, `${user}/../photo.jpg`), false);
  await assert.rejects(service.wardrobePhotoUrl('another-user', path));
  await assert.rejects(service.discardWardrobePhoto(user, 'someone/else.jpg'));
  assert.equal(requests.length, 0);
});
test('signed URLs last ten minutes and are not persisted on the item', async () => {
  const { service, requests, responses } = fixture();
  responses.push({ body: { signedURL: `/object/sign/wardrobe-images/${path}?token=short-lived` } });
  assert.match(await service.wardrobePhotoUrl(user, path), /token=short-lived/);
  assert.equal(JSON.parse(requests[0].body).expiresIn, 600);
  responses.push({ body: null }, { body: { id, image_path: path } });
  await service.createWardrobeItem(user, id, path, { name: 'Top', category: 'top', image_url: 'https://old.example/photo.jpg' });
  const payload = JSON.parse(requests.at(-1).body);
  assert.equal(payload.image_path, path);
  assert.equal(payload.image_url, null);
  assert.equal(payload.user_id, user);
  assert.equal(payload.id, id);
});
test('lost upload response is recovered only when the same object exists', async () => {
  const { service, requests, responses } = fixture();
  responses.push({ status: 409, body: { statusCode: '409', message: 'Duplicate' } }, { body: { signedURL: '/object/sign/recovered' } });
  assert.equal(await service.uploadWardrobePhoto(user, id, '/9j/'), path);
  assert.equal(requests.length, 2);
});
test('retrying Save returns the existing draft item rather than inserting twice', async () => {
  const { service, requests, responses } = fixture();
  responses.push({ body: { id, image_path: path } });
  assert.equal((await service.createWardrobeItem(user, id, path, { name: 'Top' })).id, id);
  assert.equal(requests.length, 1);
  assert.equal(requests[0].method, 'GET');
});
test('camera denial preserves canAskAgain and does not launch the camera', async () => {
  let launched = false;
  const photo = load('src/services/wardrobe/photo.ts', {
    'expo-image-picker': { requestCameraPermissionsAsync: async () => ({ granted: false, canAskAgain: false }), launchCameraAsync: async () => { launched = true; } },
    'expo-image-manipulator': {},
  });
  await assert.rejects(photo.takeWardrobePhoto(), error => error.canAskAgain === false && /Settings/.test(error.message));
  assert.equal(launched, false);
});
test('library picker is images-only, permits cancellation, and needs no broad photo permission', async () => {
  let options;
  const photo = load('src/services/wardrobe/photo.ts', {
    'expo-image-picker': { launchImageLibraryAsync: async value => { options = value; return { canceled: true, assets: null }; } },
    'expo-image-manipulator': {},
  });
  assert.equal((await photo.chooseWardrobePhoto()).canceled, true);
  assert.equal(JSON.stringify(options.mediaTypes), '["images"]');
  assert.equal(options.allowsMultipleSelection, false);
});
test('photo preparation resizes portrait images and emits compressed JPEG', async () => {
  let size, format;
  let releases = 0;
  const photo = load('src/services/wardrobe/photo.ts', {
    'expo-image-picker': {},
    'expo-image-manipulator': { SaveFormat: { JPEG: 'jpeg' }, ImageManipulator: { manipulate: () => ({
      resize: value => { size = value; }, release: () => releases++,
      renderAsync: async () => ({ saveAsync: async value => { format = value; return { base64: '/9j/' }; }, release: () => releases++ }),
    }) } },
  });
  assert.equal(await photo.prepareWardrobePhoto({ uri: 'file://photo.heic', width: 3000, height: 4000 }), '/9j/');
  assert.equal(size.height, 1600);
  assert.equal(format.format, 'jpeg');
  assert.equal(format.base64, true);
  assert.equal(releases, 2);
});
