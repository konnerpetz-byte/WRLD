import "server-only";

import { cache } from "react";

import { requireUserId } from "@/lib/supabase/server";
import type { TripRole } from "@/types/database";

export type Member = {
  user_id: string;
  role: TripRole;
  last_read_at: string | null;
  name: string;
  avatar_url: string | null;
};

/** Everyone on a trip with their name and photo. Cached per request. */
export const getMembers = cache(async (tripId: string) => {
  const { supabase, userId } = await requireUserId();
  const { data: rows } = await supabase.from("trip_members").select("user_id, role, last_read_at, created_at").eq("trip_id", tripId).order("created_at");
  const ids = (rows ?? []).map((r) => r.user_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name, avatar_url").in("id", ids)
    : { data: [] };
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
  const order: Record<TripRole, number> = { owner: 0, editor: 1, viewer: 2 };
  const members: Member[] = (rows ?? [])
    .map((r) => ({
      user_id: r.user_id,
      role: r.role,
      last_read_at: r.last_read_at,
      name: byId.get(r.user_id)?.display_name?.trim() || "Traveler",
      avatar_url: byId.get(r.user_id)?.avatar_url ?? null,
    }))
    .sort((a, b) => order[a.role] - order[b.role]);
  return { members, me: userId };
});
