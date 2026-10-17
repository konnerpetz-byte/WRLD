import { notFound } from "next/navigation";

import { ReviewPreview } from "./review-preview";

/** Development-only: the import review screen with sample bookings. Returns 404 in production. */
export default function ImportPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="mx-auto max-w-3xl p-4">
      <ReviewPreview />
    </main>
  );
}
