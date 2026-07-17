import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type Account = Database["public"]["Tables"]["accounts"]["Row"];
export type Category = Database["public"]["Tables"]["categories"]["Row"];
export type Trip = Database["public"]["Tables"]["trips"]["Row"];
export type ImportFormat = Database["public"]["Tables"]["import_formats"]["Row"];
export type FormatMapping =
  Database["public"]["Tables"]["import_format_mappings"]["Row"];

export async function listAccounts(includeArchived = true): Promise<Account[]> {
  const supabase = await createClient();
  let query = supabase.from("accounts").select("*").order("name");
  if (!includeArchived) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listCategories(includeArchived = false): Promise<Category[]> {
  const supabase = await createClient();
  let query = supabase.from("categories").select("*").order("name");
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listTrips(includeArchived = false): Promise<Trip[]> {
  const supabase = await createClient();
  let query = supabase.from("trips").select("*").order("start_date", {
    ascending: false,
    nullsFirst: false,
  });
  if (!includeArchived) query = query.eq("is_archived", false);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function listFormats(): Promise<ImportFormat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_formats")
    .select("*")
    .eq("is_archived", false)
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function listFormatMappings(
  formatId: string,
): Promise<FormatMapping[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("import_format_mappings")
    .select("*")
    .eq("format_id", formatId)
    .order("position");
  if (error) throw error;
  return data ?? [];
}
