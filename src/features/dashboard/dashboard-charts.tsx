"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from "recharts";
import type { NamedTotal } from "@/server/queries/reporting";
import { formatCurrency, monthLabel } from "@/lib/format";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function MonthlyTrendChart({ data }: { data: { month: string; amount: number }[] }) {
  if (data.length === 0) return <EmptyChart />;
  const chartData = data.map((d) => ({ ...d, label: d.month.slice(2) }));
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
        <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
        <YAxis
          tick={{ fontSize: 12 }}
          stroke="var(--muted-foreground)"
          tickFormatter={(v) => formatCurrency(Number(v), { compact: true })}
          width={56}
        />
        <Tooltip
          formatter={(v) => formatCurrency(Number(v))}
          labelFormatter={(l) => monthLabel(`20${l}`)}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="amount" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function CategoryPieChart({ data }: { data: NamedTotal[] }) {
  const positive = data.filter((d) => d.amount > 0).slice(0, 8);
  if (positive.length === 0) return <EmptyChart />;
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie
          data={positive}
          dataKey="amount"
          nameKey="label"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {positive.map((entry, i) => (
            <Cell
              key={entry.key}
              fill={entry.color ?? CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => formatCurrency(Number(v))}
          contentStyle={{
            background: "var(--popover)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-[240px] items-center justify-center text-sm text-muted-foreground">
      No data for this period
    </div>
  );
}
