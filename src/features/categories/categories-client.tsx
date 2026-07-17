"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Tags, Pencil, Archive, Trash2 } from "lucide-react";
import type { Category } from "@/server/queries/lookups";
import {
  createCategory,
  renameCategory,
  setCategoryArchived,
  deleteCategory,
} from "@/server/actions/categories";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export function CategoriesClient({ categories }: { categories: Category[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const [editing, setEditing] = useState<Category | null>(null);
  const [editName, setEditName] = useState("");
  const [deleting, setDeleting] = useState<Category | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("none");

  const active = categories.filter((c) => !c.is_archived);
  const archived = categories.filter((c) => c.is_archived);

  function add() {
    if (!name.trim()) return;
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("color", color);
    startTransition(async () => {
      const res = await createCategory(fd);
      if (res.ok) {
        toast.success("Category added");
        setName("");
      } else toast.error(res.error);
    });
  }

  function saveRename() {
    if (!editing) return;
    startTransition(async () => {
      const res = await renameCategory(editing.id, editName.trim());
      if (res.ok) {
        toast.success("Renamed");
        setEditing(null);
      } else toast.error(res.error);
    });
  }

  function confirmDelete() {
    if (!deleting) return;
    startTransition(async () => {
      const res = await deleteCategory(deleting.id, reassignTo === "none" ? null : reassignTo);
      if (res.ok) {
        toast.success("Category deleted");
        setDeleting(null);
        setReassignTo("none");
      } else toast.error(res.error);
    });
  }

  return (
    <div>
      <PageHeader
        title="Categories"
        description="Name and manage your spending categories."
      />

      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="flex-1 space-y-2">
            <Label htmlFor="cat-name">New category</Label>
            <Input
              id="cat-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Groceries"
              onKeyDown={(e) => e.key === "Enter" && add()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-color">Color</Label>
            <input
              id="cat-color"
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border bg-transparent"
            />
          </div>
          <Button onClick={add} disabled={pending || !name.trim()}>
            <Plus className="size-4" /> Add
          </Button>
        </CardContent>
      </Card>

      {active.length === 0 && archived.length === 0 ? (
        <EmptyState icon={Tags} title="No categories yet" description="Add your first category above." />
      ) : (
        <div className="grid gap-2">
          {active.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              onEdit={() => {
                setEditing(c);
                setEditName(c.name);
              }}
              onArchive={() =>
                startTransition(async () => {
                  const res = await setCategoryArchived(c.id, true);
                  if (res.ok) toast.success("Archived");
                  else toast.error(res.error);
                })
              }
              onDelete={() => setDeleting(c)}
            />
          ))}
          {archived.length > 0 && (
            <>
              <p className="mt-4 text-xs font-medium uppercase text-muted-foreground">Archived</p>
              {archived.map((c) => (
                <CategoryRow
                  key={c.id}
                  category={c}
                  archived
                  onEdit={() => {
                    setEditing(c);
                    setEditName(c.name);
                  }}
                  onArchive={() =>
                    startTransition(async () => {
                      const res = await setCategoryArchived(c.id, false);
                      if (res.ok) toast.success("Restored");
                      else toast.error(res.error);
                    })
                  }
                  onDelete={() => setDeleting(c)}
                />
              ))}
            </>
          )}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rename category</DialogTitle></DialogHeader>
          <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
          <DialogFooter>
            <Button onClick={saveRename} disabled={pending}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete “{deleting?.name}”?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Optionally reassign transactions in this category to another one.
          </p>
          <Select value={reassignTo} onValueChange={(v) => setReassignTo((v as string) ?? "none")}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Don&apos;t reassign (clear category)</SelectItem>
              {active
                .filter((c) => c.id !== deleting?.id)
                .map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDelete} disabled={pending}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CategoryRow({
  category,
  archived,
  onEdit,
  onArchive,
  onDelete,
}: {
  category: Category;
  archived?: boolean;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border p-3">
      <div className="flex items-center gap-3">
        <span
          className="size-4 rounded-full border"
          style={{ backgroundColor: category.color ?? "transparent" }}
        />
        <span className="text-sm font-medium">{category.name}</span>
        {archived && <Badge variant="outline">Archived</Badge>}
      </div>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" onClick={onEdit}><Pencil className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onArchive}><Archive className="size-4" /></Button>
        <Button variant="ghost" size="icon" onClick={onDelete}><Trash2 className="size-4" /></Button>
      </div>
    </div>
  );
}
