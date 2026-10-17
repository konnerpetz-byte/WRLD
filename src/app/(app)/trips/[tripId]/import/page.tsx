import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { getMembers } from "@/features/group/queries";
import { ImportFlow } from "@/features/import/import-flow";
import { allTimezones } from "@/features/trips/timezones";
import { getTrip } from "@/features/trips/queries";
import { env } from "@/lib/env";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Import bookings" };
// Reading a PDF without a text layer (OCR) can take several seconds.
export const maxDuration = 60;

export default function ImportPage(props: PageProps<"/trips/[tripId]/import">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ImportContent {...props} />
    </Suspense>
  );
}

async function ImportContent({ params }: PageProps<"/trips/[tripId]/import">) {
  const { tripId } = await params;
  const { trip, canEdit } = await getTrip(tripId);
  const { supabase, userId } = await requireUserId();
  const [{ members }, { data: profile }, { data: inbox }] = await Promise.all([
    getMembers(tripId),
    supabase.from("profiles").select("import_token").eq("id", userId).maybeSingle(),
    supabase
      .from("import_inbox")
      .select("id, subject, from_address, received_at, attachments")
      .eq("status", "new")
      .order("received_at", { ascending: false })
      .limit(20),
  ]);
  const domain = env("INBOUND_EMAIL_DOMAIN");
  const address = domain && profile?.import_token ? `${profile.import_token}@${domain}` : null;
  const when = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div>
        <h2 className="text-2xl font-semibold">Import bookings</h2>
        <p className="mt-1 text-muted-foreground">
          Already booked flights, a hotel or tickets? Bring them in and WRLD puts each one on the right day: flights and trains under
          Flights &amp; transit, places to sleep under Stays, and tickets into the itinerary.
        </p>
      </div>
      {canEdit ? (
        <ImportFlow
          tripId={tripId}
          timezones={allTimezones()}
          address={address}
          members={members.map((m) => ({ id: m.user_id, name: m.name }))}
          me={userId}
          tripCurrency={trip.currency}
          partySize={trip.party_size}
          inbox={(inbox ?? []).map((m) => ({
            id: m.id,
            subject: m.subject,
            from: m.from_address?.replace(/\s*<.*>$/, "") ?? null,
            received: when(m.received_at),
            files: m.attachments?.length ?? 0,
          }))}
        />
      ) : (
        <p className="rounded-xl border border-dashed bg-card p-5 text-sm">
          Only the trip&rsquo;s organizers can add bookings. Ask one of them, or{" "}
          <Link href={`/trips/${tripId}/group`} className="font-medium text-primary underline underline-offset-2">
            post it in the group chat
          </Link>
          .
        </p>
      )}
    </div>
  );
}
