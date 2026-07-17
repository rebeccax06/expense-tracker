import type { NormalizedTxnType } from "@/lib/supabase/database.types";

export interface EffectiveInput {
  normalized_spending_amount: number;
  normalized_type: NormalizedTxnType;
  include_in_spending: boolean;
}

export interface OverrideInput {
  type_override?: NormalizedTxnType | null;
  include_override?: boolean | null;
}

/**
 * The single source of truth for how a transaction contributes to spending
 * reports, with user overrides applied on top of imported values.
 *
 * Rules (documented financial logic):
 *   - include = false            -> 0 (never counted)
 *   - transfer / income          -> 0 (excluded from expense reports)
 *   - refund                     -> negative (reduces spending)
 *   - expense                    -> positive (adds to spending)
 *   - adjustment                 -> signed as imported
 *
 * We derive the sign from the resolved type (not just the stored amount) so
 * that re-classifying a row via override behaves intuitively.
 */
export function effectiveSpending(
  txn: EffectiveInput,
  override?: OverrideInput | null,
): number {
  const include = override?.include_override ?? txn.include_in_spending;
  if (!include) return 0;

  const type = override?.type_override ?? txn.normalized_type;
  const amount = txn.normalized_spending_amount;

  switch (type) {
    case "transfer":
    case "income":
      return 0;
    case "refund":
      return -Math.abs(amount);
    case "expense":
      return Math.abs(amount);
    case "adjustment":
      return amount;
    default:
      return amount;
  }
}

export function resolveType(
  txn: EffectiveInput,
  override?: OverrideInput | null,
): NormalizedTxnType {
  return override?.type_override ?? txn.normalized_type;
}

export function resolveInclude(
  txn: EffectiveInput,
  override?: OverrideInput | null,
): boolean {
  return override?.include_override ?? txn.include_in_spending;
}
