import * as Linking from "expo-linking";
import { requireSupabase } from "@/services/supabase/client";

export function authRedirectUrl(recovery = false) {
  return Linking.createURL("auth/callback", {
    queryParams: recovery ? { recovery: "1" } : undefined,
  });
}
export async function signIn(email: string, password: string) {
  const { error } = await requireSupabase().auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}
export async function signUp(
  displayName: string,
  email: string,
  password: string,
) {
  const { data, error } = await requireSupabase().auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { display_name: displayName.trim() },
      emailRedirectTo: authRedirectUrl(),
    },
  });
  if (error) throw error;
  return { confirmationRequired: !data.session };
}
export async function resendConfirmation(email: string) {
  const { error } = await requireSupabase().auth.resend({
    type: "signup",
    email: email.trim(),
    options: { emailRedirectTo: authRedirectUrl() },
  });
  if (error) throw error;
}
export async function requestPasswordReset(email: string) {
  const { error } = await requireSupabase().auth.resetPasswordForEmail(
    email.trim(),
    { redirectTo: authRedirectUrl(true) },
  );
  if (error) throw error;
}
export async function updatePassword(password: string) {
  const { error } = await requireSupabase().auth.updateUser({ password });
  if (error) throw error;
}
export async function signOut() {
  const { error } = await requireSupabase().auth.signOut({ scope: "local" });
  if (error) throw error;
}

export async function verifyEmailCode(
  email: string,
  token: string,
  type: "signup" | "recovery",
) {
  const { error } = await requireSupabase().auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type,
  });
  if (error) throw error;
}
