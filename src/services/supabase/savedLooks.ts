import { requireSupabase } from './client';
import type { CompleteLook, RecommendationRow } from '@/types/outfit';
const kinds = { 'Safe Choice': 'safe_choice', 'More Stylish': 'more_stylish', 'Something Different': 'something_different' } as const;
export async function saveLook(userId: string, entry: CompleteLook) {
  const client = requireSupabase();
  // Stable IDs make retries safe even if a previous request only partly completed.
  const { error } = await client.from('outfit_recommendations').upsert({ id: entry.id, user_id: userId, outfit_plan_id: entry.planId,
    kind: kinds[entry.look.title], title: entry.look.title, explanation: entry.look.why_this_works,
    generation_metadata: { look: entry.look, draft: entry.draft, requiredIds: entry.requiredIds } });
  if (error) throw error;
  const parts = [...entry.look.items, ...entry.look.accessories];
  const rows = parts.map((part, position) => {
    const item = entry.wardrobe.find(item => item.id === part.wardrobe_item_id);
    if (!item) throw new Error('A wardrobe piece is unavailable. Generate a new look.');
    return { user_id: userId, outfit_recommendation_id: entry.id, wardrobe_item_id: item.id, role: item.category, position };
  });
  const { error: itemError } = await client.from('outfit_recommendation_items').upsert(rows, { onConflict: 'outfit_recommendation_id,wardrobe_item_id' });
  if (itemError) throw itemError;
  const { error: saveError } = await client.from('saved_looks').upsert({ user_id: userId, outfit_recommendation_id: entry.id }, { onConflict: 'user_id,outfit_recommendation_id', ignoreDuplicates: true });
  if (saveError) throw saveError;
}
async function hydrate(userId: string, rows: RecommendationRow[]): Promise<CompleteLook[]> {
  const ids = [...new Set(rows.flatMap(row => [...(row.generation_metadata.look?.items ?? []), ...(row.generation_metadata.look?.accessories ?? [])].map(part => part.wardrobe_item_id)))];
  if (!ids.length) return [];
  const { data: wardrobe, error } = await requireSupabase().from('wardrobe_items').select('*').eq('user_id', userId).in('id', ids);
  if (error) throw error;
  return rows.flatMap(row => {
    const { look, draft, requiredIds } = row.generation_metadata;
    return look && draft ? [{ id: row.id, planId: row.outfit_plan_id, look, draft, requiredIds: requiredIds ?? [], wardrobe, saved: true }] : [];
  });
}
export async function listSavedLooks(userId: string) {
  const client = requireSupabase();
  const { data: bookmarks, error } = await client.from('saved_looks').select('*').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  if (!bookmarks.length) return [];
  const { data, error: readError } = await client.from('outfit_recommendations').select('*').eq('user_id', userId).in('id', bookmarks.map(row => row.outfit_recommendation_id));
  if (readError) throw readError;
  const entries = await hydrate(userId, data);
  return bookmarks.flatMap(bookmark => entries.filter(entry => entry.id === bookmark.outfit_recommendation_id));
}
