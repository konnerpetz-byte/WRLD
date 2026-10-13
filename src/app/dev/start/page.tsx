import { notFound } from "next/navigation";

import { StepList } from "@/features/onboarding/step-list";

/** Development-only: the guided steps with sample progress, for design and accessibility review. 404 in production. */
export default function StartPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto grid max-w-3xl gap-8 p-8">
      <StepList
        id="get-started"
        title="Get started"
        intro="Four steps from “where should we go?” to knowing exactly how to pay for the flights."
        steps={[
          { key: "type", title: "Find your travel type", body: "Ten quick questions.", done: true, href: "/profile", cta: "Take the quiz" },
          { key: "points", title: "Add your points and home airport", body: "Your card and airline balances, so WRLD can tell you which ones pay for a flight. Two minutes, no logins.", done: false, href: "/points/wallet", cta: "Add your points", secondary: { href: "/account", label: "Set home airport" } },
          { key: "trip", title: "Start a trip", body: "Where and when. Invite friends now or later; WRLD sets up the days for you.", done: false, href: "/trips/new", cta: "Plan a trip" },
          { key: "flights", title: "Points or cash for the flights", body: "See the cheapest way to get there.", done: false, href: "/points", cta: "Compare points and cash" },
        ]}
      />
    </main>
  );
}
