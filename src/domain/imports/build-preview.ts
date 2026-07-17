import type { TransactionImportAdapter, ImportContext } from "./adapter";
import type { ParsedFile } from "./parse-file";
import type { ParsedTransaction } from "@/domain/transactions/types";
import { computeFingerprint, normalizeDescription } from "@/domain/transactions/fingerprint";

export interface PreviewRow {
  rowNumber: number;
  raw: Record<string, string>;
  parsed: ParsedTransaction | null;
  error: string | null;
  fingerprint: string | null;
  duplicateInDb: boolean;
}

export interface PreviewSummary {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  suspectedTransfers: number;
  refunds: number;
  transfers: number;
  income: number;
}

export interface ImportPreview {
  rows: PreviewRow[];
  summary: PreviewSummary;
}

export interface BuildPreviewArgs {
  file: ParsedFile;
  adapter: TransactionImportAdapter;
  ctx: ImportContext;
  /** Fingerprints already committed for this user (for duplicate detection). */
  existingFingerprints: ReadonlySet<string>;
}

/**
 * Convert a parsed file into a normalized preview. Pure and deterministic:
 * assigns per-file occurrence indices so identical rows stay distinct while a
 * re-import reproduces the same fingerprints, and flags rows already present
 * in the database as duplicates.
 */
export function buildPreview({
  file,
  adapter,
  ctx,
  existingFingerprints,
}: BuildPreviewArgs): ImportPreview {
  const occurrences = new Map<string, number>();
  const rows: PreviewRow[] = [];

  const summary: PreviewSummary = {
    total: file.rows.length,
    valid: 0,
    invalid: 0,
    duplicates: 0,
    suspectedTransfers: 0,
    refunds: 0,
    transfers: 0,
    income: 0,
  };

  file.rows.forEach((raw, idx) => {
    const rowNumber = idx + 1;
    const result = adapter.parseRow(raw, ctx);

    if (!result.ok) {
      summary.invalid += 1;
      rows.push({
        rowNumber,
        raw,
        parsed: null,
        error: result.error,
        fingerprint: null,
        duplicateInDb: false,
      });
      return;
    }

    const parsed: ParsedTransaction = { ...result };
    const baseKey = [
      ctx.accountId,
      parsed.transactionDate,
      parsed.rawAmount.toFixed(2),
      normalizeDescription(parsed.rawDescription),
    ].join("|");
    const occurrenceIndex = occurrences.get(baseKey) ?? 0;
    occurrences.set(baseKey, occurrenceIndex + 1);

    const fingerprint = computeFingerprint({
      accountId: ctx.accountId,
      transactionDate: parsed.transactionDate,
      rawAmount: parsed.rawAmount,
      description: parsed.rawDescription,
      occurrenceIndex,
    });

    const duplicateInDb = existingFingerprints.has(fingerprint);

    summary.valid += 1;
    if (duplicateInDb) summary.duplicates += 1;
    if (parsed.suspectedTransfer) summary.suspectedTransfers += 1;
    if (parsed.normalizedType === "refund") summary.refunds += 1;
    if (parsed.normalizedType === "transfer") summary.transfers += 1;
    if (parsed.normalizedType === "income") summary.income += 1;

    rows.push({
      rowNumber,
      raw,
      parsed,
      error: null,
      fingerprint,
      duplicateInDb,
    });
  });

  return { rows, summary };
}
