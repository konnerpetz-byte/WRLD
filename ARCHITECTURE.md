# WRLD — Architecture



A trip planner that combines three ideas:
- **Points search and wallet** (like PointsYeah) — see all your points in one place and use them for flights and hotels
- **Collaborative itinerary** (like Rhyme) — plan day by day, around your real arrival and departure times
- **Experiences marketplace** (like Viator) — activities recommended for *your* travel type

Stack: Next.js (App Router, TypeScript) · Tailwind CSS · shadcn/ui · Supabase (Postgres, Auth, Edge Functions, Cron)

---

## 1. Folder structure

```
travel-app/
├── src/
│   ├── app/
│   │   ├── (marketing)/                     # Public pages
│   │   │   ├── layout.tsx
│   │   │   └── page.tsx
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── signup/page.tsx              # Passes visitor country → home currency
│   │   │   └── auth/callback/route.ts
│   │   ├── (app)/                           # Signed-in shell: sidebar + top bar
│   │   │   ├── layout.tsx
│   │   │   ├── dashboard/page.tsx
│   │   │   ├── trips/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [tripId]/
│   │   │   │       ├── layout.tsx           # Trip header + tabs
│   │   │   │       ├── page.tsx             # Overview
│   │   │   │       ├── itinerary/page.tsx   # Arrival-aware day grid
│   │   │   │       ├── for-you/page.tsx     # Recommendations
│   │   │   │       ├── lodging/page.tsx
│   │   │   │       ├── transit/page.tsx
│   │   │   │       ├── budget/page.tsx      # Planned totals, budget, expenses
│   │   │   │       └── settings/page.tsx
│   │   │   ├── wallet/page.tsx              # Points balances, connect accounts
│   │   │   ├── explore/
│   │   │   │   ├── flights/page.tsx         # Cash + award search
│   │   │   │   ├── hotels/page.tsx
│   │   │   │   └── experiences/page.tsx
│   │   │   ├── profile/
│   │   │   │   ├── page.tsx                 # Travel type, interests, past trips
│   │   │   │   └── quiz/page.tsx            # Travel-type questionnaire
│   │   │   └── settings/page.tsx            # Home country, currency, airport
│   │   ├── api/
│   │   │   ├── wallet/awardwallet/
│   │   │   │   ├── connect/route.ts         # Starts OAuth
│   │   │   │   └── callback/route.ts        # Saves token, kicks off first sync
│   │   │   └── webhooks/[provider]/route.ts
│   │   ├── layout.tsx
│   │   ├── globals.css
│   │   └── not-found.tsx
│   │
│   ├── components/
│   │   ├── ui/                              # shadcn/ui output
│   │   ├── layout/                          # AppSidebar, TopBar, PageHeader, TripTabs
│   │   └── shared/                          # EmptyState, DateRangePicker, Money (formats + converts)
│   │
│   ├── features/
│   │   ├── trips/          { components/, actions.ts, queries.ts, schemas.ts }
│   │   ├── itinerary/      # DayGrid, TimeBlockCard, ArrivalCard
│   │   ├── lodging/
│   │   ├── transit/
│   │   ├── budget/         # BudgetHeader, CategoryBreakdown, ExpenseList
│   │   ├── wallet/         # WalletList, ConnectButton, sync logic, copy.ts (disclosure) ✅
│   │   ├── currency/       # useCurrency(), formatMoney(), rate helpers
│   │   ├── traveler-profile/
│   │   │   ├── quiz.ts                      # Questions, scoring, travel types  ✅ written
│   │   │   └── components/                  # QuizStepper, TravelCompass (4-quadrant chart)
│   │   ├── recommendations/ # scoring + provider adapters (Viator first)
│   │   └── search/          # flight / hotel / award search adapters
│   │
│   ├── lib/
│   │   ├── supabase/ { client.ts, server.ts, admin.ts, proxy.ts }   # admin = service role, server-only
│   │   ├── env.ts
│   │   └── utils.ts
│   ├── hooks/
│   ├── types/database.ts                    # ✅ written
│   └── proxy.ts                             # Session refresh (Next 16 name; middleware.ts on Next 15)
│
├── supabase/
│   ├── migrations/                          # ✅ 01–06 written and tested
│   ├── functions/                           # Edge Functions, run by Supabase Cron
│   │   ├── sync-wallets/                    # Every 12h + on demand
│   │   ├── sync-exchange-rates/             # Daily
│   │   └── generate-recommendations/        # When a trip changes
│   ├── seed.sql
│   └── config.toml
└── …config files
```

