"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Wallet, Pencil } from "lucide-react";
import type { Account, ImportFormat } from "@/server/queries/lookups";
import { createAccount, updateAccount, setAccountActive } from "@/server/actions/accounts";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  checking: "Checking",
  debit_card: "Debit card",
  credit_card: "Credit card",
  savings: "Savings",
  cash: "Cash",
  other: "Other",
};

function AccountForm({
  account,
  formats,
  onDone,
}: {
  account?: Account;
  formats: ImportFormat[];
  onDone: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState(account?.account_type ?? "credit_card");
  const [formatId, setFormatId] = useState(account?.import_format_id ?? "none");
  const [sign, setSign] = useState(account?.purchase_sign ?? "negative_is_spending");
  const [active, setActive] = useState(account?.is_active ?? true);

  function onSubmit(formData: FormData) {
    formData.set("account_type", type);
    formData.set("import_format_id", formatId === "none" ? "" : formatId);
    formData.set("purchase_sign", sign);
    formData.set("is_active", String(active));
    startTransition(async () => {
      const res = account
        ? await updateAccount(account.id, formData)
        : await createAccount(formData);
      if (res.ok) {
        toast.success(account ? "Account updated" : "Account created");
        onDone();
      } else {
        toast.error(res.error);
      }
    });
  }

  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={account?.name} placeholder="Chase Credit 1" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="institution">Institution</Label>
          <Input id="institution" name="institution" defaultValue={account?.institution ?? ""} placeholder="Chase" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_four">Last 4</Label>
          <Input id="last_four" name="last_four" defaultValue={account?.last_four ?? ""} placeholder="1234" inputMode="numeric" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={type} onValueChange={(v) => setType(v as Account["account_type"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([v, l]) => (
                <SelectItem key={v} value={v}>{l}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Purchase sign</Label>
          <Select value={sign} onValueChange={(v) => setSign(v as Account["purchase_sign"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="negative_is_spending">Negative = spending</SelectItem>
              <SelectItem value="positive_is_spending">Positive = spending</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Import format</Label>
        <Select value={formatId} onValueChange={(v) => setFormatId((v as string) ?? "none")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {formats.map((f) => (
              <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <input type="hidden" name="currency" value="USD" />
      <div className="flex items-center justify-between rounded-md border p-3">
        <div>
          <p className="text-sm font-medium">Active</p>
          <p className="text-xs text-muted-foreground">Archived accounts are hidden from pickers.</p>
        </div>
        <Switch checked={active} onCheckedChange={setActive} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : account ? "Save changes" : "Create account"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AccountsClient({
  accounts,
  formats,
}: {
  accounts: Account[];
  formats: ImportFormat[];
}) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [, startTransition] = useTransition();

  return (
    <div>
      <PageHeader
        title="Accounts"
        description="Your financial accounts. Multiple accounts can share one import format."
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4" /> Add account
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New account</DialogTitle></DialogHeader>
              <AccountForm formats={formats} onDone={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      {accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title="No accounts yet"
          description="Add your first bank or credit-card account to start importing transactions."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {accounts.map((a) => (
            <Card key={a.id} className={a.is_active ? "" : "opacity-60"}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {a.institution ?? "—"}
                      {a.last_four ? ` ····${a.last_four}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => setEditing(a)}>
                    <Pencil className="size-4" />
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{ACCOUNT_TYPE_LABELS[a.account_type]}</Badge>
                  <Badge variant="outline">
                    {formats.find((f) => f.id === a.import_format_id)?.name ?? "No format"}
                  </Badge>
                  {!a.is_active && <Badge variant="destructive">Archived</Badge>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() =>
                    startTransition(async () => {
                      const res = await setAccountActive(a.id, !a.is_active);
                      if (res.ok) toast.success(a.is_active ? "Archived" : "Reactivated");
                      else toast.error(res.error);
                    })
                  }
                >
                  {a.is_active ? "Archive" : "Reactivate"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit account</DialogTitle></DialogHeader>
          {editing && (
            <AccountForm account={editing} formats={formats} onDone={() => setEditing(null)} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
