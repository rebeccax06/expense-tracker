"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Archive } from "lucide-react";
import type { ImportFormat } from "@/server/queries/lookups";
import type { ReimbursementBehavior, ThemePref } from "@/lib/supabase/database.types";
import { updateProfile, createFormat, updateFormat, archiveFormat } from "@/server/actions/formats";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Mapping = { source_column: string; target_field: string };

const TARGET_FIELDS = [
  "transaction_date",
  "posting_date",
  "description",
  "merchant",
  "amount",
  "bank_category",
  "bank_type",
  "ignore",
];

export function SettingsClient({
  email,
  reimbursement,
  theme,
  formats,
  mappingsByFormat,
}: {
  email: string;
  reimbursement: ReimbursementBehavior;
  theme: ThemePref;
  formats: ImportFormat[];
  mappingsByFormat: Record<string, Mapping[]>;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [reimb, setReimb] = useState<ReimbursementBehavior>(reimbursement);
  const [themePref, setThemePref] = useState<ThemePref>(theme);
  const [editing, setEditing] = useState<ImportFormat | null>(null);
  const [creating, setCreating] = useState(false);

  function saveProfile() {
    startTransition(async () => {
      const res = await updateProfile({ reimbursement_behavior: reimb, theme: themePref });
      if (res.ok) toast.success("Preferences saved");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description={email} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferences</CardTitle>
          <CardDescription>How the app treats certain transactions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Incoming money on debit/checking</Label>
              <Select value={reimb} onValueChange={(v) => setReimb(v as ReimbursementBehavior)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="income">Treat as income (excluded from spending)</SelectItem>
                  <SelectItem value="refund">Treat as refund (reduces spending)</SelectItem>
                  <SelectItem value="review">Leave for review</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Default theme</Label>
              <Select value={themePref} onValueChange={(v) => setThemePref(v as ThemePref)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={saveProfile}>Save preferences</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">Import formats</CardTitle>
            <CardDescription>
              Reusable templates for bank/card exports. Autopay patterns flag transfers for review.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New format
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {formats.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-md border p-3">
              <div>
                <p className="text-sm font-medium">{f.name}</p>
                <p className="text-xs text-muted-foreground">
                  {f.strategy === "generic" ? "Custom" : "Built-in"} ·{" "}
                  {f.sign_convention === "negative_is_spending" ? "− = spending" : "+ = spending"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Badge variant="outline">{(f.config.autopayPatterns?.length ?? 0)} patterns</Badge>
                <Button variant="ghost" size="icon" onClick={() => setEditing(f)}>
                  <Pencil className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await archiveFormat(f.id, true);
                      if (res.ok) {
                        toast.success("Archived");
                        router.refresh();
                      } else toast.error(res.error);
                    })
                  }
                >
                  <Archive className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {(editing || creating) && (
        <FormatEditor
          format={editing}
          initialMappings={editing ? mappingsByFormat[editing.id] ?? [] : []}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          onSaved={() => {
            setEditing(null);
            setCreating(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function FormatEditor({
  format,
  initialMappings,
  onClose,
  onSaved,
}: {
  format: ImportFormat | null;
  initialMappings: Mapping[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState(format?.name ?? "");
  const [sign, setSign] = useState(format?.sign_convention ?? "negative_is_spending");
  const [dateFormat, setDateFormat] = useState(format?.config.dateFormat ?? "MM/DD/YYYY");
  const [patterns, setPatterns] = useState((format?.config.autopayPatterns ?? []).join("\n"));
  const [mappings, setMappings] = useState<Mapping[]>(
    initialMappings.length > 0 ? initialMappings : [{ source_column: "", target_field: "transaction_date" }],
  );
  const isBuiltin = format ? format.strategy !== "generic" : false;

  function save() {
    if (!name.trim()) {
      toast.error("Name is required");
      return;
    }
    const cleanMappings = mappings
      .filter((m) => m.source_column.trim() !== "")
      .map((m, i) => ({ source_column: m.source_column.trim(), target_field: m.target_field, position: i }));
    const headerSignature = cleanMappings.map((m) => m.source_column);
    const config = {
      dateFormat: dateFormat.trim() || undefined,
      autopayPatterns: patterns.split("\n").map((p) => p.trim()).filter(Boolean),
    };

    startTransition(async () => {
      if (format) {
        const res = await updateFormat(format.id, {
          name: name.trim(),
          sign_convention: sign,
          config,
          // Only replace mappings/headers for custom formats.
          ...(isBuiltin ? {} : { header_signature: headerSignature, mappings: cleanMappings }),
        });
        if (res.ok) {
          toast.success("Format updated");
          onSaved();
        } else toast.error(res.error);
      } else {
        const res = await createFormat({
          name: name.trim(),
          strategy: "generic",
          sign_convention: sign,
          header_signature: headerSignature,
          config,
          mappings: cleanMappings,
        });
        if (res.ok) {
          toast.success("Format created");
          onSaved();
        } else toast.error(res.error);
      }
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{format ? "Edit format" : "New import format"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="My Bank Export" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Spending sign</Label>
              <Select value={sign} onValueChange={(v) => setSign(v as typeof sign)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="negative_is_spending">Negative = spending</SelectItem>
                  <SelectItem value="positive_is_spending">Positive = spending</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date format</Label>
              <Input value={dateFormat} onChange={(e) => setDateFormat(e.target.value)} placeholder="MM/DD/YYYY" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Autopay / transfer patterns (one per line)</Label>
            <Textarea
              value={patterns}
              onChange={(e) => setPatterns(e.target.value)}
              rows={3}
              placeholder={"CHASE CREDIT CRD AUTOPAY\nROBINHOOD CARD PAYMENT"}
            />
            <p className="text-xs text-muted-foreground">
              Matching rows are flagged as transfers for review, never auto-deleted.
            </p>
          </div>

          {isBuiltin ? (
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              This is a built-in format. Column mapping and sign are handled by its
              adapter; you can still customize autopay patterns above.
            </p>
          ) : (
            <div className="space-y-2">
              <Label>Column mapping</Label>
              {mappings.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={m.source_column}
                    onChange={(e) =>
                      setMappings((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, source_column: e.target.value } : x)),
                      )
                    }
                    placeholder="CSV column header"
                    className="flex-1"
                  />
                  <Select
                    value={m.target_field}
                    onValueChange={(v) =>
                      setMappings((prev) =>
                        prev.map((x, j) => (j === i ? { ...x, target_field: v as string } : x)),
                      )
                    }
                  >
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TARGET_FIELDS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMappings((prev) => prev.filter((_, j) => j !== i))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setMappings((prev) => [...prev, { source_column: "", target_field: "description" }])
                }
              >
                <Plus className="size-4" /> Add column
              </Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={pending}>
            {pending ? "Saving…" : "Save format"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
