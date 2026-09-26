import { outfitProvider } from './openai.ts';
import { groqOutfitProvider } from './groq.ts';
export function configuredOutfitProvider(env: (name: string) => string | undefined) {
  const provider = env('OUTFIT_AI_PROVIDER')?.trim() || 'groq';
  if (provider !== 'groq' && provider !== 'openai') return null;
  const key = env(provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY')?.trim();
  if (!key) return null;
  // Provider-specific overrides prevent an old OpenAI model name reaching Groq.
  return provider === 'groq'
    ? groqOutfitProvider(key, env('GROQ_OUTFIT_MODEL')?.trim() || undefined)
    : outfitProvider(key, env('OUTFIT_RECOMMENDATION_MODEL')?.trim() || undefined);
}
