import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/layout/page-skeleton";
import { ForgotPasswordForm } from "@/features/auth/reset-forms";

export const metadata = { title: "Reset your password" };

export default function ForgotPasswordPage(props: PageProps<"/forgot-password">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content {...props} />
    </Suspense>
  );
}

async function Content({ searchParams }: PageProps<"/forgot-password">) {
  const { confirm } = await searchParams;
  const resend = confirm === "1";
  return (
    <>
      <h1 className="text-3xl font-semibold">{resend ? "Confirm your email" : "Forgot your password?"}</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        {resend
          ? "Enter the email you signed up with and we'll send a new confirmation link."
          : "Enter the email you signed up with. We'll send a link to set a new password."}
      </p>
      <ForgotPasswordForm resend={resend} />
      <p className="mt-6 text-sm text-muted-foreground">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-4">
          Back to sign in
        </Link>
      </p>
    </>
  );
}
