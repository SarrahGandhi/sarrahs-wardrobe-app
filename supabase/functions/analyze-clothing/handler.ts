import { validateClothingAnalysis } from '../_shared/clothingAnalysis.ts';
export type AnalysisAccess = {
  userId: string;
  download: (path: string) => Promise<Blob | null>;
  consumeQuota: () => Promise<boolean>;
};
export type AnalysisDependencies = {
  authenticate: (token: string) => Promise<AnalysisAccess | null>;
  analyze: (image: Uint8Array) => Promise<unknown>;
  configured: () => boolean;
};
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json', 'Cache-Control': 'no-store',
};
const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
const failure = (status: number, code: string) => reply(status, { error: code, message: 'Analysis unavailable. You can enter the details manually.' });
export function createAnalysisHandler(deps: AnalysisDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return failure(405, 'method_not_allowed');
    const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
    if (!token) return failure(401, 'unauthorized');
    try {
      const access = await deps.authenticate(token);
      if (!access) return failure(401, 'unauthorized');
      if (!request.headers.get('content-type')?.includes('application/json')) return failure(415, 'invalid_content_type');
      if (Number(request.headers.get('content-length')) > 1024) return failure(413, 'request_too_large');
      // Bound streaming bodies too; Content-Length is untrusted/optional.
      const reader = request.body?.getReader();
      if (!reader) return failure(400, 'invalid_request');
      let body = ''; let length = 0;
      const decoder = new TextDecoder();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        length += chunk.value.byteLength;
        if (length > 1024) { await reader.cancel(); return failure(413, 'request_too_large'); }
        body += decoder.decode(chunk.value, { stream: true });
      }
      body += decoder.decode();
      let payload: unknown;
      try { payload = JSON.parse(body); } catch { return failure(400, 'invalid_request'); }
      if (!payload || typeof payload !== 'object' || Array.isArray(payload) || Object.keys(payload).length !== 1 || !('image_path' in payload) || typeof payload.image_path !== 'string') return failure(400, 'invalid_request');
      const path = payload.image_path;
      if (!/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(path) || !path.startsWith(`${access.userId}/`)) return failure(403, 'image_not_owned');
      if (!deps.configured()) return failure(503, 'not_configured');
      if (!await access.consumeQuota()) return failure(429, 'rate_limited');
      const image = await access.download(path);
      if (!image) return failure(404, 'image_unavailable');
      if (image.size > 5 * 1024 * 1024 || image.size < 3 || image.type !== 'image/jpeg') return failure(422, 'invalid_image');
      const bytes = new Uint8Array(await image.arrayBuffer());
      if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) return failure(422, 'invalid_image');
      const analysis = validateClothingAnalysis(await deps.analyze(bytes));
      // Suggestions only. This handler never inserts or updates wardrobe_items.
      return reply(200, { analysis });
    } catch {
      // Never return provider responses, keys, image data, or private error details.
      return failure(502, 'analysis_failed');
    }
  };
}
