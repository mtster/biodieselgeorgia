/**
 * Sanitizes search terms for PostgREST .or() queries and URI filters.
 * Removes characters that conflict with PostgREST logic tree syntax:
 * commas, quotes, parentheses, brackets, braces, colons, semicolons, backslashes, percent signs.
 */
export function sanitizePostgrestSearchTerm(raw: string | undefined | null): string {
  if (!raw) return '';
  return String(raw)
    .replace(/[,()"'\\\[\]{}%:;]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
