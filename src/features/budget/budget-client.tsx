"use client";

import { useState, useTransition } from "react";
import { useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";
import { upsertBudget } from "@/server/actions/budgets";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Tags } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Row {
  category_id: string;
  category_name: string;
  budget: number;
  actual: number;
}

export function BudgetClient({ month, rows }: { month: string; rows: Row[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const [drafts, setDrafts] = useState<Record<string, string>>(
    Object.fromEntries(rows.map((r) => [r.category_id, r.budget ? String(r.budget) : ""])),
  );

  function save(categoryId: string) {
    const raw = drafts[categoryId] ?? "";
    const amount = raw === "" ? 0 : Number(raw);
    if (!Number.isFinite(amount) || amount < 0) {
      toast.error("Enter a valid amount");
      return;
    }
    startTransition(async () => {
      const res = await upsertBudget({ category_id: categoryId, month, amount });
      if (res.ok) {
        toast.success("Budget saved");
        router.refresh();
      } else toast.error(res.error);
    });
  }

  const totalBudget = rows.reduce((s, r) => s + (Number(drafts[r.category_id]) || 0), 0);
  const totalActual = rows.reduce((s, r) => s + r.actual, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Budget"
        description={`Monthly category budgets · ${monthLabel(month)}`}
        action={
          <Input
            type="month"
            value={month.slice(0, 7)}
            onChange={(e) => e.target.value && router.push(`${pathname}?month=${e.target.value}-01`)}
            className="w-auto"
          />
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Total budget" value={formatCurrency(totalBudget)} />
        <Stat label="Total actual" value={formatCurrency(totalActual)} />
        <Stat
          label="Remaining"
          value={formatCurrency(totalBudget - totalActual)}
          negative={totalActual > totalBudget}
        />
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={Tags} title="No categories" description="Add categories first to set budgets." />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-40">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="hidden w-48 md:table-cell">Progress</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const budget = Number(drafts[r.category_id]) || 0;
                  const remaining = budget - r.actual;
                  const over = budget > 0 && r.actual > budget;
                  const pct = budget > 0 ? Math.min(100, (r.actual / budget) * 100) : 0;
                  return (
                    <TableRow key={r.category_id}>
                      <TableCell className="font-medium">{r.category_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          value={drafts[r.category_id] ?? ""}
                          placeholder="0.00"
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [r.category_id]: e.target.value }))
                          }
                          onBlur={() => save(r.category_id)}
                          onKeyDown={(e) => e.key === "Enter" && save(r.category_id)}
                          className="h-8"
                        />
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.actual)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", over && "text-destructive")}>
                        {formatCurrency(remaining)}
                        {over && <Badge variant="destructive" className="ml-2">Over</Badge>}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Progress value={pct} className={cn(over && "[&>*]:bg-destructive")} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className={cn("mt-1 text-2xl font-semibold tabular-nums", negative && "text-destructive")}>
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
