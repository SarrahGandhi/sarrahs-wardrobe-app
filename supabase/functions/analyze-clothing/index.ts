import { createClient } from 'npm:@supabase/supabase-js@2.108.2';
import { createAnalysisHandler } from './handler.ts';
import { analyzeWithOpenAI } from './openai.ts';

Deno.serve(createAnalysisHandler({
  configured: () => !!Deno.env.get('OPENAI_API_KEY'),
  authenticate: async (token) => {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Validate with Supabase Auth, never trust an unverified JWT decode or supplied user_id.
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return null;
    return {
      userId: user.id,
      consumeQuota: async () => {
        const { data, error } = await client.rpc('consume_clothing_analysis_quota');
        if (error) throw error;
        return data === true;
      },
      download: async (path) => {
        // Caller-scoped client retains Storage RLS. No service-role bypass.
        const { data, error } = await client.storage.from('wardrobe-images').download(path);
        return error ? null : data;
      },
    };
  },
  analyze: (image) => analyzeWithOpenAI(image, Deno.env.get('OPENAI_API_KEY')!, Deno.env.get('CLOTHING_ANALYSIS_MODEL') || undefined),
}));
