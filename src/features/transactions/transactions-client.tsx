"use client";

import { useState, useTransition, useCallback } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, X, Receipt, ChevronLeft, ChevronRight, Download } from "lucide-react";
import type { Account, Category, Trip } from "@/server/queries/lookups";
import type { TransactionPage } from "@/server/queries/transactions";
import type { NormalizedTxnType } from "@/lib/supabase/database.types";
import { applyOverrides } from "@/server/actions/transactions";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

const TXN_TYPES: NormalizedTxnType[] = ["expense", "refund", "transfer", "income", "adjustment"];
const TYPE_COLOR: Record<string, string> = {
  expense: "text-blue-600 dark:text-blue-400",
  refund: "text-green-600 dark:text-green-400",
  transfer: "text-amber-600 dark:text-amber-400",
  income: "text-purple-600 dark:text-purple-400",
  adjustment: "text-muted-foreground",
};

interface Filters {
  search: string;
  account: string;
  category: string;
  trip: string;
  type: string;
  uncat: boolean;
  from: string;
  to: string;
}

export function TransactionsClient({
  result,
  accounts,
  categories,
  trips,
  filters,
}: {
  result: TransactionPage;
  accounts: Account[];
  categories: Category[];
  trips: Trip[];
  filters: Filters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searchDraft, setSearchDraft] = useState(filters.search);

  const totalPages = Math.max(1, Math.ceil(result.total / result.pageSize));

  const setParam = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === "") params.delete(k);
        else params.set(k, v);
      }
      if (!("page" in updates)) params.delete("page");
      startTransition(() => router.push(`${pathname}?${params.toString()}`));
    },
    [pathname, router, searchParams],
  );

  function mutate(fingerprints: string[], patch: Parameters<typeof applyOverrides>[1]) {
    startTransition(async () => {
      const res = await applyOverrides(fingerprints, patch);
      if (res.ok) {
        router.refresh();
      } else {
        toast.error(res.error);
      }
    });
  }

  function toggle(fp: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(fp)) next.delete(fp);
      else next.add(fp);
      return next;
    });
  }

  const allSelected = result.rows.length > 0 && result.rows.every((r) => selected.has(r.fingerprint));
  const selectedList = [...selected];

  const activeFilterCount =
    (filters.account ? 1 : 0) +
    (filters.category ? 1 : 0) +
    (filters.trip ? 1 : 0) +
    (filters.type ? 1 : 0) +
    (filters.uncat ? 1 : 0) +
    (filters.from ? 1 : 0) +
    (filters.to ? 1 : 0) +
    (filters.search ? 1 : 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Transactions"
        description={`${result.total} transaction${result.total === 1 ? "" : "s"}`}
        action={
          <Button variant="outline" size="sm" render={<a href="/api/transactions/export" />}>
            <Download className="size-4" /> Export CSV
          </Button>
        }
      />

      <Card>
        <CardContent className="space-y-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <form
              className="relative flex-1 min-w-[200px]"
              onSubmit={(e) => {
                e.preventDefault();
                setParam({ search: searchDraft || null });
              }}
            >
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                value={searchDraft}
                onChange={(e) => setSearchDraft(e.target.value)}
                placeholder="Search description…"
                className="pl-8"
              />
            </form>

            <FilterSelect
              value={filters.account || "all"}
              onChange={(v) => setParam({ account: v === "all" ? null : v })}
              placeholder="Account"
              options={[{ value: "all", label: "All accounts" }, ...accounts.map((a) => ({ value: a.id, label: a.name }))]}
            />
            <FilterSelect
              value={filters.category || "all"}
              onChange={(v) => setParam({ category: v === "all" ? null : v })}
              placeholder="Category"
              options={[{ value: "all", label: "All categories" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]}
            />
            <FilterSelect
              value={filters.trip || "all"}
              onChange={(v) => setParam({ trip: v === "all" ? null : v })}
              placeholder="Trip"
              options={[{ value: "all", label: "All trips" }, ...trips.map((t) => ({ value: t.id, label: t.name }))]}
            />
            <FilterSelect
              value={filters.type || "all"}
              onChange={(v) => setParam({ type: v === "all" ? null : v })}
              placeholder="Type"
              options={[{ value: "all", label: "All types" }, ...TXN_TYPES.map((t) => ({ value: t, label: t }))]}
            />
            <label className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm">
              <Checkbox
                checked={filters.uncat}
                onCheckedChange={(c) => setParam({ uncat: c === true ? "1" : null })}
              />
              Uncategorized
            </label>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearchDraft("");
                  startTransition(() => router.push(pathname));
                }}
              >
                <X className="size-4" /> Clear
              </Button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span>Date</span>
            <Input
              type="date"
              value={filters.from}
              onChange={(e) => setParam({ from: e.target.value || null })}
              className="w-auto"
            />
            <span>–</span>
            <Input
              type="date"
              value={filters.to}
              onChange={(e) => setParam({ to: e.target.value || null })}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>

      {selectedList.length > 0 && (
        <Card className="border-primary">
          <CardContent className="flex flex-wrap items-center gap-2 p-3">
            <span className="text-sm font-medium">{selectedList.length} selected</span>
            <FilterSelect
              value=""
              onChange={(v) => mutate(selectedList, { user_category_id: v === "__clear" ? null : v })}
              placeholder="Set category"
              options={[
                { value: "__clear", label: "Clear category" },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
            <FilterSelect
              value=""
              onChange={(v) => mutate(selectedList, { trip_id: v === "__clear" ? null : v })}
              placeholder="Set trip"
              options={[
                { value: "__clear", label: "No trip" },
                ...trips.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
            <FilterSelect
              value=""
              onChange={(v) => mutate(selectedList, { type_override: v as NormalizedTxnType })}
              placeholder="Set type"
              options={TXN_TYPES.map((t) => ({ value: t, label: t }))}
            />
            <Button size="sm" variant="outline" onClick={() => mutate(selectedList, { include_override: false })}>
              Exclude
            </Button>
            <Button size="sm" variant="outline" onClick={() => mutate(selectedList, { include_override: true })}>
              Include
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Deselect
            </Button>
          </CardContent>
        </Card>
      )}

      {result.rows.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title="No transactions"
          description="Import a file or adjust your filters."
        />
      ) : (
        <Card>
          <CardContent className={cn("overflow-x-auto p-0", isPending && "opacity-60")}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={(c) => {
                        if (c === true) setSelected(new Set(result.rows.map((r) => r.fingerprint)));
                        else setSelected(new Set());
                      }}
                    />
                  </TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden lg:table-cell">Account</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="hidden md:table-cell">Trip</TableHead>
                  <TableHead className="hidden sm:table-cell">Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="hidden xl:table-cell text-center">Incl.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.rows.map((r) => (
                  <TableRow key={r.fingerprint} className={cn(selected.has(r.fingerprint) && "bg-accent/40")}>
                    <TableCell>
                      <Checkbox checked={selected.has(r.fingerprint)} onCheckedChange={() => toggle(r.fingerprint)} />
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(r.transaction_date)}</TableCell>
                    <TableCell className="max-w-[240px]">
                      <div className="truncate font-medium">{r.merchant || r.raw_description}</div>
                      {r.merchant && (
                        <div className="truncate text-xs text-muted-foreground">{r.raw_description}</div>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{r.account_name}</TableCell>
                    <TableCell>
                      <InlineSelect
                        value={r.user_category_id ?? "none"}
                        onChange={(v) =>
                          mutate([r.fingerprint], { user_category_id: v === "none" ? null : v })
                        }
                        options={[
                          { value: "none", label: "—" },
                          ...categories.map((c) => ({ value: c.id, label: c.name })),
                        ]}
                      />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <InlineSelect
                        value={r.trip_id ?? "none"}
                        onChange={(v) => mutate([r.fingerprint], { trip_id: v === "none" ? null : v })}
                        options={[
                          { value: "none", label: "—" },
                          ...trips.map((t) => ({ value: t.id, label: t.name })),
                        ]}
                      />
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <InlineSelect
                        value={r.resolved_type}
                        onChange={(v) => mutate([r.fingerprint], { type_override: v as NormalizedTxnType })}
                        options={TXN_TYPES.map((t) => ({ value: t, label: t }))}
                        className={TYPE_COLOR[r.resolved_type]}
                      />
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-medium",
                        r.effective_spending < 0 && "text-green-600 dark:text-green-400",
                      )}
                    >
                      {formatCurrency(r.effective_spending)}
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-center">
                      <Switch
                        checked={r.resolved_include}
                        onCheckedChange={(c) => mutate([r.fingerprint], { include_override: c })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {result.page} of {totalPages}
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={result.page <= 1}
            onClick={() => setParam({ page: String(result.page - 1) })}
          >
            <ChevronLeft className="size-4" /> Prev
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={result.page >= totalPages}
            onClick={() => setParam({ page: String(result.page + 1) })}
          >
            Next <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string) ?? "")}>
      <SelectTrigger size="sm" className="w-auto min-w-[130px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function InlineSelect({
  value,
  onChange,
  options,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange((v as string) ?? "none")}>
      <SelectTrigger size="sm" className={cn("h-7 w-auto min-w-[110px] border-transparent hover:border-border", className)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
