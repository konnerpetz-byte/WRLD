/**
 * Centralized types for the Travel & Trip Planning App.
 *
 * Mirrors supabase/migrations/2026101200*.sql.
 * Once the Supabase project exists, generate exact client types with:
 *   npx supabase gen types typescript --linked > src/types/supabase.generated.ts
 * and keep this file for the friendly names, enum lists and joined shapes.
 *
 * These are `type` aliases (not `interface`) on purpose: supabase-js
 * requires table rows to be assignable to Record<string, unknown>.
 */

// ---------------------------------------------------------------------------
// Primitive aliases
// ---------------------------------------------------------------------------
export type UUID = string;
/** 'YYYY-MM-DD' (Postgres `date`) */
export type ISODate = string;
/** 'HH:MM:SS' (Postgres `time`) */
export type ISOTime = string;
/** ISO 8601 with offset (Postgres `timestamptz`) */
export type ISODateTime = string;
/** ISO 4217, e.g. 'USD' */
export type CurrencyCode = string;
/** ISO 3166-1 alpha-2, e.g. 'PT' */
export type CountryCode = string;

// ---------------------------------------------------------------------------
// Enums — arrays double as <Select> options and zod: z.enum(TRIP_STATUSES)
// ---------------------------------------------------------------------------
export const TRIP_STATUSES = ['planning', 'booked', 'in_progress', 'completed', 'archived'] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const TRIP_ROLES = ['owner', 'editor', 'viewer'] as const;
export type TripRole = (typeof TRIP_ROLES)[number];

export const TIME_BLOCK_SLOTS = ['morning', 'afternoon', 'evening'] as const;
export type TimeBlockSlot = (typeof TIME_BLOCK_SLOTS)[number];

export const BLOCK_STATUSES = ['open', 'limited', 'unavailable'] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

export const TRAVEL_EVENTS = ['arrival', 'departure', 'in_transit'] as const;
export type TravelEvent = (typeof TRAVEL_EVENTS)[number];

export const ITINERARY_ITEM_KINDS = ['activity', 'tour', 'meal', 'sightseeing', 'free_time', 'check_in', 'note'] as const;
export type ItineraryItemKind = (typeof ITINERARY_ITEM_KINDS)[number];

export const TRANSIT_MODES = ['flight', 'train', 'bus', 'ferry', 'car'] as const;
export type TransitMode = (typeof TRANSIT_MODES)[number];

export const TRANSIT_DIRECTIONS = ['outbound', 'within', 'return'] as const;
export type TransitDirection = (typeof TRANSIT_DIRECTIONS)[number];

export const BOOKING_STATUSES = ['idea', 'held', 'booked', 'cancelled'] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const EXPENSE_CATEGORIES = ['lodging', 'transit', 'food', 'activities', 'shopping', 'fees', 'other'] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const LOYALTY_PROGRAM_KINDS = ['airline', 'hotel', 'bank', 'car_rental', 'other'] as const;
export type LoyaltyProgramKind = (typeof LOYALTY_PROGRAM_KINDS)[number];

export const WALLET_PROVIDERS = ['awardwallet'] as const;
export type WalletProvider = (typeof WALLET_PROVIDERS)[number];

export const CONNECTION_STATUSES = ['pending', 'active', 'needs_reauth', 'error', 'revoked'] as const;
export type ConnectionStatus = (typeof CONNECTION_STATUSES)[number];

export const BALANCE_SOURCES = ['connected', 'manual'] as const;
export type BalanceSource = (typeof BALANCE_SOURCES)[number];

export const TRAVEL_ARCHETYPES = ['itinerary_athlete', 'flaneur', 'trailblazer', 'sunset_collector', 'wildcard'] as const;
export type TravelArchetype = (typeof TRAVEL_ARCHETYPES)[number];

export const INTEREST_SOURCES = ['quiz', 'manual', 'learned'] as const;
export type InterestSource = (typeof INTEREST_SOURCES)[number];

export const PRICE_SOURCES = ['provider', 'estimate', 'manual', 'official'] as const;
export type PriceSource = (typeof PRICE_SOURCES)[number];

