import { LogOut } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { signOut } from "@/features/auth/actions";
import {
  AvatarUpload,
  DeleteAccountForm,
  DetailsForm,
  EmailForm,
  PasswordForm,
  ProfileForm,
} from "@/features/account/account-forms";
import { requireUserId } from "@/lib/supabase/server";
import type { AccountDetails } from "@/types/database";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const { supabase, userId } = await requireUserId();
  const [{ data: user }, { data: profile }, { data: details }, { data: countries }, { data: currencies }, { data: owned }] =
    await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("account_details").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("countries").select("code, name, currency_code").order("name"),
      supabase.from("currencies").select("*").order("code"),
      supabase.from("trips").select("id, title").eq("owner_id", userId),
    ]);
  const ownedIds = (owned ?? []).map((t) => t.id);
  const { data: others } = ownedIds.length
    ? await supabase.from("trip_members").select("trip_id").in("trip_id", ownedIds).neq("user_id", userId)
    : { data: [] };
  const shared = new Set((others ?? []).map((m) => m.trip_id));
  const ownedSharedTrips = (owned ?? []).filter((t) => shared.has(t.id)).map((t) => t.title);
  const name = profile?.display_name ?? "";

  return (
    <div className="mx-auto grid max-w-3xl gap-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-semibold">Account</h1>
          <p className="mt-1 text-muted-foreground">Your details, sign-in and privacy.</p>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="outline">
            <LogOut aria-hidden="true" /> Sign out
          </Button>
        </form>
      </header>

      <Section id="profile" title="Profile" note="Your name and photo are shown to people on your trips.">
        <AvatarUpload userId={userId} name={name} url={profile?.avatar_url ?? null} />
        <ProfileForm
          profile={{
            display_name: profile?.display_name ?? null,
            home_country: profile?.home_country ?? null,
            home_currency: profile?.home_currency ?? "USD",
            home_airport: profile?.home_airport ?? null,
          }}
          countries={countries ?? []}
          currencies={currencies ?? []}
        />
      </Section>

      <Section id="contact" title="Contact and address" note="Private to you. Used to fill in bookings later.">
        <EmailForm email={user.user?.email ?? ""} />
        <DetailsForm details={(details as AccountDetails | null) ?? null} countries={countries ?? []} />
      </Section>

      <Section id="security" title="Password">
        <PasswordForm />
      </Section>

      <Section id="privacy" title="Privacy and your data">
        <p className="text-sm text-muted-foreground">
          Read how WRLD uses your information in the{" "}
          <Link href="/privacy" className="font-medium text-primary underline underline-offset-2">
            privacy policy
          </Link>
          .
        </p>
        <DeleteAccountForm ownedSharedTrips={ownedSharedTrips} />
      </Section>
    </div>
  );
}

function Section({ id, title, note, children }: { id: string; title: string; note?: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={`${id}-h`} className="grid gap-5 rounded-xl border bg-card p-6">
      <div>
        <h2 id={`${id}-h`} className="text-xl font-semibold">
          {title}
        </h2>
        {note && <p className="text-sm text-muted-foreground">{note}</p>}
      </div>
      {children}
    </section>
  );
}
