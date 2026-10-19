/**
 * Integrations that are built but switched off, and hidden everywhere, while WRLD focuses on
 * group trip planning (October 19, 2026). Flip one to false to bring it back; the code,
 * routes and database tables are kept as they were.
 *   seatsAero:   live award-seat search and "Login with Seats.aero" (needs their written approval)
 *   awardWallet: importing points balances from AwardWallet (needs their API approval)
 */
export const PAUSED = { seatsAero: true, awardWallet: true } as const;
