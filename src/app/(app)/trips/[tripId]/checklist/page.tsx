import { ChecklistCard } from "@/features/checklist/checklist";
import { getMembers } from "@/features/group/queries";
import { requireUserId } from "@/lib/supabase/server";
import type { ChecklistItem } from "@/types/database";

export const metadata = { title: "Checklist" };

export default async function ChecklistPage({ params }: PageProps<"/trips/[tripId]/checklist">) {
  const { tripId } = await params;
  const { supabase } = await requireUserId();
  const [{ members }, { data }] = await Promise.all([
    getMembers(tripId),
    supabase.from("checklist_items").select("*").eq("trip_id", tripId).order("position"),
  ]);
  const items = (data ?? []) as ChecklistItem[];
  const people = members.map((m) => ({ user_id: m.user_id, name: m.name, avatar_url: m.avatar_url }));

  return (
    <div className="grid gap-6 lg:grid-cols-2 lg:items-start">
      <ChecklistCard
        tripId={tripId}
        list="todo"
        title="To-do before you go"
        hint="Bookings to make, tickets to buy, who's doing what."
        items={items.filter((i) => i.list === "todo")}
        people={people}
      />
      <ChecklistCard
        tripId={tripId}
        list="packing"
        title="Packing list"
        hint="Shared with everyone on the trip. Tick things off as you pack."
        items={items.filter((i) => i.list === "packing")}
        people={people}
      />
    </div>
  );
}
