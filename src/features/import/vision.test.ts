import { afterEach, describe, expect, it, vi } from "vitest";

import { readImagesWithAI } from "./vision";

const reply = (input: unknown, ok = true) =>
  vi.fn(async () => new Response(JSON.stringify({ content: [{ type: "tool_use", name: "record_bookings", input }] }), { status: ok ? 200 : 500 }));
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0]);
const ctx = { defaultTz: "America/Detroit", year: 2027 };

describe("AI screenshot reader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("is off without a key", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    const fetch = reply({});
    vi.stubGlobal("fetch", fetch);
    expect(await readImagesWithAI([png], ctx)).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("turns the model's answer into checked bookings", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal(
      "fetch",
      reply({
        confirmation: "qwertz",
        passengers: ["LOPEZ/MARIA", "SAMUEL CHEN"],
        passenger_count: 2,
        flights: [
          { airline_code: "LX", flight_number: "099", from: "ZRH", to: "YUL", depart_date: "2027-05-30", depart_time: "12:40", arrive_date: "2027-05-30", arrive_time: "15:00" },
          { airline_code: "DL", flight_number: "0022", from: "DTW", to: "MUC", depart_date: "2027-05-16", depart_time: "16:40", arrive_date: null, arrive_time: "06:55" },
          { airline_code: "XX", flight_number: "1", from: "ZZZ", to: "YUL", depart_date: "2027-05-30" },
        ],
        stays: [{ name: "Example Hotel", address: "Seestrasse 4, Konstanz", check_in_date: "2027-05-27", check_in_time: "15:00", check_out_date: "2027-05-29", check_out_time: null }],
      }),
    );
    const r = await readImagesWithAI([png], ctx);
    expect(r?.candidates.map((c) => (c.kind === "transit" ? [c.number, c.carrier, c.from, c.to, c.departLocal, c.arriveLocal, c.departTz, c.confirmation] : c.kind === "stay" ? [c.name, c.checkInLocal, c.checkOutLocal] : null))).toEqual([
      ["LX 99", "SWISS", "ZRH", "YUL", "2027-05-30T12:40", "2027-05-30T15:00", "Europe/Zurich", "QWERTZ"],
      // Overnight with no arrival date: next morning. Unknown airport (ZZZ) dropped.
      ["DL 22", "Delta", "DTW", "MUC", "2027-05-16T16:40", "2027-05-17T06:55", "America/New_York", "QWERTZ"],
      ["Example Hotel", "2027-05-27T15:00", "2027-05-29T11:00"],
    ]);
    expect(r?.people).toEqual({ names: ["Maria Lopez", "Samuel Chen"], count: 2 });
  });

  it("falls back (returns null) on an error or an answer that doesn't fit", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    vi.stubGlobal("fetch", reply({}, false));
    expect(await readImagesWithAI([png], ctx)).toBeNull();
    vi.stubGlobal("fetch", reply({ flights: [{ from: "dtw", to: "MUC", depart_date: "May 16" }] }));
    expect(await readImagesWithAI([png], ctx)).toBeNull();
  });
});
