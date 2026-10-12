"use client";

import { ArrowDown, MapPin, Plus, X } from "lucide-react";
import { useActionState, useState } from "react";

import { Autocomplete } from "@/components/autocomplete";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import type { Country, Currency } from "@/types/database";
import type { ActionState } from "./actions";

export type StopDraft = {
  key: string;
  id?: string;
  city: string;
  country_code: string;
  latitude: number | null;
  longitude: number | null;
  arrive_date: string;
  leave_date: string;
};

type CityOption = { city: string; countryCode: string; region: string | null; latitude: number; longitude: number };

type TripValues = { title: string; party_size: number; budget: number | null; currency: string | null };

const addDays = (iso: string, n: number) => {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const nights = (a: string, b: string) => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / 86_400_000) : 0);
let counter = 0;
const newKey = () => `stop-${++counter}`;

export function TripForm({
  action,
  countries,
  currencies,
  initial,
  initialStops,
  submitLabel,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  countries: Country[];
  currencies: Currency[];
  initial?: TripValues;
  initialStops?: Omit<StopDraft, "key">[];
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, {});
  const [stops, setStops] = useState<StopDraft[]>(() =>
    initialStops?.length
      ? initialStops.map((s) => ({ ...s, key: newKey() }))
      : [{ key: newKey(), city: "", country_code: "", latitude: null, longitude: null, arrive_date: "", leave_date: "" }],
  );
  const [currency, setCurrency] = useState(initial?.currency ?? "");
  const [confirmRemove, setConfirmRemove] = useState(false);

  const update = (key: string, patch: Partial<StopDraft>) =>
    setStops((all) => all.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  const firstCountryCurrency = countries.find((c) => c.code === stops[0]?.country_code)?.currency_code;
  const shownCurrency = currency || firstCountryCurrency || "";
  const start = stops[0]?.arrive_date;
  const end = stops.reduce((max, s) => (s.leave_date > max ? s.leave_date : max), "");

  return (
    <form action={formAction} className="grid gap-6 rounded-xl border bg-card p-6">
      <div className="grid gap-2">
        <Label htmlFor="title">Trip name</Label>
        <Input id="title" name="title" placeholder="Portugal and Bavaria" required maxLength={120} defaultValue={initial?.title} />
      </div>

      <fieldset className="grid gap-3">
        <legend className="mb-1 text-sm font-medium">Where you&rsquo;re going</legend>
        <p className="-mt-1 text-sm text-muted-foreground">
          Add each city in order. Arriving the same day you leave the last one is fine. Time zones are set for you.
        </p>
        <ol className="grid gap-3">
          {stops.map((stop, i) => (
            <li key={stop.key} className="grid gap-3">
              {i > 0 && (
                <span className="flex items-center gap-2 text-xs text-muted-foreground" aria-hidden="true">
                  <ArrowDown className="size-3.5" /> then
                </span>
              )}
              <div className="grid gap-3 rounded-lg border bg-background p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <MapPin className="size-4 text-brand" aria-hidden="true" /> Stop {i + 1}
                    {stop.arrive_date && stop.leave_date && (
                      <span className="font-normal text-muted-foreground">
                        · {nights(stop.arrive_date, stop.leave_date)} night{nights(stop.arrive_date, stop.leave_date) === 1 ? "" : "s"}
                      </span>
                    )}
                  </span>
                  {stops.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      aria-label={`Remove stop ${i + 1}${stop.city ? `, ${stop.city}` : ""}`}
                      onClick={() => setStops((all) => all.filter((s) => s.key !== stop.key))}
                    >
                      <X aria-hidden="true" />
                    </Button>
                  )}
                </div>
                <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`city-${stop.key}`}>City</Label>
                    <Autocomplete<CityOption>
                      id={`city-${stop.key}`}
                      value={stop.city}
                      required
                      placeholder={i === 0 ? "Lisbon" : "Munich"}
                      onValueChange={(city) => update(stop.key, { city, latitude: null, longitude: null })}
                      fetchOptions={async (q, signal) => {
                        const r = await fetch(`/api/places/cities?q=${encodeURIComponent(q)}`, { signal });
                        return r.ok ? ((await r.json()).results as CityOption[]) : [];
                      }}
                      optionKey={(o) => `${o.city}-${o.countryCode}-${o.latitude}`}
                      renderOption={(o) => (
                        <>
                          <span className="font-medium">{o.city}</span>{" "}
                          <span className="text-muted-foreground">{o.region ?? countries.find((c) => c.code === o.countryCode)?.name}</span>
                        </>
                      )}
                      onPick={(o) =>
                        update(stop.key, {
                          city: o.city,
                          country_code: countries.some((c) => c.code === o.countryCode) ? o.countryCode : stop.country_code,
                          latitude: o.latitude,
                          longitude: o.longitude,
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`country-${stop.key}`}>Country</Label>
                    <NativeSelect
                      id={`country-${stop.key}`}
                      value={stop.country_code}
                      onChange={(e) => update(stop.key, { country_code: e.target.value, latitude: null, longitude: null })}
                    >
                      <option value="">Choose</option>
                      {countries.map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.name}
                        </option>
                      ))}
                    </NativeSelect>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label htmlFor={`arrive-${stop.key}`}>Arrive</Label>
                    <Input
                      id={`arrive-${stop.key}`}
                      type="date"
                      required
                      value={stop.arrive_date}
                      min={stops[i - 1]?.leave_date || undefined}
                      onChange={(e) =>
                        update(stop.key, {
                          arrive_date: e.target.value,
                          leave_date: stop.leave_date && stop.leave_date >= e.target.value ? stop.leave_date : addDays(e.target.value, 2),
                        })
                      }
                    />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor={`leave-${stop.key}`}>Leave</Label>
                    <Input
                      id={`leave-${stop.key}`}
                      type="date"
                      required
                      value={stop.leave_date}
                      min={stop.arrive_date || undefined}
                      onChange={(e) => update(stop.key, { leave_date: e.target.value })}
                    />
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
        <div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const last = stops.at(-1)!;
              setStops((all) => [
                ...all,
                {
                  key: newKey(),
                  city: "",
                  country_code: last.country_code,
                  latitude: null,
                  longitude: null,
                  arrive_date: last.leave_date,
                  leave_date: addDays(last.leave_date, 2),
                },
              ]);
            }}
          >
            <Plus aria-hidden="true" /> Add another city
          </Button>
        </div>
        {start && end && (
          <p className="text-sm text-muted-foreground" role="status">
            {nights(start, end) + 1} days, {stops.length} {stops.length === 1 ? "city" : "cities"}.
          </p>
        )}
      </fieldset>

      <input
        type="hidden"
        name="stops"
        value={JSON.stringify(
          stops.map((s) => ({
            id: s.id,
            city: s.city,
            country_code: s.country_code,
            latitude: s.latitude,
            longitude: s.longitude,
            arrive_date: s.arrive_date,
            leave_date: s.leave_date,
          })),
        )}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="grid gap-2">
          <Label htmlFor="party_size">Travelers</Label>
          <Input id="party_size" name="party_size" type="number" min={1} max={50} defaultValue={initial?.party_size ?? 1} required />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="currency">Trip currency</Label>
          <NativeSelect id="currency" name="currency" value={currency} onChange={(e) => setCurrency(e.target.value)}>
            <option value="">{firstCountryCurrency ? `${firstCountryCurrency} (first country)` : "Your home currency"}</option>
            {currencies.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} — {c.name}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="budget">Budget {shownCurrency ? `(${shownCurrency})` : ""}</Label>
          <Input id="budget" name="budget" type="number" min={0} step="0.01" placeholder="Optional" defaultValue={initial?.budget ?? ""} />
        </div>
      </div>
      <p className="-mt-3 text-sm text-muted-foreground">Ticket prices are multiplied by the number of travelers. Prices in other currencies are converted.</p>

      {state.error && (
        <div role="alert" className="grid gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
          <p className="text-destructive">{state.error}</p>
          {state.needsConfirm && (
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={confirmRemove} onChange={(e) => setConfirmRemove(e.target.checked)} />
              Remove those plans and save the new dates
            </label>
          )}
        </div>
      )}
      {confirmRemove && <input type="hidden" name="confirm_remove" value="yes" />}
      <div>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}
