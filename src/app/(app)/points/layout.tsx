/** Explore and Wallet share a width; each page has its own heading. */
export default function PointsLayout({ children }: LayoutProps<"/points">) {
  return <div className="mx-auto grid max-w-5xl gap-6">{children}</div>;
}
