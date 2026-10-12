import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 mb-8 text-muted-foreground">Sign in to pick up your trips where you left them.</p>
      {error === "link" && (
        <p role="alert" className="mb-6 text-sm text-destructive">
          That sign-in link expired or was already used. Sign in below.
        </p>
      )}
      <AuthForm mode="login" next={typeof next === "string" ? next : undefined} />
    </>
  );
}
