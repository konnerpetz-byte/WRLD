import { SaveSpotForm } from "@/features/spots/spot-forms";
import { firstUrl } from "@/features/spots/unfurl";
import { requireUserId } from "@/lib/supabase/server";

export const metadata = { title: "Save to WRLD" };

/**
 * Where things shared INTO WRLD land:
 *  - Android/Chrome installed app: the web manifest's share_target
 *  - Android app: the "Share → WRLD" intent (see android/…/MainActivity.java)
 *  - iOS app: the share extension opens wrld://share?… (see docs/MOBILE.md)
 * Shared text often contains the link plus a caption, so we pull the link out.
 */
export default async function SharePage({ searchParams }: PageProps<"/share">) {
  const sp = await searchParams;
  const pick = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).slice(0, 2000) : "");
  const text = [pick("url"), pick("text"), pick("title")].filter(Boolean).join(" ");
  const url = firstUrl(text) ?? "";
  const caption = text.replace(url, "").replace(/\s+/g, " ").trim().slice(0, 1000);

  const { supabase } = await requireUserId();
  const { data: trips } = await supabase.from("trips").select("id, title, end_date").order("start_date");
  const today = new Date().toISOString().slice(0, 10);
  const options = (trips ?? []).filter((t) => t.end_date >= today).map((t) => ({ id: t.id, title: t.title }));

  return (
    <div className="mx-auto grid max-w-xl gap-6">
      <header>
        <h1 className="text-3xl font-semibold">Save to WRLD</h1>
        <p className="mt-1 text-muted-foreground">Pick a trip and we&rsquo;ll pull in the preview and look for the place.</p>
      </header>
      <SaveSpotForm trips={options} initialUrl={url} initialNote={caption} redirectAfter />
    </div>
  );
}
