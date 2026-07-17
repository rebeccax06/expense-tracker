"use server";

import { revalidatePath } from "next/cache";
import { getActionContext, type ActionResult } from "@/server/action-context";
import { tripSchema } from "@/lib/validation/schemas";

function parseForm(formData: FormData) {
  return tripSchema.safeParse({
    name: formData.get("name"),
    destination: formData.get("destination") || "",
    start_date: formData.get("start_date") || "",
    end_date: formData.get("end_date") || "",
    notes: formData.get("notes") || "",
  });
}

function toRow(v: ReturnType<typeof tripSchema.parse>) {
  return {
    name: v.name,
    destination: v.destination || null,
    start_date: v.start_date || null,
    end_date: v.end_date || null,
    notes: v.notes || null,
  };
}

export async function createTrip(formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase, userId } = await getActionContext();
  const { error } = await supabase.from("trips").insert({ user_id: userId, ...toRow(parsed.data) });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/trips");
  return { ok: true };
}

export async function updateTrip(id: string, formData: FormData): Promise<ActionResult> {
  const parsed = parseForm(formData);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  const { supabase } = await getActionContext();
  const { error } = await supabase.from("trips").update(toRow(parsed.data)).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/trips");
  return { ok: true };
}

export async function setTripArchived(id: string, archived: boolean): Promise<ActionResult> {
  const { supabase } = await getActionContext();
  const { error } = await supabase.from("trips").update({ is_archived: archived }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/trips");
  return { ok: true };
}
