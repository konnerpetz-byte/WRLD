import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { PlaceReview } from "@/features/places/place-review";
import { GETAWAYS } from "@/features/planner/drive";
import { distanceKm } from "@/lib/geo";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Review places" };

const QUALITY_ORDER = ["star", "guide", "usable", "outline"] as const;

export default function PlacesReviewPage({ searchParams }: PageProps<"/admin/places">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/places">["searchParams"] }) {
  const { supabase } = await requireUserId();
  const { data: isAdmin } = await supabase.rpc("is_app_admin");
  if (!isAdmin) notFound();

  const sp = await searchParams;
  const region = typeof sp.region === "string" && /^[A-Z]{2}$/.test(sp.region) ? sp.region : null;

  // Counts by region and status, for the picker and progress
  const counts = new Map<string, { pending: number; approved: number; rejected: number }>();
  for (let from = 0; ; from += 1000) {
    const { data } = await supabase.from("getaway_candidates").select("region, status").range(from, from + 999);
    if (!data?.length) break;
    for (const r of data) {
      const c = counts.get(r.region) ?? { pending: 0, approved: 0, rejected: 0 };
      c[r.status] += 1;
      counts.set(r.region, c);
    }
    if (data.length < 1000) break;
  }

  let q = supabase
    .from("getaway_candidates")
    .select("qid, name, region, country, latitude, longitude, county, description, kind, quality, population, wikivoyage, wikipedia, intro, suggested_vibes, suggested_tier, suggested_gem, gsa_lodging")
    .eq("status", "pending")
    .order("quality", { ascending: true, nullsFirst: false }) // guide, outline, star, usable: re-sorted below
    .order("population", { ascending: false, nullsFirst: false })
    .limit(region ? 1000 : 400);
  if (region) q = q.eq("region", region);
  const { data: rows, error } = await q;
  if (error) return <p role="alert">Couldn&apos;t load places: {error.message}</p>;

  // Best guides first, then bigger places; hide places the hand-picked list already covers.
  // Likely skips go last: suburbs, guides that are really about another town, places already listed.
  const rank = (x: { quality: string | null }) => QUALITY_ORDER.indexOf((x.quality ?? "outline") as never);
  const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const unlikely = (x: { name: string; intro: string | null; listedAs: string | null }) =>
    Number(
      Boolean(x.listedAs) ||
        /\bsuburb|metro detroit|county is in\b/i.test(x.intro ?? "") ||
        (Boolean(x.intro) && !fold(x.intro!).includes(fold(x.name.replace(/\s*(township|\(.*?\))\s*$/i, "")).split(" ")[0])),
    );
  const queue = (rows ?? [])
    .map((r) => ({ ...r, listedAs: GETAWAYS.find((g) => distanceKm(g, r) < 4)?.name ?? null }))
    .sort((a, b) => unlikely(a) - unlikely(b) || rank(a) - rank(b) || (b.population ?? 0) - (a.population ?? 0));

  const regions = [...counts.entries()].sort((a, b) => b[1].pending - a[1].pending);
  const total = regions.reduce((n, [, c]) => n + c.pending, 0);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <header className="grid gap-2">
        <h1 className="text-3xl font-semibold">Review places</h1>
        <p className="text-sm text-muted-foreground">
          Towns, parks and regions with a Wikivoyage guide, from Wikidata. Approved places join road-trip results within the hour.
          Keys: <kbd>A</kbd> approve, <kbd>R</kbd> reject, <kbd>S</kbd> skip, <kbd>1</kbd>–<kbd>0</kbd> vibes, <kbd>T</kbd> price tier, <kbd>G</kbd> hidden gem.
        </p>
        <nav aria-label="Region" className="flex flex-wrap gap-1 text-sm">
          <Link href="/admin/places" aria-current={!region ? "page" : undefined} className={`rounded-md border px-2 py-0.5 ${!region ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}>
            All ({total})
          </Link>
          {regions.map(([r, c]) => (
            <Link
              key={r}
              href={`/admin/places?region=${r}`}
              aria-current={r === region ? "page" : undefined}
              className={`rounded-md border px-2 py-0.5 ${r === region ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              title={`${c.approved} approved, ${c.rejected} rejected`}
            >
              {r} {c.pending}
            </Link>
          ))}
        </nav>
      </header>
      <PlaceReview key={region ?? "all"} queue={queue} />
    </div>
  );
}
