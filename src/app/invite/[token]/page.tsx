import Link from "next/link";
import { Suspense } from "react";

import { WrldMark } from "@/components/brand/wrld-mark";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/features/group/actions";
import { formatDateRange } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "You're invited" };

export default function InvitePage(props: PageProps<"/invite/[token]">) {
  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center">
        <WrldMark className="mx-auto size-14" variant="tile" detail="full" />
        <Suspense
          fallback={
            <div
              className="mx-auto mt-6 h-32 w-64 animate-pulse rounded-lg bg-muted"
              aria-hidden="true"
            />
          }
        >
          <InviteCard {...props} />
        </Suspense>
      </div>
    </main>
  );
}

async function InviteCard({
  params,
  searchParams,
}: PageProps<"/invite/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();
  const valid = /^[0-9a-f-]{36}$/i.test(token);
  const [{ data: preview }, { data: claims }] = await Promise.all([
    valid
      ? supabase.rpc("invite_preview", { p_token: token })
      : Promise.resolve({ data: null }),
    supabase.auth.getClaims(),
  ]);
  const invite = Array.isArray(preview) ? preview[0] : null;
  const signedIn = Boolean(claims?.claims?.sub);
  const here = `/invite/${token}`;

  return (
    <>
      {!invite || !invite.valid ? (
        <>
          <h1 className="mt-6 text-2xl font-semibold">
            This invite link has expired
          </h1>
          <p className="mt-2 text-muted-foreground">
            Ask whoever sent it for a new one.
          </p>
          <Button asChild variant="outline" className="mt-6">
            <Link href="/trips">Go to your trips</Link>
          </Button>
        </>
      ) : (
        <>
          <p className="mt-6 text-sm text-muted-foreground">
            {invite.invited_by} invited you to plan
          </p>
          <h1 className="mt-1 text-3xl font-semibold">{invite.trip_title}</h1>
          <p className="mt-2 text-muted-foreground">
            {[
              invite.destination,
              formatDateRange(invite.start_date, invite.end_date),
            ]
              .filter(Boolean)
              .join(", ")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            You&rsquo;ll be able to{" "}
            {invite.role === "viewer"
              ? "see the plan and chat"
              : "add to the plan and chat"}
            .
          </p>
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              That didn&rsquo;t work. The link may have just expired.
            </p>
          )}
          {signedIn ? (
            <form action={acceptInvite.bind(null, token)} className="mt-6">
              <Button type="submit" size="lg" className="w-full">
                Join the trip
              </Button>
            </form>
          ) : (
            <div className="mt-6 grid gap-2">
              <Button asChild size="lg">
                <Link href={`/signup?next=${encodeURIComponent(here)}`}>
                  Create a free account to join
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href={`/login?next=${encodeURIComponent(here)}`}>
                  I already have an account
                </Link>
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}
