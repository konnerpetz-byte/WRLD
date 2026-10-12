"use client";

import { SendHorizontal, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { SpotPreview } from "@/features/spots/spot-card";
import { createClient } from "@/lib/supabase/client";
import type { SavedSpot, TripMessage } from "@/types/database";
import { deleteMessage, markChatRead, sendMessage } from "./actions";

export type ChatMessage = TripMessage & { spot: SavedSpot | null };
type Person = { name: string; avatar_url: string | null };

/**
 * Live group chat for a trip. New messages arrive through Supabase Realtime,
 * which only delivers rows the viewer is allowed to read (trip members).
 */
export function Chat({
  tripId,
  me,
  people,
  initial,
}: {
  tripId: string;
  me: string;
  people: Record<string, Person>;
  initial: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(() =>
    [...initial].sort((a, b) => a.created_at.localeCompare(b.created_at)),
  );
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSending] = useTransition();
  const [live, setLive] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const [supabase] = useState(() => createClient());

  const merge = useCallback((incoming: ChatMessage[]) => {
    setMessages((current) => {
      const byId = new Map(current.map((m) => [m.id, m]));
      for (const m of incoming) byId.set(m.id, m);
      return [...byId.values()].sort((a, b) => a.created_at.localeCompare(b.created_at));
    });
  }, []);

  const withSpot = useCallback(
    async (row: TripMessage): Promise<ChatMessage> => {
      if (!row.spot_id) return { ...row, spot: null };
      const { data } = await supabase.from("saved_spots").select("*").eq("id", row.spot_id).maybeSingle();
      return { ...row, spot: (data as SavedSpot | null) ?? null };
    },
    [supabase],
  );

  // Live updates
  useEffect(() => {
    const channel = supabase
      .channel(`trip-chat:${tripId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "trip_messages", filter: `trip_id=eq.${tripId}` },
        async (payload) => {
          merge([await withSpot(payload.new as TripMessage)]);
          markChatRead(tripId);
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    markChatRead(tripId);
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, tripId, merge, withSpot]);

  // Keep the newest message in view.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function catchUp() {
    const since = messages.at(-1)?.created_at ?? "1970-01-01";
    const { data } = await supabase
      .from("trip_messages")
      .select("*")
      .eq("trip_id", tripId)
      .gt("created_at", since)
      .order("created_at")
      .limit(50);
    merge(await Promise.all(((data ?? []) as TripMessage[]).map(withSpot)));
  }

  function send() {
    const text = draft.trim();
    if (!text) return;
    setError(null);
    startSending(async () => {
      const result = await sendMessage(tripId, text);
      if (result.error) {
        setError(result.error);
        return;
      }
      setDraft("");
      await catchUp(); // in case the live connection is down
    });
  }

  const dayLabel = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  return (
    <section aria-labelledby="chat-h" className="flex h-[min(70dvh,44rem)] flex-col overflow-hidden rounded-xl border bg-card">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <h2 id="chat-h" className="text-lg font-semibold">
          Group chat
        </h2>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
          <span className={`size-2 rounded-full ${live ? "bg-primary" : "bg-muted-foreground/40"}`} aria-hidden="true" />
          {live ? "Live" : "Connecting…"}
        </span>
      </header>

      <ol className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite" aria-label="Messages">
        {messages.length === 0 && (
          <li className="mx-auto max-w-sm py-10 text-center text-sm text-muted-foreground">
            Say hi, share a TikTok or reel of a place you want to go, or ask who&rsquo;s booking the hotel.
          </li>
        )}
        {messages.map((m, index) => {
          const mine = m.user_id === me;
          const person = m.user_id ? people[m.user_id] : undefined;
          const name = person?.name ?? (m.user_id ? "Traveler" : "Former member");
          const day = dayLabel(m.created_at);
          const showDay = index === 0 || day !== dayLabel(messages[index - 1].created_at);
          return (
            <li key={m.id}>
              {showDay && <p className="my-2 text-center text-xs text-muted-foreground">{day}</p>}
              <div className={`group flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
                {!mine && <Avatar name={name} url={person?.avatar_url} size={28} />}
                <div className={`grid min-w-0 max-w-[80%] gap-1 ${mine ? "justify-items-end" : ""}`}>
                  {!mine && <span className="text-xs text-muted-foreground">{name}</span>}
                  <p
                    className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap [overflow-wrap:anywhere] ${
                      mine ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-bl-sm bg-muted"
                    }`}
                  >
                    <Linkified text={m.body} />
                  </p>
                  {m.spot && (
                    <div className="w-72 max-w-full">
                      <SpotPreview spot={m.spot} compact />
                      <Link href={`/trips/${tripId}/saved#spot-${m.spot.id}`} className="mt-1 inline-block text-xs text-primary underline underline-offset-2">
                        Saved to this trip — add it to a day
                      </Link>
                    </div>
                  )}
                  <span className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    {new Date(m.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    {mine && (
                      <button
                        type="button"
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                        aria-label="Delete message"
                        onClick={async () => {
                          await deleteMessage(m.id);
                          setMessages((all) => all.filter((x) => x.id !== m.id));
                        }}
                      >
                        <Trash2 className="size-3" aria-hidden="true" />
                      </button>
                    )}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
        <div ref={bottom} />
      </ol>

      <form
        className="flex items-end gap-2 border-t p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          Message
        </label>
        <textarea
          id="chat-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Message, or paste a TikTok or reel link"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring"
        />
        <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Send">
          <SendHorizontal aria-hidden="true" />
        </Button>
      </form>
      {error && (
        <p role="alert" className="px-4 pb-3 text-xs text-destructive">
          {error}
        </p>
      )}
    </section>
  );
}

function Linkified({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s<>"']+)/g);
  return (
    <>
      {parts.map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
            {part}
          </a>
        ) : (
          part
        ),
      )}
    </>
  );
}
