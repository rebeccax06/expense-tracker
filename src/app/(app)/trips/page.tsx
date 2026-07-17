import { createClient } from "@/lib/supabase/server";
import { listTrips } from "@/server/queries/lookups";
import { TripsClient } from "@/features/trips/trips-client";

export default async function TripsPage() {
  const [trips, supabase] = await Promise.all([listTrips(true), createClient()]);
  const { data } = await supabase
    .from("transactions_view")
    .select("trip_id,effective_spending")
    .not("trip_id", "is", null);

  const totals = new Map<string, number>();
  for (const r of data ?? []) {
    if (!r.trip_id) continue;
    totals.set(r.trip_id, (totals.get(r.trip_id) ?? 0) + (Number(r.effective_spending) || 0));
  }

  const tripsWithTotals = trips.map((t) => ({ ...t, total: totals.get(t.id) ?? 0 }));
  return <TripsClient trips={tripsWithTotals} />;
}
