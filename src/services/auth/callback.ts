import { requireSupabase } from "@/services/supabase/client";

// React effects may mount twice. A PKCE code must only be exchanged once.
let exchange:
  | { code: string; promise: ReturnType<typeof exchangeCode> }
  | undefined;
async function exchangeCode(code: string) {
  const { data, error } =
    await requireSupabase().auth.exchangeCodeForSession(code);
  if (error) throw error;
  if (!data.session) throw new Error("No session was returned.");
  return data.session;
}
export function completeAuthCallback(code: string) {
  if (exchange?.code === code)
    return exchange.promise.then(async (session) => {
      const current = await requireSupabase().auth.getSession();
      if (current.error || current.data.session?.user.id !== session.user.id)
        throw new Error("This link has already been used.");
      return session;
    });
  const promise = exchangeCode(code);
  exchange = { code, promise };
  return promise;
}
