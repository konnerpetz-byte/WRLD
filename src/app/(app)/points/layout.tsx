import { PointsTabs } from "./points-tabs";

/** Points or cash: the cheapest way to pay for a flight, and the balances that pay for it. */
export default function PointsLayout({ children }: LayoutProps<"/points">) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="text-4xl font-semibold">Points or cash</h1>
      </header>
      <PointsTabs />
      {children}
    </div>
  );
}
