"use client";

import { Autocomplete } from "@/components/autocomplete";

type Airport = { code: string; name: string; city: string; country: string; km?: number };

/** Type a city ("Munich") or code ("MUC") and pick the airport; the field keeps the 3-letter code. */
export function AirportField({
  id,
  name,
  value,
  onValueChange,
  placeholder,
  describedBy,
}: {
  id: string;
  name: string;
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  describedBy?: string;
}) {
  return (
    <Autocomplete<Airport>
      id={id}
      name={name}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      aria-describedby={describedBy}
      fetchOptions={async (q, signal) => {
        const res = await fetch(`/api/airports?q=${encodeURIComponent(q)}`, { signal });
        return res.ok ? res.json() : [];
      }}
      optionKey={(a) => a.code}
      onPick={(a) => onValueChange(a.code)}
      renderOption={(a) => (
        <span className="flex items-baseline gap-2">
          <span className="w-10 shrink-0 font-mono font-semibold">{a.code}</span>
          <span className="min-w-0">
            <span className="block truncate">{a.name}</span>
            <span className="block text-xs text-muted-foreground">
              {[a.city, a.country].filter(Boolean).join(", ")}
              {a.km != null ? ` · ${a.km} km away` : ""}
            </span>
          </span>
        </span>
      )}
    />
  );
}
