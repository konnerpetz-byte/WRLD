/** Bump when the Terms or Privacy Policy change in a way people must agree to again. */
export const LEGAL_VERSION = "2026-10-12";
export const LEGAL_UPDATED = "October 13, 2026";
/** Who operates WRLD. Set NEXT_PUBLIC_LEGAL_NAME / NEXT_PUBLIC_LEGAL_ADDRESS once the business is registered. */
export const LEGAL_NAME = process.env.NEXT_PUBLIC_LEGAL_NAME ?? "WRLD";
export const LEGAL_ADDRESS = process.env.NEXT_PUBLIC_LEGAL_ADDRESS ?? null;
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_PRIVACY_EMAIL ?? "privacy@wrldtrips.com";
