# WRLD rollout plan

_Written October 12, 2026. Live at wrldtrips.com._

## Where things stand today

| Area | Status |
|---|---|
| Website | Live at wrldtrips.com. Every GitHub push deploys automatically. |
| Trips, itinerary, map, group chat, budget, saved reels | Built and live |
| Official attractions | **107 verified sights in 40 cities and towns** (8 earlier + 99 added today). Links re-checked every Monday. |
| Bookable experiences (Viator, GetYourGuide) | Built. Shows **sample listings** until the Viator key is added. |
| Points flights explorer (`/flights`) | Built. Shows **sample results** until Seats.aero approves access. |
| Card → airline transfer ratios | 32 transfer links, from a chart last updated September 2026 |
| Stats | `/admin/stats` (you only) plus Vercel Analytics |

## 1. Partner accounts: what to do and when

### Viator: self-serve, about 15 minutes

1. Go to **partnerresources.viator.com** → *Become a partner* (signs you up at partners.viator.com).
2. Choose the **Affiliate** partner type. Give wrldtrips.com as your site and describe it as a trip planner.
3. Signing up gives you **Basic API access right away**. The key is in the partner dashboard, in the API section.
4. Send me the key (or add it in Vercel → wrld → Settings → Environment Variables as `VIATOR_API_KEY`).
   - Real listings and prices replace the sample cards automatically.
   - Product links carry your affiliate tracking.
   - Viator's terms: 30-day cookie, standard commission (widely reported around 8%).
5. **Later:** apply for *Full* or *Full + Booking* access once you have traffic. Booking lets people pay inside WRLD.

### GetYourGuide: application, a few days

1. Go to **partner.getyourguide.com** and apply as a travel app or website. They ask about your site and audience.
2. Approval usually takes a few days. Commission is around 8% with a 31-day cookie.
3. After approval, copy your **partner ID** from the dashboard into Vercel as `GETYOURGUIDE_PARTNER_ID`. WRLD already adds it to every GetYourGuide link.
4. **Later:** API access is by request for established partners. Links work without it.

### Seats.aero: you have to reach out (needed for real award flights)

Seats.aero's API is for personal use unless they approve commercial use in writing.

- **Option A, partner approval (best):** email **support@seats.aero** from an @wrldtrips.com address. Include what WRLD does, expected searches per day (start with "under 1,000 a day during beta"), and that results link people to airline sites to book. Once approved, add `SEATS_AERO_API_KEY` in Vercel and `/flights` switches to live data.
- **Option B, "Login with Seats.aero":** each user connects their own Seats.aero Pro account and searches use their allowance. Allowed today without a partner deal, but users must pay Seats.aero. A good fallback if Option A is slow. About 2 days of work for me.
- **Option C, other sources:** point.me, Roame and AwardFares have partner programs too. Same idea: ask for API terms.

> Testing with your own Seats.aero Pro key is fine. Showing those results to other people isn't, until Option A or B is in place.

### Also worth starting now

- **AwardWallet** (automatic points balances): apply for API access. The connect button is already built and waits for the keys.
- **Email at @wrldtrips.com:** needed for the Seats.aero request and the privacy address. Set up forwarding to Gmail first.

## 2. The rollout, phase by phase

### Phase 0: ready for testers (this week)

- [ ] Make the GitHub repo private
- [ ] Email forwarding for privacy@ and hello@wrldtrips.com
- [ ] Sign-up emails through a sending service (Resend), so many friends can sign up at once
- [ ] Turn on Vercel Analytics (Analytics tab → Enable)
- [ ] Sign up for Viator and apply to GetYourGuide (above)
- [ ] Email Seats.aero (above)
- [ ] Test the live site end to end on your phone: sign up, create a multi-city trip, search "Uffizi", invite a second account, chat, open `/flights`

### Phase 1: friends and family beta (weeks 1–4)

- **Who:** 20–30 people planning a real trip, ideally points collectors with a group.
- **Watch** on `/admin/stats`:
  - share of new people who make a trip (goal: over half)
  - invite join rate (goal: over half)
  - week-later return
  - suggestion add rate
- **Ask each tester two questions:**
  - "How long did planning take compared with last time?"
  - "What did you still do outside WRLD?"
