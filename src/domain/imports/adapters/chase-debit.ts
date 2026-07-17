import type { TransactionImportAdapter, ImportContext } from "../adapter";
import { hasHeaders, col } from "../adapter";
import { matchesAutopay } from "../rules";
import { parseAmount, parseDate } from "@/lib/parsing";
import type { ParseResult, NormalizedTxnType } from "@/domain/transactions/types";

const REQUIRED = ["Details", "Posting Date", "Description", "Amount", "Type"];

/**
 * Chase debit / checking export.
 * Sign convention: negative Amount = outgoing (spending), positive = incoming.
 * Incoming money defaults to the user's reimbursement behavior (income/refund).
 * Autopay descriptions are flagged as suspected transfers for review.
 */
export const ChaseDebitAdapter: TransactionImportAdapter = {
  id: "chase_debit",
  label: "Chase Debit / Checking",
  requiredHeaders: REQUIRED,
  detect(headers) {
    return hasHeaders(headers, REQUIRED) && hasHeaders(headers, ["Balance"]);
  },
  parseRow(row, ctx: ImportContext): ParseResult {
    const dateStr = parseDate(col(row, "Posting Date"), ctx.config.dateFormat);
    const amount = parseAmount(col(row, "Amount"));
    const description = col(row, "Description");
    const bankType = col(row, "Type") || null;

    if (!dateStr) return { ok: false, error: "Invalid or missing Posting Date" };
    if (amount === null) return { ok: false, error: "Invalid or missing Amount" };
    if (description === "") return { ok: false, error: "Missing Description" };

    const warnings: string[] = [];
    const suspectedTransfer = matchesAutopay(
      description,
      ctx.config.autopayPatterns,
    );

    let type: NormalizedTxnType;
    if (suspectedTransfer) {
      type = "transfer";
      warnings.push("Matches an autopay/transfer pattern — please review.");
    } else if (amount < 0) {
      type = "expense";
    } else if (amount > 0) {
      type = ctx.reimbursementBehavior === "refund" ? "refund" : "income";
    } else {
      type = "adjustment";
    }

    return {
      ok: true,
      transactionDate: dateStr,
      postingDate: dateStr,
      rawDescription: description,
      merchant: null,
      rawAmount: amount,
      normalizedSpendingAmount:
        type === "adjustment" ? amount : Math.abs(amount),
      bankCategory: null,
      bankType,
      normalizedType: type,
      includeInSpending: true,
      warnings,
      suspectedTransfer,
    };
  },
};
