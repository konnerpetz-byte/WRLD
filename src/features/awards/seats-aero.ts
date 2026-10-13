import "server-only";

import { env } from "@/lib/env";
import type { requireUserId } from "@/lib/supabase/server";

import type { Cabin } from "./regions";

/**
 * Live award seats through "Login with Seats.aero", Seats.aero's official
 * OAuth2 for third-party apps (developers.seats.aero, "Login with Seats.aero").
 *
 * A traveler with a Seats.aero Pro account links it once; WRLD then searches
 * Seats.aero's partner API with that traveler's own token and daily allowance
 * (1,000 calls a day). Results are shown to that traveler only and aren't
 * stored or shared. No scraping, no shared key, no cost to WRLD.
 *
 * Setup (once): in seats.aero › Settings › Apps create an OAuth2 app with the
 * redirect URI https://wrldtrips.com/api/seats/callback and scope "openid",
 * then set SEATS_AERO_CLIENT_ID and SEATS_AERO_CLIENT_SECRET in Vercel.
 * Unapproved apps are limited to 10 users; approval (free) lifts that.
 */

type Supabase = Awaited<ReturnType<typeof requireUserId>>["supabase"];

const BASE = "https://seats.aero";
const CABIN_KEY: Record<Cabin, "Y" | "W" | "J" | "F"> = { economy: "Y", premium: "W", business: "J", first: "F" };

export function seatsConfig() {
  const clientId = env("SEATS_AERO_CLIENT_ID");
  const clientSecret = env("SEATS_AERO_CLIENT_SECRET");
  const site = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://wrldtrips.com").replace(/\/$/, "");
  return clientId && clientSecret ? { clientId, clientSecret, redirectUri: `${site}/api/seats/callback` } : null;
}

export function consentUrl(state: string) {
  const c = seatsConfig();
  if (!c) return null;
  const u = new URL("/oauth2/consent", BASE);
  u.search = new URLSearchParams({ response_type: "code", client_id: c.clientId, redirect_uri: c.redirectUri, state, scope: "openid" }).toString();
  return u.toString();
}

type TokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number };

async function token(body: Record<string, string>): Promise<{ access: string; refresh: string; expiresIn: number }> {
  const res = await fetch(`${BASE}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Seats.aero sign-in failed (${res.status})`);
  const t = (await res.json()) as TokenResponse;
  if (!t.access_token || !t.refresh_token) throw new Error("Seats.aero didn't return a token");
  return { access: t.access_token, refresh: t.refresh_token, expiresIn: Math.max(60, Math.min(Number(t.expires_in) || 3600, 31536000)) };
}

export async function exchangeCode(code: string, state: string) {
  const c = seatsConfig();
  if (!c) throw new Error("Seats.aero isn't set up");
  return token({ grant_type: "authorization_code", client_id: c.clientId, client_secret: c.clientSecret, code, redirect_uri: c.redirectUri, state, scope: "openid" });
}

/** The signed-in traveler's Seats.aero token, refreshed when it has expired. Null when not linked. */
export async function linkedToken(supabase: Supabase): Promise<{ access: string; connectedAt: string } | null> {
  const c = seatsConfig();
  if (!c) return null;
  const { data } = await supabase.rpc("seats_link_get");
  const row = data?.[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() > Date.now()) return { access: row.access_token, connectedAt: row.connected_at };
  try {
    const t = await token({ grant_type: "refresh_token", client_id: c.clientId, client_secret: c.clientSecret, refresh_token: row.refresh_token });
    await supabase.rpc("seats_link_save", { p_access: t.access, p_refresh: t.refresh, p_expires_in: t.expiresIn });
    return { access: t.access, connectedAt: row.connected_at };
  } catch {
    return null; // Link revoked or expired: the explorer offers to reconnect.
  }
}

export type LiveSeat = {
  id: string;
  origin: string;
  destination: string;
  date: string;
  source: string;
  cabin: Cabin;
  miles: number;
  taxes: number | null;
  taxCurrency: string | null;
  seats: number | null;
  airlines: string;
  direct: boolean;
  updatedAt: string | null;
};

type Availability = Record<string, unknown> & {
  ID: string;
  Date: string;
  Source: string;
  UpdatedAt?: string;
  TaxesCurrency?: string;
  Route: { OriginAirport: string; DestinationAirport: string };
};

/**
 * Seats.aero cached search (GET /partnerapi/search) for the explorer's query.
 * Destinations go in groups so a broad "Anywhere" search stays within URL and
 * call limits. Returns seats for the requested cabins only.
 */
export async function liveSeats(
  accessToken: string,
  q: { origins: string[]; destinations: string[]; start: string; end: string; cabins: Cabin[]; sources: string[] | null; directOnly: boolean },
): Promise<{ seats: LiveSeat[]; error?: string }> {
  const groups: string[][] = [];
  for (let i = 0; i < q.destinations.length && groups.length < 6; i += 120) groups.push(q.destinations.slice(i, i + 120));
  const out: LiveSeat[] = [];
  let error: string | undefined;
  await Promise.all(
    groups.map(async (dests) => {
      const u = new URL("/partnerapi/search", BASE);
      u.search = new URLSearchParams({
        origin_airport: q.origins.join(","),
        destination_airport: dests.join(","),
        start_date: q.start,
        end_date: q.end,
        cabins: q.cabins.join(","),
        order_by: "lowest_mileage",
        take: "1000",
        ...(q.directOnly ? { only_direct_flights: "true" } : {}),
        ...(q.sources?.length ? { sources: q.sources.join(",") } : {}),
      }).toString();
      try {
        const res = await fetch(u, {
          headers: { "Partner-Authorization": `Bearer ${accessToken}`, Accept: "application/json" },
          signal: AbortSignal.timeout(15000),
          cache: "no-store",
        });
        if (res.status === 429) {
          error = "Your Seats.aero daily search limit is used up. It resets at midnight UTC.";
          return;
        }
        if (res.status === 401 || res.status === 403) {
          error = "Seats.aero needs you to reconnect your account.";
          return;
        }
        if (!res.ok) {
          error = `Seats.aero didn't answer (${res.status}). Showing what WRLD has.`;
          return;
        }
        const body = (await res.json()) as { data?: Availability[] };
        for (const a of body.data ?? []) {
          for (const cabin of q.cabins) {
            const k = CABIN_KEY[cabin];
            if (!a[`${k}Available`]) continue;
            const miles = Number(a[`${k}MileageCost`]);
            if (!Number.isFinite(miles) || miles <= 0) continue;
            const taxes = Number(a[`${k}TotalTaxes`]);
            out.push({
              id: `${a.ID}-${k}`,
              origin: a.Route.OriginAirport,
              destination: a.Route.DestinationAirport,
              date: String(a.Date).slice(0, 10),
              source: String(a.Source).toLowerCase(),
              cabin,
              miles,
              // Taxes come in cents when present.
              taxes: Number.isFinite(taxes) && taxes > 0 ? taxes / 100 : null,
              taxCurrency: typeof a.TaxesCurrency === "string" ? a.TaxesCurrency : null,
              seats: Number(a[`${k}RemainingSeats`]) || null,
              airlines: String(a[`${k}Airlines`] ?? "").slice(0, 120),
              direct: Boolean(a[`${k}Direct`]),
              updatedAt: typeof a.UpdatedAt === "string" ? a.UpdatedAt : null,
            });
          }
        }
      } catch {
        error = "Seats.aero took too long to answer. Showing what WRLD has.";
      }
    }),
  );
  return { seats: out, error };
}
