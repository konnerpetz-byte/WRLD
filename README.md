# Layover

A trip planner that builds each day around your real flight times, keeps your points balances in one place, and adds every priced activity, flight and stay to one budget.

Built with Next.js 16 (App Router), Tailwind CSS 4, shadcn/ui and Supabase. See `ARCHITECTURE.md` for the full design.

## Run it locally

**1. Create a Supabase project** at supabase.com. In **Project settings → API keys**, copy the project URL and the **publishable** key.

**2. Create the database.** Either:
- **Supabase CLI:** `npx supabase link --project-ref <your-ref>` then `npx supabase db push`, or
- **Dashboard:** open the SQL editor and run each file in `supabase/migrations/` in order (01 → 09).

**3. Add your keys.**
```bash
cp .env.example .env.local
# fill in NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

**4. Start the app.**
```bash
npm install
npm run dev
```
Open http://localhost:3000, create an account, take the travel-type quiz, then add a trip.

**Optional:**
- **Try automatic prices without an API key:** set `PRICING_SAMPLE_DATA=true` in `.env.local`. Prices found this way are labeled "sample price" in the app.
- **Preview the itinerary and compass without a database:** open http://localhost:3000/dev/preview. This page only exists in development.

## What works now
| Area | Status |
|---|---|
| Sign up / sign in | Email + password. New users get a home currency from their country. |
| Trips | Create a trip; days and morning/afternoon/evening blocks are built automatically. |
| Itinerary | Arrival-aware grid. Flights block out time before you land and after you leave. |
| Activities | Add by name; the price is looked up automatically (Viator, or sample data), multiplied by travelers, and editable. |
| Flights & trains, stays | Add with local times and time zones; cash and points. |
| Budget | Planned total (booked vs. ideas), spending outside the plan, budget left, per person, category breakdown. |
| Travel type | 10-question quiz and the 4-quadrant compass. |
| Points wallet | Disclosure, manual accounts, transferable points. |

## Needs outside accounts to finish
| Feature | What's needed |
|---|---|
| Automatic activity prices | A Viator affiliate API key (`VIATOR_API_KEY`). Check the response fields in `src/features/pricing/lookup.ts` against your API version. |
| Connected points balances | AwardWallet API access, then finish `/api/wallet/awardwallet/connect` and its callback, plus a sync job. |
| Daily exchange rates | A scheduled Supabase Edge Function that pulls rates from Frankfurter into `exchange_rates`. Until it runs, only same-currency amounts are counted. |
| Activity recommendations | The recommender (scoring is described in `ARCHITECTURE.md`). The database side, including one-click "add to trip" with price, is done. |

## Project layout
```
src/app/            routes: (auth) sign-in, (app) signed-in screens, api/, dev/preview
src/features/       trips, itinerary, budget, pricing, wallet, traveler-profile, auth
src/components/     ui/ (shadcn), layout/ (nav, tabs, wordmark)
src/lib/            supabase clients, formatting and time zone helpers
src/types/          database.ts — every table, view and enum
supabase/migrations 01–09, tested together
```
