import { BellRing, Pencil } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { TripTabs } from "@/components/layout/trip-tabs";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getTrip } from "@/features/trips/queries";
import { ShareTripButton } from "@/features/trips/share-trip-button";
import { formatDateRange, formatMoney, formatPoints, toNumber } from "@/lib/format";
import { requireUserId } from "@/lib/supabase/server";

export default function TripLayout({ children, params }: LayoutProps<"/trips/[tripId]">) {
  return (
    <div className="mx-auto max-w-6xl">
      <Link href="/trips" className="text-sm text-muted-foreground hover:text-foreground">
        All trips
      </Link>
      <Suspense fallback={<HeaderSkeleton />}>
        <TripHeader params={params} />
      </Suspense>
      <Suspense fallback={null}>
        <DueReminders params={params} />
      </Suspense>
      <Suspense fallback={<div className="h-[42px] border-b" />}>
        <TabsWithUnread params={params} />
      </Suspense>
      <div className="pt-6">{children}</div>
    </div>
  );
}

async function TripHeader({ params }: { params: LayoutProps<"/trips/[tripId]">["params"] }) {
  const { tripId } = await params;
  const { trip, budget, stops, canEdit } = await getTrip(tripId);
  const route = stops.length ? stops.map((s) => s.city).join(" → ") : trip.destination;

  const { supabase } = await requireUserId();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: points }, { count: daysAhead }, { data: comfort }] = await Promise.all([
    supabase.from("trip_points_planned").select("points_committed, points_ideas").eq("trip_id", tripId),
    supabase.from("trip_days").select("id", { count: "exact", head: true }).eq("trip_id", tripId).gte("date", today),
    supabase.rpc("trip_budget_comfort_summary", { p_trip_id: tripId }),
  ]);

  const projected = toNumber(budget?.projected_total) ?? 0;
  const limit = toNumber(trip.budget);
  const over = limit !== null && projected > limit;
  const party = Math.max(1, trip.party_size);
  const totalPoints = (points ?? []).reduce((sum, p) => sum + (toNumber(p.points_committed) ?? 0) + (toNumber(p.points_ideas) ?? 0), 0);
  // Days still to plan for: the days ahead, or the whole trip once it's over.
  const days = Math.max(1, daysAhead || Math.round((Date.parse(trip.end_date) - Date.parse(trip.start_date)) / 86400000) + 1);
  const leftPerPersonPerDay = limit !== null && !over ? (limit - projected) / party / days : null;
  const c = comfort?.[0];
  const askComfort = c && Number(c.members) > 1 && c.mine == null;

  return (
    <header className="mt-2 mb-6 grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
      <div>
        <h1 className="text-4xl font-semibold">{trip.title}</h1>
        <p className="mt-1 text-muted-foreground">
          {[route, formatDateRange(trip.start_date, trip.end_date), `${trip.party_size} traveler${trip.party_size > 1 ? "s" : ""}`]
            .filter(Boolean)
            .join(", ")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {canEdit && (
            <Button asChild variant="outline" size="sm">
              <Link href={`/trips/${trip.id}/edit`}>
                <Pencil aria-hidden="true" /> Edit trip
              </Link>
            </Button>
          )}
          <ShareTripButton tripId={trip.id} title={trip.title} dates={formatDateRange(trip.start_date, trip.end_date)} />
        </div>
      </div>
      {/* Trip cost bar: what the whole trip costs, in cash and points, and what's left per person each day. */}
      <Link
        href={`/trips/${trip.id}/budget${askComfort ? "#comfort-h" : ""}`}
        className="grid min-w-72 gap-2 rounded-2xl border bg-card px-4 py-3 transition-[border-color,box-shadow] duration-150 hover:border-primary/60 hover:shadow-[0_8px_24px_-14px_rgb(29_43_38/0.35)] focus-visible:outline-2 focus-visible:outline-ring"
      >
        <span className="flex items-baseline justify-between gap-4">
          <span className="text-sm text-muted-foreground">Trip total</span>
          <span className="text-right">
            <span className={`font-display text-2xl font-semibold tabular-nums ${over ? "text-destructive" : ""}`}>
              {formatMoney(projected, trip.currency, { cents: false })}
            </span>
            {totalPoints > 0 && <span className="block text-xs font-medium text-travel-ink">+ {formatPoints(totalPoints)} points</span>}
          </span>
        </span>
        {party > 1 && (
          <span className="flex justify-between text-sm">
            <span className="text-muted-foreground">Per person</span>
            <span className="font-medium tabular-nums">{formatMoney(projected / party, trip.currency, { cents: false })}</span>
          </span>
        )}
        {limit !== null && (
          <>
            <Progress value={Math.min(100, (projected / Math.max(limit, 1)) * 100)} className="h-1.5" aria-hidden="true" />
            <span className={`text-xs ${over ? "font-medium text-destructive" : "text-muted-foreground"}`}>
              {over
                ? `${formatMoney(projected - limit, trip.currency, { cents: false })} over the ${formatMoney(limit, trip.currency, { cents: false })} budget`
                : `${formatMoney(limit - projected, trip.currency, { cents: false })} left · about ${formatMoney(leftPerPersonPerDay, trip.currency, { cents: false })} per person per day`}
            </span>
          </>
        )}
        {limit === null && !askComfort && <span className="text-xs text-muted-foreground">Set a budget to see what&rsquo;s left each day</span>}
        {askComfort && (
          <span className="rounded-lg bg-open-soft px-2.5 py-1.5 text-xs font-medium text-primary">
            Add your private budget. Only the group&rsquo;s lowest number is shown.
          </span>
        )}
      </Link>
    </header>
  );
}

