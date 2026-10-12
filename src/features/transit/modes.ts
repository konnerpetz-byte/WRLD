import { BusFront, CarFront, Plane, Ship, TrainFront, type LucideIcon } from "lucide-react";

import type { TransitMode } from "@/types/database";

/** Everything the forms, itinerary and map say differently per way of getting around. */
export const MODE: Record<
  TransitMode,
  {
    label: string;
    icon: LucideIcon;
    carrier: string;
    carrierPlaceholder: string;
    number: string;
    numberPlaceholder: string;
    /** Flights use airport codes; everything else uses a place name. */
    usesCodes: boolean;
    from: string;
    fromPlaceholder: string;
    to: string;
    toPlaceholder: string;
    /** Added when looking a place up on the map ("Molo Beverello" + "ferry terminal"). */
    geocodeHint: string;
    /** "Leave for the ___ by 9:15" */
    terminal: string;
    arriveVerb: string;
  }
> = {
  flight: {
    label: "Flight",
    icon: Plane,
    carrier: "Airline",
    carrierPlaceholder: "TAP",
    number: "Flight number",
    numberPlaceholder: "TP 212",
    usesCodes: true,
    from: "From (airport code)",
    fromPlaceholder: "DTW",
    to: "To (airport code)",
    toPlaceholder: "LIS",
    geocodeHint: "airport",
    terminal: "airport",
    arriveVerb: "Land at",
  },
  train: {
    label: "Train",
    icon: TrainFront,
    carrier: "Rail company",
    carrierPlaceholder: "Trenitalia",
    number: "Train number",
    numberPlaceholder: "FR 9512",
    usesCodes: false,
    from: "From (station)",
    fromPlaceholder: "Roma Termini",
    to: "To (station)",
    toPlaceholder: "Firenze Santa Maria Novella",
    geocodeHint: "train station",
    terminal: "station",
    arriveVerb: "Arrive at",
  },
  bus: {
    label: "Bus",
    icon: BusFront,
    carrier: "Bus company",
    carrierPlaceholder: "FlixBus",
    number: "Route or booking number",
    numberPlaceholder: "N 1234",
    usesCodes: false,
    from: "From (bus station or stop)",
    fromPlaceholder: "Lisboa Oriente",
    to: "To (bus station or stop)",
    toPlaceholder: "Porto Campanhã",
    geocodeHint: "bus station",
    terminal: "bus stop",
    arriveVerb: "Get off at",
  },
  ferry: {
    label: "Ferry",
    icon: Ship,
    carrier: "Ferry line",
    carrierPlaceholder: "Blue Star Ferries",
    number: "Sailing or booking number",
    numberPlaceholder: "Optional",
    usesCodes: false,
    from: "From (port or terminal)",
    fromPlaceholder: "Piraeus",
    to: "To (port or terminal)",
    toPlaceholder: "Santorini (Athinios)",
    geocodeHint: "ferry terminal",
    terminal: "port",
    arriveVerb: "Dock at",
  },
  car: {
    label: "Car",
    icon: CarFront,
    carrier: "Rental company",
    carrierPlaceholder: "Optional",
    number: "Confirmation",
    numberPlaceholder: "Optional",
    usesCodes: false,
    from: "From",
    fromPlaceholder: "Lisbon Airport",
    to: "To",
    toPlaceholder: "Sintra",
    geocodeHint: "",
    terminal: "car",
    arriveVerb: "Arrive at",
  },
};

/** Where a leg starts or ends, in words: code for flights, place name otherwise. */
export function placeLabel(code: string | null, name: string | null) {
  return name ?? code ?? null;
}

/**
 * Sites to find times and tickets for ground and sea legs. Rome2rio compares
 * every way between two places; the others are the biggest sellers by type.
 * (All four run affiliate programs, so these can earn later.)
 */
export function findTicketsLinks(mode: TransitMode, from: string | null, to: string | null) {
  const links: { label: string; url: string }[] = [];
  if (from && to) {
    const slug = (s: string) => encodeURIComponent(s.trim().replace(/\s+/g, "-"));
    links.push({ label: "Compare routes on Rome2rio", url: `https://www.rome2rio.com/map/${slug(from)}/${slug(to)}` });
  }
  if (mode === "ferry") links.push({ label: "Direct Ferries", url: "https://www.directferries.com" });
  if (mode === "bus") links.push({ label: "FlixBus", url: "https://global.flixbus.com" }, { label: "Busbud", url: "https://www.busbud.com" });
  if (mode === "train" || mode === "bus") links.push({ label: "Omio", url: "https://www.omio.com" });
  return links;
}
