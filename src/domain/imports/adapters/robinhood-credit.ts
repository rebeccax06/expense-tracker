import type { TransactionImportAdapter, ImportContext } from "../adapter";
import { hasHeaders, col } from "../adapter";
import { matchesAutopay } from "../rules";
import { parseAmount, parseDate } from "@/lib/parsing";
import type { ParseResult, NormalizedTxnType } from "@/domain/transactions/types";

const REQUIRED = ["Date", "Amount", "Status", "Type", "Merchant", "Description"];

/**
 * Robinhood credit-card export.
 * Sign convention: positive Purchase = spending. Refund/Return/Credit reduce
 * spending. Payment rows are transfers. Merchant is used as the normalized
 * merchant; Description is preserved as the raw description.
 */
export const RobinhoodCreditAdapter: TransactionImportAdapter = {
  id: "robinhood_credit",
  label: "Robinhood Credit Card",
  requiredHeaders: REQUIRED,
  detect(headers) {
    return hasHeaders(headers, REQUIRED) && hasHeaders(headers, ["Points"]);
  },
  parseRow(row, ctx: ImportContext): ParseResult {
    const dateStr = parseDate(col(row, "Date"), ctx.config.dateFormat);
    const amount = parseAmount(col(row, "Amount"));
    const description = col(row, "Description");
    const merchant = col(row, "Merchant") || null;
    const bankType = col(row, "Type") || null;

    if (!dateStr) return { ok: false, error: "Invalid or missing Date" };
    if (amount === null) return { ok: false, error: "Invalid or missing Amount" };
    if (description === "" && !merchant)
      return { ok: false, error: "Missing Description and Merchant" };

    const warnings: string[] = [];
    const rawType = (bankType ?? "").toUpperCase();
    const suspectedTransfer =
      rawType === "PAYMENT" || matchesAutopay(description, ctx.config.autopayPatterns);

    let type: NormalizedTxnType;
    if (suspectedTransfer) {
      type = "transfer";
      warnings.push("Card payment / transfer — please review before excluding.");
    } else if (/(RETURN|REFUND|CREDIT)/.test(rawType) || amount < 0) {
      // Robinhood purchases are positive; a negative/refund reduces spending.
      type = "refund";
    } else {
      type = "expense";
    }

    return {
      ok: true,
      transactionDate: dateStr,
      postingDate: null,
      rawDescription: description || (merchant ?? ""),
      merchant,
      rawAmount: amount,
      normalizedSpendingAmount: Math.abs(amount),
      bankCategory: null,
      bankType,
      normalizedType: type,
      includeInSpending: true,
      warnings,
      suspectedTransfer,
    };
  },
};
