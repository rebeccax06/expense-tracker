"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, type ActionResult } from "@/server/action-context";
import { budgetSchema } from "@/lib/validation/schemas";

export async function upsertBudget(input: {
  category_id: string;
  month: string;
  amount: number;
}): Promise<ActionResult> {
  const parsed = budgetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, userId } = await getActionContext();

  const { error } = await supabase
    .from("budgets")
    .upsert(
      { user_id: userId, ...parsed.data },
      { onConflict: "user_id,category_id,month" },
    );
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budget");
  return { ok: true };
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  const { supabase } = await getActionContext();
  const { error } = await supabase.from("budgets").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/budget");
  return { ok: true };
}
