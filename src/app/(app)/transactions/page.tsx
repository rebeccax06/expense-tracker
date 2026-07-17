import { queryTransactions, type TransactionFilters } from "@/server/queries/transactions";
import { listAccounts, listCategories, listTrips } from "@/server/queries/lookups";
import { TransactionsClient } from "@/features/transactions/transactions-client";
import type { NormalizedTxnType } from "@/lib/supabase/database.types";

const TYPES = ["expense", "refund", "transfer", "income", "adjustment"];

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : undefined);

  const filters: TransactionFilters = {
    search: str("search"),
    accountId: str("account"),
    categoryId: str("category"),
    tripId: str("trip"),
    type: TYPES.includes(str("type") ?? "") ? (str("type") as NormalizedTxnType) : undefined,
    uncategorized: str("uncat") === "1",
    dateFrom: str("from"),
    dateTo: str("to"),
    page: Number(str("page") ?? "1") || 1,
    pageSize: 50,
    sortBy: "transaction_date",
    sortDir: (str("dir") as "asc" | "desc") ?? "desc",
  };

  const [result, accounts, categories, trips] = await Promise.all([
    queryTransactions(filters),
    listAccounts(true),
    listCategories(false),
    listTrips(false),
  ]);

  return (
    <TransactionsClient
      result={result}
      accounts={accounts}
      categories={categories}
      trips={trips}
      filters={{
        search: filters.search ?? "",
        account: filters.accountId ?? "",
        category: filters.categoryId ?? "",
        trip: filters.tripId ?? "",
        type: filters.type ?? "",
        uncat: filters.uncategorized ?? false,
        from: filters.dateFrom ?? "",
        to: filters.dateTo ?? "",
      }}
    />
  );
}
