import { PointsTabs } from "./points-tabs";

/** Plan with points: where your cash and points can take you, and the balances behind it. */
export default function PointsLayout({ children }: LayoutProps<"/points">) {
  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <header>
        <h1 className="text-4xl font-semibold">Plan with points</h1>
      </header>
      <PointsTabs />
      {children}
    </div>
  );
}
