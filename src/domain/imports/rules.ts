/**
 * Card-autopay / internal-transfer detection.
 *
 * These patterns only FLAG a row as a suspected transfer. Per product
 * requirements the importer must never auto-exclude them; the user reviews and
 * confirms during the import step. Patterns live in the format config so they
 * are configurable rather than hardcoded in UI.
 */
export const DEFAULT_AUTOPAY_PATTERNS: readonly string[] = [
  "CHASE CREDIT CRD AUTOPAY",
  "CREDIT CARD AUTOPAY",
  "ROBINHOOD CARD PAYMENT",
  "ROBINHOOD CARD AUTOPAY",
];

export function matchesAutopay(
  description: string,
  patterns: readonly string[] = DEFAULT_AUTOPAY_PATTERNS,
): boolean {
  const haystack = description.toUpperCase();
  return patterns.some((p) => p.trim() !== "" && haystack.includes(p.toUpperCase()));
}
