import { notFound } from "next/navigation";

import { DeleteTripForm } from "@/features/trips/delete-trip-form";
import { getTrip } from "@/features/trips/queries";
import { updateTrip } from "@/features/trips/trip-actions";
import { TripForm } from "@/features/trips/trip-form";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Edit trip" };

export default async function EditTripPage({ params }: PageProps<"/trips/[tripId]/edit">) {
  const { tripId } = await params;
  const { supabase } = await requireUserId();
  const [{ trip, stops, canEdit, role }, { data: countries }, { data: currencies }] = await Promise.all([
    getTrip(tripId),
    supabase.from("countries").select("code, name, currency_code").order("name"),
    supabase.from("currencies").select("*").order("code"),
  ]);
  if (!canEdit) notFound();

  return (
    <div className="mx-auto grid max-w-2xl gap-10">
      <section aria-labelledby="edit-heading">
        <h2 id="edit-heading" className="mb-4 text-2xl font-semibold">
          Edit trip
        </h2>
        <TripForm
          action={updateTrip.bind(null, tripId)}
          countries={countries ?? []}
          currencies={currencies ?? []}
          initial={{ title: trip.title, party_size: trip.party_size, budget: trip.budget, currency: trip.currency }}
          initialStops={stops.map((s) => ({
            id: s.id,
            city: s.city,
            country_code: s.country_code ?? "",
            latitude: s.latitude,
            longitude: s.longitude,
            arrive_date: s.arrive_date,
            leave_date: s.leave_date,
          }))}
          submitLabel="Save changes"
        />
      </section>
      {role === "owner" && <DeleteTripForm tripId={tripId} title={trip.title} />}
    </div>
  );
}
