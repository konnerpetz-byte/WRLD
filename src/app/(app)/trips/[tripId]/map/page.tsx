import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { buildMapDays } from "@/features/map/build-stops";
import { MapPanel } from "@/features/map/map-panel";
import { getItinerary, getTrip } from "@/features/trips/queries";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Map" };

export default function MapPage(props: PageProps<"/trips/[tripId]/map">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MapPageContent {...props} />
    </Suspense>
  );
}

async function MapPageContent({ params }: PageProps<"/trips/[tripId]/map">) {
  const { tripId } = await params;
  const { supabase, userId } = await requireUserId();
  const [{ trip, canEdit }, { days, transit, lodging }, { data: profile }] =
    await Promise.all([
      getTrip(tripId),
      getItinerary(tripId),
      supabase
        .from("profiles")
        .select("home_country")
        .eq("id", userId)
        .maybeSingle(),
    ]);

  const mapDays = buildMapDays(days, lodging, transit, trip.timezone);
  const center: [number, number] | null =
    trip.latitude !== null && trip.longitude !== null
      ? [trip.latitude, trip.longitude]
      : null;
  // US, Liberia and Myanmar use miles; everyone else gets kilometers.
  const unit = ["US", "LR", "MM"].includes(profile?.home_country ?? "US")
    ? "mi"
    : "km";

  return (
    <MapPanel
      tripId={tripId}
      days={mapDays}
      center={center}
      unit={unit}
      canEdit={canEdit}
    />
  );
}
