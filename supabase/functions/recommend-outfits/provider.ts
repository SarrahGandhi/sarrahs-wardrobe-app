import { geminiOutfitProvider } from './gemini.ts';
import { outfitProvider } from './openai.ts';
import { groqOutfitProvider } from './groq.ts';
export function configuredOutfitProvider(env: (name: string) => string | undefined) {
  const provider = env('OUTFIT_AI_PROVIDER')?.trim() || 'gemini';
  if (provider !== 'gemini' && provider !== 'groq' && provider !== 'openai') return null;
  const key = env(provider === 'gemini' ? 'GEMINI_API_KEY' : provider === 'groq' ? 'GROQ_API_KEY' : 'OPENAI_API_KEY')?.trim();
  if (!key) return null;
  if (provider === 'gemini') return geminiOutfitProvider(key, env('GEMINI_OUTFIT_MODEL')?.trim() || undefined);
  // Provider-specific overrides prevent an old OpenAI model name reaching Groq.
  return provider === 'groq'
    ? groqOutfitProvider(key, env('GROQ_OUTFIT_MODEL')?.trim() || undefined)
    : outfitProvider(key, env('OUTFIT_RECOMMENDATION_MODEL')?.trim() || undefined);
}
