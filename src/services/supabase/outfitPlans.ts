import { requireSupabase } from './client';
import { planInputs, type PlanDraft } from '@/utils/outfitPlan';
export async function saveOutfitPlan(id: string, draft: PlanDraft, itemIds: string[]) {
  const { data, error } = await requireSupabase().rpc('save_outfit_plan', {
    p_id: id, ...planInputs(draft), p_item_ids: [...new Set(itemIds)],
  });
  if (error) throw error;
  return data;
}
