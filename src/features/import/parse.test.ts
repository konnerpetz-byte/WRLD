import { describe, expect, it } from "vitest";

import { type ImportCandidate, parseBookings, travelersIn } from "./parse";
import { partnersOnBooking } from "./travelers";

/**
 * Confirmation layouts modeled on how major airlines, booking sites, rail and
 * bus operators write them (simplified, with made-up names and codes). When a
 * real email doesn't import right, add it here (with personal details changed).
 */
const ctx = { defaultTz: "America/Detroit", year: 2026 };
const legs = (cs: ImportCandidate[]) =>
  cs
    .filter((c) => c.kind === "transit")
    .map((c) => (c.kind === "transit" ? `${c.from}-${c.to} ${c.departLocal} ${c.arriveLocal} ${c.number ?? "?"}` : ""));
const routes = (cs: ImportCandidate[]) =>
  cs.filter((c) => c.kind === "transit").map((c) => (c.kind === "transit" ? `${c.from}-${c.to}` : ""));

describe("airlines: connections and layovers", () => {
  it("United: stops on separate lines with a connection", () => {
    const text = `Confirmation number: K4ZP9Q
Mon, Nov 02, 2026
Detroit to Lisbon
UA 1234
DTW  6:05 AM
ORD  6:58 AM
Connection: 2h 42m in Chicago
UA 958
ORD  9:40 AM
LIS  6:25 AM +1 day
Travelers
KONNER PETZ
SHANE SMITH`;
    const r = parseBookings({ text }, ctx);
    expect(legs(r)).toEqual(["DTW-ORD 2026-11-02T06:05 2026-11-02T06:58 UA 1234", "ORD-LIS 2026-11-02T09:40 2026-11-03T06:25 UA 958"]);
    expect(travelersIn({ text })).toEqual({
      names: ["Konner Petz", "Shane Smith"],
      count: 2,
    });
  });

  it("United eTicket receipt: codes in parentheses, times above airports, partner-operated legs, award totals", () => {
    const text = `Thank you for choosing United.
Confirmation Number:
QX7TRM
Flight 1 of 2 LX86 Class: Economy (X)
Sun, May 30, 2027 Sun, May 30, 2027
12:40 PM 03:00 PM
Zürich, CH (ZRH) Montreal, QC, CA (YUL)
Flight Operated by SWISS International Airlines.
Flight 2 of 2 AC8583 Class: Economy (X)
Sun, May 30, 2027 Sun, May 30, 2027
07:50 PM 09:45 PM
Montreal, QC, CA (YUL) Detroit, MI, US (DTW)
Flight Operated by AIR CANADA EXPRESS - JAZZ.
Traveler Details
LOPEZ/MARIA
eTicket number: 0160000000001 Seats: ZRH-YUL -----
YUL-DTW -----
CHEN/SAMUELROBERT
eTicket number: 0160000000002 Seats: ZRH-YUL -----
Frequent Flyer: UA-XXXXX111 Member YUL-DTW -----
Total Per Passenger: 44,000 miles + 64.73 USD
MileagePlus Accrual Details
Samuel Chen
Sun, May 30, 2027 86 Zürich, CH (ZRH) to
Montreal, QC, CA (YUL) 0
Baggage allowance and charges for this itinerary
Sun, May 30, 2027
Zürich, CH (ZRH - Kloten)
to Detroit, MI, US (DTW)`;
    const r = parseBookings({ text }, { ...ctx, year: 2027 });
    expect(legs(r)).toEqual(["ZRH-YUL 2027-05-30T12:40 2027-05-30T15:00 LX 86", "YUL-DTW 2027-05-30T19:50 2027-05-30T21:45 AC 8583"]);
    expect(travelersIn({ text })).toEqual({ names: ["Maria Lopez", "Samuel Chen"], count: 2 });
  });
  it("Delta app screenshots (OCR): number split from route, O for 0, arrival date on the card, passengers with View links", () => {
    // Two screenshots of one flight in the Fly Delta app, read in the order picked (details made up).
    const detail = `< BACK DTW - CDG QD)
4:55pm N - 7:10am
Fri, Jun 11
DTW 7h 15m CDG
Detroit, MI, US Paris, France, FR
McNamara Terminal Terminal 2E
Main Classic (N)
Show Passengers (2) v
MARIAJ LOPEZ VIE
SAMUEL CHEN View
Aircraft Details >
Total Flight Time | 7H 15M`;
    const summary = `< BACK DTW - CDG QD)
Upcoming Flight
To Paris, France ©
Thu, Jun 10 | 4:55pm - 7:10am
210 Days Until Check In
DLOO98
Operated by Delta Air Lines
Airbus A330-900
On Time On Time
4:55pm N - 7:10am
Fri, Jun 11
DTW 7h 15m CDG`;
    for (const text of [`${detail}\n\n${summary}`, `${summary}\n\n${detail}`, summary]) {
      expect(legs(parseBookings({ text }, { ...ctx, year: 2027 }))).toEqual(["DTW-CDG 2027-06-10T16:55 2027-06-11T07:10 DL 98"]);
    }
    expect(travelersIn({ text: detail })).toEqual({ names: ["Mariaj Lopez", "Samuel Chen"], count: 2 });
    // "MARIAJ" (middle initial run in) is the same person as trip member "Maria Lopez".
    expect(partnersOnBooking({ names: ["Mariaj Lopez", "Samuel Chen"], count: 2 }, ["Maria Lopez"]).others).toEqual(["Samuel Chen"]);
  });

  it("Delta: labeled Departs/Arrives lines with airline names", () => {
    const text = `Your Flight Receipt - KONNER PETZ 16MAY27
Confirmation #: H7KQ2P
Passenger Info
NAME: KONNER PETZ
NAME: SHANE SMITH
DELTA 1180
Departs DTW / on Sunday, May 16, 2027 at 4:40 PM
Arrives ATL / on Sunday, May 16, 2027 at 6:35 PM
DELTA 130
Departs ATL / on Sunday, May 16, 2027 at 9:55 PM
Arrives MUC / on Monday, May 17, 2027 at 1:05 PM`;
    const r = parseBookings({ text }, ctx);
    expect(legs(r)).toEqual(["DTW-ATL 2027-05-16T16:40 2027-05-16T18:35 DL 1180", "ATL-MUC 2027-05-16T21:55 2027-05-17T13:05 DL 130"]);
    expect(travelersIn({ text }).names).toEqual(["Konner Petz", "Shane Smith"]);
  });

  it("Expedia-style: each leg on one line, layover between, journey summary on top", () => {
    const text = `Detroit (DTW) to Lisbon (LIS)
Tue, Nov 10
5:05pm Detroit (DTW) - 7:20pm Newark (EWR)   United 1022
Layover: 1h 45m in Newark (EWR)
9:05pm Newark (EWR) - 9:20am Lisbon (LIS)   United 64
Arrives Wed, Nov 11
Travelers: Konner Petz, Shane Smith
Itinerary # 7312845519233`;
    const r = parseBookings({ text }, ctx);
    expect(legs(r)).toEqual(["DTW-EWR 2026-11-10T17:05 2026-11-10T19:20 UA 1022", "EWR-LIS 2026-11-10T21:05 2026-11-11T09:20 UA 64"]);
    expect(travelersIn({ text }).count).toBe(2);
  });

  it("American: route and times with arrows, round trip with connections", () => {
    const text = `Record Locator: QWERTY
Depart: Thursday, December 17, 2026
AA 2345   DFW → MIA   8:00 AM – 11:52 AM
AA 1001   MIA → SJO   1:15 PM – 2:40 PM
Return: Tuesday, December 22, 2026
AA 1000   SJO → MIA   11:20 AM – 4:30 PM
AA 2346   MIA → DFW   6:10 PM – 8:25 PM
Passengers
KONNER PETZ   Ticket 0012345678901
SHANE SMITH   Ticket 0012345678902`;
    const r = parseBookings({ text }, ctx);
    expect(routes(r)).toEqual(["DFW-MIA", "MIA-SJO", "SJO-MIA", "MIA-DFW"]);
    expect(legs(r)[2]).toBe("SJO-MIA 2026-12-22T11:20 2026-12-22T16:30 AA 1000");
    expect(travelersIn({ text }).names).toEqual(["Konner Petz", "Shane Smith"]);
  });

  it("Southwest: with a plane change and passenger count", () => {
    const text = `Confirmation # AB12CD
2 Adult Passengers
Flight 1 of 2: Wed, Jan 13, 2027
DEPARTS MDW 07:10AM  Chicago (Midway)
ARRIVES DEN 08:55AM  Denver
Flight # 2210
Change planes in Denver (DEN)
DEPARTS DEN 10:05AM
ARRIVES PHX 12:40PM  Phoenix
Flight # 1345`;
    const r = parseBookings({ text }, ctx);
    expect(routes(r)).toEqual(["MDW-DEN", "DEN-PHX"]);
    expect(travelersIn({ text }).count).toBe(2);
  });

  it("Lufthansa / European 24-hour times and day-first dates", () => {
    const text = `Booking code: 6XKP2M
Passenger: PETZ/KONNER MR
Passenger: SMITH/SHANE MR
LH 441  Mon, 16 Nov 2026  DTW 16:05  FRA 06:25 +1
LH 1166 Tue, 17 Nov 2026  FRA 08:10  LIS 10:05`;
    const r = parseBookings({ text }, ctx);
    expect(legs(r)).toEqual(["DTW-FRA 2026-11-16T16:05 2026-11-17T06:25 LH 441", "FRA-LIS 2026-11-17T08:10 2026-11-17T10:05 LH 1166"]);
    expect(travelersIn({ text }).names).toEqual(["Konner Petz", "Shane Smith"]);
  });

  it("Ryanair: one leg, two passengers listed as Adult 1 / Adult 2", () => {
    const text = `Reservation number: K9X2PQ
Flight FR 1234  Dublin (DUB) → Barcelona (BCN)
Sat, 5 Jun 2027  06:30 – 10:05
Adult 1 - Konner Petz
Adult 2 - Shane Smith`;
    const r = parseBookings({ text }, ctx);
    expect(legs(r)).toEqual(["DUB-BCN 2027-06-05T06:30 2027-06-05T10:05 FR 1234"]);
    expect(travelersIn({ text }).count).toBe(2);
  });

  it("structured data: one reservation per passenger per flight (Gmail markup)", () => {
    const block = (name: string, num: string, from: string, to: string, dep: string, arr: string) => ({
      "@context": "http://schema.org",
      "@type": "FlightReservation",
      reservationNumber: "RXJ34P",
      underName: { "@type": "Person", name },
      reservationFor: {
        "@type": "Flight",
        flightNumber: num,
        airline: { "@type": "Airline", name: "United", iataCode: "UA" },
        departureAirport: { "@type": "Airport", iataCode: from },
        departureTime: dep,
        arrivalAirport: { "@type": "Airport", iataCode: to },
        arrivalTime: arr,
      },
    });
    const html = `<html><script type="application/ld+json">${JSON.stringify([
      block("Konner Petz", "1234", "DTW", "ORD", "2026-11-02T06:05:00-05:00", "2026-11-02T06:58:00-06:00"),
      block("Shane Smith", "1234", "DTW", "ORD", "2026-11-02T06:05:00-05:00", "2026-11-02T06:58:00-06:00"),
      block("Konner Petz", "958", "ORD", "LIS", "2026-11-02T09:40:00-06:00", "2026-11-03T06:25:00+00:00"),
      block("Shane Smith", "958", "ORD", "LIS", "2026-11-02T09:40:00-06:00", "2026-11-03T06:25:00+00:00"),
    ])}</script></html>`;
    const r = parseBookings({ html }, ctx);
    expect(routes(r)).toEqual(["DTW-ORD", "ORD-LIS"]);
    expect(travelersIn({ html }).names).toEqual(["Konner Petz", "Shane Smith"]);
  });
});

