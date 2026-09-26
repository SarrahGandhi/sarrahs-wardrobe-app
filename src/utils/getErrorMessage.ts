/** Only use with errors whose messages are appropriate to display to users. */
export function getErrorMessage(
  error: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  return error instanceof Error && error.message.trim()
    ? error.message
    : fallback;
}
