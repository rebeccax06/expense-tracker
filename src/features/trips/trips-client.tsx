"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Plane, Pencil, Archive } from "lucide-react";
import type { Trip } from "@/server/queries/lookups";
import { createTrip, updateTrip, setTripArchived } from "@/server/actions/trips";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";

type TripWithTotal = Trip & { total: number };

function TripForm({ trip, onDone }: { trip?: Trip; onDone: () => void }) {
  const [pending, startTransition] = useTransition();
  function onSubmit(formData: FormData) {
    startTransition(async () => {
      const res = trip ? await updateTrip(trip.id, formData) : await createTrip(formData);
      if (res.ok) {
        toast.success(trip ? "Trip updated" : "Trip created");
        onDone();
      } else toast.error(res.error);
    });
  }
  return (
    <form action={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" defaultValue={trip?.name} placeholder="Japan 2026" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="destination">Destination</Label>
        <Input id="destination" name="destination" defaultValue={trip?.destination ?? ""} placeholder="Tokyo" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="start_date">Start</Label>
          <Input id="start_date" name="start_date" type="date" defaultValue={trip?.start_date ?? ""} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="end_date">End</Label>
          <Input id="end_date" name="end_date" type="date" defaultValue={trip?.end_date ?? ""} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" defaultValue={trip?.notes ?? ""} rows={3} />
      </div>
      <DialogFooter>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : trip ? "Save changes" : "Create trip"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TripsClient({ trips }: { trips: TripWithTotal[] }) {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Trip | null>(null);
  const [, startTransition] = useTransition();
  const active = trips.filter((t) => !t.is_archived);

  return (
    <div>
      <PageHeader
        title="Trips"
        description="Group spending by trip. Assign trips to transactions on the Transactions page."
        action={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4" /> Add trip
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New trip</DialogTitle></DialogHeader>
              <TripForm onDone={() => setAddOpen(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      {active.length === 0 ? (
        <EmptyState icon={Plane} title="No trips yet" description="Create a trip to track its spending." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {active.map((t) => (
            <Card key={t.id} className={t.is_archived ? "opacity-60" : ""}>
              <CardContent className="space-y-3 p-4">
                <div className="flex items-start justify-between">
                  <Link href={`/trips/${t.id}`} className="hover:underline">
                    <p className="font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.destination ?? "—"}</p>
                  </Link>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(t)}>
                      <Pencil className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        startTransition(async () => {
                          const res = await setTripArchived(t.id, !t.is_archived);
                          if (res.ok) toast.success(t.is_archived ? "Restored" : "Archived");
                          else toast.error(res.error);
                        })
                      }
                    >
                      <Archive className="size-4" />
                    </Button>
                  </div>
                </div>
                <p className="text-2xl font-semibold tabular-nums">{formatCurrency(t.total)}</p>
                {(t.start_date || t.end_date) && (
                  <p className="text-xs text-muted-foreground">
                    {formatDate(t.start_date)} – {formatDate(t.end_date)}
                  </p>
                )}
                {t.is_archived && <Badge variant="outline">Archived</Badge>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit trip</DialogTitle></DialogHeader>
          {editing && <TripForm trip={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