describe("more airline layouts", () => {
  const cases: [string, string, string[]][] = [
    [
      "British Airways",
      `Booking reference: X7PL2Q
BA0215  Tue 10 Nov 2026
London Heathrow (LHR) 14:10 → Boston Logan (BOS) 16:50
BA0238  Sun 15 Nov 2026
Boston Logan (BOS) 18:40 → London Heathrow (LHR) 06:05 +1`,
      ["LHR-BOS 2026-11-10T14:10 2026-11-10T16:50 BA 215", "BOS-LHR 2026-11-15T18:40 2026-11-16T06:05 BA 238"],
    ],
    [
      "KLM / Air France (operated by Delta, next-day in brackets)",
      `Booking code: MZ4KQ9
Thursday 4 February 2027
KL 6034  Detroit (DTW) 18:30  Amsterdam (AMS) 08:10 (+1)
Friday 5 February 2027
KL 1691  Amsterdam (AMS) 09:40  Rome (FCO) 11:55`,
      ["DTW-AMS 2027-02-04T18:30 2027-02-05T08:10 KL 6034", "AMS-FCO 2027-02-05T09:40 2027-02-05T11:55 KL 1691"],
    ],
    [
      "Emirates (codes beside city names, overnight)",
      `Booking reference: EKQ2WZ
EK 236 | Sat 6 Mar 2027
Departing: Dubai DXB 03:10
Arriving: Boston BOS 09:00`,
      ["DXB-BOS 2027-03-06T03:10 2027-03-06T09:00 EK 236"],
    ],
    [
      "Air Canada (connection through Toronto)",
      `Booking reference: AC9X2K
Flight 1: Monday, March 22, 2027
AC 7671  DTW 07:00  YYZ 08:05
Flight 2: Monday, March 22, 2027
AC 856  YYZ 18:50  LHR 06:45 +1`,
      ["DTW-YYZ 2027-03-22T07:00 2027-03-22T08:05 AC 7671", "YYZ-LHR 2027-03-22T18:50 2027-03-23T06:45 AC 856"],
    ],
    [
      "easyJet (EZY prefix)",
      `Booking reference: K2LXP4Q
EZY8915  London Gatwick (LGW) to Nice (NCE)
Fri 14 May 2027  Dep 07:25  Arr 10:35`,
      ["LGW-NCE 2027-05-14T07:25 2027-05-14T10:35 U2 8915"],
    ],
    [
      "JetBlue (stop in Boston)",
      `Confirmation code: JBXQ2T
Thu, Apr 8, 2027
Flight 1123  DTW 6:00a → BOS 7:59a
Flight 1655  BOS 9:15a → SJU 1:35p`,
      ["DTW-BOS 2027-04-08T06:00 2027-04-08T07:59 ?", "BOS-SJU 2027-04-08T09:15 2027-04-08T13:35 ?"],
    ],
  ];
  for (const [name, text, want] of cases) {
    it(name, () => expect(legs(parseBookings({ text }, ctx))).toEqual(want));
  }
});

