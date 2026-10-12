import Link from "next/link";

import { SaveSpotForm, SpotItem } from "@/features/spots/spot-forms";
import { requireUserId } from "@/lib/supabase/server";
import type { SavedSpot } from "@/types/database";

export const metadata = { title: "Saved spots" };

export default async function SavedPage() {
  const { supabase, userId } = await requireUserId();
  const [{ data: trips }, { data: mine }, { data: recent }] = await Promise.all([
    supabase.from("trips").select("id, title, end_date").order("start_date", { ascending: false }),
    supabase.from("saved_spots").select("*").eq("user_id", userId).is("trip_id", null).order("created_at", { ascending: false }),
    supabase.from("saved_spots").select("*").eq("user_id", userId).not("trip_id", "is", null).order("created_at", { ascending: false }).limit(12),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const tripOptions = (trips ?? []).filter((t) => t.end_date >= today).map((t) => ({ id: t.id, title: t.title }));
  const tripTitle = new Map((trips ?? []).map((t) => [t.id, t.title]));

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <header>
        <h1 className="text-4xl font-semibold">Saved spots</h1>
        <p className="mt-1 max-w-2xl text-muted-foreground">
          See a place on TikTok, Instagram or YouTube? Share it to WRLD from your phone, or paste the link here. Save it to a trip
          (and the group chat) or keep it for later.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_22rem] lg:items-start">
        <section aria-labelledby="inbox-h" className="order-2 grid gap-4 lg:order-1">
          <h2 id="inbox-h" className="text-xl font-semibold">
            Not in a trip yet
          </h2>
          {!mine?.length ? (
            <p className="rounded-xl border border-dashed bg-card p-6 text-sm text-muted-foreground">
              Spots you save without picking a trip land here. Move them into a trip when you start planning.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2">
              {(mine as SavedSpot[]).map((s) => (
                <SpotItem key={s.id} spot={s} trips={tripOptions} canEdit />
              ))}
            </ul>
          )}

          {!!recent?.length && (
            <>
              <h2 className="mt-4 text-xl font-semibold">Recently saved to trips</h2>
              <ul className="grid gap-2">
                {(recent as SavedSpot[]).map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/trips/${s.trip_id}/saved#spot-${s.id}`}
                      className="flex justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm hover:border-primary"
                    >
                      <span className="truncate font-medium">{s.place_name ?? s.title ?? s.url ?? s.note}</span>
                      <span className="shrink-0 text-muted-foreground">{tripTitle.get(s.trip_id!)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <aside className="order-1 lg:order-2" aria-label="Save a spot">
          <SaveSpotForm trips={tripOptions} />
        </aside>
      </div>
    </div>
  );
}
