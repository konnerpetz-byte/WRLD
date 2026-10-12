/**
 * Travel documents a trip needs, from the traveler's passport country, the
 * countries on the trip, the dates and whether anyone is driving.
 *
 * Rules last checked October 12, 2026 against the official sites linked on
 * each one (see docs/ROLLOUT-PLAN.md for sources). Entry rules change, so
 * every item links to the government page and the UI says to confirm there.
 * Countries without a specific rule fall back to a "check entry rules" item.
 */

export const RULES_CHECKED_ON = "2026-10-12";

export type DocContext = {
  /** Passport country (ISO-2), from the traveler's profile. */
  home: string | null;
  /** ISO-2 countries on the trip, in order. */
  countries: string[];
  /** First day of the trip, YYYY-MM-DD. */
  start: string;
  hasCarLeg: boolean;
};

export type DocRequirement = {
  key: string;
  title: string;
  detail: string;
  url: string;
  /** Remind this many days before the trip starts. */
  leadDays: number;
  level: "required" | "recommended";
};

const SCHENGEN = ["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"];
/** ETIAS covers the Schengen area plus Cyprus. */
const ETIAS = [...SCHENGEN, "CY"];
const EU_EEA_CH = [...SCHENGEN, "CY", "IE"];
/** Passports that visit Europe and the UK visa-free (and so need ETIAS / UK ETA). */
const VISA_FREE_WEST = ["US", "CA", "AU", "NZ", "JP", "KR", "SG", "MX", "BR", "AR", "CL", "IL", "AE", "TW", "HK", "MY", "GB"];
/** U.S. Visa Waiver Program countries most likely to use WRLD. */
const US_VWP = ["GB", "IE", "FR", "DE", "IT", "ES", "PT", "NL", "BE", "AT", "CH", "SE", "NO", "DK", "FI", "IS", "GR", "PL", "CZ", "HU", "JP", "KR", "TW", "SG", "AU", "NZ", "IL", "CL", "HR", "IE", "LU", "MT", "SI", "SK", "EE", "LV", "LT", "BN", "QA", "RO"];
/** Countries where U.S. drivers are expected to carry an International Driving Permit. */
const IDP_COUNTRIES = ["JP", "IT", "ES", "GR", "AT", "KR"];

const COUNTRY_NAME: Record<string, string> = {
  GB: "the UK", US: "the United States", CA: "Canada", MX: "Mexico", JP: "Japan", KR: "South Korea", TH: "Thailand", SG: "Singapore",
  AU: "Australia", NZ: "New Zealand", IN: "India", EG: "Egypt", KE: "Kenya", TR: "Türkiye", PE: "Peru", AE: "the UAE", CN: "China",
  VN: "Vietnam", BR: "Brazil", MA: "Morocco", ZA: "South Africa", ID: "Indonesia", PH: "the Philippines", CR: "Costa Rica", CO: "Colombia",
};

export function countryName(code: string) {
  return COUNTRY_NAME[code] ?? new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
}

