// routes-refresh: builds WRLD's route network.
//
// For each airport that's due (weekly), reads the "Airlines and destinations"
// list from its English Wikipedia article through the official MediaWiki API,
// resolves each destination article to its airport code through Wikidata
// (property P238, IATA code), and stores who flies nonstop where.
// Content is CC BY-SA; the app credits Wikipedia wherever routes are shown.
//
// Called by pg_cron with the same Vault token as award-refresh.
// POST {}            → process due airports
// POST {"dry":"DTW"} → parse one airport and return the result without saving
import { createClient } from "npm:@supabase/supabase-js@2";

const UA = "WRLD trip planner (https://wrldtrips.com; privacy@wrldtrips.com)";
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type Route = { destinationTitle: string; airline: string; seasonal: boolean };

// ---------------------------------------------------------------- Wikipedia
async function api(url: string) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Api-User-Agent": UA, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body?.error) throw new Error(`${body.error.code}: ${body.error.info ?? ""}`.slice(0, 200));
  return body;
}

async function wikitext(title: string): Promise<string> {
  const u = new URL("https://en.wikipedia.org/w/api.php");
  u.search = new URLSearchParams({ action: "parse", page: title, prop: "wikitext", format: "json", formatversion: "2", redirects: "1" }).toString();
  const body = await api(u.toString());
  if (body.error) throw new Error(body.error.info ?? "parse error");
  return String(body.parse?.wikitext ?? "");
}

/** The passenger "Airlines and destinations" part of an airport article. */
function passengerSection(text: string): string {
  const start = text.search(/==\s*Airlines and destinations\s*==/i);
  if (start < 0) return "";
  const rest = text.slice(start);
  const ends = [rest.search(/\n===\s*Cargo/i), rest.slice(3).search(/\n==[^=]/) + 3].filter((n) => n > 0);
  return ends.length ? rest.slice(0, Math.min(...ends)) : rest;
}

function clean(s: string) {
  return s
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<ref[^>]*\/>/gi, "")
    .replace(/<ref[^>]*>[\s\S]*?<\/ref>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n");
}

/** Split on "|" that sits outside [[links]] and {{templates}}. */
function splitTop(s: string): string[] {
  const out: string[] = [];
  let depthL = 0;
  let depthT = 0;
  let cur = "";
  for (let i = 0; i < s.length; i++) {
    const two = s.slice(i, i + 2);
    if (two === "[[") { depthL++; cur += two; i++; continue; }
    if (two === "]]" && depthL > 0) { depthL--; cur += two; i++; continue; }
    if (two === "{{") { depthT++; cur += two; i++; continue; }
    if (two === "}}" && depthT > 0) { depthT--; cur += two; i++; continue; }
    if (s[i] === "|" && depthL === 0 && depthT === 0) { out.push(cur); cur = ""; continue; }
    cur += s[i];
  }
  out.push(cur);
  return out;
}

