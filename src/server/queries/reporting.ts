import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TransactionRow } from "./transactions";

export interface NamedTotal {
  key: string;
  label: string;
  amount: number;
  color?: string | null;
}

export interface DashboardData {
  month: string;
  totalSpendingAllTime: number;
  monthSpending: number;
  byCategory: NamedTotal[];
  byAccount: NamedTotal[];
  byTrip: NamedTotal[];
  monthlyTrend: { month: string; amount: number }[];
  recent: TransactionRow[];
  uncategorizedCount: number;
  needsReviewCount: number;
}

const DASH_COLUMNS =
  "id,transaction_date,posting_date,raw_description,merchant,raw_amount," +
  "normalized_spending_amount,bank_category,bank_type,normalized_type," +
  "include_in_spending,account_id,account_name,account_type,user_category_id," +
  "trip_id,location,notes,type_override,include_override,category_name," +
  "category_color,trip_name,resolved_type,resolved_include,effective_spending," +
  "fingerprint,raw_import_id,batch_id,created_at,updated_at,user_id";

function addTo(map: Map<string, NamedTotal>, key: string, label: string, amount: number, color?: string | null) {
  const cur = map.get(key);
  if (cur) cur.amount += amount;
  else map.set(key, { key, label, amount, color });
}

export async function getDashboardData(month: string): Promise<DashboardData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions_view")
    .select(DASH_COLUMNS)
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as TransactionRow[];

  const monthPrefix = month.slice(0, 7);
  const byCategory = new Map<string, NamedTotal>();
  const byAccount = new Map<string, NamedTotal>();
  const byTrip = new Map<string, NamedTotal>();
  const trend = new Map<string, number>();

  let totalSpendingAllTime = 0;
  let monthSpending = 0;
  let uncategorizedCount = 0;
  let needsReviewCount = 0;

  for (const r of rows) {
    const eff = Number(r.effective_spending) || 0;
    totalSpendingAllTime += eff;

    const m = r.transaction_date.slice(0, 7);
    if (eff !== 0) trend.set(m, (trend.get(m) ?? 0) + eff);

    if (r.trip_id && eff !== 0) {
      addTo(byTrip, r.trip_id, r.trip_name ?? "Trip", eff);
    }

    if (m === monthPrefix) {
      monthSpending += eff;
      if (eff !== 0) {
        addTo(
          byCategory,
          r.user_category_id ?? "uncategorized",
          r.category_name ?? "Uncategorized",
          eff,
          r.category_color,
        );
        addTo(byAccount, r.account_id, r.account_name, eff);
      }
    }

    if (r.resolved_type === "expense" && !r.user_category_id) uncategorizedCount += 1;
    if (r.resolved_type === "transfer") needsReviewCount += 1;
  }

  const sortDesc = (a: NamedTotal, b: NamedTotal) => b.amount - a.amount;
  const monthlyTrend = [...trend.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([m, amount]) => ({ month: m, amount }));

  return {
    month,
    totalSpendingAllTime,
    monthSpending,
    byCategory: [...byCategory.values()].sort(sortDesc),
    byAccount: [...byAccount.values()].sort(sortDesc),
    byTrip: [...byTrip.values()].sort(sortDesc),
    monthlyTrend,
    recent: rows.slice(0, 10),
    uncategorizedCount,
    needsReviewCount,
  };
}

export interface TripReport {
  total: number;
  byCategory: NamedTotal[];
  transactions: TransactionRow[];
}

export async function getTripReport(tripId: string): Promise<TripReport> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("transactions_view")
    .select(DASH_COLUMNS)
    .eq("trip_id", tripId)
    .order("transaction_date", { ascending: false });
  if (error) throw error;
  const rows = (data ?? []) as unknown as TransactionRow[];

  const byCategory = new Map<string, NamedTotal>();
  let total = 0;
  for (const r of rows) {
    const eff = Number(r.effective_spending) || 0;
    total += eff;
    if (eff !== 0) {
      addTo(
        byCategory,
        r.user_category_id ?? "uncategorized",
        r.category_name ?? "Uncategorized",
        eff,
        r.category_color,
      );
    }
  }
  return {
    total,
    byCategory: [...byCategory.values()].sort((a, b) => b.amount - a.amount),
    transactions: rows,
  };
}

export interface BudgetLine {
  category_id: string;
  category_name: string;
  budget: number;
  actual: number;
  remaining: number;
  over: boolean;
}

export async function getBudgetReport(month: string): Promise<{
  lines: BudgetLine[];
  totalBudget: number;
  totalActual: number;
}> {
  const supabase = await createClient();
  const monthStart = `${month.slice(0, 7)}-01`;

  const [
    { data: budgets, error: bErr },
    { data: txns, error: tErr },
    { data: cats, error: cErr },
  ] = await Promise.all([
    supabase.from("budgets").select("id,category_id,amount").eq("month", monthStart),
    supabase
      .from("transactions_view")
      .select("user_category_id,category_name,effective_spending,transaction_date,resolved_type")
      .gte("transaction_date", monthStart)
      .lte("transaction_date", `${month.slice(0, 7)}-31`),
    supabase.from("categories").select("id,name"),
  ]);
  if (bErr) throw bErr;
  if (tErr) throw tErr;
  if (cErr) throw cErr;

  const categoryNames = new Map((cats ?? []).map((c) => [c.id, c.name]));

  const actualByCat = new Map<string, number>();
  const nameByCat = new Map<string, string>();
  for (const r of txns ?? []) {
    if (!r.user_category_id) continue;
    const eff = Number(r.effective_spending) || 0;
    actualByCat.set(r.user_category_id, (actualByCat.get(r.user_category_id) ?? 0) + eff);
    if (r.category_name) nameByCat.set(r.user_category_id, r.category_name);
  }

  const lines: BudgetLine[] = (budgets ?? []).map((b) => {
    const actual = actualByCat.get(b.category_id) ?? 0;
    const budget = Number(b.amount) || 0;
    const catName =
      categoryNames.get(b.category_id) ??
      nameByCat.get(b.category_id) ??
      "Category";
    return {
      category_id: b.category_id,
      category_name: catName,
      budget,
      actual,
      remaining: budget - actual,
      over: actual > budget,
    };
  });

  return {
    lines: lines.sort((a, b) => b.actual - a.actual),
    totalBudget: lines.reduce((s, l) => s + l.budget, 0),
    totalActual: lines.reduce((s, l) => s + l.actual, 0),
  };
}
