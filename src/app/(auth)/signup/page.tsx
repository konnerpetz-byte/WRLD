import { AuthForm } from "@/features/auth/auth-form";

export const metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 mb-8 text-muted-foreground">
        Next you&rsquo;ll take a 10-question quiz to find your travel type.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
