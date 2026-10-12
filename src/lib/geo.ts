export type LatLng = { latitude: number; longitude: number };

/** Straight-line ("as the crow flies") distance in kilometers. */
export function distanceKm(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function formatDistance(km: number, unit: "km" | "mi") {
  const value = unit === "mi" ? km * 0.621371 : km;
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${unit}`;
}
