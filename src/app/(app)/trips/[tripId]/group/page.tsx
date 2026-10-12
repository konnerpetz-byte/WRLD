import { Chat, type ChatMessage } from "@/features/group/chat";
import { MembersPanel } from "@/features/group/members-panel";
import { getMembers } from "@/features/group/queries";
import { getTrip } from "@/features/trips/queries";
import { requireUserId } from "@/lib/supabase/server";
import type { SavedSpot, TripInvite, TripMessage } from "@/types/database";

export const metadata = { title: "Group" };

export default async function GroupPage({ params }: PageProps<"/trips/[tripId]/group">) {
  const { tripId } = await params;
  const { supabase } = await requireUserId();
  const [{ trip, role }, { members, me }, { data: rows }, { data: invites }] = await Promise.all([
    getTrip(tripId),
    getMembers(tripId),
    supabase.from("trip_messages").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }).limit(150),
    supabase.from("trip_invites").select("*").eq("trip_id", tripId).order("created_at", { ascending: false }),
  ]);

  const messages = ((rows ?? []) as TripMessage[]).reverse();
  const spotIds = messages.map((m) => m.spot_id).filter((id): id is string => Boolean(id));
  const { data: spots } = spotIds.length ? await supabase.from("saved_spots").select("*").in("id", spotIds) : { data: [] };
  const spotById = new Map(((spots ?? []) as SavedSpot[]).map((s) => [s.id, s]));
  const initial: ChatMessage[] = messages.map((m) => ({ ...m, spot: m.spot_id ? (spotById.get(m.spot_id) ?? null) : null }));
  const people = Object.fromEntries(members.map((m) => [m.user_id, { name: m.name, avatar_url: m.avatar_url }]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      <Chat tripId={tripId} me={me} people={people} initial={initial} />
      <MembersPanel
        tripId={tripId}
        tripTitle={trip.title}
        me={me}
        myRole={role}
        members={members}
        invites={(invites ?? []) as TripInvite[]}
      />
    </div>
  );
}
