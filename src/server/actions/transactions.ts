"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, type ActionResult } from "@/server/action-context";
import { overrideSchema } from "@/lib/validation/schemas";

type OverrideFields = {
  user_category_id?: string | null;
  trip_id?: string | null;
  location?: string | null;
  notes?: string | null;
  include_override?: boolean | null;
  type_override?:
    | "expense"
    | "refund"
    | "transfer"
    | "income"
    | "adjustment"
    | null;
};

/**
 * Apply a manual override to one or more transactions (bulk edit). Overrides
 * live in their own table keyed by fingerprint so re-imports never destroy
 * them. Only the fields present in `patch` are changed; existing values for
 * other fields are preserved.
 */
export async function applyOverrides(
  fingerprints: string[],
  patch: OverrideFields,
): Promise<ActionResult> {
  const parsed = overrideSchema.safeParse({ fingerprints, ...patch });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { supabase, userId } = await getActionContext();

  // Only mutate keys explicitly provided by the caller.
  const patchKeys = (Object.keys(patch) as (keyof OverrideFields)[]).filter(
    (k) => patch[k] !== undefined,
  );
  if (patchKeys.length === 0) return { ok: true };

  const { data: existing, error: fetchError } = await supabase
    .from("transaction_overrides")
    .select("*")
    .in("fingerprint", parsed.data.fingerprints);
  if (fetchError) return { ok: false, error: fetchError.message };

  const byFp = new Map(existing?.map((o) => [o.fingerprint, o]) ?? []);

  const rows = parsed.data.fingerprints.map((fp) => {
    const prev = byFp.get(fp);
    const base = {
      user_id: userId,
      fingerprint: fp,
      user_category_id: prev?.user_category_id ?? null,
      trip_id: prev?.trip_id ?? null,
      location: prev?.location ?? null,
      notes: prev?.notes ?? null,
      include_override: prev?.include_override ?? null,
      type_override: prev?.type_override ?? null,
    };
    for (const k of patchKeys) {
      // @ts-expect-error index assignment across the union is safe here.
      base[k] = patch[k];
    }
    return base;
  });

  const { error } = await supabase
    .from("transaction_overrides")
    .upsert(rows, { onConflict: "user_id,fingerprint" });
  if (error) return { ok: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  return { ok: true };
}
