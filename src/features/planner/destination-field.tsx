"use client";

import { Car, MapPin, Plane } from "lucide-react";

import { Autocomplete } from "@/components/autocomplete";

type Option = { value: string; label: string; detail: string; kind: "drive" | "place" | "airport" };

/** "Going to": a town, a road-trip spot (Torch Lake) or an airport. The field keeps what was picked. */
export function DestinationField({
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
    <Autocomplete<Option>
      id={id}
      name={name}
      value={value}
      onValueChange={onValueChange}
      placeholder={placeholder}
      aria-describedby={describedBy}
      fetchOptions={async (q, signal) => {
        const res = await fetch(`/api/destinations?q=${encodeURIComponent(q)}`, { signal });
        return res.ok ? res.json() : [];
      }}
      optionKey={(o) => `${o.kind}-${o.value}`}
      onPick={(o) => onValueChange(o.value)}
      renderOption={(o) => {
        const Icon = o.kind === "drive" ? Car : o.kind === "airport" ? Plane : MapPin;
        return (
          <span className="flex items-start gap-2">
            <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block truncate">{o.label}</span>
              <span className="block truncate text-xs text-muted-foreground">{o.detail}</span>
            </span>
          </span>
        );
      }}
    />
  );
}