function addMonths(date: string, months: number) {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function documentsFor(ctx: DocContext): DocRequirement[] {
  const home = ctx.home?.toUpperCase() ?? null;
  const foreign = [...new Set(ctx.countries.filter((c) => c && c !== home))];
  if (!foreign.length) return [];
  const has = (list: string[]) => foreign.some((c) => list.includes(c));
  const out: DocRequirement[] = [];
  const covered = new Set<string>();

  out.push({
    key: "passport",
    title: "Passport valid for 6+ months",
    detail: `Make sure your passport is valid until at least ${addMonths(ctx.start, 6)} and has two blank pages. Many countries require 6 months; Europe requires 3 months past the day you leave and a passport issued within the last 10 years. Renewals can take weeks, so check now.`,
    url: home === "US" ? "https://travel.state.gov/content/travel/en/passports.html" : "https://www.iatatravelcentre.com",
    leadDays: 120,
    level: "required",
  });

  if (has(ETIAS) && home && !EU_EEA_CH.includes(home) && VISA_FREE_WEST.includes(home)) {
    out.push({
      key: "etias",
      title: "Europe: ETIAS travel authorization",
      detail: "The EU's ETIAS starts in the last quarter of 2026: €20 online, valid 3 years, most answers within minutes. Check the official site for whether it's required on your dates. Europe's new Entry/Exit System also scans fingerprints and your face at the border, so allow extra time on arrival.",
      url: "https://travel-europe.europa.eu/en/etias",
      leadDays: 30,
      level: "required",
    });
    for (const c of ETIAS) covered.add(c);
  } else if (has(SCHENGEN)) {
    for (const c of SCHENGEN) covered.add(c);
  }

  if (foreign.includes("GB") && home && !["GB", "IE"].includes(home)) {
    if (VISA_FREE_WEST.includes(home) || EU_EEA_CH.includes(home)) {
      out.push({
        key: "uk-eta",
        title: "UK: Electronic Travel Authorisation (ETA)",
        detail: "Required to visit the UK, including many airport transits. £20 on the official GOV.UK site or app; other sites charge more. Apply at least a few working days before you fly.",
        url: "https://www.gov.uk/eta",
        leadDays: 14,
        level: "required",
      });
      covered.add("GB");
    }
  }

  if (foreign.includes("KR")) {
    if (home === "US" && ctx.start < "2027-01-01") {
      out.push({
        key: "kr-arrival",
        title: "South Korea: e-Arrival Card",
        detail: "U.S. citizens don't need a K-ETA for trips through December 31, 2026. Fill in the free e-Arrival Card online within 3 days before you land.",
        url: "https://www.e-arrivalcard.go.kr",
        leadDays: 3,
        level: "required",
      });
      covered.add("KR");
    } else if (home && VISA_FREE_WEST.includes(home)) {
      out.push({
        key: "kr-eta",
        title: "South Korea: K-ETA",
        detail: "Apply on the official K-ETA site or app (₩10,000) at least 72 hours before departure. Approval lasts 3 years. Check whether your passport is temporarily exempt.",
        url: "https://www.k-eta.go.kr",
        leadDays: 14,
        level: "required",
      });
      covered.add("KR");
    }
  }

  if (foreign.includes("TH")) {
    out.push({
      key: "th-tdac",
      title: "Thailand: Digital Arrival Card (TDAC)",
      detail: "Every foreign visitor fills in the free TDAC online within 3 days before arriving. The official site charges nothing.",
      url: "https://tdac.immigration.go.th",
      leadDays: 3,
      level: "required",
    });
  }

  if (foreign.includes("SG")) {
    out.push({
      key: "sg-arrival",
      title: "Singapore: SG Arrival Card",
      detail: "Free, online, within 3 days before you arrive (includes a health declaration).",
      url: "https://www.ica.gov.sg/enter-transit-depart/entering-singapore/sg-arrival-card",
      leadDays: 3,
      level: "required",
    });
  }

  if (foreign.includes("JP")) {
    out.push({
      key: "jp-vjw",
      title: "Japan: Visit Japan Web",
      detail: "Optional but fast: register your immigration and customs details online and show QR codes on arrival.",
      url: "https://services.digital.go.jp/en/visit-japan-web/",
      leadDays: 7,
      level: "recommended",
    });
    if (home && VISA_FREE_WEST.includes(home)) covered.add("JP");
  }

  if (foreign.includes("AU") && home && ["US", "CA", "JP", "KR", "SG", "MY", "HK", "BN"].includes(home)) {
    out.push({
      key: "au-eta",
      title: "Australia: ETA (subclass 601)",
      detail: "Apply in the official AustralianETA app. Lets you visit as often as you like for 12 months, up to 3 months each time.",
      url: "https://immi.homeaffairs.gov.au/visas/getting-a-visa/visa-listing/electronic-travel-authority-601",
      leadDays: 14,
      level: "required",
    });
    covered.add("AU");
  }

  if (foreign.includes("NZ") && home && VISA_FREE_WEST.includes(home) && home !== "AU") {
    out.push({
      key: "nz-eta",
      title: "New Zealand: NZeTA",
      detail: "Request it in the official NZeTA app or website, with the visitor levy, before you travel. It can take up to 72 hours.",
      url: "https://www.immigration.govt.nz/nzeta",
      leadDays: 14,
      level: "required",
    });
    covered.add("NZ");
  }

  if (foreign.includes("IN") && home === "US") {
    out.push({
      key: "in-evisa",
      title: "India: e-Visa",
      detail: "U.S. citizens need a visa. Apply for the e-Visa on the official government site well ahead of travel.",
      url: "https://indianvisaonline.gov.in/evisa/",
      leadDays: 30,
      level: "required",
    });
    covered.add("IN");
  }

  if (foreign.includes("EG") && home === "US") {
    out.push({
      key: "eg-visa",
      title: "Egypt: visa",
      detail: "U.S. citizens need a visa: get the e-Visa on the official portal before you go, or buy one on arrival.",
      url: "https://visa2egypt.gov.eg",
      leadDays: 21,
      level: "required",
    });
    covered.add("EG");
  }

  if (foreign.includes("KE") && home && !["UG", "TZ", "RW", "BI", "SS", "SO"].includes(home)) {
    out.push({
      key: "ke-eta",
      title: "Kenya: eTA",
      detail: "Apply for Kenya's Electronic Travel Authorization on the official site before you fly.",
      url: "https://www.etakenya.go.ke",
      leadDays: 14,
      level: "required",
    });
    covered.add("KE");
  }

  if (foreign.includes("US") && home && US_VWP.includes(home)) {
    out.push({
      key: "us-esta",
      title: "United States: ESTA",
      detail: "Apply on the official CBP site (other sites charge extra). Apply at least 72 hours before you fly.",
      url: "https://esta.cbp.dhs.gov",
      leadDays: 30,
      level: "required",
    });
    covered.add("US");
  }

  if (foreign.includes("CA") && home && home !== "US" && VISA_FREE_WEST.includes(home)) {
    out.push({
      key: "ca-eta",
      title: "Canada: eTA",
      detail: "Visa-exempt travelers flying to Canada need an eTA. Apply on the official Government of Canada site.",
      url: "https://www.canada.ca/en/immigration-refugees-citizenship/services/visit-canada/eta.html",
      leadDays: 14,
      level: "required",
    });
    covered.add("CA");
  }
  if (foreign.includes("CA") && home === "US") covered.add("CA");
  if (foreign.includes("MX") && home === "US") covered.add("MX");

  if (ctx.hasCarLeg && home === "US" && has(IDP_COUNTRIES)) {
    const where = foreign.filter((c) => IDP_COUNTRIES.includes(c)).map(countryName).join(", ");
    out.push({
      key: "idp",
      title: "International Driving Permit",
      detail: `You're driving in ${where}, where U.S. drivers are expected to carry an International Driving Permit with their license. Get one from AAA before you leave.`,
      url: "https://www.aaa.com/vacation/idpf.html",
      leadDays: 30,
      level: "required",
    });
  }

  if (home === "US") {
    out.push({
      key: "us-step",
      title: "Enroll in STEP (optional)",
      detail: "The State Department's free Smart Traveler program sends safety alerts for your destinations and helps the embassy reach you in an emergency.",
      url: "https://step.state.gov",
      leadDays: 7,
      level: "recommended",
    });
  }

  // Arrival cards don't settle visas: Thailand and Singapore count as checked only for visa-free passports.
  if (home && VISA_FREE_WEST.includes(home)) for (const c of ["TH", "SG"]) covered.add(c);
  const unchecked = foreign.filter((c) => !covered.has(c));
  if (unchecked.length) {
    out.push({
      key: `entry-${unchecked.join("-").toLowerCase()}`.slice(0, 60),
      title: `Check entry rules for ${unchecked.map(countryName).join(", ")}`,
      detail: home
        ? "WRLD doesn't have checked rules for this passport and destination yet. Look up visa and entry requirements on the official source."
        : "Add your home country in Account to see the documents your passport needs.",
      url: home === "US" ? "https://travel.state.gov/content/travel/en/international-travel/International-Travel-Country-Information-Pages.html" : "https://www.iatatravelcentre.com",
      leadDays: 60,
      level: "required",
    });
  }

  return out;
}

/** The date to remind on: start minus lead days, never earlier than today. */
export function remindDate(start: string, leadDays: number, today = new Date().toISOString().slice(0, 10)) {
  const d = new Date(`${start}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - leadDays);
  const iso = d.toISOString().slice(0, 10);
  return iso < today ? today : iso;
}
