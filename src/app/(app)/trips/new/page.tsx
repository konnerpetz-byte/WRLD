import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { templateById } from "@/features/trips/templates";
import { createTrip } from "@/features/trips/trip-actions";
import { TripForm } from "@/features/trips/trip-form";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "New trip" };

export default function NewTripPage({ searchParams }: PageProps<"/trips/new">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewTripPageContent searchParams={searchParams} />
    </Suspense>
  );
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

async function NewTripPageContent({ searchParams }: { searchParams: PageProps<"/trips/new">["searchParams"] }) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const { supabase } = await requireUserId();
  const { data: countries } = await supabase.from("countries").select("code, name, currency_code").order("name");

  // Opened from "Start this trip" in Explore: city, dates, travelers and budget come filled in.
  const city = sp.city?.slice(0, 80).trim();
  const start = sp.start && DATE.test(sp.start) && sp.start >= new Date().toISOString().slice(0, 10) ? sp.start : null;
  const nights = Math.min(30, Math.max(1, Math.round(Number(sp.nights)) || 5));
  const lat = Number(sp.lat);
  const lng = Number(sp.lng);
  const prefilled = Boolean(city && start);
  const initialStops = prefilled
    ? [
        {
          city: city!,
          country_code: /^[A-Z]{2}$/.test(sp.country ?? "") ? sp.country! : "",
          latitude: Number.isFinite(lat) && Math.abs(lat) <= 90 ? lat : null,
          longitude: Number.isFinite(lng) && Math.abs(lng) <= 180 ? lng : null,
          arrive_date: start!,
          leave_date: addDays(start!, nights),
        },
      ]
    : undefined;
  const budget = Math.round(Number(sp.budget));
  const party = Math.round(Number(sp.party));
  // Started from a trip type on the homepage ("Bachelorette weekend").
  const template = templateById(sp.template);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-4xl font-semibold">New trip</h1>
      <p className="mt-1 mb-8 text-muted-foreground">
        {prefilled
          ? `Filled in from Explore: ${city}, ${nights} nights. Change anything, then create the trip.`
          : template
            ? `${template.name}: ${template.party} people and a starting budget of $${template.perPerson.toLocaleString("en-US")} each are filled in. Add where and when, then invite the group. A checklist for this kind of trip comes with it.`
            : "Add the cities you’re visiting and when. Each day gets morning, afternoon and evening blocks on that city’s clock."}
      </p>
      <TripForm
        action={createTrip}
        countries={countries ?? []}
        submitLabel="Create trip"
        template={template?.id}
        initial={
          template && !prefilled
            ? { title: template.name, party_size: template.party, budget: template.party * template.perPerson, currency: "USD" }
            : prefilled
            ? {
                title: `${city} trip`,
                party_size: party >= 1 && party <= 50 ? party : 1,
                budget: budget > 0 && budget < 10_000_000 ? budget : null,
                currency: "USD",
              }
            : undefined
        }
        initialStops={initialStops}
      />
    </div>
  );
}