export const RECOMMENDATION_STATUSES = ['new', 'saved', 'added', 'dismissed'] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

// ---------------------------------------------------------------------------
// Shared column groups
// ---------------------------------------------------------------------------
type Timestamps = { created_at: ISODateTime; updated_at: ISODateTime };

type Bookable = {
  booking_status: BookingStatus;
  booking_url: string | null;
  provider: string | null;
  provider_ref: string | null;
  /** Cash paid. On award bookings this is the taxes/fees portion. */
  cost: number | null;
  currency: CurrencyCode | null;
};

type PaidWithPoints = {
  loyalty_program_id: UUID | null;
  loyalty_account_id: UUID | null;
  points_used: number | null;
};

type Geo = { latitude: number | null; longitude: number | null };

// ---------------------------------------------------------------------------
// Reference data (01)
// ---------------------------------------------------------------------------
export type Currency = { code: CurrencyCode; name: string; symbol: string | null; minor_units: number };
export type Country = { code: CountryCode; name: string; currency_code: CurrencyCode };

// ---------------------------------------------------------------------------
// Core trip planning (02, 03)
// ---------------------------------------------------------------------------
export type Profile = Timestamps & {
  id: UUID; // = auth.users.id
  display_name: string | null;
  avatar_url: string | null;
  home_country: CountryCode | null;
  home_currency: CurrencyCode;
  home_airport: string | null;
};

export type Trip = Timestamps & {
  id: UUID;
  owner_id: UUID;
  title: string;
  destination: string | null;
  destination_country: CountryCode | null;
  start_date: ISODate;
  end_date: ISODate;
  timezone: string;
  status: TripStatus;
  cover_image_url: string | null;
  budget: number | null;
  currency: CurrencyCode;
  notes: string | null;
  /** People sharing the trip's costs, for per-person totals. */
  party_size: number;
  /** Destination center, for the map. */
  latitude: number | null;
  longitude: number | null;
};

export type TripMember = { trip_id: UUID; user_id: UUID; role: TripRole; created_at: ISODateTime; last_read_at: ISODateTime | null };

// ---------------------------------------------------------------------------
// Traveling together (14) and account (15)
// ---------------------------------------------------------------------------
export type TripInvite = {
  id: UUID;
  trip_id: UUID;
  token: UUID;
  role: TripRole;
  created_by: UUID | null;
  created_at: ISODateTime;
  expires_at: ISODateTime;
  revoked_at: ISODateTime | null;
  max_uses: number | null;
  uses: number;
};

export const SPOT_SOURCES = ['tiktok', 'instagram', 'youtube', 'maps', 'link', 'note'] as const;
export type SpotSource = (typeof SPOT_SOURCES)[number];

export type SavedSpot = Geo & {
  id: UUID;
  user_id: UUID | null;
  trip_id: UUID | null;
  url: string | null;
  source: SpotSource;
  title: string | null;
  author: string | null;
  thumbnail_url: string | null;
  note: string | null;
  place_name: string | null;
  address: string | null;
  attraction_id: UUID | null;
  itinerary_item_id: UUID | null;
  created_at: ISODateTime;
};

export type TripMessage = {
  id: UUID;
  trip_id: UUID;
  user_id: UUID | null;
  body: string;
  spot_id: UUID | null;
  created_at: ISODateTime;
};

export type ExpenseParticipant = { expense_id: UUID; user_id: UUID; trip_id: UUID };

export type Settlement = {
  id: UUID;
  trip_id: UUID;
  from_user: UUID;
  to_user: UUID;
  amount: number;
  currency: CurrencyCode;
  settled_on: ISODate;
  created_by: UUID | null;
  created_at: ISODateTime;
};

export type ChecklistItem = Timestamps & {
  id: UUID;
  trip_id: UUID;
  list: 'packing' | 'todo' | 'documents';
  title: string;
  done: boolean;
  done_by: UUID | null;
  assigned_to: UUID | null;
  due_on: ISODate | null;
  position: number;
  created_by: UUID | null;
  /** Travel documents: when to remind, which rule it came from, the official page. */
  remind_on: ISODate | null;
  doc_key: string | null;
  info_url: string | null;
};

