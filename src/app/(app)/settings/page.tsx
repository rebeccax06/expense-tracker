import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth/user";
import { listFormats } from "@/server/queries/lookups";
import { SettingsClient } from "@/features/settings/settings-client";
import type { ReimbursementBehavior, ThemePref } from "@/lib/supabase/database.types";

export default async function SettingsPage() {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: profile }, formats, { data: mappings }] = await Promise.all([
    supabase.from("profiles").select("reimbursement_behavior,theme").eq("id", user.id).single(),
    listFormats(),
    supabase.from("import_format_mappings").select("*"),
  ]);

  const mappingsByFormat: Record<string, { source_column: string; target_field: string }[]> = {};
  for (const m of mappings ?? []) {
    (mappingsByFormat[m.format_id] ??= []).push({
      source_column: m.source_column,
      target_field: m.target_field,
    });
  }

  return (
    <SettingsClient
      email={user.email ?? ""}
      reimbursement={(profile?.reimbursement_behavior as ReimbursementBehavior) ?? "income"}
      theme={(profile?.theme as ThemePref) ?? "system"}
      formats={formats}
      mappingsByFormat={mappingsByFormat}
    />
  );
}
