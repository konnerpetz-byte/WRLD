/**
 * Credit card points → airline programs: who transfers where, and at what ratio.
 *
 * Sources (both checked 2026-10-13; they agree except where noted):
 *   NerdWallet, "Credit Card Transfer Partners At a Glance" (updated July 1, 2026)
 *   Thrifty Traveler, "The Master List of Credit Card Transfer Partners" (updated Sept 24, 2026)
 * Amex → Emirates: NerdWallet's table says 1:1 but its text and Thrifty Traveler
 * say the ratio was cut; 5:4 is used. Citi ratios are for Strata Premier/Elite.
 * Banks change partners and ratios; re-check quarterly and before big transfers.
 */

export type Bank = { key: string; name: string; short: string; unit: string; slug: string; site: string; partners: Record<string, [number, number]> };

const r11: [number, number] = [1, 1];

export const BANKS: Bank[] = [
  {
    key: "chase",
    short: "Chase",
    unit: "Chase Ultimate Rewards points",
    name: "Chase Ultimate Rewards",
    slug: "chase_ultimate_rewards",
    site: "chase.com",
    partners: {
      aerlingus: r11, aeroplan: r11, british: r11, emirates: r11, flyingblue: r11, iberia: r11, jetblue: r11, singapore: r11,
      southwest: r11, united: r11, virginatlantic: r11,
    },
  },
  {
    key: "amex",
    short: "Amex",
    unit: "Amex Membership Rewards points",
    name: "Amex Membership Rewards",
    slug: "amex_membership_rewards",
    site: "americanexpress.com",
    partners: {
      aerlingus: r11, aeromexico: [1, 1.6], aeroplan: r11, ana: r11, lifemiles: r11, british: r11, cathay: [5, 4], delta: r11,
      emirates: [5, 4], flyingblue: r11, iberia: r11, jetblue: [5, 4], qantas: r11, qatar: r11, singapore: r11, virginatlantic: r11,
    },
  },
  {
    key: "capitalone",
    short: "Capital One",
    unit: "Capital One miles",
    name: "Capital One Miles",
    slug: "capital_one_miles",
    site: "capitalone.com",
    partners: {
      aeromexico: r11, aeroplan: r11, lifemiles: r11, british: r11, cathay: r11, emirates: [4, 3], etihad: r11, eva: [4, 3],
      finnair: r11, flyingblue: r11, jal: [4, 3], jetblue: [5, 3], qantas: r11, qatar: r11, singapore: r11, tap: r11,
      turkish: r11, virginatlantic: r11,
    },
  },
  {
    key: "citi",
    short: "Citi",
    unit: "Citi ThankYou points",
    name: "Citi ThankYou Points",
    slug: "citi_thankyou",
    site: "thankyou.com",
    partners: {
      american: r11, lifemiles: r11, cathay: r11, emirates: [5, 4], etihad: r11, eva: r11, flyingblue: r11, jetblue: r11,
      qantas: r11, qatar: r11, singapore: r11, thai: r11, turkish: r11, virginatlantic: r11,
    },
  },
  {
    key: "bilt",
    short: "Bilt",
    unit: "Bilt points",
    name: "Bilt Rewards",
    slug: "bilt_rewards",
    site: "biltrewards.com",
    partners: {
      aerlingus: r11, aeroplan: r11, alaska: r11, lifemiles: r11, british: r11, cathay: r11, emirates: r11, etihad: r11,
      flyingblue: r11, iberia: r11, jal: r11, southwest: r11, tap: r11, turkish: r11, united: r11, virginatlantic: r11,
    },
  },
];

export const bankByKey = (key: string) => BANKS.find((b) => b.key === key);

/** Bank points needed for `miles` in the program (transfers go in 1,000-point steps). */
export function bankPointsFor(miles: number, [from, to]: [number, number]) {
  return Math.ceil((miles * from) / to / 1000) * 1000;
}

export const ratioLabel = ([from, to]: [number, number]) => (from === to ? "1:1" : `${from}:${to}`);
