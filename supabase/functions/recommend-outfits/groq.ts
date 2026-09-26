import { outfitProvider } from './openai.ts';
export const groqDefaultModel = 'openai/gpt-oss-120b';
async function waitForRetry(ms: number, signal: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}
export async function groqJSON(input: unknown, instructions: string, schema: Record<string, unknown>, key: string, model: string, fetcher: typeof fetch = fetch, wait = waitForRetry) {
  const started = Date.now();
  const signal = AbortSignal.timeout(40_000);
  const send = () => fetcher('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST', signal,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, max_completion_tokens: 4500, reasoning_effort: 'low',
      messages: [{ role: 'system', content: instructions }, { role: 'user', content: JSON.stringify(input) }],
      response_format: { type: 'json_schema', json_schema: { name: 'outfit_response', strict: true, schema } },
    }),
  });
  let response = await send();
  let schemaFailure = false;
  let retriedSchema = false;
  let retriedRateLimit = false;
  // Both retries share the original 40-second deadline. Daily limits and long
  // waits return immediately; invalid outputs never bypass validation.
  while (!response.ok) {
    schemaFailure = false;
    if (response.status === 400) {
      const failure = await response.clone().json().catch(() => null);
      schemaFailure = failure?.error?.code === 'json_validate_failed';
      if (schemaFailure && !retriedSchema) {
        retriedSchema = true;
        console.error(JSON.stringify({ event: 'groq_schema_retry', attempt: 1 }));
        response = await send();
        continue;
      }
    }
    if (response.status === 429 && !retriedRateLimit) {
      const retryAfter = response.headers.get('retry-after');
      const seconds = retryAfter === null ? NaN : Number(retryAfter);
      const delay = Math.ceil(seconds * 1000) + 250;
      if (Number.isFinite(seconds) && seconds >= 0 && delay <= 25_000 && Date.now() - started + delay < 35_000) {
        retriedRateLimit = true;
        console.error(JSON.stringify({ event: 'groq_rate_limit_retry', delay_ms: delay }));
        await wait(delay, signal);
        response = await send();
        continue;
      }
    }
    break;
  }
  if (!response.ok) {
    const code = schemaFailure ? 'ai_invalid_response' : response.status === 429 ? 'ai_rate_limited'
      : [401, 403].includes(response.status) ? 'ai_key_invalid'
      : response.status === 413 ? 'ai_request_too_large'
      : [400, 404, 422].includes(response.status) ? 'ai_request_rejected'
      : 'ai_provider_failed';
    // Log only safe diagnostics, never request content or provider error bodies.
    console.error(JSON.stringify({ event: 'groq_request_failed', status: response.status, code }));
    throw Object.assign(new Error('AI request failed'), { code });
  }
  const result = await response.json();
  const choice = result.choices?.[0];
  if (choice?.finish_reason !== 'stop' || choice.message?.refusal) throw new Error('Incomplete or refused response');
  const output = choice.message?.content;
  if (typeof output !== 'string' || !output || output.length > 30_000) throw new Error('Invalid output');
  return JSON.parse(output) as unknown;
}
export function groqOutfitProvider(key: string, model = groqDefaultModel) {
  return outfitProvider(key, model, groqJSON);
}