export type ItemVote = { item_id: UUID; user_id: UUID; trip_id: UUID; created_at: ISODateTime };

/** Private to the account holder (phone, home address). */
export type AccountDetails = Timestamps & {
  user_id: UUID;
  phone: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country_code: CountryCode | null;
};

export type TripDay = Timestamps & {
  id: UUID;
  trip_id: UUID;
  date: ISODate;
  title: string | null;
  notes: string | null;
  /** The stop (city) you sleep in that night; set by the database. */
  stop_id: UUID | null;
  /** That stop's IANA time zone; set by the database. */
  timezone: string | null;
};

/** One city on a multi-city trip (12). */
export type TripStop = Timestamps &
  Geo & {
    id: UUID;
    trip_id: UUID;
    position: number;
    city: string;
    country_code: CountryCode | null;
    timezone: string;
    arrive_date: ISODate;
    leave_date: ISODate;
  };

/** A hand-checked official sight (13). */
export type Attraction = {
  id: UUID;
  slug: string;
  name: string;
  aliases: string[];
  city: string;
  country_code: CountryCode | null;
  latitude: number;
  longitude: number;
  address: string | null;
  official_url: string;
  tickets_url: string | null;
  timed_entry: boolean;
  best_slot: TimeBlockSlot | null;
  suggested_start: ISOTime | null;
  duration_minutes: number | null;
  hours_note: string | null;
  visit_note: string | null;
  adult_price: number | null;
  currency: CurrencyCode | null;
  price_note: string | null;
  verified_on: ISODate | null;
  /** Interest tags (public.interest_tags slugs) and compass lean, for recommendations (16) */
  tags: string[];
  lean_x: number;
  lean_y: number;
  /** Last weekly link check (HTTP status, -1 = no answer). */
  link_status: number | null;
  link_checked_at: ISODateTime | null;
  created_at: ISODateTime;
};

/** Window + availability are calculated by the database from transit legs. */
export type TimeBlock = Timestamps & {
  id: UUID;
  trip_id: UUID;
  day_id: UUID;
  slot: TimeBlockSlot;
  starts_at: ISODateTime;
  ends_at: ISODateTime;
  status: BlockStatus;
  available_minutes: number;
  available_from: ISODateTime | null;
  available_until: ISODateTime | null;
  travel_event: TravelEvent | null;
  notes: string | null;
};

export type ItineraryItem = Timestamps &
  Bookable &
  Geo & {
    id: UUID;
    trip_id: UUID;
    time_block_id: UUID;
    kind: ItineraryItemKind;
    title: string;
    description: string | null;
    start_time: ISOTime | null;
    end_time: ISOTime | null;
    location_name: string | null;
    address: string | null;
    tags: string[];
    position: number;
    created_by: UUID | null;
    /** Price per ticket. When set, the database sets cost = unit_price × quantity. */
    unit_price: number | null;
    /** null = whole party (trips.party_size) */
    quantity: number | null;
    price_source: PriceSource | null;
    price_checked_at: ISODateTime | null;
    /** The official listing this came from, if any. */
    attraction_id: UUID | null;
    official_url: string | null;
  };

export type Lodging = Timestamps &
  Bookable &
  PaidWithPoints &
  Geo & {
    id: UUID;
    trip_id: UUID;
    name: string;
    address: string | null;
    check_in_at: ISODateTime;
    check_out_at: ISODateTime;
    confirmation_code: string | null;
    notes: string | null;
    created_by: UUID | null;
  };

export type TransitSegment = Timestamps &
  Bookable &
  PaidWithPoints & {
    id: UUID;
    trip_id: UUID;
    mode: TransitMode;
    direction: TransitDirection;
    carrier: string | null;
    service_number: string | null;
    origin_code: string | null;
    origin_name: string | null;
    origin_timezone: string | null;
    destination_code: string | null;
    destination_name: string | null;
    destination_timezone: string | null;
    depart_at: ISODateTime;
    arrive_at: ISODateTime;
    buffer_before_minutes: number;
    buffer_after_minutes: number;
    origin_latitude: number | null;
    origin_longitude: number | null;
    destination_latitude: number | null;
    destination_longitude: number | null;
    cabin_class: string | null;
    seat: string | null;
    confirmation_code: string | null;
    notes: string | null;
    created_by: UUID | null;
  };

