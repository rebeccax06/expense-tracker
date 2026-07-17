import type { TransactionImportAdapter, ImportContext } from "./adapter";
import { hasHeaders, col } from "./adapter";
import { matchesAutopay } from "./rules";
import { parseAmount, parseDate } from "@/lib/parsing";
import type { ParseResult, NormalizedTxnType } from "@/domain/transactions/types";

export interface FieldMapping {
  source_column: string;
  target_field: string; // transaction_date | posting_date | description | merchant | amount | bank_category | bank_type | ignore
}

export interface GenericFormatSpec {
  id: string;
  name: string;
  headerSignature: string[];
  mappings: FieldMapping[];
}

const ASSET_ACCOUNTS = new Set(["checking", "debit_card", "savings", "cash"]);

/**
 * Builds an adapter from a user-defined column mapping. This is what makes the
 * system extensible without code changes: a user uploads a new export, chooses
 * which columns map to which normalized fields and the spending-sign
 * convention, saves it as a template, and future imports reuse it.
 */
export function createGenericAdapter(
  spec: GenericFormatSpec,
): TransactionImportAdapter {
  const find = (target: string) =>
    spec.mappings.find((m) => m.target_field === target)?.source_column ?? null;

  const dateCol = find("transaction_date");
  const postCol = find("posting_date");
  const descCol = find("description");
  const merchantCol = find("merchant");
  const amountCol = find("amount");
  const bankCatCol = find("bank_category");
  const bankTypeCol = find("bank_type");

  return {
    id: `generic:${spec.id}`,
    label: spec.name,
    requiredHeaders: spec.headerSignature,
    detect(headers) {
      return (
        spec.headerSignature.length > 0 &&
        hasHeaders(headers, spec.headerSignature)
      );
    },
    parseRow(row, ctx: ImportContext): ParseResult {
      if (!dateCol) return { ok: false, error: "Format has no date mapping" };
      if (!amountCol) return { ok: false, error: "Format has no amount mapping" };

      const dateStr = parseDate(col(row, dateCol), ctx.config.dateFormat);
      const amount = parseAmount(col(row, amountCol));
      const description = descCol ? col(row, descCol) : "";
      const merchant = merchantCol ? col(row, merchantCol) || null : null;

      if (!dateStr) return { ok: false, error: "Invalid or missing date" };
      if (amount === null) return { ok: false, error: "Invalid or missing amount" };
      if (description === "" && !merchant)
        return { ok: false, error: "Missing description" };

      const warnings: string[] = [];
      const effectiveDesc = description || (merchant ?? "");
      const suspectedTransfer = matchesAutopay(
        effectiveDesc,
        ctx.config.autopayPatterns,
      );

      const spendingIsNegative = ctx.purchaseSign === "negative_is_spending";
      const isSpendingSign = spendingIsNegative ? amount < 0 : amount > 0;

      let type: NormalizedTxnType;
      if (suspectedTransfer) {
        type = "transfer";
        warnings.push("Matches an autopay/transfer pattern — please review.");
      } else if (amount === 0) {
        type = "adjustment";
      } else if (isSpendingSign) {
        type = "expense";
      } else {
        // Incoming money: income for asset accounts, refund for credit cards.
        type = ASSET_ACCOUNTS.has(ctx.accountType) ? "income" : "refund";
      }

      return {
        ok: true,
        transactionDate: dateStr,
        postingDate: postCol ? parseDate(col(row, postCol), ctx.config.dateFormat) : null,
        rawDescription: effectiveDesc,
        merchant,
        rawAmount: amount,
        normalizedSpendingAmount:
          type === "adjustment" ? amount : Math.abs(amount),
        bankCategory: bankCatCol ? col(row, bankCatCol) || null : null,
        bankType: bankTypeCol ? col(row, bankTypeCol) || null : null,
        normalizedType: type,
        includeInSpending: true,
        warnings,
        suspectedTransfer,
      };
    },
  };
}
