import { requireSupabase } from './client';
import type { WardrobeCategory, WardrobeEdit } from '@/types/wardrobe';

export const wardrobePageSize = 40;
export const validItemId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
// Quote PostgREST filter values and escape LIKE wildcards. Search remains literal,
// including commas, quotes, parentheses, percent signs and backslashes.
export function searchPattern(search: string) {
  return JSON.stringify(`%${search.trim().replace(/[\\%_]/g, '\\$&')}%`);
}
export async function listWardrobe(userId: string, filters: { search: string; category: WardrobeCategory | null; favourites: boolean }, offset = 0) {
  let query = requireSupabase().from('wardrobe_items').select('*')
    .eq('user_id', userId).is('archived_at', null);
  if (filters.category) query = query.eq('category', filters.category);
  if (filters.favourites) query = query.eq('favourite', true);
  if (filters.search.trim()) {
    const pattern = searchPattern(filters.search);
    query = query.or(`name.ilike.${pattern},brand.ilike.${pattern},primary_colour.ilike.${pattern}`);
  }
  const { data, error } = await query.order('created_at', { ascending: false }).order('id', { ascending: false }).range(offset, offset + wardrobePageSize - 1);
  if (error) throw error;
  return data;
}
export async function getWardrobeItem(userId: string, id: string) {
  if (!validItemId(id)) return null;
  const { data, error } = await requireSupabase().from('wardrobe_items').select('*').eq('user_id', userId).eq('id', id).is('archived_at', null).maybeSingle();
  if (error) throw error;
  return data;
}
export async function updateWardrobeItem(userId: string, id: string, changes: Partial<WardrobeEdit>) {
  const { data, error } = await requireSupabase().from('wardrobe_items').update(changes).eq('user_id', userId).eq('id', id).is('archived_at', null).select().single();
  if (error) throw error;
  return data;
}
export async function deleteWardrobeItem(userId: string, id: string) {
  const { data, error } = await requireSupabase().from('wardrobe_items').delete().eq('user_id', userId).eq('id', id).select('id, image_path').single();
  if (error) throw error;
  if (data.image_path) {
    // The database delete is authoritative. A failed storage cleanup must not
    // make a successful deletion look like it failed; stale files remain private.
    await requireSupabase().storage.from('wardrobe-images').remove([data.image_path]).catch(() => {});
  }
  return data;
}
export async function saveAnchoredPlan(userId: string, itemId: string, occasion: string, instructions: string) {
  const item = await getWardrobeItem(userId, itemId);
  if (!item) throw new Error('Item unavailable');
  const { data, error } = await requireSupabase().from('outfit_plans').insert({ user_id: userId, anchor_item_id: itemId, occasion: occasion.trim(), instructions: instructions.trim() || null }).select('id').single();
  if (error) throw error;
  return data;
}
export function wardrobeError(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
  if (code === '23503') return 'This piece is used in an outfit plan or saved look. Remove those references before deleting it.';
  if (code === 'PGRST116') return 'This piece is no longer available. Return to your wardrobe and refresh.';
  return 'We couldn’t update your wardrobe. Check your connection and try again.';
}