describe("trains and buses", () => {
  it("Amtrak: labeled departs/arrives with station names", () => {
    const text = `Amtrak Reservation Number: 4C9D2E
Train 171 Northeast Regional
Thu, Dec 3, 2026
Depart: New York, NY - Moynihan Train Hall 7:05 AM
Arrive: Washington, DC - Union Station 10:35 AM
2 Adults`;
    const r = parseBookings({ text }, ctx);
    const t = r.find((c) => c.kind === "transit");
    expect(t && t.kind === "transit" ? [t.mode, t.carrier, t.departLocal, t.arriveLocal, t.number] : null).toEqual([
      "train",
      "Amtrak",
      "2026-12-03T07:05",
      "2026-12-03T10:35",
      "Train 171",
    ]);
    expect(t && t.kind === "transit" ? t.from : "").toMatch(/New York/);
    expect(travelersIn({ text }).count).toBe(2);
  });

  it("Eurostar: arrow line with times", () => {
    const text = `Eurostar booking reference: QXR4LM
Fri 12 Mar 2027
08:01 Paris Gare du Nord → 09:30 London St Pancras Int'l
Train 9014  Coach 7 Seat 61
Passengers: Konner Petz, Shane Smith`;
    const r = parseBookings({ text }, ctx);
    const t = r.find((c) => c.kind === "transit");
    expect(t && t.kind === "transit" ? [t.mode, t.from, t.to, t.departLocal, t.arriveLocal] : null).toEqual([
      "train",
      "Paris Gare du Nord",
      "London St Pancras Int'l",
      "2027-03-12T08:01",
      "2027-03-12T09:30",
    ]);
    expect(travelersIn({ text }).names).toEqual(["Konner Petz", "Shane Smith"]);
  });

  it("Deutsche Bahn: two ICE legs with a change", () => {
    const text = `Deutsche Bahn Online-Ticket
Travel date: 14.05.2027
Frankfurt(Main)Hbf 10:13 → Köln Hbf 11:17   ICE 123
Köln Hbf 11:44 → Amsterdam Centraal 14:26   ICE 126`;
    const r = parseBookings({ text }, ctx);
    expect(r.filter((c) => c.kind === "transit").length).toBe(2);
  });

  it("SNCF in French (08h01 times)", () => {
    const text = `SNCF Connect - Votre voyage
Samedi 19 juin 2027
Départ 08h01 Paris Gare de Lyon
Arrivée 10h05 Lyon Part-Dieu
TGV INOUI 6603`;
    const r = parseBookings({ text }, ctx);
    const t = r.find((c) => c.kind === "transit");
    expect(t && t.kind === "transit" ? [t.mode, t.from, t.to, t.departLocal, t.arriveLocal] : null).toEqual([
      "train",
      "Paris Gare de Lyon",
      "Lyon Part-Dieu",
      "2027-06-19T08:01",
      "2027-06-19T10:05",
    ]);
  });

  it("Greyhound", () => {
    const text = `Greyhound Confirmation #: 5521-0042-11
Wed, Jul 14, 2027
Depart 11:30 PM  Detroit, MI (Downtown)
Arrive 5:55 AM  Chicago, IL (Union Station)
Passengers: 2 Adults`;
    const r = parseBookings({ text }, ctx);
    const t = r.find((c) => c.kind === "transit");
    expect(t && t.kind === "transit" ? [t.mode, t.departLocal, t.arriveLocal] : null).toEqual([
      "bus",
      "2027-07-14T23:30",
      "2027-07-15T05:55",
    ]);
    expect(travelersIn({ text }).count).toBe(2);
  });

  it("FlixBus: departure and arrival labels", () => {
    const text = `FlixBus booking 2948-1734
Sunday, 20 June 2027
Departure 08:15 Berlin central bus station (ZOB)
Arrival 12:40 Hamburg ZOB
1 adult`;
    const r = parseBookings({ text }, ctx);
    const t = r.find((c) => c.kind === "transit");
    expect(t && t.kind === "transit" ? [t.mode, t.departLocal, t.arriveLocal] : null).toEqual([
      "bus",
      "2027-06-20T08:15",
      "2027-06-20T12:40",
    ]);
  });
});

