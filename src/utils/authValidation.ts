export function validateEmail(email: string): string | null {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? null
    : "Enter a valid email address.";
}
export function validatePassword(password: string): string | null {
  return password.length >= 8
    ? null
    : "Use at least 8 characters for your password.";
}
export function authErrorMessage(error: unknown): string {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? String(error.code)
      : "";
  if (code === "invalid_credentials")
    return "The email or password is incorrect.";
  if (code === "email_not_confirmed")
    return "Confirm your email before signing in. You can resend the email below.";
  if (
    code === "over_email_send_rate_limit" ||
    code === "over_request_rate_limit"
  )
    return "Too many requests. Please wait a moment and try again.";
  if (code === "otp_expired" || code === "otp_disabled")
    return "That code is invalid or expired. Request a new email and try again.";
  if (code === "same_password")
    return "Choose a password you haven’t used before.";
  if (code === "weak_password")
    return "Choose a stronger password with a mix of letters, numbers, and symbols.";
  return "We couldn’t complete that request. Check your connection and try again.";
}
