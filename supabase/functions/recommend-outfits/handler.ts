import { aiErrorMessages, projectItem, validateOutfitRequest, validateOutfitResult, type OutfitItem, type OutfitRequest } from '../_shared/outfitRecommendations.ts';
export type OutfitDependencies = {
  configured: () => boolean;
  authenticate: (token: string) => Promise<null | {
    wardrobe: () => Promise<OutfitItem[]>;
    consumeQuota: () => Promise<boolean>;
  }>;
  generate: (request: OutfitRequest) => Promise<unknown>;
  audit: (request: OutfitRequest, result: unknown) => Promise<boolean>;
};
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
const fail = (status: number, error: string, message: string) => reply(status, { error, message });
export function createOutfitHandler(deps: OutfitDependencies) {
  return async (request: Request) => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return fail(405, 'method_not_allowed', 'Use POST.');
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return fail(401, 'unauthorized', 'Sign in to generate outfits.');
    let stage = 'authenticate';
    try {
      const access = await deps.authenticate(token);
      if (!access) return fail(401, 'unauthorized', 'Sign in to generate outfits.');
      if (!request.headers.get('content-type')?.includes('application/json')) return fail(415, 'invalid_content_type', 'Use JSON.');
      const reader = request.body?.getReader();
      if (!reader) return fail(400, 'invalid_request', 'Supply your styling preferences.');
      let body = ''; let size = 0; const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 750_000) { await reader.cancel(); return fail(413, 'request_too_large', 'Your wardrobe request is too large.'); }
        body += decoder.decode(value, { stream: true });
      }
      body += decoder.decode();
      let input: OutfitRequest;
      try { input = validateOutfitRequest(JSON.parse(body)); }
      catch { return fail(400, 'invalid_request', 'Check your occasion, preferences and selected pieces.'); }
      stage = 'wardrobe';
      const owned = await access.wardrobe();
      const byId = new Map(owned.map(item => [item.id, item]));
      if (input.available_wardrobe_items.some(item => !byId.has(item.id))) return fail(409, 'wardrobe_changed', 'Your wardrobe changed. Refresh it and try again.');
      // Discard client attributes. RLS-scoped database values are authoritative.
      input = { occasion: input.occasion, custom_occasion_description: input.custom_occasion_description,
        weather: { temperature_c: input.weather.temperature_c, condition: input.weather.condition }, setting: input.setting,
        styling_request: input.styling_request, preference_chips: input.preference_chips,
        required_wardrobe_item_ids: input.required_wardrobe_item_ids,
        available_wardrobe_items: input.available_wardrobe_items.map(item => projectItem(byId.get(item.id)!)) };
      if (!input.available_wardrobe_items.length) return reply(200, { status: 'impossible', reason: 'Add clothing to your wardrobe before generating outfits.', recommendations: [] });
      if (!deps.configured()) return fail(503, 'not_configured', 'Outfit generation is not configured yet.');
      stage = 'quota';
      if (!await access.consumeQuota()) return fail(429, 'rate_limited', 'You have reached the hourly outfit limit. Try again later.');
      stage = 'provider';
      const generated = await deps.generate(input);
      stage = 'validation';
      const result = validateOutfitResult(generated, input);
      stage = 'audit';
      if (result.status === 'ok' && !await deps.audit(input, result)) return fail(422, 'requirements_not_met', 'We couldn’t satisfy all your requirements. Adjust your request or try again.');
      // Re-read immediately before responding: reject deletion, archiving or attribute changes during AI work.
      stage = 'wardrobe_recheck';
      const fresh = new Map((await access.wardrobe()).map(item => [item.id, projectItem(item)]));
      const used = result.recommendations.flatMap(look => [...look.items, ...look.accessories].map(part => part.wardrobe_item_id));
      if (used.some(id => JSON.stringify(fresh.get(id)) !== JSON.stringify(projectItem(byId.get(id)!)))) return fail(409, 'wardrobe_changed', 'Your wardrobe changed. Please try again.');
      return reply(200, result);
    } catch (error) {
      // Do not log keys, wardrobe content, prompts or raw provider responses.
      console.error(JSON.stringify({ event: 'outfit_generation_failed', stage }));
      const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
      if (typeof code === 'string' && Object.prototype.hasOwnProperty.call(aiErrorMessages, code)) {
        return fail(code === 'ai_rate_limited' ? 429 : 503, code, aiErrorMessages[code]!);
      }
      return fail(502, 'generation_failed', 'We couldn’t generate valid outfits. Please try again.');
    }
  };
}
