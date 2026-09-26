import { createClient } from 'npm:@supabase/supabase-js@2.108.2';
import { attributes, type OutfitItem } from '../_shared/outfitRecommendations.ts';
import { createOutfitHandler } from './handler.ts';
import { configuredOutfitProvider } from './provider.ts';
const provider = () => configuredOutfitProvider(name => Deno.env.get(name));
Deno.serve(createOutfitHandler({
  configured: () => provider() !== null,
  authenticate: async token => {
    const client = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: `Bearer ${token}` }, fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: { user }, error } = await client.auth.getUser(token);
    if (error || !user) return null;
    return {
      wardrobe: async () => {
        const { data, error } = await client.from('wardrobe_items').select(attributes.join(','))
          .eq('user_id', user.id).is('archived_at', null).order('id').limit(501);
        if (error || !data || data.length > 500) throw new Error('Wardrobe unavailable or too large');
        return data as unknown as OutfitItem[];
      },
      consumeQuota: async () => {
        const { data, error } = await client.rpc('consume_outfit_recommendation_quota');
        if (error) throw error;
        return data === true;
      },
    };
  },
  generate: request => provider()!.generate(request),
  audit: (request, result) => provider()!.audit(request, result),
}));
