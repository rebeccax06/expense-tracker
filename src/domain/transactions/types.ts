import type { NormalizedTxnType } from "@/lib/supabase/database.types";

export type { NormalizedTxnType };

export const NORMALIZED_TXN_TYPES: readonly NormalizedTxnType[] = [
  "expense",
  "refund",
  "transfer",
  "income",
  "adjustment",
] as const;

/**
 * Result of an adapter parsing a single raw row into normalized shape.
 * `normalizedSpendingAmount` uses the convention: positive = spending,
 * negative = reduces spending. The reporting layer converts this to an
 * "effective" amount based on the (possibly overridden) type.
 */
export interface ParsedTransaction {
  transactionDate: string; // ISO yyyy-mm-dd
  postingDate: string | null;
  rawDescription: string;
  merchant: string | null;
  rawAmount: number;
  normalizedSpendingAmount: number;
  bankCategory: string | null;
  bankType: string | null;
  normalizedType: NormalizedTxnType;
  includeInSpending: boolean;
  /** Non-fatal notes surfaced during import review. */
  warnings: string[];
  /**
   * True when a description pattern suggests this is a card autopay/transfer.
   * The UI must require explicit review before excluding these.
   */
  suspectedTransfer: boolean;
}

export interface ParseFailure {
  ok: false;
  error: string;
}

export type ParseResult =
  | ({ ok: true } & ParsedTransaction)
  | ParseFailure;
