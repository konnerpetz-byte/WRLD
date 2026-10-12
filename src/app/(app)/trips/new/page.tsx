import { NewTripForm } from "@/features/trips/new-trip-form";
import { allTimezones } from "@/features/trips/timezones";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "New trip" };

export default async function NewTripPage() {
  const { supabase } = await requireUserId();
  const { data: countries } = await supabase.from("countries").select("code, name, currency_code").order("name");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-semibold">New trip</h1>
      <p className="mt-1 mb-8 text-muted-foreground">
        Dates and destination are enough to start. Days and morning, afternoon and evening blocks are created for you.
      </p>
      <NewTripForm countries={countries ?? []} timezones={allTimezones()} />
    </div>
  );
}
