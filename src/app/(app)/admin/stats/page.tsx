import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { requireUserId } from "@/lib/supabase/server";
import { viatorSearch } from "@/features/experiences/providers";
import type { AdminStats } from "@/types/database";
import { env } from "@/lib/env";

export const metadata = { title: "Stats" };

const RANGES = [7, 30, 90, 365] as const;

export default function StatsPage({ searchParams }: PageProps<"/admin/stats">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StatsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function StatsContent({ searchParams }: { searchParams: PageProps<"/admin/stats">["searchParams"] }) {
  const { supabase } = await requireUserId();
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) notFound();

  const raw = Number((await searchParams).days);
  const days = (RANGES as readonly number[]).includes(raw) ? raw : 30;
  const { data: s, error } = await supabase.rpc("admin_stats", { p_days: days });
  if (error || !s) return <p role="alert">Couldn&apos;t load stats: {error?.message ?? "no data"}</p>;
  const stats = s as AdminStats;
  const { data: links } = await supabase
    .from("attractions")
    .select("slug, name, city, official_url, link_status, link_checked_at")
    .or("link_status.lt.200,link_status.gt.399")
    .order("city");

  const clicks = Object.entries(stats.booking_clicks.by_provider).sort((a, b) => b[1] - a[1]);

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">WRLD stats</h1>
          <p className="text-sm text-muted-foreground">Only you can see this page. Numbers cover the last {days} days unless they say otherwise.</p>
        </div>
        <nav aria-label="Time range" className="flex gap-1 rounded-lg border p-1 text-sm">
          {RANGES.map((d) => (
            <Link
              key={d}
              href={`/admin/stats?days=${d}`}
              aria-current={d === days ? "page" : undefined}
              className={`rounded-md px-3 py-1 ${d === days ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            >
              {d === 365 ? "1 year" : `${d} days`}
            </Link>
          ))}
        </nav>
      </header>

      <section aria-labelledby="totals-h" className="grid gap-3">
        <h2 id="totals-h" className="sr-only">Totals</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label="People signed up (all time)" value={stats.totals.users} />
          <Tile label="Trips (all time)" value={stats.totals.trips} />
          <Tile label="Used the app, last 7 days" value={stats.totals.active_7d} />
          <Tile label="Used the app, last 30 days" value={stats.totals.active_30d} />
        </div>
      </section>

      <section aria-labelledby="five-h" className="grid gap-3">
        <h2 id="five-h" className="text-xl font-semibold">The five numbers</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Metric
            n={1}
            title="Do new people get started?"
            part={stats.started.made_a_trip}
            whole={stats.started.new_users}
            detail={`${stats.started.made_a_trip} of ${stats.started.new_users} new people made a trip. ${stats.started.trips_created} trips created in total.`}
            goal="Aim for more than half."
          />
          <Metric
            n={2}
            title="Do invited friends join?"
            part={stats.invites.trips_where_friends_joined}
            whole={stats.invites.trips_with_invite}
            detail={`${stats.invites.trips_where_friends_joined} of ${stats.invites.trips_with_invite} trips with an invite link got at least one friend. ${stats.invites.friends_joined} friends joined; ${stats.invites.invited_friends_who_were_new} were brand-new to WRLD.`}
            goal="This is your free growth. Aim for more than half."
          />
          <Metric
            n={3}
            title="Do people come back a week later?"
            part={stats.return.came_back}
            whole={stats.return.eligible}
            detail={`${stats.return.came_back} of ${stats.return.eligible} people who signed up at least a week ago used WRLD again 7+ days later. Counting started Oct 12, 2026.`}
            goal="Travel apps that last usually keep 20% or more."
          />
          <Metric
            n={4}
            title="Do suggestions fit the person?"
            part={stats.suggestions.added}
            whole={stats.suggestions.shown}
            detail={`${stats.suggestions.added} bookable suggestions added to a trip out of ${stats.suggestions.shown} shown.`}
            goal="Above 10% means the matching works."
          />
          <div className="rounded-xl border bg-card p-4 md:col-span-2">
            <p className="text-xs font-medium text-muted-foreground">5 · Booking clicks (future commission)</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{stats.booking_clicks.total}</p>
            {clicks.length > 0 ? (
              <ul className="mt-2 flex flex-wrap gap-2 text-sm">
                {clicks.map(([provider, n]) => (
                  <li key={provider} className="rounded-full bg-muted px-3 py-1">
                    {LABEL[provider] ?? provider}: <span className="font-medium tabular-nums">{n}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">No clicks yet. Clicks on official ticket links are counted too, even though they don&apos;t earn money.</p>
            )}
          </div>
        </div>
      </section>

      <section aria-labelledby="weekly-h" className="grid gap-3">
        <h2 id="weekly-h" className="text-xl font-semibold">Last 8 weeks</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">Week of</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Sign-ups</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">People active</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Trips created</th>
              </tr>
            </thead>
            <tbody>
              {stats.weekly.map((w) => (
                <tr key={w.week} className="border-t">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    {new Date(`${w.week}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{w.signups}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{w.active}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{w.trips}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section aria-labelledby="eng-h" className="grid gap-3">
        <h2 id="eng-h" className="text-xl font-semibold">What people did</h2>
        <div className="grid grid-cols-3 gap-3">
          <Tile label="Itinerary items added" value={stats.engagement.itinerary_items} />
          <Tile label="Chat messages" value={stats.engagement.chat_messages} />
          <Tile label="Reels and links saved" value={stats.engagement.saved_spots} />
        </div>
      </section>

      <section aria-labelledby="conn-h" className="grid gap-3">
        <h2 id="conn-h" className="text-xl font-semibold">Partner connections</h2>
        <Suspense fallback={<p className="text-sm text-muted-foreground">Checking…</p>}>
          <Connections />
        </Suspense>
      </section>

      <section aria-labelledby="links-h" className="grid gap-3">
        <h2 id="links-h" className="text-xl font-semibold">Official links to look at</h2>
        <p className="text-sm text-muted-foreground">
          Checked every Monday. 400, 403 and 429 usually mean the site blocks automated checks but works for people; -1 means no answer.
        </p>
        {links && links.length > 0 ? (
          <ul className="grid gap-1 text-sm">
            {links.map((l) => (
              <li key={l.slug} className="flex flex-wrap items-baseline gap-x-2">
                <a href={l.official_url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-2">
                  {l.name}
                </a>
                <span className="text-muted-foreground">{l.city}</span>
                <span className="rounded bg-muted px-1.5 text-xs tabular-nums">{l.link_status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm">All official links answered at the last check.</p>
        )}
      </section>

      <p className="text-sm text-muted-foreground">
        Website visits and where people came from (Google, Reddit, TikTok) are in Vercel: open the <strong>wrld</strong> project and click the{" "}
        <strong>Analytics</strong> tab.
      </p>
    </div>
  );
}

const LABEL: Record<string, string> = {
  viator: "Viator",
  getyourguide: "GetYourGuide",
  tripadvisor: "Tripadvisor",
  airbnb: "Airbnb",
  official: "Official tickets",
  other: "Other",
};

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>
    </div>
  );
}

function Metric({ n, title, part, whole, detail, goal }: { n: number; title: string; part: number; whole: number; detail: string; goal: string }) {
  const pct = whole > 0 ? Math.round((part / whole) * 100) : null;
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">
        {n} · {title}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{pct === null ? "—" : `${pct}%`}</p>
      {pct !== null && (
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
        </div>
      )}
      <p className="mt-2 text-sm">{pct === null ? "Not enough data yet." : detail}</p>
      <p className="mt-1 text-xs text-muted-foreground">{goal}</p>
    </div>
  );
}

/** Which partner keys are set in Vercel, and whether Viator actually answers. */
async function Connections() {
  const viatorKey = Boolean(env("VIATOR_API_KEY"));
  const viatorResults = viatorKey ? await viatorSearch("Lisbon", "walking tour", "USD") : [];
  const rows: { name: string; ok: boolean; note: string }[] = [
    {
      name: "Viator",
      ok: viatorKey && viatorResults.length > 0,
      note: !viatorKey
        ? "No VIATOR_API_KEY yet: sample listings are shown."
        : viatorResults.length
          ? `Working: a test search for Lisbon walking tours returned ${viatorResults.length} live listings.`
          : "Key is set but the test search returned nothing. Check the key, or set VIATOR_API_BASE if it's a sandbox key.",
    },
    {
      name: "Viator link tracking",
      ok: Boolean(env("VIATOR_PID")),
      note: env("VIATOR_PID") ? "Search links carry your partner ID." : "Add VIATOR_PID (and VIATOR_MCID) so plain Viator search links earn commission too.",
    },
    {
      name: "GetYourGuide",
      ok: Boolean(process.env.GETYOURGUIDE_PARTNER_ID),
      note: process.env.GETYOURGUIDE_PARTNER_ID ? "Partner ID added to every link." : "Waiting for GETYOURGUIDE_PARTNER_ID.",
    },
    {
      name: "Seats.aero (award flights)",
      ok: Boolean(process.env.SEATS_AERO_API_KEY),
      note: process.env.SEATS_AERO_API_KEY ? "Live award search is on." : "Waiting for SEATS_AERO_API_KEY: sample results are shown.",
    },
    {
      name: "AwardWallet (balances)",
      ok: Boolean(process.env.AWARDWALLET_CLIENT_ID),
      note: process.env.AWARDWALLET_CLIENT_ID ? "Connect button is live." : "Waiting for AwardWallet API access.",
    },
  ];
  return (
    <ul className="grid gap-2 text-sm">
      {rows.map((r) => (
        <li key={r.name} className="flex items-start gap-3 rounded-lg border bg-card px-3 py-2">
          <span className={`mt-1.5 size-2 shrink-0 rounded-full ${r.ok ? "bg-open" : "bg-muted-foreground/40"}`} aria-hidden="true" />
          <span>
            <strong>{r.name}</strong> <span className="sr-only">{r.ok ? "(connected)" : "(not connected)"}</span>
            <span className="block text-muted-foreground">{r.note}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
