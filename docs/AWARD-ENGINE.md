# Building WRLD's own award-flight engine

_October 12, 2026. How PointsYeah and Seats.aero work, and how WRLD can build its own system without inheriting their legal risk._

## 1. How the existing tools work

| | Seats.aero | PointsYeah |
|---|---|---|
| **Where seats come from** | Bots that search airline loyalty websites and their behind-the-scenes data feeds, about 24 programs | Not published. Reviews describe the same pattern (automated searches of airline programs, plus hotels) |
| **Cached search** | Most results come from a stored database refreshed "periodically", stamped with how old each result is (can be days) | Fast results from stored data |
| **Live search** | Pro users and approved partners trigger a fresh lookup for one route. Pro allows about 1,125 live results an hour | Real-time search on demand |
| **Explorer** | "Anywhere from X" built by scanning the stored data, not by live searching | Same |
| **Alerts** | Compares each new data pull with the last one; emails when a seat opens | Same |
| **Business** | One person, bootstrapped. About $1.5M a year in subscriptions at end of 2023, reportedly about $8M by 2025. $9.99/mo or $99/yr | $11.99/mo or $99.99/yr |

### The hard part isn't the code, it's the data

- **The lawsuit.** Air Canada sued Seats.aero in October 2023, claiming its bots broke Aeroplan's terms of use, which ban bots, scrapers and getting around blocking. It also claimed computer fraud and trademark violations for showing the Aeroplan logo.
- **The volume.** Air Canada said Seats.aero searched up to 265,000 Aeroplan routes over two days and that the traffic contributed to site outages.
- **Status.** Air Canada lost its bid for an early injunction, but as of May 2026 the case is still open after about 3 years, with no settlement and with Seats.aero filing antitrust counterclaims against Air Canada.
- **Airlines fight back.** They also block bots, require logins, and change their sites often. A scraper is a permanent arms race.

**Bottom line:** copying their method means building against airlines that actively block it and have sued over it. WRLD should own the engine (database, scheduler, explorer, alerts, "your points can book this") and plug in data sources it's allowed to use.

## 2. The engine WRLD should build

```
            ┌─────────────── Data sources (pluggable) ────────────────┐
            │ A. Licensed feeds  B. GDS saver classes  C. User-linked │
            └──────────────┬──────────────────────────────────────────┘
                           ▼
   Route planner ──► Fetch workers ──► Normalize ──► award_availability
   (what to check,      (respect rate      (one shape     (one row per
    how often)           limits, retries)   per seat)      route/date/
                                                           program/cabin)
                                                │
              ┌─────────────────────────────────┼──────────────────────┐
              ▼                                 ▼                      ▼
      Points explorer (/points)        Change detector ──► Alerts   Trip planner
      cache-first, freshness shown     (new / gone / cheaper)       ("add this
      + "your points can book this"                                 flight")
```

### Parts

1. **`award_availability` table (the cache).**
   - **Columns:** origin, destination, date, program, cabin, miles, taxes and currency, seats left, airlines, nonstop or not, `seen_at`, data source.
   - **Same shape for every source**, so the explorer doesn't care where a seat came from.
   - **History.** Keep a small history table so alerts can say "opened today" and charts can show "usually 60k, now 45k."
2. **Route planner (what to check, and how often).**
   - Score each route by demand: what people searched, everyone's home airports, saved trip destinations, open alerts.
   - Score it by how often it changes: premium cabins and the 0–60 days before departure change most.
   - Popular routes refresh hourly; long-tail routes daily or weekly.
   - This is how Seats.aero covers "anywhere" without searching everything all the time.
3. **Fetch workers.**
   - One adapter per source, a fixed request budget per source, backoff on errors, logging.
   - These run on a schedule (Supabase `pg_cron` + Edge Functions, or a small worker on Fly/Render) and write into the cache.
   - The current `/points` code is already shaped this way: `searchAwards()` picks a source; adding one is a new adapter.
4. **Normalizer.**
   - Maps each source's codes to WRLD's programs and cabins (already started in `SOURCE_PROGRAM`).
   - Fills in taxes where the source leaves them out.
   - Drops results flown mostly in a lower cabin.
5. **Explorer and search.**
   - Read from the cache first, so results are instant.
   - Show "seen 3 hours ago" on every result.
   - Offer "Check now" when a live source has budget left.
