import { createTrip } from "@/features/trips/trip-actions";
import { TripForm } from "@/features/trips/trip-form";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "New trip" };

export default async function NewTripPage() {
  const { supabase } = await requireUserId();
  const [{ data: countries }, { data: currencies }] = await Promise.all([
    supabase.from("countries").select("code, name, currency_code").order("name"),
    supabase.from("currencies").select("*").order("code"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-semibold">New trip</h1>
      <p className="mt-1 mb-8 text-muted-foreground">
        Add the cities you&rsquo;re visiting and when. Each day gets morning, afternoon and evening blocks on that city&rsquo;s clock.
      </p>
      <TripForm action={createTrip} countries={countries ?? []} currencies={currencies ?? []} submitLabel="Create trip" />
    </div>
  );
}
