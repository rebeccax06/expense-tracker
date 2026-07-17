"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload, FileWarning, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";
import type { Account, ImportFormat } from "@/server/queries/lookups";
import type { ImportBatch } from "@/server/queries/imports";
import type { PreviewRow, PreviewSummary } from "@/domain/imports/build-preview";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

interface PreviewResponse {
  formatId?: string;
  formatName?: string;
  accountName?: string;
  headers: string[];
  summary?: PreviewSummary;
  rows?: PreviewRow[];
  fileHash?: string;
  filename?: string;
  duplicateFile?: { filename: string; importedAt: string } | null;
  needsFormat?: boolean;
  formatMismatch?: boolean;
  warning?: string;
  error?: string;
}

const TYPE_BADGE: Record<string, string> = {
  expense: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  refund: "bg-green-500/10 text-green-600 dark:text-green-400",
  transfer: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  income: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  adjustment: "bg-muted text-muted-foreground",
};

const PREVIEW_LIMIT = 100;

export function ImportsClient({
  accounts,
  formats,
  batches,
}: {
  accounts: Account[];
  formats: ImportFormat[];
  batches: ImportBatch[];
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState<string>(accounts[0]?.id ?? "");
  const [formatId, setFormatId] = useState<string>("auto");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [skipDuplicates, setSkipDuplicates] = useState(true);
  const [dragOver, setDragOver] = useState(false);

  const accountName = accounts.find((a) => a.id === accountId)?.name;

  async function runPreview(selectedFile: File) {
    if (!accountId) {
      toast.error("Select an account first");
      return;
    }
    setLoading(true);
    setPreview(null);
    try {
      const fd = new FormData();
      fd.set("file", selectedFile);
      fd.set("account_id", accountId);
      if (formatId !== "auto") fd.set("format_id", formatId);
      const res = await fetch("/api/imports/preview", { method: "POST", body: fd });
      const data: PreviewResponse = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Preview failed");
        return;
      }
      setPreview(data);
      if (data.needsFormat) {
        toast.warning("Couldn't detect the format. Pick one below and retry.");
      } else if (data.formatMismatch) {
        toast.warning(data.warning ?? "Header mismatch");
      }
    } catch {
      toast.error("Network error while previewing");
    } finally {
      setLoading(false);
    }
  }

  function onSelectFile(f: File | null) {
    setFile(f);
    setPreview(null);
    if (f) void runPreview(f);
  }

  async function commit() {
    if (!file || !preview?.rows || !preview.formatId) return;
    const rows = preview.rows
      .filter((r) => r.parsed && (!skipDuplicates || !r.duplicateInDb))
      .map((r) => ({
        rowNumber: r.rowNumber,
        raw: r.raw,
        fingerprint: r.fingerprint!,
        transaction_date: r.parsed!.transactionDate,
        posting_date: r.parsed!.postingDate,
        raw_description: r.parsed!.rawDescription,
        merchant: r.parsed!.merchant,
        raw_amount: r.parsed!.rawAmount,
        normalized_spending_amount: r.parsed!.normalizedSpendingAmount,
        bank_category: r.parsed!.bankCategory,
        bank_type: r.parsed!.bankType,
        normalized_type: r.parsed!.normalizedType,
        include_in_spending: r.parsed!.includeInSpending,
      }));

    if (rows.length === 0) {
      toast.error("No rows to import");
      return;
    }

    setCommitting(true);
    try {
      const payload = {
        account_id: accountId,
        format_id: preview.formatId,
        filename: preview.filename ?? file.name,
        file_hash: preview.fileHash ?? null,
        storage_path: null,
        rows,
        skipDuplicates,
      };
      const fd = new FormData();
      fd.set("payload", JSON.stringify(payload));
      fd.set("file", file);
      const res = await fetch("/api/imports/commit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Import failed");
        return;
      }
      toast.success(`Imported ${data.imported} transaction(s), skipped ${data.skipped}.`);
      setFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      router.refresh();
    } catch {
      toast.error("Network error while importing");
    } finally {
      setCommitting(false);
    }
  }

  const s = preview?.summary;
  const importableCount = preview?.rows?.filter(
    (r) => r.parsed && (!skipDuplicates || !r.duplicateInDb),
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Imports"
        description="Upload a CSV or XLSX export. Review the normalized preview before committing."
      />

      {accounts.length === 0 ? (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>No active accounts</AlertTitle>
          <AlertDescription>Add an account before importing.</AlertDescription>
        </Alert>
      ) : (
        <Card>
          <CardContent className="space-y-4 p-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Account</Label>
                <Select value={accountId} onValueChange={(v) => setAccountId(v as string)}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Format</Label>
                <Select value={formatId} onValueChange={(v) => setFormatId((v as string) ?? "auto")}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto-detect</SelectItem>
                    {formats.map((f) => (
                      <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const f = e.dataTransfer.files?.[0];
                if (f) onSelectFile(f);
              }}
              className={cn(
                "flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center transition-colors",
                dragOver ? "border-primary bg-primary/5" : "border-border",
              )}
            >
              <Upload className="mb-2 size-6 text-muted-foreground" />
              <p className="text-sm font-medium">
                {file ? file.name : "Drag & drop a .csv or .xlsx file"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Max 10 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls,text/csv"
                className="hidden"
                onChange={(e) => onSelectFile(e.target.files?.[0] ?? null)}
              />
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? "Reading…" : "Choose file"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {preview?.duplicateFile && (
        <Alert variant="destructive">
          <FileWarning className="size-4" />
          <AlertTitle>Possible duplicate file</AlertTitle>
          <AlertDescription>
            A file with identical contents was imported on{" "}
            {formatDate(preview.duplicateFile.importedAt.slice(0, 10))}. Duplicate
            transactions will be skipped automatically.
          </AlertDescription>
        </Alert>
      )}

      {preview?.needsFormat && (
        <Alert>
          <AlertTriangle className="size-4" />
          <AlertTitle>Select a format</AlertTitle>
          <AlertDescription>
            We couldn&apos;t auto-detect the format from these headers:{" "}
            <span className="font-mono text-xs">{preview.headers.join(", ")}</span>.
            Choose one above and re-select the file.
          </AlertDescription>
        </Alert>
      )}

      {s && preview?.rows && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Preview · {preview.formatName} → {accountName ?? preview.accountName}
            </CardTitle>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={skipDuplicates}
                  onCheckedChange={(c) => setSkipDuplicates(c === true)}
                />
                Skip duplicates
              </label>
              <Button onClick={commit} disabled={committing || !importableCount}>
                {committing ? (
                  <>
                    <RefreshCw className="size-4 animate-spin" /> Importing…
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="size-4" /> Import {importableCount} rows
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="secondary">{s.total} rows</Badge>
              <Badge variant="secondary">{s.valid} valid</Badge>
              {s.invalid > 0 && <Badge variant="destructive">{s.invalid} invalid</Badge>}
              {s.duplicates > 0 && <Badge className="bg-amber-500/15 text-amber-600">{s.duplicates} duplicates</Badge>}
              {s.suspectedTransfers > 0 && (
                <Badge className="bg-amber-500/15 text-amber-600">
                  {s.suspectedTransfers} suspected transfers
                </Badge>
              )}
              {s.refunds > 0 && <Badge className="bg-green-500/15 text-green-600">{s.refunds} refunds</Badge>}
              {s.income > 0 && <Badge className="bg-purple-500/15 text-purple-600">{s.income} income</Badge>}
            </div>

            {s.suspectedTransfers > 0 && (
              <Alert>
                <AlertTriangle className="size-4" />
                <AlertTitle>Review suspected transfers</AlertTitle>
                <AlertDescription>
                  Rows matching autopay/transfer patterns are marked as{" "}
                  <strong>transfer</strong> (excluded from spending) but still
                  imported. Review them below; you can re-classify any of them
                  later on the Transactions page.
                </AlertDescription>
              </Alert>
            )}

            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Flags</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.rows.slice(0, PREVIEW_LIMIT).map((r) => (
                    <TableRow
                      key={r.rowNumber}
                      className={cn(!r.parsed && "bg-destructive/5")}
                    >
                      <TableCell className="whitespace-nowrap">
                        {r.parsed ? formatDate(r.parsed.transactionDate) : `Row ${r.rowNumber}`}
                      </TableCell>
                      <TableCell className="max-w-[320px] truncate">
                        {r.parsed?.merchant || r.parsed?.rawDescription || (
                          <span className="text-destructive">{r.error}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.parsed ? formatCurrency(r.parsed.rawAmount) : "—"}
                      </TableCell>
                      <TableCell>
                        {r.parsed && (
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-xs font-medium",
                              TYPE_BADGE[r.parsed.normalizedType],
                            )}
                          >
                            {r.parsed.normalizedType}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="space-x-1">
                        {r.duplicateInDb && (
                          <Badge variant="outline" className="text-amber-600">dup</Badge>
                        )}
                        {r.parsed?.suspectedTransfer && (
                          <Badge variant="outline" className="text-amber-600">review</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {preview.rows.length > PREVIEW_LIMIT && (
              <p className="text-xs text-muted-foreground">
                Showing first {PREVIEW_LIMIT} of {preview.rows.length} rows. All
                eligible rows will be imported.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Import history</CardTitle>
        </CardHeader>
        <CardContent>
          {batches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No imports yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Imported</TableHead>
                    <TableHead className="text-right">Skipped</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batches.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="max-w-[260px] truncate">{b.filename}</TableCell>
                      <TableCell>{formatDate(b.created_at.slice(0, 10))}</TableCell>
                      <TableCell>
                        <Badge variant={b.status === "committed" ? "secondary" : "outline"}>
                          {b.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{b.imported_rows}</TableCell>
                      <TableCell className="text-right tabular-nums">{b.skipped_rows}</TableCell>
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
