"use client";

import { Check, Copy, Mail, MessageSquare, Share2, Users } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { createInvite, type GroupState } from "@/features/group/actions";

import { setTravelers } from "./actions";
import { partnersOnBooking, type Travelers } from "./travelers";

/**
 * Shown after reading or saving a booking with more than one person on it:
 * asks whether they're coming along and makes it one tap to invite them.
 */
export function TravelPartners({
  tripId,
  people,
  members,
  partySize,
}: {
  tripId: string;
  people?: Travelers;
  /** Display names of people already on the trip (including you) */
  members: string[];
  partySize: number | null;
}) {
  const { others, extra, count } = partnersOnBooking(people, members);
  const [invite, makeInvite, making] = useActionState<GroupState, FormData>(createInvite.bind(null, tripId), {});
  const [copied, setCopied] = useState(false);
  const [sized, setSized] = useState(false);
  const missing = others.length + extra;
  if (count < 2 || missing < 1) return null;

  const url = invite.link ? `${typeof window === "undefined" ? "" : window.location.origin}${invite.link}` : null;
  const message = url ? `I added our booking to WRLD so we can plan the trip together. Join here: ${url}` : "";
  const who =
    others.length > 0
      ? `${others.slice(0, -1).join(", ")}${others.length > 1 ? " and " : ""}${others.at(-1)}${extra > 0 ? ` and ${extra} more` : ""}`
      : `${extra} other ${extra === 1 ? "person" : "people"}`;
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <section aria-labelledby="partners-h" className="grid gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <h3 id="partners-h" className="flex items-center gap-2 font-semibold">
        <Users className="size-4" aria-hidden="true" />
        {count} people are on this booking. Traveling with {who}?
      </h3>
      <p className="text-sm text-muted-foreground">
        Invite them to the trip so they see the plan, get the same day-by-day itinerary and can add their own bookings. They aren&rsquo;t
        added or contacted unless you send the link.
      </p>

      {url ? (
        <div className="grid gap-2">
          <p className="rounded-md border bg-background px-3 py-2 font-mono text-xs break-all">{url}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(url);
                  setCopied(true);
                } catch {}
              }}
            >
              {copied ? <Check className="size-4" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
              {copied ? "Copied" : "Copy link"}
            </Button>
            {canShare && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  navigator
                    .share({
                      title: "Join my trip on WRLD",
                      text: message,
                      url,
                    })
                    .catch(() => {})
                }
              >
                <Share2 className="size-4" aria-hidden="true" /> Share
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <a href={`sms:?&body=${encodeURIComponent(message)}`}>
                <MessageSquare className="size-4" aria-hidden="true" /> Text
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:?subject=${encodeURIComponent("Join my trip on WRLD")}&body=${encodeURIComponent(message)}`}>
                <Mail className="size-4" aria-hidden="true" /> Email
              </a>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Anyone with this link can join as an editor. You can turn it off on the Group tab.
          </p>
        </div>
      ) : (
        <form action={makeInvite} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="role" value="editor" />
          <Button type="submit" size="sm" disabled={making}>
            {making ? "Making a link…" : "Invite travel partners"}
          </Button>
          {invite.error && (
            <p role="alert" className="text-sm text-destructive">
              {invite.error}
            </p>
          )}
        </form>
      )}

      {(partySize ?? 1) < count && !sized && (
        <form
          action={async () => {
            await setTravelers(tripId, count);
            setSized(true);
          }}
          className="flex flex-wrap items-center gap-2 border-t pt-3 text-sm"
        >
          <span className="text-muted-foreground">
            The trip is set for {partySize ?? 1} {partySize === 1 || !partySize ? "traveler" : "travelers"}, so budgets and points math are
            per {partySize ?? 1}.
          </span>
          <Button type="submit" size="sm" variant="outline">
            Set travelers to {count}
          </Button>
        </form>
      )}
      {sized && (
        <p role="status" className="border-t pt-3 text-sm">
          Travelers set to {count}.
        </p>
      )}
    </section>
  );
}
