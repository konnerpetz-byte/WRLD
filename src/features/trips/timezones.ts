/** Main timezone per country, used to pre-fill the trip form. Users can change it. */
export const COUNTRY_TIMEZONE: Record<string, string> = {
  US: "America/New_York", PR: "America/Puerto_Rico", CA: "America/Toronto", MX: "America/Mexico_City",
  GB: "Europe/London", IE: "Europe/Dublin", FR: "Europe/Paris", DE: "Europe/Berlin", ES: "Europe/Madrid",
  PT: "Europe/Lisbon", IT: "Europe/Rome", NL: "Europe/Amsterdam", BE: "Europe/Brussels", AT: "Europe/Vienna",
  GR: "Europe/Athens", HR: "Europe/Zagreb", FI: "Europe/Helsinki", MT: "Europe/Malta", CH: "Europe/Zurich",
  SE: "Europe/Stockholm", NO: "Europe/Oslo", DK: "Europe/Copenhagen", IS: "Atlantic/Reykjavik",
  CZ: "Europe/Prague", PL: "Europe/Warsaw", HU: "Europe/Budapest", TR: "Europe/Istanbul", AE: "Asia/Dubai",
  IL: "Asia/Jerusalem", EG: "Africa/Cairo", MA: "Africa/Casablanca", ZA: "Africa/Johannesburg",
  KE: "Africa/Nairobi", IN: "Asia/Kolkata", TH: "Asia/Bangkok", VN: "Asia/Ho_Chi_Minh", ID: "Asia/Jakarta",
  MY: "Asia/Kuala_Lumpur", SG: "Asia/Singapore", PH: "Asia/Manila", KR: "Asia/Seoul", JP: "Asia/Tokyo",
  CN: "Asia/Shanghai", HK: "Asia/Hong_Kong", TW: "Asia/Taipei", AU: "Australia/Sydney",
  NZ: "Pacific/Auckland", BR: "America/Sao_Paulo", AR: "America/Argentina/Buenos_Aires",
  CL: "America/Santiago", CO: "America/Bogota", PE: "America/Lima", CR: "America/Costa_Rica",
  DO: "America/Santo_Domingo",
};

export function allTimezones(): string[] {
  try {
    return Intl.supportedValuesOf("timeZone");
  } catch {
    return Object.values(COUNTRY_TIMEZONE);
  }
}
