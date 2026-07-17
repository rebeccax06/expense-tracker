import "server-only";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_FORMATS } from "@/domain/imports/default-formats";

/**
 * Seeds the three known import formats (and their column mappings) for a user
 * the first time they use the app. Idempotent: does nothing if the user
 * already has any import formats.
 */
export async function ensureDefaultFormats(userId: string): Promise<void> {
  const supabase = await createClient();

  const { count, error: countError } = await supabase
    .from("import_formats")
    .select("id", { count: "exact", head: true });

  if (countError) throw countError;
  if ((count ?? 0) > 0) return;

  for (const fmt of DEFAULT_FORMATS) {
    const { data: inserted, error } = await supabase
      .from("import_formats")
      .insert({
        user_id: userId,
        name: fmt.name,
        institution: fmt.institution,
        strategy: fmt.strategy,
        header_signature: fmt.header_signature,
        sign_convention: fmt.sign_convention,
        config: fmt.config,
      })
      .select("id")
      .single();

    if (error) throw error;

    if (fmt.mappings.length > 0) {
      const { error: mapError } = await supabase.from("import_format_mappings").insert(
        fmt.mappings.map((m) => ({
          user_id: userId,
          format_id: inserted.id,
          source_column: m.source_column,
          target_field: m.target_field,
          position: m.position,
        })),
      );
      if (mapError) throw mapError;
    }
  }
}
