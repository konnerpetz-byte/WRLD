/**
 * Live places to stay for a trip: the same search on Airbnb, Booking.com and Google Hotels, filled in
 * with the place, check-in and check-out dates, people and rooms. Prices on those sites are live;
 * WRLD's hotel number is an estimate to plan with.
 */
export type StayLink = { label: string; url: string };

const addDays = (iso: string, n: number) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function stayLinks(place: string, checkIn: string, nights: number, people: number): StayLink[] {
  const checkOut = addDays(checkIn, nights);
  const rooms = Math.max(1, Math.ceil(people / 2));

  const airbnb = new URL(`https://www.airbnb.com/s/${encodeURIComponent(place.replace(/,\s*/g, "--").replace(/\s+/g, "-"))}/homes`);
  airbnb.search = new URLSearchParams({ checkin: checkIn, checkout: checkOut, adults: String(people) }).toString();

  const booking = new URL("https://www.booking.com/searchresults.html");
  booking.search = new URLSearchParams({
    ss: place,
    checkin: checkIn,
    checkout: checkOut,
    group_adults: String(people),
    no_rooms: String(rooms),
    group_children: "0",
  }).toString();

  const nice = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  const google = new URL("https://www.google.com/travel/search");
  google.searchParams.set("q", `hotels in ${place} ${nice(checkIn)} to ${nice(checkOut)} for ${people}`);

  return [
    { label: "Airbnb", url: airbnb.toString() },
    { label: "Booking.com", url: booking.toString() },
    { label: "Google Hotels", url: google.toString() },
  ];
}

/** The next Friday at least a week out, inside the month when possible: when a weekend away would start. */
export function fridayIn(month: string, now = new Date()) {
  const soonest = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7));
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  if (d < soonest) d.setTime(soonest.getTime());
  while (d.getUTCDay() !== 5) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}
