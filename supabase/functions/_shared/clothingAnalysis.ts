// Pure contract shared by Edge Function and mobile client. No credentials or server APIs.
export const analysisCategories = ['top', 'bottom', 'dress', 'outerwear', 'shoes', 'bag', 'jewellery', 'accessory'] as const;
const fits = ['fitted', 'regular', 'relaxed', 'oversized'] as const;
const seasons = ['spring', 'summer', 'autumn', 'winter'] as const;
const formalities = ['casual', 'smart_casual', 'business', 'semi_formal', 'formal'] as const;
const sleeves = ['sleeveless', 'short', 'elbow', 'three_quarter', 'long'] as const;
export type ClothingAnalysis = {
  suggested_name: string | null;
  category: typeof analysisCategories[number] | null;
  subcategory: string | null;
  primary_colour: string | null;
  secondary_colours: string[] | null;
  pattern: string | null;
  possible_material: string[] | null;
  fit: typeof fits[number] | null;
  season: (typeof seasons[number])[] | null;
  formality: typeof formalities[number] | null;
  style_tags: string[] | null;
  warmth_level: number | null;
  sleeve_length: typeof sleeves[number] | null;
  neckline: string | null;
};
type Rule = { kind: 'string' | 'array' | 'integer'; values?: readonly string[]; max?: number };
const rules: Record<keyof ClothingAnalysis, Rule> = {
  suggested_name: { kind: 'string', max: 200 }, category: { kind: 'string', values: analysisCategories },
  subcategory: { kind: 'string', max: 100 }, primary_colour: { kind: 'string', max: 100 },
  secondary_colours: { kind: 'array' }, pattern: { kind: 'string', max: 100 }, possible_material: { kind: 'array' },
  fit: { kind: 'string', values: fits }, season: { kind: 'array', values: seasons },
  formality: { kind: 'string', values: formalities }, style_tags: { kind: 'array' },
  warmth_level: { kind: 'integer' }, sleeve_length: { kind: 'string', values: sleeves }, neckline: { kind: 'string', max: 100 },
};
export const clothingAnalysisSchema = {
  type: 'object', additionalProperties: false, required: Object.keys(rules),
  properties: Object.fromEntries(Object.entries(rules).map(([key, rule]) => [key,
    rule.kind === 'integer' ? { type: ['integer', 'null'], minimum: 1, maximum: 5 }
      : rule.kind === 'array' ? { type: ['array', 'null'], maxItems: 12, items: { type: 'string', ...(rule.values ? { enum: rule.values } : { minLength: 1, maxLength: 100 }) } }
      : { type: ['string', 'null'], ...(rule.values ? { enum: [...rule.values, null] } : { minLength: 1, maxLength: rule.max }) },
  ])),
};
export function validateClothingAnalysis(value: unknown): ClothingAnalysis {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid analysis');
  const record = value as Record<string, unknown>;
  if (Object.keys(record).length !== Object.keys(rules).length || Object.keys(record).some(key => !(key in rules))) throw new Error('Invalid analysis fields');
  for (const [key, rule] of Object.entries(rules)) {
    if (!Object.prototype.hasOwnProperty.call(record, key)) throw new Error('Missing analysis field');
    const field = record[key];
    if (field === null) continue;
    const validText = (text: unknown) => typeof text === 'string' && text.trim().length > 0 && text.length <= (rule.max ?? 100) && (!rule.values || rule.values.includes(text));
    if (rule.kind === 'integer' ? !Number.isInteger(field) || (field as number) < 1 || (field as number) > 5
      : rule.kind === 'array' ? !Array.isArray(field) || field.length > 12 || !field.every(validText)
        : !validText(field)) throw new Error(`Invalid analysis field: ${key}`);
  }
  const result = record as ClothingAnalysis;
  if (result.category && !['top', 'dress', 'outerwear'].includes(result.category) && (result.sleeve_length !== null || result.neckline !== null)) throw new Error('Inapplicable garment attributes');
  return result;
}