export type Expense = Timestamps & {
  id: UUID;
  trip_id: UUID;
  paid_by: UUID | null;
  category: ExpenseCategory;
  description: string | null;
  amount: number;
  currency: CurrencyCode;
  incurred_on: ISODate;
  lodging_id: UUID | null;
  transit_segment_id: UUID | null;
  itinerary_item_id: UUID | null;
  /** Set by the database at the day's exchange rate; null until a rate exists. */
  amount_in_trip_currency: number | null;
  fx_rate: number | null;
};

// ---------------------------------------------------------------------------
// Points wallet (04)
// ---------------------------------------------------------------------------
export type LoyaltyProgram = {
  id: UUID;
  slug: string;
  name: string;
  kind: LoyaltyProgramKind;
  unit_name: string;
  alliance: string | null;
  est_cents_per_point: number | null;
  awardwallet_code: string | null;
  logo_url: string | null;
  created_at: ISODateTime;
};

export type TransferPartner = {
  from_program_id: UUID;
  to_program_id: UUID;
  ratio_from: number;
  ratio_to: number;
  min_transfer: number | null;
  typical_wait: string | null;
  updated_at: ISODateTime;
};

export type WalletConnection = Timestamps & {
  id: UUID;
  user_id: UUID;
  provider: WalletProvider;
  status: ConnectionStatus;
  external_user_id: string | null;
  last_synced_at: ISODateTime | null;
  last_error: string | null;
};

export type LoyaltyAccount = Timestamps & {
  id: UUID;
  user_id: UUID;
  program_id: UUID;
  connection_id: UUID | null;
  source: BalanceSource;
  external_account_id: string | null;
  member_last4: string | null;
  display_name: string | null;
  balance: number;
  elite_status: string | null;
  points_expire_on: ISODate | null;
  last_synced_at: ISODateTime | null;
};

export type LoyaltyBalanceHistory = {
  id: number;
  account_id: UUID;
  user_id: UUID;
  balance: number;
  recorded_at: ISODateTime;
};

/** View: points reachable per program, directly or via transfer. */
export type WalletReachablePoints = {
  user_id: UUID;
  target_program_id: UUID;
  via_program_id: UUID;
  route: 'direct' | 'transfer';
  points: number;
};

// ---------------------------------------------------------------------------
// Currency (05)
// ---------------------------------------------------------------------------
/** 1 USD = rate × quote */
export type ExchangeRate = {
  quote: CurrencyCode;
  as_of: ISODate;
  rate: number;
  source: string;
  fetched_at: ISODateTime;
};


// ---------------------------------------------------------------------------
// Traveler profiles & recommendations (06)
// ---------------------------------------------------------------------------
export type InterestTag = {
  slug: string;
  label: string;
  category: string;
  compass_x: number;
  compass_y: number;
};

export type TravelerProfile = Timestamps & {
  user_id: UUID;
  /** −10 Culture … +10 Nature */
  compass_x: number | null;
  /** −10 Relaxing … +10 Active */
  compass_y: number | null;
  /** Calculated by the database from the compass position. */
  archetype: TravelArchetype | null;
  quiz_version: number | null;
  quiz_answers: Record<string, string>;
  quiz_completed_at: ISODateTime | null;
};

export type TravelerInterest = {
  user_id: UUID;
  tag_slug: string;
  /** −2 "not for me" … +3 "love it" */
  weight: number;
  source: InterestSource;
  updated_at: ISODateTime;
};

export type ExperienceRating = {
  user_id: UUID;
  itinerary_item_id: UUID;
  rating: number;
  would_repeat: boolean | null;
  created_at: ISODateTime;
};

