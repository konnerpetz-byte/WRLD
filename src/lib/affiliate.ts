/**
 * Partner links built on the server: no script, no cookies on WRLD.
 *
 * GetYourGuide commission runs through Travelpayouts. A tracked link sends the
 * traveler through Travelpayouts' redirect, which credits WRLD and forwards to
 * the GetYourGuide page. Off until the program's link format is confirmed from a
 * link made in the Travelpayouts dashboard:
 *   TRAVELPAYOUTS_MARKER   partner ID (789493)
 *   TRAVELPAYOUTS_TRS      project/source ID (585101)
 *   TRAVELPAYOUTS_GYG_P    GetYourGuide's "p" value from a dashboard link
 * Without them, links go straight to GetYourGuide (with GETYOURGUIDE_PARTNER_ID
 * if WRLD ever joins GetYourGuide's own program directly).
 */
const GYG_CAMPAIGN = "108";

export function getYourGuideUrl(target: URL): string {
  if (process.env.GETYOURGUIDE_PARTNER_ID) target.searchParams.set("partner_id", process.env.GETYOURGUIDE_PARTNER_ID);
  const marker = process.env.TRAVELPAYOUTS_MARKER;
  const trs = process.env.TRAVELPAYOUTS_TRS;
  const p = process.env.TRAVELPAYOUTS_GYG_P;
  if (!marker || !trs || !p || process.env.GETYOURGUIDE_PARTNER_ID) return target.toString();
  const r = new URL("https://tp.media/r");
  r.search = new URLSearchParams({ marker, trs, p, u: target.toString(), campaign_id: GYG_CAMPAIGN }).toString();
  return r.toString();
}

export const affiliateStatus = () => ({
  getYourGuide: Boolean(process.env.GETYOURGUIDE_PARTNER_ID || (process.env.TRAVELPAYOUTS_MARKER && process.env.TRAVELPAYOUTS_TRS && process.env.TRAVELPAYOUTS_GYG_P)),
});
