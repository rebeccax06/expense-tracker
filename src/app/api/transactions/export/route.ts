import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sanitizeForCsvExport } from "@/lib/parsing";

const COLUMNS = [
  "transaction_date",
  "posting_date",
  "account_name",
  "raw_description",
  "merchant",
  "raw_amount",
  "effective_spending",
  "resolved_type",
  "category_name",
  "trip_name",
  "location",
  "notes",
] as const;

function csvCell(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  const safe = sanitizeForCsvExport(str);
  // Quote if it contains comma, quote, or newline.
  if (/[",\n\r]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("transactions_view")
    .select(COLUMNS.join(","))
    .order("transaction_date", { ascending: false });
  if (error) {
    console.error("Export failed", error);
    return NextResponse.json({ error: "Export failed" }, { status: 500 });
  }

  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  const header = COLUMNS.join(",");
  const body = rows.map((r) => COLUMNS.map((c) => csvCell(r[c])).join(",")).join("\n");
  const csv = `${header}\n${body}`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="transactions-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