/** View */
export type BookingHistoryEntry = {
  trip_id: UUID;
  trip_title: string;
  destination: string | null;
  destination_country: CountryCode | null;
  trip_end_date: ISODate;
  booking_type: 'activity' | 'lodging' | TransitMode;
  booking_id: UUID;
  title: string;
  tags: string[];
  provider: string | null;
  provider_ref: string | null;
  cost: number | null;
  currency: CurrencyCode | null;
  rating: number | null;
  would_repeat: boolean | null;
};

export type TripRecommendation = Timestamps & {
  id: UUID;
  trip_id: UUID;
  user_id: UUID;
  provider: string;
  provider_ref: string;
  title: string;
  summary: string | null;
  image_url: string | null;
  tags: string[];
  duration_minutes: number | null;
  price: number | null;
  currency: CurrencyCode | null;
  provider_rating: number | null;
  booking_url: string | null;
  /** 0–100 */
  score: number;
  /** Plain-language reasons shown on the card */
  reasons: string[];
  suggested_time_block_id: UUID | null;
  status: RecommendationStatus;
};

// ---------------------------------------------------------------------------
// Budget (07) — all amounts in the trip's currency
// ---------------------------------------------------------------------------
/** View: one row per priced item in the plan (cancelled items excluded). */
export type TripPlannedCost = {
  trip_id: UUID;
  source: 'activity' | 'lodging' | 'transit';
  source_id: UUID;
  title: string;
  category: ExpenseCategory;
  booking_status: Exclude<BookingStatus, 'cancelled'>;
  on_date: ISODate;
  cost: number | null;
  currency: CurrencyCode | null;
  loyalty_program_id: UUID | null;
  points_used: number | null;
  trip_currency: CurrencyCode;
  /** Null if an exchange rate is missing. */
  cost_in_trip_currency: number | null;
};

/** View: the Budget tab header. */
export type TripBudgetOverview = {
  trip_id: UUID;
  currency: CurrencyCode;
  budget: number | null;
  party_size: number;
  /** Booked or held */
  planned_committed: number;
  /** Still ideas */
  planned_ideas: number;
  planned_total: number;
  spent_total: number;
  /** Expenses not tied to a booking (food, taxis…) */
  spent_unplanned: number;
  items_missing_rate: number;
  projected_committed: number;
  /** Everything planned + unplanned spending: "what this trip will cost" */
  projected_total: number;
  projected_per_person: number;
  /** budget − projected_total; null when no budget is set */
  remaining: number | null;
};

/** View: category breakdown. */
export type TripBudgetByCategory = {
  trip_id: UUID;
  category: ExpenseCategory;
  committed: number;
  ideas: number;
  spent_unplanned: number;
  total: number;
};

/** View: points planned per program. */
export type TripPointsPlanned = {
  trip_id: UUID;
  loyalty_program_id: UUID;
  points_committed: number | null;
  points_ideas: number | null;
};

// ---------------------------------------------------------------------------
// Insert / Update shapes
// ---------------------------------------------------------------------------
type InsertOf<Row, Req extends keyof Row> = Pick<Row, Req> & Partial<Omit<Row, Req>>;
type UpdateOf<Row> = Partial<Omit<Row, 'id' | 'created_at'>>;
type ReadOnly<Row> = { Row: Row; Insert: never; Update: never; Relationships: [] };

/** Award engine: one cached seat offer (written by the award-refresh worker). */
export type AwardAvailability = {
  id: number;
  origin: string;
  destination: string;
  travel_date: ISODate;
  program: string;
  cabin: "economy" | "premium" | "business" | "first";
  miles: number;
  taxes: number | null;
  tax_currency: string | null;
  seats: number | null;
  airlines: string;
  direct: boolean;
  data_source: string;
  first_seen_at: string;
  seen_at: string;
  closed_at: string | null;
};
export type AwardSearchLog = {
  id: number;
  user_id: UUID;
  origin: string;
  destinations: string[];
  cabin: AwardAvailability["cabin"];
  month: ISODate;
  via: string | null;
  created_at: string;
};