/** {{Airport destination list | airline | destinations | …}} blocks, brace-matched. */
function templateBlocks(section: string): string[] {
  const blocks: string[] = [];
  // The template has several names: "Airport destination list", "Airport-dest-list", "Airport dest list".
  const re = /\{\{\s*Airport[ -]dest(?:ination)?[ -]list/gi;
  for (const m of section.matchAll(re)) {
    let depth = 0;
    for (let i = m.index!; i < section.length - 1; i++) {
      const two = section.slice(i, i + 2);
      if (two === "{{") { depth++; i++; }
      else if (two === "}}") { depth--; i++; if (depth === 0) { blocks.push(section.slice(m.index! + 2, i - 1)); break; } }
    }
  }
  return blocks;
}

const linkTitles = (s: string) =>
  [...s.matchAll(/\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim()).filter((t) => !/^(file|image|category):/i.test(t));

function airlineName(cell: string) {
  const link = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/.exec(cell);
  const name = (link ? (link[2] ?? link[1]) : cell.replace(/\{\{[^|}]*\|?|\}\}|'''/g, "")).replace(/\s+/g, " ").trim();
  return name.slice(0, 80);
}

function destinations(cell: string): { title: string; seasonal: boolean }[] {
  const out: { title: string; seasonal: boolean }[] = [];
  // Segments start at "'''Seasonal:'''", "'''Charter:'''", "'''Seasonal charter:'''".
  const parts = cell.split(/'''\s*((?:seasonal\s*)?charter|seasonal)\s*:?\s*'''\s*:?/i);
  let label = "";
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) { label = parts[i].toLowerCase(); continue; }
    if (label.includes("charter")) continue; // charters aren't bookable with miles
    for (const t of linkTitles(parts[i])) out.push({ title: t, seasonal: label === "seasonal" });
  }
  return out;
}

export function parseRoutes(text: string): Route[] {
  const section = clean(passengerSection(text));
  if (!section) return [];
  const rows: { airline: string; dest: string }[] = [];
  const blocks = templateBlocks(section);
  if (blocks.length) {
    for (const block of blocks) {
      const tokens = splitTop(block).slice(1); // drop "Airport destination list"
      const threeCols = tokens.some((t) => /^\s*3rdcoltitle\s*=/i.test(t));
      const cells = tokens.filter((t) => !/^\s*[a-z0-9]+\s*=/i.test(t));
      const step = threeCols ? 3 : 2;
      for (let i = 0; i + 1 < cells.length; i += step) rows.push({ airline: cells[i], dest: cells[i + 1] });
    }
  } else {
    // Older wikitable layout: rows split by "|-", cells by "||" or a new "|" line.
    for (const row of section.split(/\n\|-/).slice(1)) {
      const cells = row.replace(/^\s*\n/, "").split(/\n\||\|\|/).map((c) => c.replace(/^\s*\|/, ""));
      if (cells.length >= 2 && !/^\s*!/.test(cells[0])) rows.push({ airline: cells[0], dest: cells[1] });
    }
  }
  const out: Route[] = [];
  for (const r of rows) {
    const airline = airlineName(r.airline);
    if (!airline || /^\s*$/.test(airline)) continue;
    for (const d of destinations(r.dest)) out.push({ destinationTitle: d.title, airline, seasonal: d.seasonal });
  }
  return out;
}

// ---------------------------------------------------------------- Titles → airport codes
async function resolveTitles(titles: string[], cache: Map<string, string | null>): Promise<Map<string, string | null>> {
  const todo = [...new Set(titles)].filter((t) => !cache.has(t));
  for (let i = 0; i < todo.length; i += 50) {
    const batch = todo.slice(i, i + 50);
    // 1) Follow Wikipedia redirects and normalization.
    const q = new URL("https://en.wikipedia.org/w/api.php");
    q.search = new URLSearchParams({ action: "query", titles: batch.join("|"), redirects: "1", format: "json", formatversion: "2" }).toString();
    const r = await api(q.toString());
    const finalOf = new Map<string, string>(batch.map((t) => [t, t]));
    for (const n of r.query?.normalized ?? []) for (const [k, v] of finalOf) if (v === n.from) finalOf.set(k, n.to);
    for (const n of r.query?.redirects ?? []) for (const [k, v] of finalOf) if (v === n.from) finalOf.set(k, n.to);
    // 2) Wikidata: the article's item and its IATA code (P238).
    const finals = [...new Set(finalOf.values())];
    const w = new URL("https://www.wikidata.org/w/api.php");
    w.search = new URLSearchParams({ action: "wbgetentities", sites: "enwiki", titles: finals.join("|"), props: "claims|sitelinks", sitefilter: "enwiki", format: "json" }).toString();
    const wd = await api(w.toString());
    const iataByTitle = new Map<string, string>();
    for (const e of Object.values(wd.entities ?? {}) as Record<string, any>[]) {
      const title = e.sitelinks?.enwiki?.title;
      const claims = (e.claims?.P238 ?? []).filter((c: any) => c.rank !== "deprecated");
      const best = claims.find((c: any) => c.rank === "preferred") ?? claims[0];
      const code = best?.mainsnak?.datavalue?.value;
      if (title && typeof code === "string" && /^[A-Z]{3}$/.test(code)) iataByTitle.set(title, code);
    }
    for (const t of batch) cache.set(t, iataByTitle.get(finalOf.get(t) ?? t) ?? null);
  }
  return cache;
}

// ---------------------------------------------------------------- Worker
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

  const body = await req.json().catch(() => ({}));
  const dry = typeof body?.dry === "string" && /^[A-Z]{3}$/.test(body.dry) ? body.dry : null;

  // The article for each airport comes from Wikidata too: the item with that IATA code.
  async function articleFor(code: string): Promise<string | null> {
    const s = new URL("https://www.wikidata.org/w/api.php");
    s.search = new URLSearchParams({ action: "query", list: "search", srsearch: `haswbstatement:P238=${code}`, format: "json", srlimit: "5" }).toString();
    const found = await api(s.toString());
    const ids: string[] = (found.query?.search ?? []).map((x: any) => x.title);
    if (!ids.length) return null;
    const g = new URL("https://www.wikidata.org/w/api.php");
    g.search = new URLSearchParams({ action: "wbgetentities", ids: ids.join("|"), props: "sitelinks|claims", sitefilter: "enwiki", format: "json" }).toString();
    const ents = await api(g.toString());
    for (const e of Object.values(ents.entities ?? {}) as Record<string, any>[]) {
      const isAirport = (e.claims?.P238 ?? []).some((c: any) => c.mainsnak?.datavalue?.value === code);
      const title = e.sitelinks?.enwiki?.title;
      if (isAirport && title) return title;
    }
    return null;
  }

  const codes: string[] = dry ? [dry] : (((await db.rpc("claim_route_airports", { p_limit: 6 })).data ?? []) as string[]);
  const cache = new Map<string, string | null>();
  const results: unknown[] = [];
  const started = Date.now();

  for (const code of codes) {
    if (Date.now() - started > 110000) break;
    try {
      const title = await articleFor(code);
      if (!title) throw new Error("No Wikipedia article found");
      const text = await wikitext(title);
      let routes = parseRoutes(text);
      // Some airports keep the list on its own page ({{Main|List of airlines and destinations at …}}).
      if (!routes.length) {
        const main = /\{\{\s*(?:main|further|see also)\s*\|\s*([^}|]*(?:destinations|airlines)[^}|]*)/i.exec(passengerSection(text) || text);
        if (main) routes = parseRoutes(await wikitext(main[1].trim()));
      }
      const titles = routes.map((r) => r.destinationTitle);
      // Reuse earlier resolutions.
      const known = titles.length
        ? (await db.from("wiki_airport_titles").select("title, iata").in("title", [...new Set(titles)].slice(0, 1000))).data ?? []
        : [];
      for (const k of known) cache.set(k.title, k.iata);
      const before = new Set(cache.keys());
      await resolveTitles(titles, cache);
      const fresh = [...cache.entries()].filter(([t]) => !before.has(t)).map(([title, iata]) => ({ title: title.slice(0, 300), iata, resolved_at: new Date().toISOString() }));
      if (fresh.length && !dry) await db.from("wiki_airport_titles").upsert(fresh);

      const rows = new Map<string, { origin: string; destination: string; airline: string; seasonal: boolean; last_seen: string }>();
      for (const r of routes) {
        const dest = cache.get(r.destinationTitle);
        if (!dest || dest === code) continue;
        const key = `${dest}|${r.airline}`;
        const prev = rows.get(key);
        // Year-round beats seasonal when an airline lists both.
        if (!prev || (prev.seasonal && !r.seasonal)) rows.set(key, { origin: code, destination: dest, airline: r.airline, seasonal: r.seasonal, last_seen: new Date().toISOString() });
      }
      const list = [...rows.values()];
      if (dry) {
        results.push({ code, title, parsed: routes.length, resolved: list.length, unresolved: [...new Set(titles.filter((t) => !cache.get(t)))].slice(0, 30), sample: list.slice(0, 400) });
        continue;
      }
      for (let i = 0; i < list.length; i += 500) {
        const { error } = await db.from("airport_routes").upsert(list.slice(i, i + 500));
        if (error) throw new Error(error.message);
      }
      await db.rpc("finish_route_airport", { p_code: code, p_count: list.length, p_error: list.length ? null : "No routes parsed" });
      results.push({ code, title, routes: list.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : "failed";
      if (!dry) await db.rpc("finish_route_airport", { p_code: code, p_count: 0, p_error: message });
      results.push({ code, error: message });
    }
  }
  return json(200, { processed: results.length, results });
});