function HeaderSkeleton() {
  return (
    <div className="mt-2 mb-6 flex animate-pulse items-end justify-between gap-6" aria-hidden="true">
      <div>
        <div className="h-10 w-64 rounded-md bg-muted" />
        <div className="mt-2 h-4 w-80 rounded bg-muted" />
      </div>
      <div className="h-16 w-64 rounded-xl bg-muted" />
    </div>
  );
}

/** Tabs, with a badge for unread group messages. */
async function TabsWithUnread({ params }: { params: LayoutProps<"/trips/[tripId]">["params"] }) {
  const { tripId } = await params;
  const { supabase, userId } = await requireUserId();
  const { data: me } = await supabase.from("trip_members").select("last_read_at").eq("trip_id", tripId).eq("user_id", userId).maybeSingle();
  let query = supabase.from("trip_messages").select("id", { count: "exact", head: true }).eq("trip_id", tripId).neq("user_id", userId);
  if (me?.last_read_at) query = query.gt("created_at", me.last_read_at);
  const { count } = await query;
  return <TripTabs unread={count ?? 0} />;
}

/** Your document reminders for this trip that are due today or overdue. */
async function DueReminders({ params }: { params: LayoutProps<"/trips/[tripId]">["params"] }) {
  const { tripId } = await params;
  const { supabase, userId } = await requireUserId();
  const today = new Date().toISOString().slice(0, 10);
  const { data: due } = await supabase
    .from("checklist_items")
    .select("id, title, remind_on, info_url")
    .eq("trip_id", tripId)
    .eq("list", "documents")
    .eq("assigned_to", userId)
    .eq("done", false)
    .lte("remind_on", today)
    .order("remind_on");
  if (!due?.length) return null;
  return (
    <div role="status" className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-travel bg-travel-soft px-4 py-3 text-sm">
      <BellRing className="size-4 shrink-0" aria-hidden="true" />
      <strong>Reminder:</strong>
      <span className="min-w-0 flex-1">{due.map((d) => d.title).join(" · ")}</span>
      <Link href={`/trips/${tripId}/checklist#docs-h`} className="font-medium underline underline-offset-2">
        Open documents
      </Link>
    </div>
  );
}
