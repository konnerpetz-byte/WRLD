import { redirect } from "next/navigation";

/** Group fit now lives on the Group tab. */
export default async function FitPage({ params }: PageProps<"/trips/[tripId]/fit">) {
  const { tripId } = await params;
  redirect(`/trips/${tripId}/group#fit-h`);
}
