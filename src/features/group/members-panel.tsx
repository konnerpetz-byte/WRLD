"use client";

import { Copy, Link2, LogOut, Share2, UserMinus } from "lucide-react";
import { useActionState, useState } from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { shareLink } from "@/lib/native";
import type { TripInvite, TripRole } from "@/types/database";
import { changeRole, createInvite, removeMember, revokeInvite, type GroupState } from "./actions";

type Member = { user_id: string; role: TripRole; name: string; avatar_url: string | null };

const ROLE_LABEL: Record<TripRole, string> = { owner: "Organizer", editor: "Can edit", viewer: "Can view" };

export function MembersPanel({
  tripId,
  tripTitle,
  me,
  myRole,
  members,
  invites,
}: {
  tripId: string;
  tripTitle: string;
  me: string;
  myRole: TripRole;
  members: Member[];
  invites: TripInvite[];
}) {
  const canEdit = myRole === "owner" || myRole === "editor";
  return (
    <section aria-labelledby="people-h" className="grid content-start gap-5 rounded-xl border bg-card p-5">
      <div>
        <h2 id="people-h" className="text-lg font-semibold">
          Who&rsquo;s going
        </h2>
        <p className="text-sm text-muted-foreground">
          {members.length} {members.length === 1 ? "person" : "people"}
        </p>
      </div>
      <ul className="grid gap-3">
        {members.map((m) => (
          <li key={m.user_id} className="flex items-center gap-3">
            <Avatar name={m.name} url={m.avatar_url} size={36} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">
                {m.name}
                {m.user_id === me && <span className="font-normal text-muted-foreground"> (you)</span>}
              </span>
              {myRole === "owner" && m.role !== "owner" ? (
                <form action={changeRole.bind(null, tripId, m.user_id)}>
                  <Label htmlFor={`role-${m.user_id}`} className="sr-only">
                    {m.name}&rsquo;s access
                  </Label>
                  <select
                    id={`role-${m.user_id}`}
                    name="role"
                    defaultValue={m.role}
                    onChange={(e) => e.currentTarget.form?.requestSubmit()}
                    className="rounded border-0 bg-transparent p-0 text-xs text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <option value="editor">Can edit</option>
                    <option value="viewer">Can view</option>
                  </select>
                </form>
              ) : (
                <span className="text-xs text-muted-foreground">{ROLE_LABEL[m.role]}</span>
              )}
            </span>
            {m.role !== "owner" && (myRole === "owner" || m.user_id === me) && (
              <form action={removeMember.bind(null, tripId, m.user_id)}>
                <Button
                  type="submit"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={m.user_id === me ? "Leave this trip" : `Remove ${m.name}`}
                  title={m.user_id === me ? "Leave this trip" : `Remove ${m.name}`}
                >
                  {m.user_id === me ? <LogOut aria-hidden="true" /> : <UserMinus aria-hidden="true" />}
                </Button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {canEdit && <InviteBox tripId={tripId} tripTitle={tripTitle} invites={invites} />}
    </section>
  );
}

function InviteBox({ tripId, tripTitle, invites }: { tripId: string; tripTitle: string; invites: TripInvite[] }) {
  const [state, action, pending] = useActionState<GroupState, FormData>(createInvite.bind(null, tripId), {});
  const [note, setNote] = useState<string | null>(null);
  const active = invites.filter((i) => !i.revoked_at && new Date(i.expires_at) > new Date());
  const link = state.link ?? (active[0] ? `/invite/${active[0].token}` : null);

  async function share() {
    if (!link) return;
    const url = `${window.location.origin}${link}`;
    const result = await shareLink({ title: `Join ${tripTitle} on WRLD`, text: `Plan ${tripTitle} with me on WRLD.`, url });
    setNote(result === "copied" ? "Link copied." : result === "unavailable" ? url : null);
  }

  return (
    <div className="grid gap-3 border-t pt-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Link2 className="size-4" aria-hidden="true" /> Invite people
      </h3>
      {link ? (
        <div className="grid gap-2">
          <p className="truncate rounded-md bg-muted px-3 py-2 font-mono text-xs" title="Invite link">
            {link}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={share}>
              <Share2 aria-hidden="true" /> Share invite
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(`${window.location.origin}${link}`);
                setNote("Link copied.");
              }}
            >
              <Copy aria-hidden="true" /> Copy
            </Button>
            {active[0] && !state.link && (
              <form action={revokeInvite.bind(null, tripId, active[0].id)}>
                <Button type="submit" size="sm" variant="ghost">
                  Turn off link
                </Button>
              </form>
            )}
          </div>
          {note && (
            <p role="status" className="text-xs text-muted-foreground">
              {note}
            </p>
          )}
          <p className="text-xs text-muted-foreground">Anyone with the link can join for 14 days. They&rsquo;ll need a free WRLD account.</p>
        </div>
      ) : (
        <form action={action} className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <Label htmlFor="invite-role" className="text-xs">
              They can
            </Label>
            <NativeSelect id="invite-role" name="role" defaultValue="editor" className="h-9">
              <option value="editor">Edit the plan</option>
              <option value="viewer">View only</option>
            </NativeSelect>
          </div>
          <Button type="submit" size="sm" className="h-9" disabled={pending}>
            {pending ? "Making link…" : "Make invite link"}
          </Button>
        </form>
      )}
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
