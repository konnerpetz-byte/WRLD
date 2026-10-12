// Deletes the signed-in user's WRLD account (App Store 5.1.1(v), Google Play
// account deletion policy).
//
// Called by the app's server with the user's own access token:
//   POST /functions/v1/delete-account   Authorization: Bearer <user access token>
//   body: { "confirm": "DELETE" }
//
// The token is checked with Supabase Auth, then only THAT user is deleted.
// Deleting the auth user cascades to their profile, private details, trips
// they own (with everything planned on them), memberships, votes and saved
// spots. Messages and expenses they added to other people's trips stay, with
// the author shown as "Former member". Their profile photos are removed too.
//
// Deployed with verify_jwt = false because the project uses the new API
// keys; the user check below is the authorization.
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Use POST" });

  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json(401, { error: "Sign in again, then try deleting your account." });

  let body: { confirm?: string } = {};
  try {
    body = await req.json();
  } catch {
    // handled below
  }
  if (body.confirm !== "DELETE") return json(400, { error: "Type DELETE to confirm." });

  const url = Deno.env.get("SUPABASE_URL")!;
  let secret: string | undefined;
  try {
    secret = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}").default;
  } catch {
    secret = undefined;
  }
  secret ??= Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret) return json(500, { error: "Account deletion isn't configured." });

  const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: userData, error: userError } = await admin.auth.getUser(token);
  const userId = userData?.user?.id;
  if (userError || !userId) return json(401, { error: "Sign in again, then try deleting your account." });

  // Profile photos (avatars/<user id>/...)
  const { data: files } = await admin.storage.from("avatars").list(userId, { limit: 1000 });
  if (files?.length) {
    await admin.storage.from("avatars").remove(files.map((f) => `${userId}/${f.name}`));
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) {
    console.error("delete-account failed", userId, error.message);
    return json(500, { error: "We couldn't delete your account. Try again, or contact support." });
  }
  return json(200, { deleted: true });
});
