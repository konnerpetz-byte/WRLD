// costs-refresh: real-world trip cost data for the planner.
//
// 1. State Department foreign per diem rates (lodging and meals & incidentals,
//    by city and season, ~1,000 locations). Public U.S. government data,
//    posted monthly as an Excel file at allowances.state.gov/ExcelVersion.asp.
// 2. GSA per diem rates for U.S. cities, when GSA_API_KEY is set (a free
//    api.data.gov key). Public U.S. government data via GSA's documented API.
//
// Upserts public.cost_per_diem and logs each run in public.cost_refresh_runs.
// Skips a State Department file it already loaded unless called with {"force": true}.
// Called daily by pg_cron with the same Vault token as the other workers.
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const UA = { "User-Agent": "WRLD trip planner (https://wrldtrips.com)" };
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Excel serial date → YYYY-MM-DD. */
const excelDate = (v: unknown): string | null => {
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  if (typeof v === "string" && /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(v)) {
    const [m, d, y] = v.split("/").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toISOString().slice(0, 10);
  }
  return null;
};
const money = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(n) && n >= 0 && n < 5000 ? n : null;
};

/** The newest State Department file that exists: this month, then the two before. */
async function latestStateFile(): Promise<{ name: string; url: string; body: ArrayBuffer } | null> {
  const now = new Date();
  for (let back = 0; back < 3; back++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
    const base = `${MONTHS[d.getUTCMonth()]}${d.getUTCFullYear()}PD`;
    for (const host of ["https://allowances.state.gov", "https://aoprals.state.gov"]) {
      for (const ext of ["xls", "xlsx"]) {
        const url = `${host}/content/Documents/${base}.${ext}`;
        try {
          const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
          if (!res.ok) continue;
          const type = res.headers.get("content-type") ?? "";
          if (type.includes("html")) continue; // a "not found" page served as 200
          return { name: `${base}.${ext}`, url, body: await res.arrayBuffer() };
        } catch {
          // try the next candidate
        }
      }
    }
  }
  return null;
}

type Row = {
  source: "state" | "gsa";
  location_code: string;
  country: string;
  location: string;
  state: string | null;
  season_start: string;
  season_end: string;
  lodging: number;
  mie: number;
  effective: string | null;
  source_file: string;
  fetched_at: string;
};

function parseState(buf: ArrayBuffer, file: string): Row[] {
  const wb = XLSX.read(new Uint8Array(buf), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });
  const head = (rows[0] ?? []).map((h) => String(h ?? "").trim().toLowerCase());
  const col = (name: string) => head.findIndex((h) => h === name);
  const c = {
    country: col("country"),
    location: col("location"),
    start: col("season start date"),
    end: col("season end date"),
    lodging: col("lodging"),
    mie: col("meals & incidentals"),
    effective: col("effective date"),
    code: col("location code"),
  };
  if (Object.values(c).some((i) => i < 0)) throw new Error(`Unexpected columns: ${head.join(", ")}`);
  const now = new Date().toISOString();
  const out: Row[] = [];
  const seen = new Set<string>();
  for (const r of rows.slice(1)) {
    const country = String(r[c.country] ?? "").trim();
    const location = String(r[c.location] ?? "").trim();
    const start = excelDate(r[c.start]);
    const end = excelDate(r[c.end]);
    const lodging = money(r[c.lodging]);
    const mie = money(r[c.mie]);
    const code = String(r[c.code] ?? "").trim();
    if (!country || !location || !start || !end || lodging == null || mie == null || !code) continue;
    const key = `${code}|${start}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ source: "state", location_code: code, country, location, state: null, season_start: start, season_end: end, lodging, mie, effective: excelDate(r[c.effective]), source_file: file, fetched_at: now });
  }
  return out;
}

/** GSA lodging by month for U.S. cities in the current fiscal year (starts October 1). */
async function gsaRows(key: string): Promise<{ rows: Row[]; file: string }> {
  const now = new Date();
  const fy = now.getUTCMonth() >= 9 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const url = `https://api.gsa.gov/travel/perdiem/v2/rates/conus/lodging/${fy}`;
  const res = await fetch(url, { headers: { ...UA, "x-api-key": key, Accept: "application/json" }, signal: AbortSignal.timeout(60000) });
  if (!res.ok) throw new Error(`GSA ${res.status}`);
  const body = (await res.json()) as Record<string, unknown>[];
  if (!Array.isArray(body)) throw new Error("GSA: unexpected response");
  const out: Row[] = [];
  const fetched = new Date().toISOString();
  const short = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  for (const r of body) {
    const city = String(r.City ?? "").trim();
    const st = String(r.State ?? "").trim();
    const did = String(r.DID ?? "").trim();
    const mie = money(r.Meals);
    if (!city || !st || !did || mie == null) continue;
    short.forEach((m, i) => {
      const lodging = money(r[m]);
      if (lodging == null) return;
      const year = i >= 9 ? fy - 1 : fy;
      const start = new Date(Date.UTC(year, i, 1)).toISOString().slice(0, 10);
      const end = new Date(Date.UTC(year, i + 1, 0)).toISOString().slice(0, 10);
      out.push({ source: "gsa", location_code: did, country: "United States", location: city, state: st, season_start: start, season_end: end, lodging, mie, effective: null, source_file: `GSA FY${fy}`, fetched_at: fetched });
    });
  }
  return { rows: out, file: `GSA FY${fy}` };
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
  let force = false;
  try { force = Boolean((await req.json())?.force); } catch { force = false; }

  const upsert = async (rows: Row[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from("cost_per_diem").upsert(rows.slice(i, i + 500));
      if (error) throw new Error(error.message);
    }
  };
  const log = (source: string, file: string | null, rows: number, okRun: boolean, note?: string) =>
    db.from("cost_refresh_runs").insert({ source, source_file: file, rows, ok: okRun, note: note?.slice(0, 500) ?? null });

  const result: Record<string, unknown> = {};

  // State Department
  try {
    const file = await latestStateFile();
    if (!file) throw new Error("No State Department file found for the last three months");
    const { data: prior } = await db.from("cost_refresh_runs").select("id").eq("source", "state").eq("source_file", file.name).eq("ok", true).limit(1);
    if (prior?.length && !force) {
      result.state = { skipped: true, file: file.name };
    } else {
      const rows = parseState(file.body, file.name);
      if (rows.length < 500) throw new Error(`Only ${rows.length} rows parsed from ${file.name}`);
      await upsert(rows);
      await db.from("cost_per_diem").delete().eq("source", "state").neq("source_file", file.name);
      await log("state", file.name, rows.length, true);
      result.state = { file: file.name, rows: rows.length };
    }
  } catch (e) {
    await log("state", null, 0, false, String(e));
    result.state = { error: String(e) };
  }

  // GSA (U.S. cities), only with a key
  const gsaKey = Deno.env.get("GSA_API_KEY");
  if (gsaKey) {
    try {
      const { rows, file } = await gsaRows(gsaKey);
      if (rows.length < 100) throw new Error(`Only ${rows.length} GSA rows`);
      await upsert(rows);
      await db.from("cost_per_diem").delete().eq("source", "gsa").neq("source_file", file);
      await log("gsa", file, rows.length, true);
      result.gsa = { file, rows: rows.length };
    } catch (e) {
      await log("gsa", null, 0, false, String(e));
      result.gsa = { error: String(e) };
    }
  } else {
    result.gsa = { skipped: "No GSA_API_KEY" };
  }

  return json(200, result);
});
