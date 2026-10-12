import { NextResponse } from "next/server";

/**
 * Starts the AwardWallet sign-in (OAuth). Finish this once AwardWallet issues
 * API credentials: their docs give the exact authorize URL and scopes.
 *
 * The callback route will:
 *   1. exchange the code for a token (server-side, with AWARDWALLET_CLIENT_SECRET)
 *   2. create a wallet_connections row and store the token in
 *      private.wallet_connection_tokens using the service role
 *   3. run the first balance sync and redirect to /wallet
 *
 * Before going live: add a random `state` value (saved in an httpOnly cookie
 * and checked in the callback) so the sign-in can't be forged.
 */
export async function GET() {
  if (!process.env.AWARDWALLET_CLIENT_ID || !process.env.AWARDWALLET_AUTHORIZE_URL) {
    return NextResponse.json(
      { error: "AwardWallet isn't set up for this app yet. Add AWARDWALLET_CLIENT_ID and AWARDWALLET_AUTHORIZE_URL." },
      { status: 501 },
    );
  }
  const url = new URL(process.env.AWARDWALLET_AUTHORIZE_URL);
  url.searchParams.set("client_id", process.env.AWARDWALLET_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/api/wallet/awardwallet/callback`);
  return NextResponse.redirect(url);
}
