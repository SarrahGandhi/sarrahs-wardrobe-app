import { requireSupabase } from './client';
import type { WardrobeEdit } from '@/types/wardrobe';

export const wardrobeImageBucket = 'wardrobe-images';
export const maxImageBytes = 5 * 1024 * 1024;
export function imageBytes(base64: string): ArrayBuffer {
  if (base64.length > Math.ceil(maxImageBytes / 3) * 4) throw new Error('This photo is too large. Choose a smaller photo.');
  const decoded = atob(base64);
  if (!decoded.length || decoded.length > maxImageBytes) throw new Error('Choose a photo smaller than 5 MB.');
  return Uint8Array.from(decoded, char => char.charCodeAt(0)).buffer;
}
export function ownedImagePath(userId: string, path: string) {
  return path.startsWith(`${userId}/`) && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(path);
}
export async function uploadWardrobePhoto(userId: string, photoId: string, base64: string) {
  const path = `${userId}/${photoId}.jpg`;
  if (!ownedImagePath(userId, path)) throw new Error('Invalid photo path.');
  const bucket = requireSupabase().storage.from(wardrobeImageBucket);
  const { error } = await bucket.upload(path, imageBytes(base64), { contentType: 'image/jpeg', cacheControl: '600', upsert: false });
  if (error) {
    // An upload may have completed even when its response was lost. On retry,
    // verify that this unique draft path exists instead of overwriting it.
    const { error: lookupError } = await bucket.createSignedUrl(path, 60);
    if (!lookupError) return path;
    throw error;
  }
  return path;
}
export async function wardrobePhotoUrl(userId: string, path: string) {
  if (!ownedImagePath(userId, path)) throw new Error('Photo unavailable.');
  const { data, error } = await requireSupabase().storage.from(wardrobeImageBucket).createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}
export async function discardWardrobePhoto(userId: string, path: string) {
  if (!ownedImagePath(userId, path)) throw new Error('Invalid photo path.');
  const { error } = await requireSupabase().storage.from(wardrobeImageBucket).remove([path]);
  if (error) throw error;
}
export async function createWardrobeItem(userId: string, id: string, path: string, fields: WardrobeEdit) {
  if (!ownedImagePath(userId, path)) throw new Error('Invalid photo path.');
  const client = requireSupabase();
  // Stable draft id makes Save retry-safe after a lost response.
  const { data: existing, error: lookupError } = await client.from('wardrobe_items').select('*').eq('user_id', userId).eq('id', id).maybeSingle();
  if (lookupError) throw lookupError;
  if (existing) return existing;
  const { data, error } = await client.from('wardrobe_items').insert({ ...fields, id, user_id: userId, image_path: path, image_url: null }).select().single();
  if (error) throw error;
  return data;
}
