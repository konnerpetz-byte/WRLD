// places-harvest: candidate road-trip places for WRLD, for a person to approve.
//
// For each state or province asked for, finds every place on Wikidata that has an English
// Wikivoyage travel guide and map coordinates (towns, parks, small regions), then reads the
// guide's opening paragraph and its article type and quality from Wikivoyage. Guesses vibes,
// a price tier (from GSA's hotel rate when GSA lists the town or county) and whether it's a
// lesser-known place. Upserts public.getaway_candidates without touching review fields.
//
// Both sources are free and openly licensed (Wikidata CC0, Wikivoyage CC BY-SA) and are read
// through their public APIs with an identifying User-Agent, a few requests at a time.
// Body: {"regions": ["MI", "ON", ...]}. With no regions, returns the region codes it knows.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const UA = { "User-Agent": "WRLD trip planner places harvest (https://wrldtrips.com; privacy@wrldtrips.com)", Accept: "application/sparql-results+json" };

type Binding = Record<string, { value: string } | undefined>;

async function sparql(q: string): Promise<Binding[]> {
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch("https://query.wikidata.org/sparql", {
        method: "POST",
        headers: { ...UA, "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ query: q, format: "json" }),
        signal: AbortSignal.timeout(40000),
      });
    } catch {
      continue; // timed out: try again
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) throw new Error(`Wikidata ${res.status}`);
    return (await res.json()).results.bindings as Binding[];
  }
  throw new Error("Wikidata busy");
}

/** US states, Canadian provinces and territories: code → Wikidata id. */
async function regions(): Promise<Map<string, { qid: string; country: "US" | "CA" }>> {
  const rows = await sparql(`SELECT ?s ?iso WHERE {
    VALUES ?t { wd:Q35657 wd:Q11828004 wd:Q9357527 }
    ?s wdt:P31 ?t ; wdt:P300 ?iso .
  }`);
  const out = new Map<string, { qid: string; country: "US" | "CA" }>();
  for (const r of rows) {
    const iso = r.iso!.value;
    const m = iso.match(/^(US|CA)-([A-Z]{2})$/);
    if (m) out.set(m[2], { qid: r.s!.value.split("/").pop()!, country: m[1] as "US" | "CA" });
  }
  return out;
}

// Two light queries rather than one heavy one (the combined query times out): the places, then
// population, Wikipedia article and county for those places by id.
const placesQuery = (qid: string) => `SELECT ?item ?itemLabel ?wv ?coord ?desc WHERE {
  ?wv schema:about ?item ; schema:isPartOf <https://en.wikivoyage.org/> .
  { ?item wdt:P131 wd:${qid} . } UNION { ?item wdt:P131 ?a . ?a wdt:P131 wd:${qid} . }
  ?item wdt:P625 ?coord .
  OPTIONAL { ?item schema:description ?desc FILTER(LANG(?desc) = "en") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}`;

const extrasQuery = (ids: string[], region: string) => `SELECT ?item (MAX(?pop) AS ?population) (SAMPLE(?wp) AS ?wpp) (SAMPLE(?cl) AS ?county) WHERE {
  VALUES ?item { ${ids.map((i) => `wd:${i}`).join(" ")} }
  OPTIONAL { ?item wdt:P1082 ?pop . }
  OPTIONAL { ?wp schema:about ?item ; schema:isPartOf <https://en.wikipedia.org/> . }
  OPTIONAL { ?item wdt:P131 ?a . ?a wdt:P131 wd:${region} . ?a rdfs:label ?cl . FILTER(LANG(?cl) = "en") }
} GROUP BY ?item`;

const titleOf = (url: string) => decodeURIComponent(url.split("/wiki/")[1] ?? "").replace(/_/g, " ");

type Guide = { kind: "city" | "park" | "region" | null; quality: "outline" | "usable" | "guide" | "star" | null; intro: string };

const WANTED = [
  "City articles", "Park articles", "Bottom-level regions", "Rural area articles",
  "Outline articles", "Usable articles", "Guide articles", "Star articles",
].map((c) => `Category:${c}`);

