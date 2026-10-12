import "server-only";

import { env } from "@/lib/env";

const LIVE = "https://api.viator.com/partner";
const SANDBOX = "https://api.sandbox.viator.com/partner";

/**
 * POST to Viator's Partner API. Uses VIATOR_API_BASE when set; otherwise
 * tries the live API and, if it rejects the key as invalid, Viator's sandbox
 * (new partner accounts often start with a sandbox key).
 */
export async function viatorPost(path: string, body: unknown, timeoutMs = 7000): Promise<Response | null> {
  const key = env("VIATOR_API_KEY");
  if (!key) return null;
  const bases = env("VIATOR_API_BASE") ? [env("VIATOR_API_BASE")!] : [LIVE, SANDBOX];
  let last: Response | null = null;
  for (const base of bases) {
    const response = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "exp-api-key": key, Accept: "application/json;version=2.0", "Accept-Language": "en-US", "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.status !== 401) return response;
    last = response;
  }
  return last;
}
