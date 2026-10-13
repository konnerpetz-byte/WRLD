/**
 * Only allow redirects to a path on this site. Plain `startsWith("/")` checks
 * miss tricks like "/\evil.com" or "/%5Cevil.com", which browsers treat as
 * another site, so parse it the way the browser will and compare origins.
 */
export function safePath(value: unknown, fallback = "/trips"): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.length > 512) return fallback;
  if (/[\\\u0000-\u001f]/.test(value) || /^\/[/\\]/.test(value) || /%5c|%2f%2f/i.test(value)) return fallback;
  try {
    const base = "https://wrld.invalid";
    const u = new URL(value, base);
    const path = u.pathname + u.search + u.hash;
    // Normalizing can turn "/..//evil.com" into "//evil.com"; refuse anything that isn't a single-slash path.
    if (u.origin !== base || !path.startsWith("/") || /^\/[/\\]/.test(path)) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
