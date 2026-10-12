import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const { next } = await searchParams;
  const joining = typeof next === "string" && next.startsWith("/invite/");
  return (
    <>
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        {joining
          ? "Create a free account to join the trip you were invited to."
          : "Next you\u2019ll take a 10-question quiz to find your travel type."}
      </p>
      <AuthForm mode="signup" next={typeof next === "string" ? next : undefined} />
    </>
  );
}
