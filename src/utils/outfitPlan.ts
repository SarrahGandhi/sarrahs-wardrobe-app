export const occasions = ['Work', 'Dinner', 'Party', 'Date', 'Friends', 'Wedding', 'Casual', 'Travel', 'Other'] as const;
export const preferenceChips = ['Comfortable', 'Casual', 'Dressy', 'Feminine', 'Edgy', 'Minimal', 'Warm', 'Modest', 'Colourful', 'Neutral'] as const;
export type PlanDraft = {
  occasion: string; description: string; temperature: string; condition: string;
  setting: 'indoor' | 'outdoor' | 'both' | null; instructions: string; preferences: string[];
};
export function planInputs(draft: PlanDraft) {
  const occasion = draft.occasion === 'Other' ? draft.description.trim()
    : [draft.occasion, draft.description.trim()].filter(Boolean).join(': ');
  if (!occasion || !draft.occasion) throw new Error('Choose an occasion. For Other, add a short description.');
  if (occasion.length > 200) throw new Error('Keep the occasion and description under 200 characters.');
  const raw = draft.temperature.trim().replace(',', '.');
  const temperature = raw ? Number(raw) : null;
  if (raw && (!/^-?\d+(\.\d{1,2})?$/.test(raw) || !Number.isFinite(temperature) || temperature! < -100 || temperature! > 70)) {
    throw new Error('Enter a temperature between −100 and 70 °C, or leave it blank.');
  }
  if (draft.condition.length > 500 || draft.instructions.length > 4000) throw new Error('Please shorten your weather or preferences text.');
  return { p_occasion: occasion, p_temperature_c: temperature, p_weather_summary: draft.condition.trim() || null,
    p_setting: draft.setting, p_instructions: draft.instructions.trim() || null, p_style_preferences: draft.preferences };
}
