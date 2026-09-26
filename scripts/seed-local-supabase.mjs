import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';

// Read credentials from the local stack, never from the app's potentially hosted .env.
const cli = process.env.SUPABASE_CLI_PATH;
const status = JSON.parse(execFileSync(cli || 'npx', cli ? ['status', '-o', 'json'] : ['--yes', 'supabase@2.117.0', 'status', '-o', 'json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
const url = new URL(status.API_URL);
if (!['127.0.0.1', 'localhost'].includes(url.hostname) || url.port !== '54321') throw new Error('Seeding is restricted to this project’s local Supabase on port 54321.');
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const admin = createClient(url.href, status.SERVICE_ROLE_KEY, options);
const email = 'demo@wardrobe.test';
const password = 'WardrobeDemo123!'; // Public, local-only demo credentials.
function checked({ data, error }) { if (error) throw error; return data; }
let user;
for (let page = 1; ; page++) {
  const { users } = checked(await admin.auth.admin.listUsers({ page, perPage: 100 }));
  user = users.find(entry => entry.email === email);
  if (user || users.length < 100) break;
}
if (!user) user = checked(await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: 'Sarrah Demo' } })).user;
const client = createClient(url.href, status.ANON_KEY, options);
checked(await client.auth.signInWithPassword({ email, password }));
const id = label => {
  const hash = createHash('sha256').update(`wardrobe-local-demo:${user.id}:${label}`).digest('hex');
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-8${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
};
const entries = [
  ['White cotton T-shirt', 'top', 't-shirt', 'white', 'cotton', 'regular', 'casual', 1, 'short', 'crew'],
  ['Cream linen shirt', 'top', 'shirt', 'cream', 'linen', 'relaxed', 'smart_casual', 1, 'long', 'collared'],
  ['Black ribbed tank', 'top', 'tank top', 'black', 'cotton', 'fitted', 'casual', 1, 'sleeveless', 'scoop'],
  ['Burgundy silk blouse', 'top', 'blouse', 'burgundy', 'silk', 'regular', 'semi_formal', 2, 'long', 'v-neck'],
  ['Navy wool sweater', 'top', 'sweater', 'navy', 'wool', 'relaxed', 'casual', 4, 'long', 'crew'],
  ['Blue straight-leg jeans', 'bottom', 'jeans', 'blue', 'denim', 'regular', 'casual', 3],
  ['Black wide-leg jeans', 'bottom', 'jeans', 'black', 'denim', 'relaxed', 'smart_casual', 3],
  ['Beige tailored trousers', 'bottom', 'trousers', 'beige', 'cotton', 'regular', 'business', 2],
  ['Olive linen trousers', 'bottom', 'trousers', 'olive', 'linen', 'relaxed', 'casual', 1],
  ['Black midi skirt', 'bottom', 'midi skirt', 'black', 'viscose', 'regular', 'smart_casual', 2],
  ['Navy wrap midi dress', 'dress', 'wrap dress', 'navy', 'viscose', 'regular', 'semi_formal', 2, 'short', 'v-neck'],
  ['Green floral summer dress', 'dress', 'midi dress', 'green', 'cotton', 'relaxed', 'casual', 1, 'short', 'square'],
  ['Camel tailored blazer', 'outerwear', 'blazer', 'camel', 'wool', 'regular', 'business', 3, 'long', 'lapel'],
  ['Blue denim jacket', 'outerwear', 'denim jacket', 'blue', 'denim', 'relaxed', 'casual', 3, 'long', 'collared'],
  ['White flat sneakers', 'shoes', 'flat sneakers', 'white', 'canvas', null, 'casual', 2],
  ['Black flat loafers', 'shoes', 'flat loafers', 'black', 'leather', null, 'smart_casual', 2],
  ['Tan flat sandals', 'shoes', 'flat sandals', 'tan', 'leather', null, 'casual', 1],
  ['Black high-heel pumps', 'shoes', 'high heels', 'black', 'leather', null, 'formal', 2],
  ['Tan crossbody bag', 'bag', 'crossbody bag', 'tan', 'leather', null, 'casual', 1],
  ['Black evening clutch', 'bag', 'clutch', 'black', 'satin', null, 'formal', 1],
  ['Small gold hoop earrings', 'jewellery', 'earrings', 'gold', 'gold-plated brass', null, 'smart_casual', 1],
  ['Brown leather belt', 'accessory', 'belt', 'brown', 'leather', null, 'casual', 1],
];
const items = entries.map(([name, category, subcategory, colour, material, fit, formality, warmth, sleeves, neckline]) => ({
  id: id(name), user_id: user.id, name, category, subcategory, primary_colour: colour,
  secondary_colours: name.includes('floral') ? ['white'] : [], pattern: name.includes('floral') ? 'floral' : 'solid',
  material: [material], fit, formality, warmth_level: warmth,
  season: warmth >= 3 ? ['autumn', 'winter', 'spring'] : ['spring', 'summer'],
  style_tags: name.includes('flat') ? ['comfortable', 'flat', 'no heel'] : name.includes('high-heel') ? ['dressy', 'high heel'] : ['versatile'],
  sleeve_length: sleeves ?? null, neckline: neckline ?? null,
  favourite: ['Blue straight-leg jeans', 'Cream linen shirt', 'White flat sneakers'].includes(name),
}));
// Insert missing fixtures only, preserving any edits made to demo items on reruns.
checked(await admin.from('wardrobe_items').upsert(items, { onConflict: 'id', ignoreDuplicates: true }));
const photoManifest = JSON.parse(readFileSync(new URL('./seed-assets/wardrobe/photos.json', import.meta.url), 'utf8'));
const bucket = client.storage.from('wardrobe-images');
let addedPhotos = 0;
for (const item of items) {
  const current = checked(await client.from('wardrobe_items').select('image_path,image_url').eq('id', item.id).single());
  // Preserve user uploads and external photos when re-seeding.
  if (current.image_path || current.image_url) continue;
  const photo = photoManifest.find(entry => entry.name === item.name);
  if (!photo || !/^[a-z0-9-]+\.jpg$/.test(photo.file)) throw new Error(`Missing seed photo for ${item.name}`);
  const bytes = readFileSync(new URL(`./seed-assets/wardrobe/${photo.file}`, import.meta.url));
  if (bytes.length > 5 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Invalid JPEG for ${item.name}`);
  const imagePath = `${user.id}/${id(`photo:${item.name}`)}.jpg`;
  const { error: uploadError } = await bucket.upload(imagePath, bytes, { contentType: 'image/jpeg', upsert: false });
  // A previous run may have uploaded the object before being interrupted.
  if (uploadError) checked(await bucket.download(imagePath));
  checked(await client.from('wardrobe_items').update({ image_path: imagePath })
    .eq('id', item.id).is('image_path', null).is('image_url', null));
  addedPhotos++;
}
const planId = id('dinner-plan');
const existing = checked(await client.from('outfit_plans').select('id').eq('id', planId).maybeSingle());
if (!existing) checked(await client.rpc('save_outfit_plan', {
  p_id: planId, p_occasion: 'Dinner: A relaxed evening with friends', p_temperature_c: 22,
  p_weather_summary: 'Clear', p_setting: 'indoor', p_instructions: 'No heels. I want to wear jeans.',
  p_style_preferences: ['Comfortable', 'Minimal'], p_item_ids: [id('Blue straight-leg jeans')],
}));
const visible = checked(await client.from('wardrobe_items').select('id,image_path,image_url').in('id', items.map(item => item.id)));
if (visible.length !== items.length) throw new Error('Demo user cannot read all seeded pieces.');
for (const item of visible) {
  if (!item.image_path && !item.image_url) throw new Error('A seeded item is missing its photo.');
  if (item.image_path) {
    const { signedUrl } = checked(await bucket.createSignedUrl(item.image_path, 60));
    const response = await fetch(signedUrl);
    if (!response.ok || !response.headers.get('content-type')?.includes('image/jpeg')) throw new Error('A seed photo is not accessible.');
    await response.arrayBuffer();
  }
}
await client.auth.signOut();
console.log(`Seeded and verified ${visible.length} wardrobe items with photos and a sample outfit plan in LOCAL Supabase. Added ${addedPhotos} photos this run.`);
console.log(`Demo login: ${email}\nDemo password: ${password}\nStudio: http://127.0.0.1:54323`);
