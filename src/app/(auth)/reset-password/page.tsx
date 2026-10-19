import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { NewPasswordForm } from "@/features/auth/reset-forms";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Set a new password" };

/** Where the reset email's link lands, already signed in for this one step. */
export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    return (
      <>
        <h1 className="text-3xl font-semibold">This link has expired</h1>
        <p className="mt-2 mb-8 text-muted-foreground">
          Reset links work once and last an hour. If you opened it on a different phone or browser than the one you asked from, try asking again
          from the same one.
        </p>
        <Link href="/forgot-password" className="font-medium text-primary underline underline-offset-4">
          Send a new reset link
        </Link>
      </>
    );
  }
  return (
    <>
      <h1 className="text-3xl font-semibold">Set a new password</h1>
      <p className="mt-2 mb-8 text-muted-foreground">For {data.user.email}. You&rsquo;ll stay signed in after saving.</p>
      <NewPasswordForm />
    </>
  );
}
