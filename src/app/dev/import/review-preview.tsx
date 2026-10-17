"use client";

import { useState } from "react";

import { Review } from "@/features/import/import-flow";
import type { ImportCandidate } from "@/features/import/parse";

const SAMPLE: (ImportCandidate & { include: boolean; rate?: number })[] = [
  {
    id: "a", kind: "transit", mode: "flight", carrier: "SWISS", number: "LX 99", from: "ZRH", to: "YUL",
    departLocal: "2027-05-30T12:40", departTz: "Europe/Zurich", arriveLocal: "2027-05-30T15:00", arriveTz: "America/Toronto",
    confirmation: "QWERTZ", found: "Screenshot", warnings: ["The price shown covers the whole booking (every flight and traveler)."],
    cost: 129.46, currency: "USD", points: 88000, include: true,
  },
  {
    id: "b", kind: "stay", name: "Example Hotel Hamburg", address: "Beispielstrasse 12, 22765 Hamburg, Germany",
    checkInLocal: "2027-06-03T15:00", checkOutLocal: "2027-06-06T11:00", confirmation: "2004567812", found: "Text", warnings: [],
    cost: 291, currency: "EUR", include: true, rate: 1.1253,
  },
];

export function ReviewPreview() {
  const [rows, setRows] = useState(SAMPLE);
  return (
    <Review
      tripId="00000000-0000-0000-0000-000000000001"
      rows={rows}
      setRows={(r) => r && setRows(r)}
      timezones={["Europe/Zurich", "America/Toronto", "Europe/Berlin", "America/Detroit"]}
      note="Found 2."
      members={[
        { id: "00000000-0000-0000-0000-0000000000a1", name: "Sam Rivera" },
        { id: "00000000-0000-0000-0000-0000000000a2", name: "Jo Park" },
      ]}
      me="00000000-0000-0000-0000-0000000000a1"
      tripCurrency="USD"
    />
  );
}
