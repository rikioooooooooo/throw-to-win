/**
 * Sanitize a user-provided display name.
 */
export function sanitizeDisplayName(input: string): string {
  return input
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\t\n\r]/g, " ")
    .trim()
    .slice(0, 20);
}

export const NAME_PATTERN = /^[\p{L}\p{N}\p{M}\s._-]+$/u;
export const MAX_NAME_LENGTH = 20;

export function validateDisplayName(name: string): null | "empty" | "too_long" | "invalid_chars" {
  if (name.length === 0) return "empty";
  if (name.length > MAX_NAME_LENGTH) return "too_long";
  if (!NAME_PATTERN.test(name)) return "invalid_chars";
  return null;
}