/** Article type, quality and opening paragraph for up to 20 Wikivoyage titles. */
async function guides(titles: string[]): Promise<Map<string, Guide>> {
  const u = new URL("https://en.wikivoyage.org/w/api.php");
  u.search = new URLSearchParams({
    action: "query", format: "json", formatversion: "2", redirects: "1",
    prop: "extracts|categories", exintro: "1", explaintext: "1", exlimit: "20", exsentences: "3",
    cllimit: "max", clcategories: WANTED.join("|"), titles: titles.join("|"),
  }).toString();
  const out = new Map<string, Guide>();
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(u, { headers: { "User-Agent": UA["User-Agent"] }, signal: AbortSignal.timeout(20000) });
    } catch {
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      continue;
    }
    if (!res.ok) return out;
    const j = await res.json();
    const back = new Map<string, string>();
    for (const r of j.query?.redirects ?? []) back.set(r.to, r.from);
    for (const p of j.query?.pages ?? []) {
      const cats = new Set<string>((p.categories ?? []).map((c: { title: string }) => c.title.replace("Category:", "")));
      const kind = cats.has("City articles") ? "city" : cats.has("Park articles") ? "park" : cats.has("Bottom-level regions") || cats.has("Rural area articles") ? "region" : null;
      const quality = cats.has("Star articles") ? "star" : cats.has("Guide articles") ? "guide" : cats.has("Usable articles") ? "usable" : cats.has("Outline articles") ? "outline" : null;
      out.set(back.get(p.title) ?? p.title, { kind, quality, intro: String(p.extract ?? "").replace(/\s+/g, " ").trim().slice(0, 600) });
    }
    return out;
  }
  return out;
}

// Vibe guesses from the guide's opening and Wikidata's description. The reviewer has the final say.
const RULES: [string, RegExp][] = [
  ["water", /\b(lake|lakes|beach|beaches|shore|shoreline|coast|coastal|island|bay|ocean|dunes|harbou?r|waterfront|riverfront)\b/i],
  ["outdoors", /\b(hik(e|es|ing)|trails?|national park|state park|provincial park|forest|mountains?|canyons?|waterfalls?|kayak(ing)?|canoe(ing)?|camping|wilderness|outdoor)\b/i],
  ["historic", /\b(histor(y|ic|ical)|victorian|colonial|heritage|old town|civil war|18th|19th|antebellum|pioneer)\b/i],
  ["food", /\b(winer(y|ies)|vineyards?|wine|brewer(y|ies)|craft beer|cuisine|restaurants|culinary|food)\b/i],
  ["nightlife", /\b(nightlife|bars|live music|casinos?|clubs)\b/i],
  ["culture", /\b(museums?|art|arts|galler(y|ies)|theat(er|re)s?|festival)\b/i],
  ["family", /\b(amusement|theme park|water ?parks?|zoo|aquarium|family)\b/i],
  ["snow", /\b(ski(ing)?|snowboard(ing)?|snowmobil(e|ing))\b/i],
];

function guessVibes(text: string, kind: string, population: number | null) {
  const v = new Set(RULES.filter(([, re]) => re.test(text)).map(([k]) => k));
  if (kind === "park") v.add("outdoors");
  if (population != null && population < 10000) v.add("quiet");
  if (population != null && population >= 300000) v.add("city");
  return [...v].slice(0, 4);
}

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

/** GSA's yearly-average hotel rate by town and by county, for one state. */
async function gsaRates(db: ReturnType<typeof createClient>, state: string) {
  const { data } = await db.from("cost_per_diem").select("location, lodging").eq("source", "gsa").eq("state", state).limit(2000);
  const sums = new Map<string, { sum: number; n: number }>();
  const add = (k: string, v: number) => {
    const s = sums.get(k) ?? { sum: 0, n: 0 };
    s.sum += v;
    s.n += 1;
    sums.set(k, s);
  };
  for (const r of (data ?? []) as { location: string; lodging: number }[]) {
    const m = r.location.match(/^(.*?)\s*\((.*?)\)\s*$/);
    for (const n of (m ? m[1] : r.location).split("/")) add(`town:${fold(n)}`, Number(r.lodging));
    if (m) for (const c of m[2].split(/,| and /)) add(`county:${fold(c.replace(/\bcount(y|ies)\b/i, ""))}`, Number(r.lodging));
  }
  const avg = new Map<string, number>();
  for (const [k, s] of sums) avg.set(k, Math.round(s.sum / s.n));
  return avg;
}

