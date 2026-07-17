import type {
  ImportFormatConfig,
  SignConvention,
  AccountType,
  ReimbursementBehavior,
} from "@/lib/supabase/database.types";
import type { ParseResult } from "@/domain/transactions/types";

/** Everything an adapter needs beyond a single row to normalize it. */
export interface ImportContext {
  accountId: string;
  accountType: AccountType;
  /** Which raw sign indicates an outgoing purchase for this account. */
  purchaseSign: SignConvention;
  config: ImportFormatConfig;
  /** How incoming money on non-credit accounts is treated by default. */
  reimbursementBehavior: ReimbursementBehavior;
}

/**
 * Contract every import adapter implements. Adapters are PURE functions:
 * given a row and context they must return a deterministic result and never
 * perform IO. Malformed rows return { ok: false } rather than throwing.
 */
export interface TransactionImportAdapter {
  id: string;
  label: string;
  /** Column headers that must be present for this adapter to apply. */
  requiredHeaders: string[];
  /** Header-signature match used for auto-detection. */
  detect(headers: string[]): boolean;
  parseRow(row: Record<string, string>, ctx: ImportContext): ParseResult;
}

/** Case-insensitive check that every required header is present. */
export function hasHeaders(
  headers: string[],
  required: string[],
): boolean {
  const norm = new Set(headers.map((h) => h.trim().toLowerCase()));
  return required.every((r) => norm.has(r.trim().toLowerCase()));
}

/** Read a column case-insensitively (bank exports vary in casing/spacing). */
export function col(
  row: Record<string, string>,
  name: string,
): string {
  const target = name.trim().toLowerCase();
  for (const key of Object.keys(row)) {
    if (key.trim().toLowerCase() === target) {
      return (row[key] ?? "").trim();
    }
  }
  return "";
}