- **Build from what they say.** Likely needs:
  - forward-a-confirmation-email import
  - more official sights for the cities testers pick
  - real prices on those sights

### Phase 2: real data and first revenue (weeks 3–8)

- **Viator key live:** real listings and the first commissions. GetYourGuide links earn too.
- **Seats.aero live** (or "Login with Seats.aero"): `/flights` shows real award seats from each person's home airport.
- **Prices on official sights:** read the ticket pages for the 107 sights and add adult prices with a "checked on" date. Re-check every 6 months.
- **Explorer add-ons:**
  - alerts ("tell me when DTW→LIS business opens under 70k")
  - return dates
  - "add this flight to my trip"
- **Payments:** Stripe for the Trip Pass ($9.99 per trip). Needs Terms of Service first.
- **Before taking money:**
  - Upgrade Vercel to Pro ($20/mo; the free plan isn't for commercial use)
  - Upgrade Supabase to Pro ($25/mo; free projects pause when idle)

### Phase 3: public launch on the web (months 2–4)

- **Public trip pages:** "Our 7 days in Portugal" with a *Plan yours on WRLD* button.
- **One page per official sight:** official link, how timed entry works, best time to go. These bring in free search traffic.
- **Marketing:** points communities (Reddit, FlyerTalk, Facebook groups) with real trip write-ups, plus 3–5 small points creators given a free Trip Pass.
- **WRLD Pro** ($5.99/mo or $49/yr) once award search and alerts are live.

### Phase 4: app stores (months 3–6)

- Apple Developer ($99/yr) and Google Play ($25 once)
- iOS share extension, so you can share a reel to WRLD (needs a Mac and Xcode)
- In-app purchases for the Trip Pass and Pro
- Store screenshots, descriptions and privacy forms

## 3. Official attractions: how they're kept right

- **What a verified sight means.** Its domain matches the official website listed on Wikidata, or a second check confirms the government body or operator runs it. The link answers, and the map pin is within 1.5 km of Wikidata's coordinates.
- **Coverage, 40 cities and towns:**
  - **Europe:** Paris, Versailles, London, Edinburgh, Dublin, Rome and the Vatican, Florence, Venice, Milan, Barcelona, Madrid, Seville, Lisbon, Sintra, Amsterdam, Berlin, Munich, Schwangau, Vienna, Prague, Athens, Istanbul (Topkapı)
  - **Rest of the world:** Giza, New York, Washington, San Francisco, Chicago, Los Angeles, Mexico City and Teotihuacan, Machu Picchu, Tokyo, Kyoto, Nara, Seoul, Singapore, Dubai, Sydney
  - Granada (Alhambra) is in the original 8.
- **Left out on purpose:** Hagia Sophia and the Basilica Cistern. Their official sites couldn't be confirmed.
- **Not filled in yet:** prices and exact opening hours. Sights say "see the official site" rather than show a guess.
- **Upkeep:** every Monday the database re-opens each official link. Anything that stops answering appears on `/admin/stats` under "Official links to look at".
- **Adding more:** `scripts/attractions/README.md` explains the process. Next batch: the cities your testers actually pick.

## 4. Costs to expect in the first 6 months

| Item | Cost |
|---|---|
| Domain (GoDaddy) | Paid |
| Vercel Pro | $20/mo (from first revenue) |
| Supabase Pro | $25/mo (before public launch) |
| Email sending (Resend) | Free up to a few thousand emails a month |
| Map search (paid geocoder) | about $0–50/mo at beta size |
| Seats.aero partner access | Ask them; not published |
| Apple / Google developer accounts | $99/yr + $25 |

## Sources

- Viator affiliate program: https://partnerresources.viator.com/travel-commerce/affiliate/
- GetYourGuide partner terms (8%, 31 days): https://getlasso.co/affiliate/get-your-guide/
- Seats.aero API rules: https://docs.seats.aero/article/68-seatsaero-pro-api-access-limits-and-usage
- Seats.aero cached search reference: https://developers.seats.aero/reference/cached-search
- Transfer partner ratios (updated Sept 1, 2026): https://thepointsguy.com/guide/transfer-credit-card-rewards/
- Greek Ministry of Culture ticketing (Hellenic Heritage): https://www.hh.gr/en/about
