"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, type ActionResult } from "@/server/action-context";
import { accountSchema } from "@/lib/validation/schemas";

function parseForm(formData: FormData) {
  return accountSchema.safeParse({
    name: formData.get("name"),
    institution: formData.get("institution") || "",
    account_type: formData.get("account_type"),
    last_four: formData.get("last_four") || "",
    currency: (formData.get("currency") as string) || "USD",
    import_format_id: (formData.get("import_format_id") as string) || null,
    purchase_sign: formData.get("purchase_sign"),
    is_active: formData.get("is_active") !== "false",
  });
}

export async function createAccount(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, userId } = await getActionContext();
  const v = parsed.data;

  const { error } = await supabase.from("accounts").insert({
    user_id: userId,
    name: v.name,
    institution: v.institution || null,
    account_type: v.account_type,
    last_four: v.last_four || null,
    currency: v.currency,
    import_format_id: v.import_format_id || null,
    purchase_sign: v.purchase_sign,
    is_active: v.is_active,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}

export async function updateAccount(
  id: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase } = await getActionContext();
  const v = parsed.data;

  const { error } = await supabase
    .from("accounts")
    .update({
      name: v.name,
      institution: v.institution || null,
      account_type: v.account_type,
      last_four: v.last_four || null,
      currency: v.currency,
      import_format_id: v.import_format_id || null,
      purchase_sign: v.purchase_sign,
      is_active: v.is_active,
    })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}

export async function setAccountActive(
  id: string,
  isActive: boolean,
): Promise<ActionResult> {
  const { supabase } = await getActionContext();
  const { error } = await supabase.from("accounts").update({ is_active: isActive }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/accounts");
  return { ok: true };
}
