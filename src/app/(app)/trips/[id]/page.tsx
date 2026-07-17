import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getTripReport } from "@/server/queries/reporting";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: trip } = await supabase.from("trips").select("*").eq("id", id).single();
  if (!trip) notFound();

  const report = await getTripReport(id);
  const max = Math.max(1, ...report.byCategory.map((c) => Math.abs(c.amount)));

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" render={<Link href="/trips" />}>
        <ArrowLeft className="size-4" /> All trips
      </Button>
      <PageHeader
        title={trip.name}
        description={
          [trip.destination, trip.start_date && `${formatDate(trip.start_date)} – ${formatDate(trip.end_date)}`]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm text-muted-foreground">Total spending</CardTitle></CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">{formatCurrency(report.total)}</p>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardHeader><CardTitle className="text-base">By category</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {report.byCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No spending recorded.</p>
            ) : (
              report.byCategory.map((c) => (
                <div key={c.key} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{c.label}</span>
                    <span className="tabular-nums">{formatCurrency(c.amount)}</span>
                  </div>
                  <div className="h-2 w-full rounded bg-muted">
                    <div
                      className="h-2 rounded bg-primary"
                      style={{ width: `${(Math.abs(c.amount) / max) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Transactions</CardTitle></CardHeader>
        <CardContent>
          {report.transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions assigned to this trip yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(t.transaction_date)}</TableCell>
                      <TableCell className="max-w-[280px] truncate">{t.merchant || t.raw_description}</TableCell>
                      <TableCell>{t.category_name ?? "—"}</TableCell>
                      <TableCell>{t.account_name}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(t.effective_spending)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
