import "react-native-url-polyfill/auto";
import "@/services/auth/pkceCrypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, processLock } from "@supabase/supabase-js";
import { Platform } from "react-native";
import type { Database } from "@/types/database";

const url =
  (Platform.OS === "android" &&
    process.env.EXPO_PUBLIC_SUPABASE_ANDROID_URL?.trim()) ||
  process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

function configurationError(): string | null {
  if (!url || !key)
    return "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env, then restart Expo.";
  try {
    if (!["https:", "http:"].includes(new URL(url).protocol)) throw new Error();
  } catch {
    return "The Supabase project URL is invalid.";
  }
  if (key.startsWith("sb_publishable_")) return null;
  // Local Supabase also exposes the legacy anon JWT. Reject privileged keys.
  try {
    const payload = key.split(".")[1];
    if (
      payload &&
      JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).role ===
        "anon"
    )
      return null;
  } catch {
    /* Return a configuration error without exposing the supplied key. */
  }
  return "Use a public publishable key or legacy anon key. Secret and service-role keys are not allowed.";
}
export const supabaseConfigurationError = configurationError();
export const supabase =
  !supabaseConfigurationError && url && key
    ? createClient<Database>(url, key, {
        auth: {
          ...(Platform.OS !== "web"
            ? { storage: AsyncStorage, lock: processLock }
            : {}),
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
          flowType: "pkce",
        },
      })
    : null;

export function requireSupabase() {
  if (!supabase)
    throw new Error(
      supabaseConfigurationError ?? "Supabase is not configured.",
    );
  return supabase;
}
