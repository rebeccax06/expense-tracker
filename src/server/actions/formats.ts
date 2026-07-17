"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, type ActionResult } from "@/server/action-context";
import { importFormatSchema } from "@/lib/validation/schemas";
import type { ReimbursementBehavior, ThemePref } from "@/lib/supabase/database.types";

export async function updateProfile(input: {
  reimbursement_behavior: ReimbursementBehavior;
  theme: ThemePref;
}): Promise<ActionResult> {
  const { supabase, userId } = await getActionContext();
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: userId, ...input }, { onConflict: "id" });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}

export async function createFormat(
  input: unknown,
): Promise<ActionResult & { id?: string }> {
  const parsed = importFormatSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid format" };
  const { supabase, userId } = await getActionContext();
  const v = parsed.data;

  const { data, error } = await supabase
    .from("import_formats")
    .insert({
      user_id: userId,
      name: v.name,
      institution: v.institution || null,
      strategy: v.strategy,
      header_signature: v.header_signature,
      sign_convention: v.sign_convention,
      config: v.config,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  const mappings = v.mappings.filter((m) => m.target_field !== "ignore");
  if (mappings.length > 0) {
    const { error: mapError } = await supabase.from("import_format_mappings").insert(
      mappings.map((m, i) => ({
        user_id: userId,
        format_id: data.id,
        source_column: m.source_column,
        target_field: m.target_field,
        position: m.position ?? i,
      })),
    );
    if (mapError) return { ok: false, error: mapError.message };
  }
  revalidatePath("/settings");
  return { ok: true, id: data.id };
}

export async function updateFormat(id: string, input: unknown): Promise<ActionResult> {
  const parsed = importFormatSchema.partial().safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid format" };
  const { supabase, userId } = await getActionContext();
  const v = parsed.data;

  const { error } = await supabase
    .from("import_formats")
    .update({
      ...(v.name !== undefined ? { name: v.name } : {}),
      ...(v.institution !== undefined ? { institution: v.institution || null } : {}),
      ...(v.sign_convention !== undefined ? { sign_convention: v.sign_convention } : {}),
      ...(v.header_signature !== undefined ? { header_signature: v.header_signature } : {}),
      ...(v.config !== undefined ? { config: v.config } : {}),
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };

  // Replace mappings when provided.
  if (v.mappings) {
    await supabase.from("import_format_mappings").delete().eq("format_id", id);
    const mappings = v.mappings.filter((m) => m.target_field !== "ignore");
    if (mappings.length > 0) {
      const { error: mapError } = await supabase.from("import_format_mappings").insert(
        mappings.map((m, i) => ({
          user_id: userId,
          format_id: id,
          source_column: m.source_column,
          target_field: m.target_field,
          position: m.position ?? i,
        })),
      );
      if (mapError) return { ok: false, error: mapError.message };
    }
  }
  revalidatePath("/settings");
  revalidatePath("/imports");
  return { ok: true };
}

export async function archiveFormat(id: string, archived: boolean): Promise<ActionResult> {
  const { supabase } = await getActionContext();
  const { error } = await supabase.from("import_formats").update({ is_archived: archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/settings");
  return { ok: true };
}
