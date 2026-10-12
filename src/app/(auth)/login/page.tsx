import { Suspense } from "react";
import { PageSkeleton } from "@/components/layout/page-skeleton";
import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Sign in" };

export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LoginPageContent {...props} />
    </Suspense>
  );
}

async function LoginPageContent({ searchParams }: PageProps<"/login">) {
  const { next, error, deleted } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Sign in to pick up your trips where you left them.
      </p>
      {deleted === "1" && (
        <p role="status" className="mb-6 rounded-md bg-open-soft p-3 text-sm">
          Your account and its data were deleted. Thanks for traveling with
          WRLD.
        </p>
      )}
      {error === "link" && (
        <p role="alert" className="mb-6 text-sm text-destructive">
          Your email is confirmed if you used the link from your inbox. Sign in
          below to continue.
        </p>
      )}
      <AuthForm
        mode="login"
        next={typeof next === "string" ? next : undefined}
      />
    </>
  );
}