6. **Change detector and alerts.** After each refresh, compare against the last snapshot. When a seat matches someone's alert (route, cabin, max miles, dates), send an email or push.
7. **Wallet match (already built).** Transfer partners and balances turn each result into "your Chase points can book this."

## 3. Where the seats come from

Ranked from safest to riskiest. Build the engine first; switch these on as they come through.

### A. Licensed feeds (start here)

- **Seats.aero partner API.** Needs written approval for commercial use; email support@seats.aero. Plugs into the existing adapter.
- **AwardTravelFinder Enterprise API.** About 12 programs (BA/Avios, Virgin Atlantic, Qatar, Etihad, Cathay, Iberia, United, American, Alaska, Emirates, JetBlue, Qantas), with taxes included. Ask for Enterprise pricing.
- **Ask PointsYeah, point.me and Roame about data licensing.** None has a public API, but data deals happen privately.

A licensed feed fills the cache directly. The route planner then decides which licensed calls to spend.

### B. Saver seats through a GDS (the long-term moat)

- **What a GDS is.** Airlines publish seat availability by fare class to travel agencies through global distribution systems: Amadeus, Sabre, Travelport.
- **How it reveals award seats.** Many airlines release partner award ("saver") seats in specific fare classes. For example, Star Alliance partner business saver space is commonly class **I** and economy saver class **X** on many members.
- **Who does this today.** ExpertFlyer, a tool for frequent flyers, is the best-known example. It's the agency channel airlines expect.
- **What it takes:**
  - a travel-agency setup (your own accreditation through IATA or ARC, or a host agency)
  - a GDS contract
  - a table mapping each airline's saver classes to the programs that can book them
- **Trade-offs:** slower and pricier to start, but WRLD owns the data and doesn't depend on another startup.
- **What it misses:** each airline's own members-only award space (for example, United's own saver space for its own members) isn't always visible this way.

### C. User-linked searches

"Login with Seats.aero" lets each user's own Pro account run searches. It's allowed today but needs users to pay Seats.aero; a good bridge.

### What WRLD should not do

- Run bots against airline websites against their terms.
- Get around blocking (rotating IP addresses to dodge limits, solving CAPTCHAs, faking logins).
- Show airline logos without permission.

Each of these is a specific claim in the Air Canada suit, and they'd put WRLD's app-store listing, payment processing and partnerships at risk. If you ever want to go that way, get a lawyer's written opinion first.

## 4. Build order

| Step | What | Depends on |
|---|---|---|
| 1 | `award_availability` + history tables, normalizer, explorer reads from the cache (sample data first) | nothing; can start now |
| 2 | Route planner, plus logging every explorer search as the demand signal | step 1 |
| 3 | Adapter for the first licensed feed (Seats.aero or AwardTravelFinder) + scheduled refresh | a signed agreement |
| 4 | Change detector + alerts (email first) | email sending (Resend) |
| 5 | "Check now" live refresh with a per-user budget (Pro feature) | step 3 |
| 6 | GDS saver-class source | agency + GDS contract |
| 7 | Hotels, the same pattern for hotel award nights | step 3 |

**Rough cost to run** (steps 1–5): database and workers are tens of dollars a month at beta size. The real cost is the data license, usually a monthly fee or per-call pricing negotiated with the provider.

## 5. Already in WRLD

- **Points explorer:** cheapest seats by destination, month and cabin, from your home airport.
- **Explore by:** all programs, the programs your points can reach, one credit card (Chase, Amex, Citi, Capital One, Bilt, showing seats bookable through its transfer partners), or one airline program.
- **Card transfer ratios** for 32 card-to-airline and card-to-hotel links (September 2026), plus balances.
- **Sample data** until a licensed source is switched on.

## Sources

- Seats.aero data collection: https://milepoint.com/questions/how-does-the-seats-aero-service-collect-data-for-award-seat-availability/
- Seats.aero live search: https://awardwallet.com/news/seats-aero-adds-live-award-search/
- Air Canada v. Seats.aero (status May 2026): https://viewfromthewing.com/air-canada-says-award-scraping-is-computer-fraud-seats-aero-says-thats-anticompetitive/
- Seats.aero business: https://kaeda.co/cases/seats-aero
- Seats.aero API rules: https://docs.seats.aero/article/68-seatsaero-pro-api-access-limits-and-usage
- AwardTravelFinder API: https://awardtravelfinder.com/mcp