---

## 2. Data model

```
profiles ──1:1── traveler_profiles (compass x/y → travel type)
   │       └──<  traveler_interests >── interest_tags
   │       └──<  loyalty_accounts >── loyalty_programs ──< transfer_partners
   │                  └── wallet_connections (AwardWallet)  [tokens in private schema]
   │
   └──< trip_members >── trips ──┬──< trip_days ──< time_blocks ──< itinerary_items ──< experience_ratings
                                 ├──< transit_segments  ─┐ (paid with points → loyalty_accounts)
                                 ├──< lodging           ─┘
                                 ├──< expenses (converted to trip currency)
                                 └──< trip_recommendations ── suggested time_block
```

| Migration | What it adds |
|---|---|
| **01 reference data** | Currencies and countries (country → currency) |
| **02 core trips** | Profiles, trips, members, days, blocks, items, lodging, transit, expenses, access rules |
| **03 trip availability** | Real clock windows per block; arrival/departure blocks out busy time |
| **04 points wallet** | Programs, connections, accounts, balance history, transfer partners, pay-with-points |
| **05 currency conversion** | Daily rates, `convert_currency()`, expense snapshots |
| **06 traveler profiles** | Interest tags, compass + travel type, ratings, booking history, recommendations |
| **07 trip budget** | Party size; planned-cost, budget-overview, by-category and points-planned views |
| **08 auto pricing** | Ticket price × travelers, price source, one-call "add recommendation to trip" |
| **09 API grants** | Explicit Data API access; row level security still decides which rows |

---

## 3. How the key features work

### Arrival-aware day grid
- Each block has a real window in the trip's timezone: Morning 6am–12pm, Afternoon 12–5pm, Evening 5pm–midnight.
- Each flight or train is marked **outbound**, **within** or **return**. Everything before you land (plus time for bags and getting to lodging) and after you leave for home (minus airport time) is blocked out.
- Default padding: flights 2h before / 1.5h after; trains 30 / 20 min; editable per leg.
- Every block gets: minutes available, first and last free moment, a status (open / limited / unavailable) and the reason (arrival / departure / in transit).
- **Tested example:** land in Lisbon 11 PM Nov 1, fly home 2 PM Nov 3.
  - Nov 1 — all blocks unavailable; the evening shows the arrival and check-in card.
  - Nov 2 — fully open.
  - Nov 3 — morning open until noon; afternoon and evening blocked by the flight home.
- The UI shows an arrival card ("Land 11:00 PM → check in at {hotel}") instead of an empty block, and recommendations only suggest activities that fit the free minutes.

### Points wallet (connected, not typed in)
- Users click **Connect** and sign in with **AwardWallet**, which already tracks 600+ airline, hotel and card programs. Its Account Access API uses OAuth and is free.
- Tokens are stored in a private table the browser can never read. A scheduled job refreshes balances every 12 hours; there's also a **Refresh** button.
- Every balance change is logged, so we can chart points over time.
- Users can't edit synced balances. Manual accounts remain as a fallback for programs that can't be synced.
- The `wallet_reachable_points` view answers "how many Hyatt points could I have?" by adding direct balances to transferable bank points, e.g. Chase points → Hyatt at 1:1.
- Lodging and transit record which account paid, the points used, and the cash taxes/fees.
- **Disclosed up front** (text in `features/wallet/copy.ts`, shown before Connect): users need a free AwardWallet account, they sign in on AwardWallet's site, we never see program passwords, and some programs may need manual entry.
- Disconnecting deletes the connection, its token and its synced balances immediately.
- AwardWallet also sells paid award-search APIs we can add later for "book with points" search.

