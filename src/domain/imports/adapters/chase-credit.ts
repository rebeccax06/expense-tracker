import type { TransactionImportAdapter, ImportContext } from "../adapter";
import { hasHeaders, col } from "../adapter";
import { matchesAutopay } from "../rules";
import { parseAmount, parseDate } from "@/lib/parsing";
import type { ParseResult, NormalizedTxnType } from "@/domain/transactions/types";

const REQUIRED = [
  "Transaction Date",
  "Post Date",
  "Description",
  "Type",
  "Amount",
];

/**
 * Chase credit-card export (shared by both Chase credit cards; the account is
 * chosen at import time).
 * Sign convention: negative Sale = spending, positive Return/Refund reduces
 * spending. Payment rows are transfers. Bank Category is imported but never
 * overrides a user-assigned category.
 */
export const ChaseCreditAdapter: TransactionImportAdapter = {
  id: "chase_credit",
  label: "Chase Credit Card",
  requiredHeaders: REQUIRED,
  detect(headers) {
    // Distinguish from debit by presence of "Post Date" + "Category".
    return hasHeaders(headers, REQUIRED) && hasHeaders(headers, ["Category"]);
  },
  parseRow(row, ctx: ImportContext): ParseResult {
    const dateStr = parseDate(col(row, "Transaction Date"), ctx.config.dateFormat);
    const postStr = parseDate(col(row, "Post Date"), ctx.config.dateFormat);
    const amount = parseAmount(col(row, "Amount"));
    const description = col(row, "Description");
    const bankType = col(row, "Type") || null;
    const bankCategory = col(row, "Category") || null;

    if (!dateStr) return { ok: false, error: "Invalid or missing Transaction Date" };
    if (amount === null) return { ok: false, error: "Invalid or missing Amount" };
    if (description === "") return { ok: false, error: "Missing Description" };

    const warnings: string[] = [];
    const rawType = (bankType ?? "").toUpperCase();
    const suspectedTransfer =
      rawType === "PAYMENT" || matchesAutopay(description, ctx.config.autopayPatterns);

    let type: NormalizedTxnType;
    if (suspectedTransfer) {
      type = "transfer";
      warnings.push("Card payment / transfer — please review before excluding.");
    } else if (/(RETURN|REFUND|CREDIT)/.test(rawType) || amount > 0) {
      type = "refund";
    } else {
      type = "expense";
    }

    return {
      ok: true,
      transactionDate: dateStr,
      postingDate: postStr,
      rawDescription: description,
      merchant: null,
      rawAmount: amount,
      normalizedSpendingAmount: Math.abs(amount),
      bankCategory,
      bankType,
      normalizedType: type,
      includeInSpending: true,
      warnings,
      suspectedTransfer,
    };
  },
};
