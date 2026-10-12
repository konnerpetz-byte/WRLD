export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_details: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country_code: string | null
          created_at: string
          phone: string | null
          postal_code: string | null
          region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          city?: string | null
          country_code?: string | null
          created_at?: string
          phone?: string | null
          postal_code?: string | null
          region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_details_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "account_details_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      attractions: {
        Row: {
          address: string | null
          adult_price: number | null
          aliases: string[]
          best_slot: Database["public"]["Enums"]["time_block_slot"] | null
          city: string
          country_code: string | null
          created_at: string
          currency: string | null
          duration_minutes: number | null
          hours_note: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          official_url: string
          price_note: string | null
          slug: string
          suggested_start: string | null
          tickets_url: string | null
          timed_entry: boolean
          verified_on: string | null
          visit_note: string | null
        }
        Insert: {
          address?: string | null
          adult_price?: number | null
          aliases?: string[]
          best_slot?: Database["public"]["Enums"]["time_block_slot"] | null
          city: string
          country_code?: string | null
          created_at?: string
          currency?: string | null
          duration_minutes?: number | null
          hours_note?: string | null
          id?: string
          latitude: number
          longitude: number
          name: string
          official_url: string
          price_note?: string | null
          slug: string
          suggested_start?: string | null
          tickets_url?: string | null
          timed_entry?: boolean
          verified_on?: string | null
          visit_note?: string | null
        }
        Update: {
          address?: string | null
          adult_price?: number | null
          aliases?: string[]
          best_slot?: Database["public"]["Enums"]["time_block_slot"] | null
          city?: string
          country_code?: string | null
          created_at?: string
          currency?: string | null
          duration_minutes?: number | null
          hours_note?: string | null
          id?: string
          latitude?: number
          longitude?: number
          name?: string
          official_url?: string
          price_note?: string | null
          slug?: string
          suggested_start?: string | null
          tickets_url?: string | null
          timed_entry?: boolean
          verified_on?: string | null
          visit_note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attractions_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "attractions_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      checklist_items: {
        Row: {
          assigned_to: string | null
          created_at: string
          created_by: string | null
          done: boolean
          done_by: string | null
          due_on: string | null
          id: string
          list: string
          position: number
          title: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_by?: string | null
          due_on?: string | null
          id?: string
          list: string
          position?: number
          title: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          created_at?: string
          created_by?: string | null
          done?: boolean
          done_by?: string | null
          due_on?: string | null
          id?: string
          list?: string
          position?: number
          title?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_done_by_fkey"
            columns: ["done_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "checklist_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          code: string
          currency_code: string
          name: string
        }
        Insert: {
          code: string
          currency_code: string
          name: string
        }
        Update: {
          code?: string
          currency_code?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "countries_currency_code_fkey"
            columns: ["currency_code"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      currencies: {
        Row: {
          code: string
          minor_units: number
          name: string
          symbol: string | null
        }
        Insert: {
          code: string
          minor_units?: number
          name: string
          symbol?: string | null
        }
        Update: {
          code?: string
          minor_units?: number
          name?: string
          symbol?: string | null
        }
        Relationships: []
      }
      exchange_rates: {
        Row: {
          as_of: string
          fetched_at: string
          quote: string
          rate: number
          source: string
        }
        Insert: {
          as_of: string
          fetched_at?: string
          quote: string
          rate: number
          source?: string
        }
        Update: {
          as_of?: string
          fetched_at?: string
          quote?: string
          rate?: number
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "exchange_rates_quote_fkey"
            columns: ["quote"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      expense_participants: {
        Row: {
          expense_id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          expense_id: string
          trip_id: string
          user_id: string
        }
        Update: {
          expense_id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expense_participants_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_participants_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "expense_participants_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expense_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          amount_in_trip_currency: number | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          currency: string
          description: string | null
          fx_rate: number | null
          id: string
          incurred_on: string
          itinerary_item_id: string | null
          lodging_id: string | null
          paid_by: string | null
          transit_segment_id: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          amount_in_trip_currency?: number | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency: string
          description?: string | null
          fx_rate?: number | null
          id?: string
          incurred_on?: string
          itinerary_item_id?: string | null
          lodging_id?: string | null
          paid_by?: string | null
          transit_segment_id?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          amount_in_trip_currency?: number | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          currency?: string
          description?: string | null
          fx_rate?: number | null
          id?: string
          incurred_on?: string
          itinerary_item_id?: string | null
          lodging_id?: string | null
          paid_by?: string | null
          transit_segment_id?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "expenses_itinerary_item_id_fkey"
            columns: ["itinerary_item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_lodging_id_fkey"
            columns: ["lodging_id"]
            isOneToOne: false
            referencedRelation: "lodging"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_paid_by_fkey"
            columns: ["paid_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_transit_segment_id_fkey"
            columns: ["transit_segment_id"]
            isOneToOne: false
            referencedRelation: "transit_segments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "expenses_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      experience_ratings: {
        Row: {
          created_at: string
          itinerary_item_id: string
          rating: number
          user_id: string
          would_repeat: boolean | null
        }
        Insert: {
          created_at?: string
          itinerary_item_id: string
          rating: number
          user_id: string
          would_repeat?: boolean | null
        }
        Update: {
          created_at?: string
          itinerary_item_id?: string
          rating?: number
          user_id?: string
          would_repeat?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_ratings_itinerary_item_id_fkey"
            columns: ["itinerary_item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "experience_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interest_tags: {
        Row: {
          category: string
          compass_x: number
          compass_y: number
          label: string
          slug: string
        }
        Insert: {
          category: string
          compass_x?: number
          compass_y?: number
          label: string
          slug: string
        }
        Update: {
          category?: string
          compass_x?: number
          compass_y?: number
          label?: string
          slug?: string
        }
        Relationships: []
      }
      item_votes: {
        Row: {
          created_at: string
          item_id: string
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          item_id: string
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          item_id?: string
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "item_votes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "item_votes_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "item_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      itinerary_items: {
        Row: {
          address: string | null
          attraction_id: string | null
          booking_status: Database["public"]["Enums"]["booking_status"]
          booking_url: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          description: string | null
          end_time: string | null
          id: string
          kind: Database["public"]["Enums"]["itinerary_item_kind"]
          latitude: number | null
          location_name: string | null
          longitude: number | null
          official_url: string | null
          position: number
          price_checked_at: string | null
          price_source: Database["public"]["Enums"]["price_source"] | null
          provider: string | null
          provider_ref: string | null
          quantity: number | null
          start_time: string | null
          tags: string[]
          time_block_id: string
          title: string
          trip_id: string
          unit_price: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          attraction_id?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"]
          booking_url?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["itinerary_item_kind"]
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          official_url?: string | null
          position?: number
          price_checked_at?: string | null
          price_source?: Database["public"]["Enums"]["price_source"] | null
          provider?: string | null
          provider_ref?: string | null
          quantity?: number | null
          start_time?: string | null
          tags?: string[]
          time_block_id: string
          title: string
          trip_id: string
          unit_price?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          attraction_id?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"]
          booking_url?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          description?: string | null
          end_time?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["itinerary_item_kind"]
          latitude?: number | null
          location_name?: string | null
          longitude?: number | null
          official_url?: string | null
          position?: number
          price_checked_at?: string | null
          price_source?: Database["public"]["Enums"]["price_source"] | null
          provider?: string | null
          provider_ref?: string | null
          quantity?: number | null
          start_time?: string | null
          tags?: string[]
          time_block_id?: string
          title?: string
          trip_id?: string
          unit_price?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "itinerary_items_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_block_fk"
            columns: ["time_block_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "time_blocks"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "itinerary_items_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "itinerary_items_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "itinerary_items_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      lodging: {
        Row: {
          address: string | null
          booking_status: Database["public"]["Enums"]["booking_status"]
          booking_url: string | null
          check_in_at: string
          check_out_at: string
          confirmation_code: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          id: string
          latitude: number | null
          longitude: number | null
          loyalty_account_id: string | null
          loyalty_program_id: string | null
          name: string
          notes: string | null
          points_used: number | null
          provider: string | null
          provider_ref: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"]
          booking_url?: string | null
          check_in_at: string
          check_out_at: string
          confirmation_code?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          loyalty_account_id?: string | null
          loyalty_program_id?: string | null
          name: string
          notes?: string | null
          points_used?: number | null
          provider?: string | null
          provider_ref?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          booking_status?: Database["public"]["Enums"]["booking_status"]
          booking_url?: string | null
          check_in_at?: string
          check_out_at?: string
          confirmation_code?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          loyalty_account_id?: string | null
          loyalty_program_id?: string | null
          name?: string
          notes?: string | null
          points_used?: number | null
          provider?: string | null
          provider_ref?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lodging_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lodging_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lodging_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "lodging_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_accounts: {
        Row: {
          balance: number
          connection_id: string | null
          created_at: string
          display_name: string | null
          elite_status: string | null
          external_account_id: string | null
          id: string
          last_synced_at: string | null
          member_last4: string | null
          points_expire_on: string | null
          program_id: string
          source: Database["public"]["Enums"]["balance_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          connection_id?: string | null
          created_at?: string
          display_name?: string | null
          elite_status?: string | null
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          member_last4?: string | null
          points_expire_on?: string | null
          program_id: string
          source: Database["public"]["Enums"]["balance_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          connection_id?: string | null
          created_at?: string
          display_name?: string | null
          elite_status?: string | null
          external_account_id?: string | null
          id?: string
          last_synced_at?: string | null
          member_last4?: string | null
          points_expire_on?: string | null
          program_id?: string
          source?: Database["public"]["Enums"]["balance_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_accounts_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "wallet_connections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_balance_history: {
        Row: {
          account_id: string
          balance: number
          id: number
          recorded_at: string
          user_id: string
        }
        Insert: {
          account_id: string
          balance: number
          id?: never
          recorded_at?: string
          user_id: string
        }
        Update: {
          account_id?: string
          balance?: number
          id?: never
          recorded_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_balance_history_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "loyalty_balance_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_programs: {
        Row: {
          alliance: string | null
          awardwallet_code: string | null
          created_at: string
          est_cents_per_point: number | null
          id: string
          kind: Database["public"]["Enums"]["loyalty_program_kind"]
          logo_url: string | null
          name: string
          slug: string
          unit_name: string
        }
        Insert: {
          alliance?: string | null
          awardwallet_code?: string | null
          created_at?: string
          est_cents_per_point?: number | null
          id?: string
          kind: Database["public"]["Enums"]["loyalty_program_kind"]
          logo_url?: string | null
          name: string
          slug: string
          unit_name?: string
        }
        Update: {
          alliance?: string | null
          awardwallet_code?: string | null
          created_at?: string
          est_cents_per_point?: number | null
          id?: string
          kind?: Database["public"]["Enums"]["loyalty_program_kind"]
          logo_url?: string | null
          name?: string
          slug?: string
          unit_name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          home_airport: string | null
          home_country: string | null
          home_currency: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_airport?: string | null
          home_country?: string | null
          home_currency?: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          home_airport?: string | null
          home_country?: string | null
          home_currency?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_country_fkey"
            columns: ["home_country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "profiles_home_currency_fkey"
            columns: ["home_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      saved_spots: {
        Row: {
          address: string | null
          attraction_id: string | null
          author: string | null
          created_at: string
          id: string
          itinerary_item_id: string | null
          latitude: number | null
          longitude: number | null
          note: string | null
          place_name: string | null
          source: string
          thumbnail_url: string | null
          title: string | null
          trip_id: string | null
          url: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          attraction_id?: string | null
          author?: string | null
          created_at?: string
          id?: string
          itinerary_item_id?: string | null
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          place_name?: string | null
          source?: string
          thumbnail_url?: string | null
          title?: string | null
          trip_id?: string | null
          url?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          attraction_id?: string | null
          author?: string | null
          created_at?: string
          id?: string
          itinerary_item_id?: string | null
          latitude?: number | null
          longitude?: number | null
          note?: string | null
          place_name?: string | null
          source?: string
          thumbnail_url?: string | null
          title?: string | null
          trip_id?: string | null
          url?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_spots_attraction_id_fkey"
            columns: ["attraction_id"]
            isOneToOne: false
            referencedRelation: "attractions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_spots_itinerary_item_id_fkey"
            columns: ["itinerary_item_id"]
            isOneToOne: false
            referencedRelation: "itinerary_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_spots_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "saved_spots_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_spots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          currency: string
          from_user: string
          id: string
          settled_on: string
          to_user: string
          trip_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          created_by?: string | null
          currency: string
          from_user: string
          id?: string
          settled_on?: string
          to_user: string
          trip_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          from_user?: string
          id?: string
          settled_on?: string
          to_user?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "settlements_from_user_fkey"
            columns: ["from_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_to_user_fkey"
            columns: ["to_user"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "settlements_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      time_blocks: {
        Row: {
          available_from: string | null
          available_minutes: number
          available_until: string | null
          created_at: string
          day_id: string
          ends_at: string
          id: string
          notes: string | null
          slot: Database["public"]["Enums"]["time_block_slot"]
          starts_at: string
          status: Database["public"]["Enums"]["block_status"]
          travel_event: Database["public"]["Enums"]["travel_event"] | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          available_from?: string | null
          available_minutes?: number
          available_until?: string | null
          created_at?: string
          day_id: string
          ends_at: string
          id?: string
          notes?: string | null
          slot: Database["public"]["Enums"]["time_block_slot"]
          starts_at: string
          status?: Database["public"]["Enums"]["block_status"]
          travel_event?: Database["public"]["Enums"]["travel_event"] | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          available_from?: string | null
          available_minutes?: number
          available_until?: string | null
          created_at?: string
          day_id?: string
          ends_at?: string
          id?: string
          notes?: string | null
          slot?: Database["public"]["Enums"]["time_block_slot"]
          starts_at?: string
          status?: Database["public"]["Enums"]["block_status"]
          travel_event?: Database["public"]["Enums"]["travel_event"] | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "time_blocks_day_fk"
            columns: ["day_id", "trip_id"]
            isOneToOne: false
            referencedRelation: "trip_days"
            referencedColumns: ["id", "trip_id"]
          },
          {
            foreignKeyName: "time_blocks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "time_blocks_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_partners: {
        Row: {
          from_program_id: string
          min_transfer: number | null
          ratio_from: number
          ratio_to: number
          to_program_id: string
          typical_wait: string | null
          updated_at: string
        }
        Insert: {
          from_program_id: string
          min_transfer?: number | null
          ratio_from?: number
          ratio_to?: number
          to_program_id: string
          typical_wait?: string | null
          updated_at?: string
        }
        Update: {
          from_program_id?: string
          min_transfer?: number | null
          ratio_from?: number
          ratio_to?: number
          to_program_id?: string
          typical_wait?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transfer_partners_from_program_id_fkey"
            columns: ["from_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_partners_to_program_id_fkey"
            columns: ["to_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      transit_segments: {
        Row: {
          arrive_at: string
          booking_status: Database["public"]["Enums"]["booking_status"]
          booking_url: string | null
          buffer_after_minutes: number
          buffer_before_minutes: number
          cabin_class: string | null
          carrier: string | null
          confirmation_code: string | null
          cost: number | null
          created_at: string
          created_by: string | null
          currency: string | null
          depart_at: string
          destination_code: string | null
          destination_latitude: number | null
          destination_longitude: number | null
          destination_name: string | null
          destination_timezone: string | null
          direction: Database["public"]["Enums"]["transit_direction"]
          id: string
          loyalty_account_id: string | null
          loyalty_program_id: string | null
          mode: Database["public"]["Enums"]["transit_mode"]
          notes: string | null
          origin_code: string | null
          origin_latitude: number | null
          origin_longitude: number | null
          origin_name: string | null
          origin_timezone: string | null
          points_used: number | null
          provider: string | null
          provider_ref: string | null
          seat: string | null
          service_number: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          arrive_at: string
          booking_status?: Database["public"]["Enums"]["booking_status"]
          booking_url?: string | null
          buffer_after_minutes: number
          buffer_before_minutes: number
          cabin_class?: string | null
          carrier?: string | null
          confirmation_code?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          depart_at: string
          destination_code?: string | null
          destination_latitude?: number | null
          destination_longitude?: number | null
          destination_name?: string | null
          destination_timezone?: string | null
          direction?: Database["public"]["Enums"]["transit_direction"]
          id?: string
          loyalty_account_id?: string | null
          loyalty_program_id?: string | null
          mode: Database["public"]["Enums"]["transit_mode"]
          notes?: string | null
          origin_code?: string | null
          origin_latitude?: number | null
          origin_longitude?: number | null
          origin_name?: string | null
          origin_timezone?: string | null
          points_used?: number | null
          provider?: string | null
          provider_ref?: string | null
          seat?: string | null
          service_number?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          arrive_at?: string
          booking_status?: Database["public"]["Enums"]["booking_status"]
          booking_url?: string | null
          buffer_after_minutes?: number
          buffer_before_minutes?: number
          cabin_class?: string | null
          carrier?: string | null
          confirmation_code?: string | null
          cost?: number | null
          created_at?: string
          created_by?: string | null
          currency?: string | null
          depart_at?: string
          destination_code?: string | null
          destination_latitude?: number | null
          destination_longitude?: number | null
          destination_name?: string | null
          destination_timezone?: string | null
          direction?: Database["public"]["Enums"]["transit_direction"]
          id?: string
          loyalty_account_id?: string | null
          loyalty_program_id?: string | null
          mode?: Database["public"]["Enums"]["transit_mode"]
          notes?: string | null
          origin_code?: string | null
          origin_latitude?: number | null
          origin_longitude?: number | null
          origin_name?: string | null
          origin_timezone?: string | null
          points_used?: number | null
          provider?: string | null
          provider_ref?: string | null
          seat?: string | null
          service_number?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transit_segments_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_segments_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "transit_segments_loyalty_account_id_fkey"
            columns: ["loyalty_account_id"]
            isOneToOne: false
            referencedRelation: "loyalty_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_segments_loyalty_program_id_fkey"
            columns: ["loyalty_program_id"]
            isOneToOne: false
            referencedRelation: "loyalty_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transit_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "transit_segments_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_interests: {
        Row: {
          source: Database["public"]["Enums"]["interest_source"]
          tag_slug: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          source?: Database["public"]["Enums"]["interest_source"]
          tag_slug: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          source?: Database["public"]["Enums"]["interest_source"]
          tag_slug?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "traveler_interests_tag_slug_fkey"
            columns: ["tag_slug"]
            isOneToOne: false
            referencedRelation: "interest_tags"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "traveler_interests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      traveler_profiles: {
        Row: {
          archetype: Database["public"]["Enums"]["travel_archetype"] | null
          compass_x: number | null
          compass_y: number | null
          created_at: string
          quiz_answers: Json
          quiz_completed_at: string | null
          quiz_version: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          archetype?: Database["public"]["Enums"]["travel_archetype"] | null
          compass_x?: number | null
          compass_y?: number | null
          created_at?: string
          quiz_answers?: Json
          quiz_completed_at?: string | null
          quiz_version?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          archetype?: Database["public"]["Enums"]["travel_archetype"] | null
          compass_x?: number | null
          compass_y?: number | null
          created_at?: string
          quiz_answers?: Json
          quiz_completed_at?: string | null
          quiz_version?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "traveler_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_days: {
        Row: {
          created_at: string
          date: string
          id: string
          notes: string | null
          stop_id: string | null
          timezone: string | null
          title: string | null
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          notes?: string | null
          stop_id?: string | null
          timezone?: string | null
          title?: string | null
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          stop_id?: string | null
          timezone?: string | null
          title?: string | null
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_days_stop_id_fkey"
            columns: ["stop_id"]
            isOneToOne: false
            referencedRelation: "trip_stops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_days_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_invites: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          id: string
          max_uses: number | null
          revoked_at: string | null
          role: Database["public"]["Enums"]["trip_role"]
          token: string
          trip_id: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          token?: string
          trip_id: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          id?: string
          max_uses?: number | null
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          token?: string
          trip_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "trip_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_invites_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          created_at: string
          last_read_at: string | null
          role: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          trip_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_read_at?: string | null
          role?: Database["public"]["Enums"]["trip_role"]
          trip_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          spot_id: string | null
          trip_id: string
          user_id: string | null
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          spot_id?: string | null
          trip_id: string
          user_id?: string | null
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          spot_id?: string | null
          trip_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trip_messages_spot_id_fkey"
            columns: ["spot_id"]
            isOneToOne: false
            referencedRelation: "saved_spots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_messages_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_recommendations: {
        Row: {
          booking_url: string | null
          created_at: string
          currency: string | null
          duration_minutes: number | null
          id: string
          image_url: string | null
          price: number | null
          provider: string
          provider_rating: number | null
          provider_ref: string
          reasons: string[]
          score: number
          status: Database["public"]["Enums"]["recommendation_status"]
          suggested_time_block_id: string | null
          summary: string | null
          tags: string[]
          title: string
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          booking_url?: string | null
          created_at?: string
          currency?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          price?: number | null
          provider: string
          provider_rating?: number | null
          provider_ref: string
          reasons?: string[]
          score: number
          status?: Database["public"]["Enums"]["recommendation_status"]
          suggested_time_block_id?: string | null
          summary?: string | null
          tags?: string[]
          title: string
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          booking_url?: string | null
          created_at?: string
          currency?: string | null
          duration_minutes?: number | null
          id?: string
          image_url?: string | null
          price?: number | null
          provider?: string
          provider_rating?: number | null
          provider_ref?: string
          reasons?: string[]
          score?: number
          status?: Database["public"]["Enums"]["recommendation_status"]
          suggested_time_block_id?: string | null
          summary?: string | null
          tags?: string[]
          title?: string
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_recommendations_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trip_recommendations_suggested_time_block_id_fkey"
            columns: ["suggested_time_block_id"]
            isOneToOne: false
            referencedRelation: "time_blocks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_recommendations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_recommendations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_recommendations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          arrive_date: string
          city: string
          country_code: string | null
          created_at: string
          id: string
          latitude: number | null
          leave_date: string
          longitude: number | null
          position: number
          timezone: string
          trip_id: string
          updated_at: string
        }
        Insert: {
          arrive_date: string
          city: string
          country_code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          leave_date: string
          longitude?: number | null
          position?: number
          timezone?: string
          trip_id: string
          updated_at?: string
        }
        Update: {
          arrive_date?: string
          city?: string
          country_code?: string | null
          created_at?: string
          id?: string
          latitude?: number | null
          leave_date?: string
          longitude?: number | null
          position?: number
          timezone?: string
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_country_code_fkey"
            columns: ["country_code"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trip_budget_overview"
            referencedColumns: ["trip_id"]
          },
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          budget: number | null
          cover_image_url: string | null
          created_at: string
          currency: string
          destination: string | null
          destination_country: string | null
          end_date: string
          id: string
          latitude: number | null
          longitude: number | null
          notes: string | null
          owner_id: string
          party_size: number
          start_date: string
          status: Database["public"]["Enums"]["trip_status"]
          timezone: string
          title: string
          updated_at: string
        }
        Insert: {
          budget?: number | null
          cover_image_url?: string | null
          created_at?: string
          currency: string
          destination?: string | null
          destination_country?: string | null
          end_date: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          owner_id: string
          party_size?: number
          start_date: string
          status?: Database["public"]["Enums"]["trip_status"]
          timezone?: string
          title: string
          updated_at?: string
        }
        Update: {
          budget?: number | null
          cover_image_url?: string | null
          created_at?: string
          currency?: string
          destination?: string | null
          destination_country?: string | null
          end_date?: string
          id?: string
          latitude?: number | null
          longitude?: number | null
          notes?: string | null
          owner_id?: string
          party_size?: number
          start_date?: string
          status?: Database["public"]["Enums"]["trip_status"]
          timezone?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trips_destination_country_fkey"
            columns: ["destination_country"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "trips_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallet_connections: {
        Row: {
          created_at: string
          external_user_id: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          status: Database["public"]["Enums"]["connection_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          external_user_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider: Database["public"]["Enums"]["wallet_provider"]
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          external_user_id?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          provider?: Database["public"]["Enums"]["wallet_provider"]
          status?: Database["public"]["Enums"]["connection_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_connections_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      my_booking_history: {
        Row: {
          booking_id: string | null
          booking_type: string | null
          cost: number | null
          currency: string | null
          destination: string | null
          destination_country: string | null
          provider: string | null
          provider_ref: string | null
          rating: number | null
          tags: string[] | null
          title: string | null
          trip_end_date: string | null
          trip_id: string | null
          trip_title: string | null
          would_repeat: boolean | null
        }
        Relationships: []
      }
      trip_budget_by_category: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"] | null
          committed: number | null
          ideas: number | null
          spent_unplanned: number | null
          total: number | null
          trip_id: string | null
        }
        Relationships: []
      }
      trip_budget_overview: {
        Row: {
          budget: number | null
          currency: string | null
          items_missing_rate: number | null
          party_size: number | null
          planned_committed: number | null
          planned_ideas: number | null
          planned_total: number | null
          projected_committed: number | null
          projected_per_person: number | null
          projected_total: number | null
          remaining: number | null
          spent_total: number | null
          spent_unplanned: number | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_currency_fkey"
            columns: ["currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      trip_planned_costs: {
        Row: {
          booking_status: Database["public"]["Enums"]["booking_status"] | null
          category: Database["public"]["Enums"]["expense_category"] | null
          cost: number | null
          cost_in_trip_currency: number | null
          currency: string | null
          loyalty_program_id: string | null
          on_date: string | null
          points_used: number | null
          source: string | null
          source_id: string | null
          title: string | null
          trip_currency: string | null
          trip_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_currency_fkey"
            columns: ["trip_currency"]
            isOneToOne: false
            referencedRelation: "currencies"
            referencedColumns: ["code"]
          },
        ]
      }
      trip_points_planned: {
        Row: {
          loyalty_program_id: string | null
          points_committed: number | null
          points_ideas: number | null
          trip_id: string | null
        }
        Relationships: []
      }
      wallet_reachable_points: {
        Row: {
          points: number | null
          route: string | null
          target_program_id: string | null
          user_id: string | null
          via_program_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      accept_trip_invite: { Args: { p_token: string }; Returns: string }
      add_recommendation_to_trip: {
        Args: { p_recommendation_id: string; p_time_block_id?: string }
        Returns: string
      }
      attractions_near: {
        Args: { p_km?: number; p_lat: number; p_lng: number }
        Returns: {
          attraction: Database["public"]["Tables"]["attractions"]["Row"]
          km: number
        }[]
      }
      convert_currency: {
        Args: { p_amount: number; p_from: string; p_on?: string; p_to: string }
        Returns: number
      }
      invite_preview: {
        Args: { p_token: string }
        Returns: {
          destination: string
          end_date: string
          invited_by: string
          role: Database["public"]["Enums"]["trip_role"]
          start_date: string
          trip_title: string
          valid: boolean
        }[]
      }
      mark_chat_read: { Args: { p_trip_id: string }; Returns: undefined }
      search_attractions: {
        Args: { p_limit?: number; p_query: string }
        Returns: {
          address: string | null
          adult_price: number | null
          aliases: string[]
          best_slot: Database["public"]["Enums"]["time_block_slot"] | null
          city: string
          country_code: string | null
          created_at: string
          currency: string | null
          duration_minutes: number | null
          hours_note: string | null
          id: string
          latitude: number
          longitude: number
          name: string
          official_url: string
          price_note: string | null
          slug: string
          suggested_start: string | null
          tickets_url: string | null
          timed_entry: boolean
          verified_on: string | null
          visit_note: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "attractions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      balance_source: "connected" | "manual"
      block_status: "open" | "limited" | "unavailable"
      booking_status: "idea" | "held" | "booked" | "cancelled"
      connection_status:
        | "pending"
        | "active"
        | "needs_reauth"
        | "error"
        | "revoked"
      expense_category:
        | "lodging"
        | "transit"
        | "food"
        | "activities"
        | "shopping"
        | "fees"
        | "other"
      interest_source: "quiz" | "manual" | "learned"
      itinerary_item_kind:
        | "activity"
        | "tour"
        | "meal"
        | "sightseeing"
        | "free_time"
        | "check_in"
        | "note"
      loyalty_program_kind:
        | "airline"
        | "hotel"
        | "bank"
        | "car_rental"
        | "other"
      price_source: "provider" | "estimate" | "manual" | "official"
      recommendation_status: "new" | "saved" | "added" | "dismissed"
      time_block_slot: "morning" | "afternoon" | "evening"
      transit_direction: "outbound" | "within" | "return"
      transit_mode: "flight" | "train" | "bus" | "ferry" | "car"
      travel_archetype:
        | "itinerary_athlete"
        | "flaneur"
        | "trailblazer"
        | "sunset_collector"
        | "wildcard"
      travel_event: "arrival" | "departure" | "in_transit"
      trip_role: "owner" | "editor" | "viewer"
      trip_status:
        | "planning"
        | "booked"
        | "in_progress"
        | "completed"
        | "archived"
      wallet_provider: "awardwallet"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      balance_source: ["connected", "manual"],
      block_status: ["open", "limited", "unavailable"],
      booking_status: ["idea", "held", "booked", "cancelled"],
      connection_status: [
        "pending",
        "active",
        "needs_reauth",
        "error",
        "revoked",
      ],
      expense_category: [
        "lodging",
        "transit",
        "food",
        "activities",
        "shopping",
        "fees",
        "other",
      ],
      interest_source: ["quiz", "manual", "learned"],
      itinerary_item_kind: [
        "activity",
        "tour",
        "meal",
        "sightseeing",
        "free_time",
        "check_in",
        "note",
      ],
      loyalty_program_kind: ["airline", "hotel", "bank", "car_rental", "other"],
      price_source: ["provider", "estimate", "manual", "official"],
      recommendation_status: ["new", "saved", "added", "dismissed"],
      time_block_slot: ["morning", "afternoon", "evening"],
      transit_direction: ["outbound", "within", "return"],
      transit_mode: ["flight", "train", "bus", "ferry", "car"],
      travel_archetype: [
        "itinerary_athlete",
        "flaneur",
        "trailblazer",
        "sunset_collector",
        "wildcard",
      ],
      travel_event: ["arrival", "departure", "in_transit"],
      trip_role: ["owner", "editor", "viewer"],
      trip_status: [
        "planning",
        "booked",
        "in_progress",
        "completed",
        "archived",
      ],
      wallet_provider: ["awardwallet"],
    },
  },
} as const
