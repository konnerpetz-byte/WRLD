"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import type { Country } from "@/types/database";
import { createTrip, type ActionState } from "./actions";
import { COUNTRY_TIMEZONE } from "./timezones";

export function NewTripForm({ countries, timezones }: { countries: Country[]; timezones: string[] }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(createTrip, {});
  const [country, setCountry] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const currency = countries.find((c) => c.code === country)?.currency_code;

  return (
    <form action={action} className="grid gap-6 rounded-xl border bg-card p-6">
      <div className="grid gap-2">
        <Label htmlFor="title">Trip name</Label>
        <Input id="title" name="title" placeholder="Lisbon long weekend" required maxLength={120} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="destination">Destination</Label>
          <Input id="destination" name="destination" placeholder="Lisbon" />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="destination_country">Country</Label>
          <NativeSelect
            id="destination_country"
            name="destination_country"
            value={country}
            onChange={(e) => {
              setCountry(e.target.value);
              const tz = COUNTRY_TIMEZONE[e.target.value];
              if (tz) setTimezone(tz);
            }}
          >
            <option value="">Choose a country</option>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="start_date">First day</Label>
          <Input id="start_date" name="start_date" type="date" required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="end_date">Last day</Label>
          <Input id="end_date" name="end_date" type="date" required />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="timezone">Local time zone</Label>
        <NativeSelect id="timezone" name="timezone" value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </NativeSelect>
        <p className="text-sm text-muted-foreground">Used to line up flights with your mornings, afternoons and evenings.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="party_size">Travelers</Label>
          <Input id="party_size" name="party_size" type="number" min={1} max={50} defaultValue={1} required />
          <p className="text-sm text-muted-foreground">Ticket prices are multiplied by this.</p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="budget">Budget {currency ? `(${currency})` : ""}</Label>
          <Input id="budget" name="budget" type="number" min={0} step="0.01" placeholder="Optional" />
          <p className="text-sm text-muted-foreground">
            {currency ? `Trip money is tracked in ${currency}.` : "Pick a country to set the trip currency."}
          </p>
        </div>
      </div>

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Creating…" : "Create trip"}
        </Button>
      </div>
    </form>
  );
}
