import Link from "next/link";
import { AlertTriangle, Tags, TrendingUp, Wallet } from "lucide-react";
import { getDashboardData } from "@/server/queries/reporting";
import { currentMonthStart, formatCurrency, formatDate, monthLabel } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MonthPicker } from "@/features/dashboard/month-picker";
import {
  MonthlyTrendChart,
  CategoryPieChart,
} from "@/features/dashboard/dashboard-charts";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const { month } = await searchParams;
  const selectedMonth = month ?? currentMonthStart();
  const data = await getDashboardData(selectedMonth);

  const stats = [
    { label: monthLabel(selectedMonth), value: formatCurrency(data.monthSpending), icon: TrendingUp },
    { label: "All-time net spending", value: formatCurrency(data.totalSpendingAllTime), icon: Wallet },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dashboard"
        description="Your spending at a glance."
        action={<MonthPicker month={selectedMonth} />}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <s.icon className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardContent>
          </Card>
        ))}
        <Link href="/transactions?uncat=1">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Uncategorized</p>
                <Tags className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data.uncategorizedCount}</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/transactions?type=transfer">
          <Card className="transition-colors hover:border-primary">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Transfers to review</p>
                <AlertTriangle className="size-4 text-muted-foreground" />
              </div>
              <p className="mt-2 text-2xl font-semibold tabular-nums">{data.needsReviewCount}</p>
            </CardContent>
          </Card>
        </Link>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly trend</CardTitle></CardHeader>
          <CardContent><MonthlyTrendChart data={data.monthlyTrend} /></CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Spending by category · {monthLabel(selectedMonth)}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-2 items-center gap-2">
            <CategoryPieChart data={data.byCategory} />
            <div className="space-y-1.5">
              {data.byCategory.filter((c) => c.amount > 0).slice(0, 6).map((c, i) => (
                <div key={c.key} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 truncate">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ background: c.color ?? `var(--chart-${(i % 5) + 1})` }}
                    />
                    <span className="truncate">{c.label}</span>
                  </span>
                  <span className="tabular-nums">{formatCurrency(c.amount)}</span>
                </div>
              ))}
              {data.byCategory.length === 0 && (
                <p className="text-sm text-muted-foreground">No spending yet.</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BreakdownCard title="Spending by account" rows={data.byAccount} />
        <BreakdownCard title="Spending by trip" rows={data.byTrip} hrefBase="/trips" />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Recent transactions</CardTitle></CardHeader>
        <CardContent className="p-0">
          {data.recent.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No transactions yet. Import a file to get started.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="hidden sm:table-cell">Category</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recent.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="whitespace-nowrap text-sm">{formatDate(t.transaction_date)}</TableCell>
                    <TableCell className="max-w-[280px] truncate">{t.merchant || t.raw_description}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {t.category_name ? <Badge variant="secondary">{t.category_name}</Badge> : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(t.effective_spending)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BreakdownCard({
  title,
  rows,
  hrefBase,
}: {
  title: string;
  rows: { key: string; label: string; amount: number }[];
  hrefBase?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.amount)));
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          rows.slice(0, 8).map((r) => {
            const inner = (
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="truncate">{r.label}</span>
                  <span className="tabular-nums">{formatCurrency(r.amount)}</span>
                </div>
                <div className="h-2 w-full rounded bg-muted">
                  <div className="h-2 rounded bg-primary" style={{ width: `${(Math.abs(r.amount) / max) * 100}%` }} />
                </div>
              </div>
            );
            return hrefBase ? (
              <Link key={r.key} href={`${hrefBase}/${r.key}`} className="block hover:opacity-80">
                {inner}
              </Link>
            ) : (
              <div key={r.key}>{inner}</div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