export type ProfileInsert = InsertOf<Profile, 'id'>;
export type ProfileUpdate = UpdateOf<Profile>;

export type TripInsert = InsertOf<Trip, 'owner_id' | 'title' | 'start_date' | 'end_date'>;
export type TripUpdate = Omit<UpdateOf<Trip>, 'owner_id'>;

export type TripMemberInsert = Omit<InsertOf<TripMember, 'trip_id' | 'user_id'>, 'last_read_at'>;
export type TripMemberUpdate = Pick<Partial<TripMember>, 'role'>;

/** Days and blocks are created by the database; only title/notes are editable. */
export type TripStopInsert = InsertOf<TripStop, 'trip_id' | 'city' | 'arrive_date' | 'leave_date'>;
export type TripStopUpdate = UpdateOf<TripStop>;

export type TripDayUpdate = Pick<Partial<TripDay>, 'title' | 'notes'>;
export type TimeBlockUpdate = Pick<Partial<TimeBlock>, 'notes'>;

export type ItineraryItemInsert = InsertOf<ItineraryItem, 'trip_id' | 'time_block_id' | 'title'>;
export type ItineraryItemUpdate = UpdateOf<ItineraryItem>;

export type LodgingInsert = InsertOf<Lodging, 'trip_id' | 'name' | 'check_in_at' | 'check_out_at'>;
export type LodgingUpdate = UpdateOf<Lodging>;

export type TransitSegmentInsert = InsertOf<TransitSegment, 'trip_id' | 'mode' | 'depart_at' | 'arrive_at'>;
export type TransitSegmentUpdate = UpdateOf<TransitSegment>;

export type ExpenseInsert = Omit<InsertOf<Expense, 'trip_id' | 'amount' | 'currency'>, 'amount_in_trip_currency' | 'fx_rate'>;
export type ExpenseUpdate = Omit<UpdateOf<Expense>, 'amount_in_trip_currency' | 'fx_rate'>;

/** Users only create manual accounts; connected ones come from the sync job. */
export type LoyaltyAccountInsert = InsertOf<LoyaltyAccount, 'user_id' | 'program_id' | 'source'>;
export type LoyaltyAccountUpdate = UpdateOf<LoyaltyAccount>;

export type TravelerProfileUpdate = Omit<UpdateOf<TravelerProfile>, 'user_id' | 'archetype'>;

export type TravelerInterestInsert = InsertOf<TravelerInterest, 'user_id' | 'tag_slug'>;
export type TravelerInterestUpdate = Pick<Partial<TravelerInterest>, 'weight' | 'source'>;

export type ExperienceRatingInsert = InsertOf<ExperienceRating, 'user_id' | 'itinerary_item_id' | 'rating'>;
export type ExperienceRatingUpdate = Pick<Partial<ExperienceRating>, 'rating' | 'would_repeat'>;

export type TripRecommendationInsert = InsertOf<
  TripRecommendation,
  'trip_id' | 'user_id' | 'provider' | 'provider_ref' | 'title' | 'score'
>;
export type TripRecommendationUpdate = Pick<Partial<TripRecommendation>, 'status'>;

// ---------------------------------------------------------------------------
// Supabase client typing:  createClient<Database>(url, key)
// ---------------------------------------------------------------------------
type TableDef<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };

