import { requireSupabase } from './client';
import { validateClothingAnalysis } from '../../../supabase/functions/_shared/clothingAnalysis';

export async function analyzeWardrobeImage(path: string, signal: AbortSignal) {
  const { data, error } = await requireSupabase().functions.invoke('analyze-clothing', {
    body: { image_path: path }, signal, timeout: 45_000,
  });
  if (error) throw error;
  return validateClothingAnalysis(data?.analysis);
}