const tierFor = (lodging: number | null, population: number | null) =>
  lodging != null ? (lodging <= 140 ? 1 : lodging <= 190 ? 2 : 3) : population != null && population >= 500000 ? 2 : 1;

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });
  const url = Deno.env.get("SUPABASE_URL")!;
  let secret: string | undefined;
  try { secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default; } catch { secret = undefined; }
  secret ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return json(500, { error: "Not configured" });
  const db = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const token = req.headers.get("x-wrld-cron") ?? "";
  if (token.length < 32) return json(401, { error: "Unauthorized" });
  const { data: ok } = await db.rpc("award_cron_token_ok", { p_token: token });
  if (ok !== true) return json(401, { error: "Unauthorized" });

  let asked: string[] = [];
  try { asked = ((await req.json())?.regions ?? []).map((s: unknown) => String(s).toUpperCase()).slice(0, 20); } catch { asked = []; }

  const known = await regions();
  if (!asked.length) return json(200, { regions: [...known.keys()].sort() });

  const result: Record<string, unknown> = {};
  for (const code of asked) {
    const r = known.get(code);
    if (!r) {
      result[code] = "unknown region";
      continue;
    }
    try {
      const rows = await sparql(placesQuery(r.qid));
      const seen = new Set<string>();
      const base = rows.flatMap((b) => {
        const c = b.coord?.value.match(/Point\(([-\d.]+) ([-\d.]+)\)/);
        const qid = b.item!.value.split("/").pop()!;
        if (!c || !b.wv || seen.has(qid) || !/^Q\d+$/.test(qid)) return [];
        seen.add(qid);
        return [{
          qid,
          name: b.itemLabel?.value ?? qid,
          wikivoyage: titleOf(b.wv.value),
          latitude: Number(c[2]),
          longitude: Number(c[1]),
          description: b.desc?.value ?? null,
        }];
      });
      const extras = new Map<string, Binding>();
      for (let i = 0; i < base.length; i += 150) {
        for (const b of await sparql(extrasQuery(base.slice(i, i + 150).map((x) => x.qid), r.qid))) extras.set(b.item!.value.split("/").pop()!, b);
      }
      const items = base.map((x) => {
        const e = extras.get(x.qid);
        return {
          ...x,
          wikipedia: e?.wpp ? titleOf(e.wpp.value) : null,
          population: e?.population ? Math.round(Number(e.population.value)) || null : null,
          county: e?.county?.value ?? null,
        };
      });

      const batches: string[][] = [];
      for (let i = 0; i < items.length; i += 20) batches.push(items.slice(i, i + 20).map((x) => x.wikivoyage));
      const found = new Map<string, Guide>();
      for (const m of await pool(batches, 3, guides)) for (const [k, v] of m) found.set(k, v);

      const gsa = r.country === "US" ? await gsaRates(db, code) : new Map<string, number>();
      const upserts = items.flatMap((x) => {
        const g = found.get(x.wikivoyage);
        if (!g?.kind) return []; // airports, districts, big regions, itineraries, topics
        const town = fold(x.name.replace(/\s*\(.*?\)|,.*$/g, ""));
        const county = x.county ? fold(x.county.replace(/\bcounty\b/i, "")) : null;
        const lodging = gsa.get(`town:${town}`) ?? (county ? gsa.get(`county:${county}`) : undefined) ?? null;
        const text = `${x.name}. ${x.description ?? ""}. ${g.intro}`;
        return [{
          ...x,
          region: code,
          country: r.country,
          kind: g.kind,
          quality: g.quality,
          intro: g.intro || null,
          suggested_vibes: guessVibes(text, g.kind, x.population),
          suggested_tier: tierFor(lodging, x.population),
          suggested_gem: g.kind !== "park" && (x.population == null || x.population < 25000),
          gsa_lodging: lodging,
          harvested_at: new Date().toISOString(),
        }];
      });
      for (let i = 0; i < upserts.length; i += 500) {
        const { error } = await db.from("getaway_candidates").upsert(upserts.slice(i, i + 500), { onConflict: "qid" });
        if (error) throw new Error(error.message);
      }
      result[code] = { found: items.length, kept: upserts.length };
    } catch (e) {
      result[code] = `failed: ${(e as Error).message}`;
    }
  }
  return json(200, result);
});