export type Database = {
  public: {
    Tables: {
      currencies: ReadOnly<Currency>;
      countries: ReadOnly<Country>;
      profiles: TableDef<Profile, ProfileInsert, ProfileUpdate>;
      trips: TableDef<Trip, TripInsert, TripUpdate>;
      trip_members: TableDef<TripMember, TripMemberInsert, TripMemberUpdate>;
      trip_stops: TableDef<TripStop, TripStopInsert, TripStopUpdate>;
      trip_invites: TableDef<TripInvite, InsertOf<TripInvite, 'trip_id' | 'created_by'>, Pick<Partial<TripInvite>, 'revoked_at'>>;
      saved_spots: TableDef<SavedSpot, InsertOf<SavedSpot, 'user_id'>, UpdateOf<SavedSpot>>;
      trip_messages: TableDef<TripMessage, InsertOf<TripMessage, 'trip_id' | 'user_id' | 'body'>, never>;
      expense_participants: TableDef<ExpenseParticipant, ExpenseParticipant, never>;
      settlements: TableDef<Settlement, InsertOf<Settlement, 'trip_id' | 'from_user' | 'to_user' | 'amount' | 'currency'>, never>;
      checklist_items: TableDef<ChecklistItem, InsertOf<ChecklistItem, 'trip_id' | 'list' | 'title'>, UpdateOf<ChecklistItem>>;
      item_votes: TableDef<ItemVote, InsertOf<ItemVote, 'item_id' | 'user_id' | 'trip_id'>, never>;
      account_details: TableDef<AccountDetails, InsertOf<AccountDetails, 'user_id'>, UpdateOf<AccountDetails>>;
      attractions: ReadOnly<Attraction>;
      app_events: TableDef<AppEvent, InsertOf<AppEvent, 'user_id' | 'kind'>, never>;
      trip_days: TableDef<TripDay, never, TripDayUpdate>;
      time_blocks: TableDef<TimeBlock, never, TimeBlockUpdate>;
      itinerary_items: TableDef<ItineraryItem, ItineraryItemInsert, ItineraryItemUpdate>;
      lodging: TableDef<Lodging, LodgingInsert, LodgingUpdate>;
      transit_segments: TableDef<TransitSegment, TransitSegmentInsert, TransitSegmentUpdate>;
      expenses: TableDef<Expense, ExpenseInsert, ExpenseUpdate>;
      loyalty_programs: ReadOnly<LoyaltyProgram>;
      transfer_partners: ReadOnly<TransferPartner>;
      wallet_connections: TableDef<WalletConnection, never, never>;
      loyalty_accounts: TableDef<LoyaltyAccount, LoyaltyAccountInsert, LoyaltyAccountUpdate>;
      loyalty_balance_history: ReadOnly<LoyaltyBalanceHistory>;
      exchange_rates: ReadOnly<ExchangeRate>;
      interest_tags: ReadOnly<InterestTag>;
      traveler_profiles: TableDef<TravelerProfile, never, TravelerProfileUpdate>;
      traveler_interests: TableDef<TravelerInterest, TravelerInterestInsert, TravelerInterestUpdate>;
      experience_ratings: TableDef<ExperienceRating, ExperienceRatingInsert, ExperienceRatingUpdate>;
      trip_recommendations: TableDef<TripRecommendation, TripRecommendationInsert, TripRecommendationUpdate>;
      award_availability: ReadOnly<AwardAvailability>;
      award_searches: TableDef<AwardSearchLog, Pick<AwardSearchLog, "user_id" | "origin" | "destinations" | "cabin" | "month" | "via">, never>;
    };
    Views: {
      wallet_reachable_points: { Row: WalletReachablePoints; Relationships: [] };
      trip_planned_costs: { Row: TripPlannedCost; Relationships: [] };
      trip_budget_overview: { Row: TripBudgetOverview; Relationships: [] };
      trip_budget_by_category: { Row: TripBudgetByCategory; Relationships: [] };
      trip_points_planned: { Row: TripPointsPlanned; Relationships: [] };
      my_booking_history: { Row: BookingHistoryEntry; Relationships: [] };
    };
    Functions: {
      add_recommendation_to_trip: {
        Args: { p_recommendation_id: UUID; p_time_block_id?: UUID };
        Returns: UUID;
      };
      invite_preview: {
        Args: { p_token: UUID };
        Returns: { trip_title: string; destination: string | null; start_date: ISODate; end_date: ISODate; invited_by: string; role: TripRole; valid: boolean }[];
      };
      accept_trip_invite: { Args: { p_token: UUID }; Returns: UUID };
      request_award_routes: {
        Args: { p_origin: string; p_destinations: string[]; p_cabin: string };
        Returns: { destination: string; checked_at: string | null }[];
      };
      mark_chat_read: { Args: { p_trip_id: UUID }; Returns: undefined };
      touch_activity: { Args: Record<string, never>; Returns: undefined };
      is_app_admin: { Args: Record<string, never>; Returns: boolean };
      admin_stats: { Args: { p_days?: number }; Returns: AdminStats };
      trip_travel_types: {
        Args: { p_trip_id: UUID };
        Returns: { user_id: UUID; display_name: string | null; avatar_url: string | null; compass_x: number | null; compass_y: number | null; archetype: TravelArchetype | null; interests: Record<string, number> }[];
      };
      search_attractions: {
        Args: { p_query: string; p_limit?: number };
        Returns: Attraction[];
      };
      attractions_near: {
        Args: { p_lat: number; p_lng: number; p_km?: number };
        Returns: { attraction: Attraction; km: number }[];
      };
      convert_currency: {
        Args: { p_amount: number; p_from: CurrencyCode; p_to: CurrencyCode; p_on?: ISODate };
        Returns: number | null;
      };
    };
    Enums: {
      trip_status: TripStatus;
      trip_role: TripRole;
      time_block_slot: TimeBlockSlot;
      block_status: BlockStatus;
      travel_event: TravelEvent;
      itinerary_item_kind: ItineraryItemKind;
      transit_mode: TransitMode;
      transit_direction: TransitDirection;
      booking_status: BookingStatus;
      expense_category: ExpenseCategory;
      loyalty_program_kind: LoyaltyProgramKind;
      wallet_provider: WalletProvider;
      connection_status: ConnectionStatus;
      balance_source: BalanceSource;
      travel_archetype: TravelArchetype;
      interest_source: InterestSource;
      recommendation_status: RecommendationStatus;
      price_source: PriceSource;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type TableName = keyof Database['public']['Tables'];
export type Row<T extends TableName> = Database['public']['Tables'][T]['Row'];

// ---------------------------------------------------------------------------
// Joined shapes the UI works with
// ---------------------------------------------------------------------------
export type TimeBlockWithItems = TimeBlock & { items: ItineraryItem[] };

export type TripDayWithBlocks = TripDay & {
  /** Always three, ordered morning → afternoon → evening. */
  blocks: TimeBlockWithItems[];
};

export type TripMemberWithProfile = TripMember & {
  profile: Pick<Profile, 'id' | 'display_name' | 'avatar_url'>;
  archetype: TravelArchetype | null;
};

/** Everything needed to render the trip workspace. */
export type TripDetail = Trip & {
  members: TripMemberWithProfile[];
  days: TripDayWithBlocks[];
  lodging: Lodging[];
  transit: TransitSegment[];
  expenses: Expense[];
  budget_overview: TripBudgetOverview | null;
};

/** Lightweight card for the trips list / dashboard. */
export type TripSummary = Pick<
  Trip,
  'id' | 'title' | 'destination' | 'start_date' | 'end_date' | 'status' | 'cover_image_url'
> & { role: TripRole };

/** A wallet row ready to display. */
export type WalletAccountView = LoyaltyAccount & {
  program: Pick<LoyaltyProgram, 'name' | 'kind' | 'unit_name' | 'logo_url' | 'est_cents_per_point'>;
};

export type AppEvent = {
  id: number;
  user_id: UUID;
  kind: "booking_click" | "suggestions_shown";
  trip_id: UUID | null;
  provider: string | null;
  count: number;
  created_at: string;
};

/** What admin_stats() returns (see migration 20261012001700_stats.sql). */
export type AdminStats = {
  days: number;
  totals: { users: number; trips: number; active_7d: number; active_30d: number };
  started: { new_users: number; made_a_trip: number; trips_created: number };
  invites: { trips_with_invite: number; trips_where_friends_joined: number; friends_joined: number; invited_friends_who_were_new: number };
  return: { eligible: number; came_back: number };
  suggestions: { shown: number; added: number };
  booking_clicks: { total: number; by_provider: Record<string, number> };
  engagement: { chat_messages: number; saved_spots: number; itinerary_items: number };
  weekly: { week: string; signups: number; active: number; trips: number }[];
};
