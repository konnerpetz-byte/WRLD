import { PointsTabs } from "./points-tabs";

/** Points explorer: find award flights and manage the balances that pay for them. */
export default function PointsLayout({ children }: LayoutProps<"/points">) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="text-4xl font-semibold">Points explorer</h1>
      </header>
      <PointsTabs />
      {children}
    </div>
  );
}
