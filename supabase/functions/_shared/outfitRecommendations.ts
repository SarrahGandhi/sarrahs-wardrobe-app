export const recommendationTitles = ['Safe Choice', 'More Stylish', 'Something Different'] as const;
export const attributes = ['id', 'name', 'category', 'subcategory', 'primary_colour', 'secondary_colours', 'pattern', 'material', 'fit', 'season', 'formality', 'style_tags', 'warmth_level', 'sleeve_length', 'neckline'] as const;
export type OutfitItem = { id: string; name: string; category: string; [key: string]: unknown };
export type OutfitRequest = {
  occasion: string; custom_occasion_description: string;
  weather: { temperature_c: number | null; condition: string };
  setting: 'indoor' | 'outdoor' | 'both' | null;
  styling_request: string; preference_chips: string[];
  required_wardrobe_item_ids: string[]; available_wardrobe_items: OutfitItem[];
};
export type Recommendation = {
  title: typeof recommendationTitles[number];
  items: { wardrobe_item_id: string; role: string }[];
  accessories: { wardrobe_item_id: string; role: string }[];
  hairstyle: string; makeup: string; why_this_works: string;
};
export type OutfitResult = { status: 'ok' | 'impossible'; reason: string; recommendations: Recommendation[] };
export const objectSchema = (properties: Record<string, unknown>) => ({ type: 'object', additionalProperties: false, properties, required: Object.keys(properties) });
const stringSchema = { type: 'string' };
const itemSchema = objectSchema({ wardrobe_item_id: stringSchema, role: stringSchema });
export const outfitSchema = objectSchema({
  status: { type: 'string', enum: ['ok', 'impossible'] }, reason: stringSchema,
  recommendations: { type: 'array', items: objectSchema({
    title: { type: 'string', enum: recommendationTitles },
    items: { type: 'array', items: itemSchema }, accessories: { type: 'array', items: itemSchema },
    hairstyle: stringSchema, makeup: stringSchema, why_this_works: stringSchema,
  }) },
});
// Constrain decoding to the actual wardrobe, instead of asking the model to copy UUIDs.
export function outfitSchemaFor(request: OutfitRequest) {
  const schema = JSON.parse(JSON.stringify(outfitSchema));
  const properties = schema.properties.recommendations.items.properties;
  for (const field of ['items', 'accessories']) {
    const matching = request.available_wardrobe_items.filter(item =>
      ['bag', 'jewellery', 'accessory'].includes(item.category) === (field === 'accessories'));
    properties[field].items.properties.wardrobe_item_id = {
      type: 'string', enum: (matching.length ? matching : request.available_wardrobe_items).map(item => item.id),
    };
    if (!matching.length) properties[field].maxItems = 0;
  }
  return schema;
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid object');
  return value as Record<string, unknown>;
}
function exact(value: Record<string, unknown>, keys: string[]) {
  if (Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) throw new Error('Unexpected fields');
}
function text(value: unknown, max: number, empty = true): value is string {
  return typeof value === 'string' && value.length <= max && (empty || !!value.trim());
}
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value);
export function projectItem(value: OutfitItem): OutfitItem {
  return Object.fromEntries(attributes.map(key => [key, value[key] ?? null])) as OutfitItem;
}
export function validateOutfitRequest(value: unknown): OutfitRequest {
  const r = record(value), w = record(r.weather);
  if (!text(r.occasion, 200, false) || !text(r.custom_occasion_description, 180) ||
    (r.occasion === 'Other' && !r.custom_occasion_description.trim()) ||
    !text(w.condition, 500) || !(w.temperature_c === null || typeof w.temperature_c === 'number' && Number.isFinite(w.temperature_c) && w.temperature_c >= -100 && w.temperature_c <= 70) ||
    ![null, 'indoor', 'outdoor', 'both'].includes(r.setting as null) || !text(r.styling_request, 4000) ||
    !Array.isArray(r.preference_chips) || r.preference_chips.length > 20 || !r.preference_chips.every(v => text(v, 80, false)) ||
    !Array.isArray(r.required_wardrobe_item_ids) || r.required_wardrobe_item_ids.length > 20 || !r.required_wardrobe_item_ids.every(uuid) ||
    !Array.isArray(r.available_wardrobe_items) || r.available_wardrobe_items.length > 500) throw new Error('Invalid request');
  const ids = new Set<string>();
  for (const raw of r.available_wardrobe_items) {
    const item = record(raw);
    if (!uuid(item.id) || ids.has(item.id) || !text(item.name, 200, false) || !text(item.category, 40, false)) throw new Error('Invalid wardrobe');
    ids.add(item.id);
  }
  if (!r.required_wardrobe_item_ids.every(id => ids.has(id))) throw new Error('Required piece unavailable');
  return value as OutfitRequest;
}
export function validateOutfitResult(value: unknown, request: OutfitRequest): OutfitResult {
  const result = record(value);
  exact(result, ['status', 'reason', 'recommendations']);
  if (!text(result.reason, 1000) || !Array.isArray(result.recommendations)) throw new Error('Invalid result');
  if (result.status === 'impossible') {
    if (!result.reason.trim() || result.recommendations.length) throw new Error('Invalid impossible result');
    return value as OutfitResult;
  }
  if (result.status !== 'ok' || result.recommendations.length !== 3) throw new Error('Expected three outfits');
  const wardrobe = new Map(request.available_wardrobe_items.map(item => [item.id, item]));
  const styling = `${request.styling_request} ${request.custom_occasion_description} ${request.preference_chips.join(' ')}`;
  const noHeels = /\b(no|without|avoid)\s+(high\s+)?heels\b/i.test(styling);
  const wantsJeans = /\b(want to wear|must wear|wear|include)\s+(my\s+|some\s+)?jeans\b/i.test(styling) && !/\b(no|without|avoid|don't wear|do not wear|don't want to wear|do not want to wear)\s+jeans\b/i.test(styling);
  for (const [index, raw] of result.recommendations.entries()) {
    const look = record(raw);
    exact(look, ['title', 'items', 'accessories', 'hairstyle', 'makeup', 'why_this_works']);
    if (look.title !== recommendationTitles[index] || !Array.isArray(look.items) || !look.items.length || !Array.isArray(look.accessories) ||
      !text(look.hairstyle, 1000, false) || !text(look.makeup, 1000, false) || !text(look.why_this_works, 2000, false)) throw new Error('Invalid outfit');
    const ids = new Set<string>();
    const selected: OutfitItem[] = [];
    for (const [entries, accessory] of [[look.items, false], [look.accessories, true]] as const) {
      if (entries.length > 20) throw new Error('Too many pieces');
      for (const entry of entries) {
        const part = record(entry);
        exact(part, ['wardrobe_item_id', 'role']);
        if (!uuid(part.wardrobe_item_id) || !text(part.role, 200, false) || ids.has(part.wardrobe_item_id)) throw new Error('Invalid piece');
        const item = wardrobe.get(part.wardrobe_item_id);
        if (!item || accessory !== ['bag', 'jewellery', 'accessory'].includes(item.category)) throw new Error('Unknown or misclassified piece');
        ids.add(item.id); selected.push(item);
      }
    }
    if (!request.required_wardrobe_item_ids.every(id => ids.has(id))) throw new Error('Missing required piece');
    const description = (item: OutfitItem) => `${item.name} ${item.subcategory ?? ''} ${JSON.stringify(item.style_tags ?? [])}`;
    // Seeded flat shoes carry the tag "no heel". Negated descriptors are not heels.
    const hasHeels = (item: OutfitItem) => /\b(heels?|heeled|stilettos?|pumps|wedges)\b/i.test(
      description(item).replace(/\b(?:no|without|zero)\s+heels?\b|\bnon[- ]heeled\b|\bheel[- ]free\b/gi, ''));
    if (noHeels && selected.some(item => item.category === 'shoes' && hasHeels(item))) throw new Error('Heels forbidden');
    if (wantsJeans && !selected.some(item => item.category === 'bottom' && /\bjeans\b/i.test(description(item)))) throw new Error('Jeans required');
    if (!selected.some(item => item.category === 'dress') && !(selected.some(item => item.category === 'top') && selected.some(item => item.category === 'bottom'))) throw new Error('Incomplete outfit');
  }
  return value as OutfitResult;
}

// Only these predefined messages may cross the provider boundary. Never expose raw errors.
export const aiErrorMessages: Record<string, string> = {
  ai_invalid_response: 'The AI returned an invalid outfit response after retrying. Please try again.',
  ai_rate_limited: 'The AI provider’s free-tier limit has been reached. Wait a minute and try again; daily limits may take longer to reset.',
  ai_key_invalid: 'The outfit server’s AI key is invalid or lacks access. Check the server configuration.',
  ai_request_too_large: 'This wardrobe request exceeds the AI provider’s request limit. The outfit service needs a smaller request.',
  ai_request_rejected: 'The AI provider rejected the outfit request. The server configuration or request format needs checking.',
  ai_provider_failed: 'The AI provider is temporarily unavailable. Please try again later.',
};
