/**
 * Stable, environment-independent 128-bit hash (hex) used to identify a
 * transaction across re-imports. Deterministic and synchronous so it works in
 * both the browser (preview) and server (commit) without Web Crypto async.
 *
 * Implementation: two independent cyrb53 passes concatenated -> 26 hex chars.
 */
function cyrb53(str: string, seed: number): number {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

export function stableHash(input: string): string {
  const a = cyrb53(input, 0).toString(16).padStart(14, "0");
  const b = cyrb53(input, 0x9e3779b9).toString(16).padStart(14, "0");
  return `${a}${b}`;
}

function normalizeDescription(description: string): string {
  return description.replace(/\s+/g, " ").trim().toUpperCase();
}

export interface FingerprintInput {
  accountId: string;
  transactionDate: string; // ISO yyyy-mm-dd
  rawAmount: number;
  description: string;
  /** Disambiguates otherwise-identical rows in the same file. */
  occurrenceIndex: number;
}

/**
 * Deterministic identity for a normalized transaction. The occurrence index is
 * assigned by the importer per identical base-key within a file so that two
 * genuinely identical transactions on the same day don't collapse, while a
 * re-import of the same file reproduces the exact same fingerprints.
 */
export function computeFingerprint(input: FingerprintInput): string {
  const key = [
    input.accountId,
    input.transactionDate,
    input.rawAmount.toFixed(2),
    normalizeDescription(input.description),
    String(input.occurrenceIndex),
  ].join("|");
  return stableHash(key);
}

export { normalizeDescription };
