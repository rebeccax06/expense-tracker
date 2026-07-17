"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, type ActionResult } from "@/server/action-context";
import { categorySchema } from "@/lib/validation/schemas";

export async function createCategory(formData: FormData): Promise<ActionResult> {
  const parsed = categorySchema.safeParse({
    name: formData.get("name"),
    color: (formData.get("color") as string) || null,
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, userId } = await getActionContext();

  const { error } = await supabase.from("categories").insert({
    user_id: userId,
    name: parsed.data.name,
    color: parsed.data.color ?? null,
  });
  if (error) {
    return {
      ok: false,
      error: error.code === "23505" ? "A category with that name already exists." : error.message,
    };
  }
  revalidatePath("/categories");
  return { ok: true };
}

/** Returns the id of an existing (case-insensitive) or newly created category. */
export async function getOrCreateCategory(name: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const { supabase, userId } = await getActionContext();

  const { data: existing } = await supabase
    .from("categories")
    .select("id")
    .ilike("name", trimmed)
    .maybeSingle();
  if (existing) return existing.id;

  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: userId, name: trimmed })
    .select("id")
    .single();
  if (error) return null;
  revalidatePath("/categories");
  return data.id;
}

export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  const parsed = categorySchema.pick({ name: true }).safeParse({ name });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  const { supabase } = await getActionContext();
  const { error } = await supabase.from("categories").update({ name: parsed.data.name }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/categories");
  revalidatePath("/transactions");
  return { ok: true };
}

export async function setCategoryArchived(
  id: string,
  archived: boolean,
): Promise<ActionResult> {
  const { supabase } = await getActionContext();
  const { error } = await supabase.from("categories").update({ is_archived: archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/categories");
  return { ok: true };
}

/**
 * Delete a category. Optionally reassign its transactions to another category
 * first (overrides reference categories with on delete set null otherwise).
 */
export async function deleteCategory(
  id: string,
  reassignToId: string | null,
): Promise<ActionResult> {
  const { supabase } = await getActionContext();
  if (reassignToId) {
    const { error: reassignError } = await supabase
      .from("transaction_overrides")
      .update({ user_category_id: reassignToId })
      .eq("user_category_id", id);
    if (reassignError) return { ok: false, error: reassignError.message };
  }
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/categories");
  revalidatePath("/transactions");
  return { ok: true };
}