describe("hotels", () => {
  it("Hotel app screenshot (OCR): Arrival/Departure labels, Where? heading, unlabeled address, Booking N°", () => {
    // Shape of OCR text from a phone screenshot of a direct hotel booking (details made up).
    const text = `£ Your booking was ~~ A
EXAMPLE
HOTELS
Booking N°: 2004567812
Guests: 2
Room: 1
"ah ! | ol r B Co »
Hey Sam,
Great news! The update to your reservation
was successful.
Who is booking?
Sam Rivera
Where?
EXAMPLE Hotel Hamburg Altona
Beispielstrasse 12, 22765 Hamburg, Germany.
GET DIRECTIONS
When?
Arrival: 3.6.2027
Departure: 6.6.2027
Check-in: From 3 p.m.
Check-out: By 11 a.m.
Twin room (rate incl. breakfast)
2 adults
03.06 - 06.06 - 291,00 EUR
Total: 291,00 EUR`;
    const r = parseBookings({ text }, { ...ctx, year: 2027 });
    expect(r.map((c) => (c.kind === "stay" ? [c.name, c.address, c.checkInLocal, c.checkOutLocal, c.confirmation] : c.kind))).toEqual([
      ["EXAMPLE Hotel Hamburg Altona", "Beispielstrasse 12, 22765 Hamburg, Germany", "2027-06-03T15:00", "2027-06-06T11:00", "2004567812"],
    ]);
    expect(travelersIn({ text })).toEqual({ names: ["Sam Rivera"], count: 2 });
  });

  it("Booking.com PDF with a text layer: address over two lines, check-in and check-out stacked", () => {
    const text = `Hotel Example Lakeside
Address: Seestrasse 4, 78462
Konstanz, Germany
Phone: +49 0000 000000
GPS Coordinates: N 047°
40.000, E 09° 9.000
YOUR GROUP
2 adults
Booking Confirmation
CONFIRMATION NUMBER: 1234.567.891
CHECK-IN
27
MAY
Thursday
from 15:00
CHECK-OUT
29
MAY
Saturday
until 12:00
ROOMS
1 /
NIGHTS
2`;
    const stay = parseBookings({ text }, { ...ctx, year: 2027 }).find((c) => c.kind === "stay");
    expect(stay && stay.kind === "stay" ? [stay.checkInLocal, stay.checkOutLocal, stay.confirmation, stay.address] : null).toEqual([
      "2027-05-27T15:00",
      "2027-05-29T12:00",
      "1234567891",
      "Seestrasse 4, 78462, Konstanz, Germany",
    ]);
  });

  it("Booking.com PDF read as an image: dates in columns beside the address", () => {
    // Shape of OCR output from a "Print to PDF" Booking.com confirmation (details changed).
    const text = `Booking.com Booking Confirmation
CONFIRMATION NUMBER: 1234.567.890
PIN CODE: 0000
Hotel Example CHECK-IN CHECK-OUT ROOMS NIGHTS
Address: Hauptstrasse 12, Altstadt, 5020 20 2 3 1 3
Salzburg, Austria MAY MAY
Phone: +43 000 000000
Thursday Sunday
GPS Coordinates: N 047 48.794, E 13 2.428 from 14:00 00:30 - 11:00
PRICE
(for 2 guests) € 495
Guest name: Alex Rivera You can cancel for free until 2 days before
Number of guests: 2 adults arrival. If you cancel within 2 days of arrival,
You'll get a full refund if you cancel before
11:59 PM on May 17, 2027.`;
    const r = parseBookings({ text }, ctx);
    const stay = r.find((c) => c.kind === "stay");
    expect(
      stay && stay.kind === "stay" ? [stay.name, stay.checkInLocal, stay.checkOutLocal, stay.confirmation, stay.address] : null
    ).toEqual(["Hotel Example", "2027-05-20T14:00", "2027-05-23T11:00", "1234567890", "Hauptstrasse 12, Altstadt, 5020, Salzburg, Austria"]);
    expect(r.filter((c) => c.kind !== "stay")).toEqual([]);
    expect(travelersIn({ text })).toEqual({ names: ["Alex Rivera"], count: 2 });
  });
});

describe("travel partners on a booking", () => {
  it("names the people not on the trip yet", () => {
    expect(partnersOnBooking({ names: ["Sam Rivera", "Jo Park", "Alex Kim"], count: 3 }, ["Sam Rivera"])).toEqual({
      others: ["Jo Park", "Alex Kim"],
      extra: 0,
      count: 3,
    });
  });
  it("counts unnamed seats when only the lead traveler is listed", () => {
    expect(partnersOnBooking({ names: ["Sam Rivera"], count: 2 }, ["Sam"])).toEqual({ others: [], extra: 1, count: 2 });
  });
  it("says nothing when everyone is already on the trip", () => {
    expect(partnersOnBooking({ names: ["Sam Rivera", "Jo Park"], count: 2 }, ["Sam Rivera", "Jo Park"])).toMatchObject({
      others: [],
      extra: 0,
    });
  });
});
