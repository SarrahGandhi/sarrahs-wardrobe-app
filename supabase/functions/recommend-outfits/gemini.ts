import { outfitProvider } from './openai.ts';
export const geminiDefaultModel = 'gemini-3.8-flash';

export async function geminiJSON(input: unknown, instructions: string, schema: Record<string, unknown>, key: string, model: string, fetcher: typeof fetch = fetch) {
  // Each call shares its deadline with a single capacity fallback. The audit has its own call.
  const signal = AbortSignal.timeout(45_000);
  const send = (selectedModel: string) => fetcher(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selectedModel)}:generateContent`, {
    method: 'POST', signal,
    headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: instructions }] },
      contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
      generationConfig: { responseMimeType: 'application/json', responseJsonSchema: schema, maxOutputTokens: 16_384,
        ...(selectedModel.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'low' } } : {}) },
    }),
  });
  let response: Response;
  try {
    response = await send(model);
    if (response.status === 503 && model === geminiDefaultModel) {
      console.error(JSON.stringify({ event: 'gemini_capacity_fallback', from: model, to: 'gemini-3.7-flash' }));
      // Give transient capacity pressure time to settle; keep the original deadline.
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) { reject(new Error('Request deadline reached')); return; }
        const onAbort = () => { clearTimeout(timer); reject(new Error('Request deadline reached')); };
        const timer = setTimeout(() => { signal.removeEventListener('abort', onAbort); resolve(); }, 1000 + Math.floor(Math.random() * 500));
        signal.addEventListener('abort', onAbort, { once: true });
      });
      response = await send('gemini-3.7-flash');
    }
  } catch (error) {
    console.error(JSON.stringify({ event: 'gemini_transport_failed', kind: error instanceof Error ? error.name : 'unknown' }));
    throw Object.assign(new Error('AI request failed'), { code: 'ai_provider_failed' });
  }
  if (!response.ok) {
    const code = response.status === 503 ? 'ai_temporarily_unavailable'
      : response.status === 429 ? 'ai_rate_limited'
      : [401, 403].includes(response.status) ? 'ai_key_invalid'
      : response.status === 413 ? 'ai_request_too_large'
      : [400, 404, 422].includes(response.status) ? 'ai_request_rejected'
      : 'ai_provider_failed';
    // Never expose provider bodies, user wardrobe data, or the server key.
    console.error(JSON.stringify({ event: 'gemini_http_failed', status: response.status, code }));
    throw Object.assign(new Error('AI request failed'), { code });
  }
  const result = await response.json();
  const candidate = result.candidates?.[0];
  if (result.promptFeedback?.blockReason || candidate?.finishReason !== 'STOP' || !Array.isArray(candidate.content?.parts)) {
    console.error(JSON.stringify({ event: 'gemini_incomplete', finish_reason: candidate?.finishReason ?? 'none', blocked: !!result.promptFeedback?.blockReason }));
    throw Object.assign(new Error('Incomplete or blocked response'), { code: 'ai_invalid_response' });
  }
  const output = candidate.content.parts
    .filter((part: { thought?: boolean; text?: unknown }) => !part.thought && typeof part.text === 'string')
    .map((part: { text: string }) => part.text).join('');
  if (!output || output.length > 30_000) throw Object.assign(new Error('Invalid output'), { code: 'ai_invalid_response' });
  try { return JSON.parse(output) as unknown; }
  catch { throw Object.assign(new Error('Invalid JSON output'), { code: 'ai_invalid_response' }); }
}
export function geminiOutfitProvider(key: string, model = geminiDefaultModel) {
  return outfitProvider(key, model, geminiJSON);
}
