import Link from "next/link";

import { monthOptions } from "@/features/awards/engine";
import { fxFrom } from "@/features/awards/fees";
import { PointsOrCash } from "@/features/awards/points-or-cash";
import { AIRPORT_CITY, REGIONS, type RegionKey, SOURCE_PROGRAM } from "@/features/awards/regions";
import { BANKS } from "@/features/awards/transfers";
import { tripAirport } from "@/features/onboarding/progress";
import { toUsd } from "@/lib/currency";
import { optionalUserId, requireUserId } from "@/lib/supabase/server";

import { type Style, STYLES } from "./costs";
import { type PlanSort, parsePoints, planTrips, POINT_KEYS, type Points, sortOptions } from "./plan";
import { PlannerForm } from "./planner-form";
import { TripCard } from "./planner-results";

const IATA = /^[A-Z]{3}$/;
const int = (v: string | undefined, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
};

/**
 * The trip planner, in two places:
 *   - Explore (/points): budget first, "where can my cash and points take me?"
 *   - Inside a trip (/trips/[id]/points): that trip's airport, dates, travelers and budget.
 */
export async function PlannerView({
  sp,
  basePath,
  tripId: fixedTrip,
  publicMode = false,
}: {
  sp: Record<string, string | undefined>;
  basePath: string;
  tripId?: string;
  /** The public page (/plan): no account needed; a signed-in visitor still gets their home airport and points filled in. */
  publicMode?: boolean;
}) {
  const { supabase, userId } = publicMode ? await optionalUserId() : await requireUserId();
  const uid = userId ?? "00000000-0000-0000-0000-000000000000";

  const [{ data: profile }, { data: accounts }, { data: rates }, { data: isAdmin }] = await Promise.all([
    supabase.from("profiles").select("home_airport").eq("id", uid).maybeSingle(),
    supabase.from("loyalty_accounts").select("balance, program:loyalty_programs(slug)").eq("user_id", uid),
    supabase.from("exchange_rates").select("quote, rate, as_of").order("as_of", { ascending: false }).limit(400),
    userId ? supabase.rpc("is_app_admin") : Promise.resolve({ data: false }),
  ]);

  // Wallet balances, by the planner's keys (banks and airline programs).
  const keyOfSlug = new Map<string, string>([
    ...BANKS.map((b) => [b.slug, b.key] as [string, string]),
    ["world_of_hyatt", "hyatt"],
    ...Object.entries(SOURCE_PROGRAM)
      .filter(([, p]) => p.slug)
      .map(([k, p]) => [p.slug!, k] as [string, string]),
  ]);
  const wallet: Points = {};
  for (const a of accounts ?? []) {
    const key = keyOfSlug.get((a.program as unknown as { slug: string } | null)?.slug ?? "");
    if (key) wallet[key] = (wallet[key] ?? 0) + Math.max(0, Math.round(Number(a.balance ?? 0)));
  }
  const rateMap = new Map<string, number>();
  for (const r of rates ?? []) if (!rateMap.has(r.quote)) rateMap.set(r.quote, Number(r.rate));
  const fx = fxFrom(rateMap);

  // Opened from a trip: price that trip (its airport, dates, travelers and budget) unless the form says otherwise.
  const tripId = publicMode ? null : (fixedTrip ?? (sp.trip && /^[0-9a-f-]{36}$/i.test(sp.trip) ? sp.trip : null));
  const [{ data: forTrip }, { count: members }] = tripId
    ? await Promise.all([
        supabase.from("trips").select("id, title, start_date, end_date, budget, currency").eq("id", tripId).maybeSingle(),
        supabase.from("trip_members").select("user_id", { count: "exact", head: true }).eq("trip_id", tripId),
      ])
    : [{ data: null }, { count: null }];
  // The trip's first stop, so hotel and daily costs are for the city you're going to, not just its airport.
  const { data: firstStop } = forTrip
    ? await supabase
        .from("trip_stops")
        .select("city, country_code, latitude, longitude")
        .eq("trip_id", forTrip.id)
        .order("arrive_date")
        .order("position")
        .limit(1)
        .maybeSingle()
    : { data: null };
  const only =
    sp.to && IATA.test(sp.to.toUpperCase())
      ? sp.to.toUpperCase()
      : firstStop?.latitude != null && firstStop.longitude != null
        ? tripAirport([{ latitude: firstStop.latitude, longitude: firstStop.longitude }])
        : null;
  const tripPlace = firstStop?.city && firstStop.country_code ? { city: firstStop.city, country: firstStop.country_code } : null;
  const tripNights = forTrip ? Math.round((Date.parse(forTrip.end_date) - Date.parse(forTrip.start_date)) / 86400000) : null;
  const tripBudget = forTrip?.budget != null ? Math.round(toUsd(Number(forTrip.budget), forTrip.currency) ?? Number(forTrip.budget)) : null;

  const months = monthOptions();
  const home = (sp.from ?? profile?.home_airport ?? "").toUpperCase().trim();
  const cashRaw = sp.cash ?? (tripBudget != null ? String(tripBudget) : undefined);
  const budgetSet = cashRaw !== undefined && cashRaw.trim() !== "";
  const cash = budgetSet ? Math.round(Number(cashRaw!.replace(/[^0-9.]/g, ""))) || 0 : 0;
  const points = sp.pts !== undefined ? parsePoints(sp.pts) : wallet;
  const nights = int(sp.nights, 1, 30, tripNights && tripNights >= 1 ? Math.min(tripNights, 30) : 5);
  const travelers = int(sp.travelers, 1, 8, members ? Math.min(members, 8) : 1);
  const style: Style = sp.style && sp.style in STYLES ? (sp.style as Style) : "mid";
  const tripMonth = (sp.month ?? sp.start ?? forTrip?.start_date ?? "").slice(0, 7);
  const month = months.some((m) => m.value === tripMonth) ? tripMonth : months[1].value;
  const region = sp.region && (sp.region === "anywhere" || sp.region in REGIONS) ? (sp.region as RegionKey | "anywhere") : "anywhere";
  const sort: PlanSort = sp.sort === "cash" || sp.sort === "value" ? sp.sort : "most";
  const monthLabel = months.find((m) => m.value === month)?.label ?? month;

  const ready = IATA.test(home) && (budgetSet || Boolean(only));
  const plan = ready
    ? await planTrips(
        supabase,
        {
          home,
          cash: budgetSet ? cash : Infinity,
          points,
          nights,
          travelers,
          style,
          month,
          region,
          only,
          dates: only && forTrip && !sp.month ? { start: forTrip.start_date, end: forTrip.end_date } : null,
          place: tripPlace,
        },
        fx
      )
    : null;
  const sorted = plan ? sortOptions(plan.options, sort) : [];
  if (plan && userId) {
    // Usage: does this traveler start from a budget ("where can I go") or from a trip they already have?
    const fitCount = plan.options.filter((t) => t.fit === "fits").length;
    await supabase
      .from("app_events")
      .insert({
        user_id: userId,
        kind: "planner_run",
        trip_id: forTrip?.id ?? null,
        provider: only ? (budgetSet ? "trip" : "trip_nobudget") : "explore",
        count: Math.min(50, Math.max(1, fitCount)),
      })
      .then(
        () => undefined,
        () => undefined
      );
  }
  const fits = sorted.filter((t) => t.fit === "fits").slice(0, 12);
  const stretch = sorted.filter((t) => t.fit === "stretch").slice(0, 6);

  const totalPoints = Object.values(points).reduce((s, n) => s + n, 0);
  const sortHref = (s: PlanSort) => {
    const p = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string"));
    p.set("sort", s);
    return `${basePath}?${p}#results`;
  };

  return (
    <div className="grid gap-8">
      {!fixedTrip && !publicMode && (
        <header>
          <h1 className="text-4xl font-semibold">Explore</h1>
          <p className="mt-1 max-w-prose text-muted-foreground">
            Have a budget but no destination yet? See where your cash and points can take you, then start the trip in one click.
          </p>
        </header>
      )}
      {forTrip && !fixedTrip && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-open-soft px-4 py-3 text-sm">
          <span>
            For your trip <strong>{forTrip.title}</strong>. Booked the flight? Add it so your days fit around it.
          </span>
          <Link href={`/trips/${forTrip.id}/transit`} className="font-medium text-primary underline underline-offset-2">
            Add the flight
          </Link>
        </p>
      )}

      <section aria-label="Your budget" className="grid gap-5 rounded-2xl border bg-card p-5 sm:p-6">
        <div className={publicMode ? "sr-only" : undefined}>
          <h2 id="plan-h" className="text-xl font-semibold">
            {only ? `What will ${AIRPORT_CITY[only] ?? only} cost with your points?` : "Where can your cash and points take you?"}
          </h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            Tell WRLD what you have. It prices the whole trip, flights, hotel and days there, and shows the places you can afford, with the
            best way to use each point.
            {Object.keys(wallet).length > 0 && sp.pts === undefined ? " Your points are filled in from My points." : ""}
          </p>
        </div>
        <PlannerForm
          initial={{
            home,
            cash: cashRaw ?? "",
            points: Object.entries(points).map(([key, n]) => ({ key, amount: n.toLocaleString("en-US") })),
            nights: String(nights),
            travelers: String(travelers),
            style,
            month,
            region,
            sort,
          }}
          keep={{ to: only ?? undefined, trip: fixedTrip ? undefined : forTrip?.id }}
          action={basePath}
          pointKeys={POINT_KEYS}
          months={months}
          regions={Object.entries(REGIONS).map(([value, r]) => ({ value, label: r.label }))}
          styles={Object.entries(STYLES).map(([value, s]) => ({ value, label: s.label, hint: s.hint }))}
        />
      </section>

      {plan && (
        <section id="results" aria-labelledby="results-h" className="grid scroll-mt-6 gap-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <h2 id="results-h" className="text-lg font-semibold">
                {only
                  ? `Your trip to ${AIRPORT_CITY[only] ?? only}`
                  : fits.length
                  ? `${fits.length}${
                      sorted.filter((t) => t.fit === "fits").length > fits.length ? "+" : ""
                    } trips fit $${cash.toLocaleString("en-US")}${totalPoints ? ` and ${totalPoints.toLocaleString("en-US")} points` : ""}`
                  : "Nothing fits this budget yet"}
              </h2>
              <p className="text-sm text-muted-foreground">
                From {home}, {monthLabel}, {nights} nights, {travelers} traveler{travelers === 1 ? "" : "s"},{" "}
                {STYLES[style].label.toLowerCase()}.
              </p>
            </div>
            {!only && (
              <nav aria-label="Sort trips" className="flex flex-wrap gap-1 text-sm">
                {(
                  [
                    ["most", "Biggest trip"],
                    ["cash", "Most cash left"],
                    ["value", "Best use of points"],
                  ] as const
                ).map(([s, label]) => (
                  <Link
                    key={s}
                    href={sortHref(s)}
                    aria-current={sort === s ? "true" : undefined}
                    className={`rounded-full border px-3 py-1.5 ${
                      sort === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted"
                    }`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
            )}
          </div>

          {!plan.liveFares && (
            <p className="rounded-xl bg-travel/15 px-4 py-3 text-sm">
              Flight prices are estimates from distance for now. Today&rsquo;s real fares are coming soon.
              {isAdmin && (
                <>
                  {" "}
                  <strong>Owner setup:</strong> add <code className="font-mono text-xs">TRAVELPAYOUTS_TOKEN</code> in Vercel.
                </>
              )}
            </p>
          )}

          {only ? (
            sorted.length ? (
              <ul className="grid gap-3">
                {sorted.map((t) => (
                  <TripCard
                    key={t.code}
                    t={t}
                    home={home}
                    month={month}
                    monthLabel={monthLabel}
                    cash={budgetSet ? cash : null}
                    travelers={travelers}
                    nights={nights}
                    tripId={forTrip?.id}
                  />
                ))}
              </ul>
            ) : (
              <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
                WRLD can&rsquo;t price a flight from {home} to {only}. Check both airport codes.
              </p>
            )
          ) : fits.length ? (
            <ul className="grid gap-3">
              {fits.map((t) => (
                <TripCard
                  key={t.code}
                  t={t}
                  home={home}
                  month={month}
                  monthLabel={monthLabel}
                  cash={cash}
                  travelers={travelers}
                  nights={nights}
                />
              ))}
            </ul>
          ) : (
            <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
              Try fewer nights, the budget travel style, or another month. The trips just over budget are below.
            </p>
          )}

          {!only && stretch.length > 0 && (
            <>
              <h3 className="mt-2 px-1 font-semibold">A little over budget</h3>
              <ul className="grid gap-3">
                {stretch.map((t) => (
                  <TripCard
                    key={t.code}
                    t={t}
                    home={home}
                    month={month}
                    monthLabel={monthLabel}
                    cash={cash}
                    travelers={travelers}
                    nights={nights}
                  />
                ))}
              </ul>
            </>
          )}

          <details className="rounded-2xl border bg-card px-5 py-4 text-sm">
            <summary className="cursor-pointer font-medium">How WRLD prices these trips</summary>
            <div className="mt-3 grid max-w-prose gap-2 text-muted-foreground">
              <p>
                <strong className="text-foreground">Flights:</strong> economy, round trip.{" "}
                {plan.liveFares
                  ? "Cash prices are the lowest recent fares travelers found: around your dates for a trip, across the month otherwise. When there's no return fare, the outbound price is used for it and the card says so."
                  : "Cash prices are estimates from distance until live fares are on."}{" "}
                Points prices come from published award charts (Air Canada Aeroplan, American AAdvantage, Virgin Atlantic), counted at the
                top of their range, and only where a partner airline flies the route.
              </p>
              <p>
                <strong className="text-foreground">Card points:</strong> Chase, Amex, Capital One and Citi points pay 1¢ each for any
                flight on the card&rsquo;s travel site, and 1¢ for hotels (Amex: 0.7¢). Chase and Bilt points can also move to
                World of Hyatt, where a point typically buys about 1.65¢ of hotel (The Points Guy, October 2026); WRLD estimates Hyatt
                nights from that, so check a real Hyatt in the city before moving points. WRLD tries each way to pay and keeps the one that
                needs the least cash.
              </p>
              <p>
                <strong className="text-foreground">Hotel and days there:</strong> from U.S. government per diem rates (State Department for
                1,000+ cities abroad, updated monthly), which are what a business traveler is reimbursed. WRLD scales them to leisure
                travel: hotels at {plan.factors?.lodging ?? 0.55}× and food, transit and sights at {plan.factors?.day ?? 0.6}×, then by your
                travel style. Those factors are re-measured as travelers log real costs on their trips. Rates for some cities are set high
                for security reasons, so treat those as a ceiling. U.S. cities use WRLD&rsquo;s own estimates for now.
              </p>
              <p>
                <strong className="text-foreground">Seats:</strong> award seats are limited. Find an open seat on Seats.aero before moving
                points; transfers can&rsquo;t be undone. Live seat search inside WRLD is coming soon.
              </p>
            </div>
          </details>
        </section>
      )}

      <PointsOrCash
        programs={Object.entries(SOURCE_PROGRAM)
          .map(([value, p]) => ({ value, label: p.name }))
          .sort((a, b) => a.label.localeCompare(b.label))}
        held={Object.fromEntries(BANKS.map((b) => [b.key, wallet[b.key] ?? 0]))}
        initial={{
          cash: sp.cash_price,
          points: sp.points,
          taxes: sp.taxes,
          program: sp.program && sp.program in SOURCE_PROGRAM ? sp.program : undefined,
        }}
      />
    </div>
  );
}
