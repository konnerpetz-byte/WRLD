// gas-refresh: this week's average price of regular gasoline, from the U.S. Energy Information
// Administration's public weekly spreadsheet (no API key needed): the U.S., the seven regions
// (PADD sub-districts) and the nine states EIA prices on their own. EIA updates it every Monday
// afternoon. Stores the newest week for each area in public.gas_prices.
import { createClient } from "npm:@supabase/supabase-js@2";
import * as XLSX from "npm:xlsx@0.18.5";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
// Regular gasoline, every area EIA reports (U.S., regions, states, cities), weekly.
const FILE = "https://www.eia.gov/dnav/pet/xls/PET_PRI_GND_A_EPMR_PTE_DPGAL_W.xls";
const UA = { "User-Agent": "WRLD trip planner (https://wrldtrips.com)" };

/** Excel serial date or a date string → YYYY-MM-DD. */
const day = (v: unknown): string | null => {
  if (typeof v === "number" && v > 20000 && v < 80000) return new Date(Date.UTC(1899, 11, 30) + v * 86400000).toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
};

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

  const res = await fetch(FILE, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) return json(502, { error: `EIA ${res.status}` });
  const book = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });

  // Each "Data" sheet: a row of source keys (EMM_EPMR_PTE_R20_DPG = regular, all formulations,
  // Midwest, $ a gallon), then one row per week, oldest first.
  const prices = new Map<string, { week: string; price: number }>();
  const seen: string[] = [];
  for (const name of book.SheetNames.filter((n) => /^data/i.test(n))) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(book.Sheets[name], { header: 1, raw: true });
    const keyRow = rows.findIndex((r) => r.some((c) => typeof c === "string" && /^EMM_/.test(c)));
    if (keyRow < 0) continue;
    const keys = rows[keyRow] as unknown[];
    seen.push(...keys.slice(1, 4).map(String));
    for (let col = 1; col < keys.length; col++) {
      const m = String(keys[col] ?? "").match(/^EMM_EPMR_PTE_([A-Z0-9]+)_DPG$/);
      if (!m) continue;
      for (let r = rows.length - 1; r > keyRow; r--) {
        const v = Number(rows[r]?.[col]);
        const week = day(rows[r]?.[0]);
        if (week && v > 1 && v < 10) {
          prices.set(m[1], { week, price: Math.round(v * 1000) / 1000 });
          break;
        }
      }
    }
  }
  if (!prices.has("NUS")) return json(502, { error: "U.S. price not found", sheets: book.SheetNames, keys: seen.slice(0, 12) });

  const rows = [...prices].map(([area, p]) => ({ area, week: p.week, price: p.price, fetched_at: new Date().toISOString() }));
  const { error } = await db.from("gas_prices").upsert(rows, { onConflict: "area" });
  if (error) return json(500, { error: error.message });
  return json(200, { areas: rows.length, week: prices.get("NUS")!.week, us: prices.get("NUS")!.price });
});
