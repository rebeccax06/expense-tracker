import { createClient } from "@/lib/supabase/server";
import { listCategories } from "@/server/queries/lookups";
import { currentMonthStart } from "@/lib/format";
import { BudgetClient } from "@/features/budget/budget-client";

export default async function BudgetPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const selectedMonth = month ?? currentMonthStart();
  const monthStart = `${selectedMonth.slice(0, 7)}-01`;

  const supabase = await createClient();
  const [categories, { data: budgets }, { data: txns }] = await Promise.all([
    listCategories(false),
    supabase.from("budgets").select("id,category_id,amount").eq("month", monthStart),
    supabase
      .from("transactions_view")
      .select("user_category_id,effective_spending")
      .gte("transaction_date", monthStart)
      .lte("transaction_date", `${selectedMonth.slice(0, 7)}-31`),
  ]);

  const budgetByCat = new Map((budgets ?? []).map((b) => [b.category_id, Number(b.amount)]));
  const actualByCat = new Map<string, number>();
  for (const t of txns ?? []) {
    if (!t.user_category_id) continue;
    actualByCat.set(
      t.user_category_id,
      (actualByCat.get(t.user_category_id) ?? 0) + (Number(t.effective_spending) || 0),
    );
  }

  const rows = categories.map((c) => ({
    category_id: c.id,
    category_name: c.name,
    budget: budgetByCat.get(c.id) ?? 0,
    actual: actualByCat.get(c.id) ?? 0,
  }));

  return <BudgetClient month={monthStart} rows={rows} />;
}