### Currency
- A daily job pulls rates from **Frankfurter** (free, central-bank data, no key) and stores them as USD-based rates.
- **Defaults:**
  - Your home currency is set from the country you sign up in (USD if unknown), and you can change it in settings.
  - A trip's currency follows its destination country (Lisbon → EUR).
- Every expense keeps the amount and currency you actually paid, plus a copy converted to the trip currency at that day's rate, so budgets don't drift.
- The app shows any amount in your home currency with `convert_currency()`.

### Travel type compass
- **Axes:**
  - **Culture ↔ Nature** (left–right): where you want to be.
  - **Relaxing ↔ Active** (bottom–top): how much energy you want to spend.
- 10-question quiz (`features/traveler-profile/quiz.ts`). Each answer nudges both axes and records interest tags.
- **Five types:**

  | | Culture | Nature |
  |---|---|---|
  | **Active** | **The Itinerary Athlete** — "Sleep is for the flight home." | **The Trailblazer** — "If there's a ridge, you're on it." |
  | **Relaxing** | **The Flâneur** — "No plan, just a good café." | **The Sunset Collector** — "Golden hour is the itinerary." |

  Near the center: **The Wildcard** — "A little of everything, please."
- The database recalculates the type from the dot's position, so it can't get out of sync.
- Trip-mates can see each other's types (fun for group trips: "you're traveling with two Trailblazers").

### Budget tab
Everything with a price in the plan is added up automatically, in the trip's currency:

| Example | Amount |
|---|---|
| Museum (activity) | $50 |
| Lodging | $200 |
| Flight | $500 |
| **Planned total** | **$750** |

- **Planned items:** activities, lodging and flights/trains. Anything priced in another currency is converted at the latest rate.
- **Committed vs. ideas:** booked/held items count as committed. Ideas show separately, so you see both "what I've locked in" and "what the full plan costs". Cancelled items drop out.
- **Unplanned spending:** expenses not tied to a booking (dinners, taxis, souvenirs) are added on top for the **projected total**.
- **No double counting:** paying for the hotel and logging it as an expense linked to the hotel doesn't add it twice.
- **Header numbers:** budget, projected total, remaining, and per person (based on how many people are splitting costs).
- **Breakdown:** costs by category (lodging, transit, activities, food…), plus points planned per program, e.g. "plus 60,000 Hyatt points".
- **Tested:** $50 + $200 + $500 = $750. Adding a €46 tour idea, a $35 dinner and a cancelled $120 show gives $835 projected, $165 left of a $1,000 budget, and $417.50 per person for two.

### Automatic activity pricing
- **Typed by name:** an activity added without a price gets one looked up automatically. The app searches Viator by title and destination and only accepts a listing whose title clearly matches.
- **From a recommendation:** one call adds it to the itinerary with its listed price.
- **Price × travelers:** prices are stored per ticket and multiplied by the trip's traveler count. Changing the party size re-totals every ticket; you can override the ticket count per activity.
- **Source shown:** each price is labeled "listed price", "looked up", "your price" or "sample price", and any of them can be edited.
- **Budget updates on its own:** the budget reads these totals directly, so adding a museum moves the trip total immediately.

### Recommendations (to build next)
For each trip and traveler, score candidate activities (Viator first) out of 100:

| Factor | Weight | What it measures |
|---|---|---|
| Interest match | 40 | Activity tags vs. your interest weights |
| Compass fit | 25 | How close the activity's lean is to your dot |
| Memory | 20 | Boost tags you rated 4–5 before, lower ones you rated 1–2, skip repeats |
| Fits the schedule | 15 | Must fit an open block's free minutes; picks that block |

Each card shows plain reasons ("You rated a hike in Banff 5★", "Fits your free afternoon on Day 2"). Dismissing a suggestion feeds back into future scores.

---

## 4. Open items
- Trip ownership transfer (plain updates to `owner_id` are blocked)
- Expense splitting between members
- Award search (AwardWallet / other providers) on the Explore pages
- Auto-import flights from confirmation emails (AwardWallet also offers an email parsing API)
- Encrypt wallet tokens with Supabase Vault before launch
