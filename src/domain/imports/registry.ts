import type { TransactionImportAdapter } from "./adapter";
import { ChaseDebitAdapter } from "./adapters/chase-debit";
import { ChaseCreditAdapter } from "./adapters/chase-credit";
import { RobinhoodCreditAdapter } from "./adapters/robinhood-credit";
import { createGenericAdapter, type FieldMapping } from "./generic-mapping";
import type { ImportStrategy } from "@/lib/supabase/database.types";

/** Code-defined adapters for the known formats, keyed by strategy. */
export const BUILTIN_ADAPTERS: Record<
  Exclude<ImportStrategy, "generic">,
  TransactionImportAdapter
> = {
  chase_debit: ChaseDebitAdapter,
  chase_credit: ChaseCreditAdapter,
  robinhood_credit: RobinhoodCreditAdapter,
};

export interface FormatLike {
  id: string;
  name: string;
  strategy: ImportStrategy;
  header_signature: string[];
}

/**
 * Resolve the adapter for a stored import format. Known strategies use the
 * typed, tested built-in adapters; "generic" formats build a config-driven
 * adapter from their column mappings.
 */
export function resolveAdapter(
  format: FormatLike,
  mappings: FieldMapping[] = [],
): TransactionImportAdapter {
  if (format.strategy === "generic") {
    return createGenericAdapter({
      id: format.id,
      name: format.name,
      headerSignature: format.header_signature,
      mappings,
    });
  }
  return BUILTIN_ADAPTERS[format.strategy];
}

/**
 * Attempt to auto-detect which of the user's formats matches a file's headers.
 * Built-in adapters are tried first (most specific), then generic formats by
 * header-signature overlap. Returns the best matching format id or null.
 */
export function detectFormat(
  headers: string[],
  formats: Array<FormatLike & { mappings?: FieldMapping[] }>,
): string | null {
  // Prefer a built-in adapter match.
  for (const fmt of formats) {
    if (fmt.strategy !== "generic") {
      const adapter = BUILTIN_ADAPTERS[fmt.strategy];
      if (adapter?.detect(headers)) return fmt.id;
    }
  }
  // Then generic formats: require full header-signature match, pick the one
  // with the most specific (largest) signature.
  const generic = formats
    .filter((f) => f.strategy === "generic")
    .map((f) => ({ f, adapter: resolveAdapter(f, f.mappings ?? []) }))
    .filter(({ adapter }) => adapter.detect(headers))
    .sort((a, b) => b.f.header_signature.length - a.f.header_signature.length);

  return generic[0]?.f.id ?? null;
}
