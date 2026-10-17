import { describe, expect, it } from "vitest";

import { parseAmount, priceIn } from "./price";

describe("amounts", () => {
  it.each([
    ["291,00", 291],
    ["1.234,56", 1234.56],
    ["1,234.56", 1234.56],
    ["1,234", 1234],
    ["129.46", 129.46],
    ["260.98", 260.98],
    ["1.234", 1234],
    ["1 234,50", 1234.5],
  ])("%s → %s", (raw, want) => expect(parseAmount(raw)).toBe(want));
});

describe("prices in confirmations (details made up)", () => {
  it("hotel total with the currency after", () => {
    expect(priceIn("Twin room (rate incl. breakfast)\n2 adults\n17.05 - 20.05 - 291,00 EUR\n291,00 EUR\nTotal: 291,00 EUR\nPayment terms: due upon check-in.")).toEqual({ amount: 291, currency: "EUR", points: null });
  });
  it("Booking.com: the property's own currency, not the 'approx.' conversion, and the final price block", () => {
    const text = "PRICE\n1 room $260\n7 % VAT $18\nPrice\n(for 2 guests)\napprox. $294\n€ 260.98\nThe final price shown is the amount you'll pay.";
    expect(priceIn(text)).toEqual({ amount: 260.98, currency: "EUR", points: null });
  });
  it("award ticket: cash part and miles, ignoring the per-passenger line and repeated PDF text", () => {
    const text = "Total Per Passenger: 44,000 miles + 64.73 USD\nTotal:Total:Total:Total: 88,000 miles + 129.4688,000 miles + 129.4688,000 miles + 129.4688,000 miles + 129.46\nUSDUSDUSDUSD";
    expect(priceIn(text)).toEqual({ amount: 129.46, currency: "USD", points: 88000 });
  });
  it("cash flight with a symbol before the amount", () => {
    expect(priceIn("Fare $512.40\nTaxes and fees $88.20\nTotal paid: $600.60")).toEqual({ amount: 600.6, currency: "USD", points: null });
  });
  it("no labeled total: nothing", () => {
    expect(priceIn("Seat 30J, 30K\nAC8583 YUL → DTW 7:50 PM")).toBeNull();
  });
});
