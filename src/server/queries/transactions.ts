import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database, NormalizedTxnType } from "@/lib/supabase/database.types";

export type TransactionRow =
  Database["public"]["Views"]["transactions_view"]["Row"];

export interface TransactionFilters {
  search?: string;
  accountId?: string;
  categoryId?: string;
  tripId?: string;
  type?: NormalizedTxnType;
  uncategorized?: boolean;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  pageSize?: number;
  sortBy?: "transaction_date" | "effective_spending" | "raw_description";
  sortDir?: "asc" | "desc";
}

export interface TransactionPage {
  rows: TransactionRow[];
  total: number;
  page: number;
  pageSize: number;
}

export async function queryTransactions(
  filters: TransactionFilters,
): Promise<TransactionPage> {
  const supabase = await createClient();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(200, Math.max(10, filters.pageSize ?? 50));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("transactions_view")
    .select("*", { count: "exact" });

  if (filters.search) {
    query = query.ilike("raw_description", `%${filters.search}%`);
  }
  if (filters.accountId) query = query.eq("account_id", filters.accountId);
  if (filters.categoryId) query = query.eq("user_category_id", filters.categoryId);
  if (filters.tripId) query = query.eq("trip_id", filters.tripId);
  if (filters.type) query = query.eq("resolved_type", filters.type);
  if (filters.uncategorized) query = query.is("user_category_id", null);
  if (filters.dateFrom) query = query.gte("transaction_date", filters.dateFrom);
  if (filters.dateTo) query = query.lte("transaction_date", filters.dateTo);

  const sortBy = filters.sortBy ?? "transaction_date";
  query = query
    .order(sortBy, { ascending: filters.sortDir === "asc" })
    .order("created_at", { ascending: false })
    .range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { rows: data ?? [], total: count ?? 0, page, pageSize };
}

export async function countUncategorized(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("transactions_view")
    .select("id", { count: "exact", head: true })
    .is("user_category_id", null)
    .eq("resolved_type", "expense");
  if (error) throw error;
  return count ?? 0;
}

/** All committed fingerprints for the user (used for import duplicate checks). */
export async function fetchExistingFingerprints(): Promise<Set<string>> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("transactions").select("fingerprint");
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.fingerprint));
}
