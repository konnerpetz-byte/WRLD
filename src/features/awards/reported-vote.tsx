"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

import { voteAwardSeat } from "./actions";

/** "Still there?" on a traveler-reported seat: keeps good reports fresh and takes stale ones down. */
export function ReportedVote({ id }: { id: number }) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (note) {
    return (
      <p role="status" className="text-xs text-primary">
        {note}
      </p>
    );
  }
  const vote = (still: boolean) =>
    start(async () => {
      const r = await voteAwardSeat(id, still);
      setNote(r.note ?? r.error ?? null);
    });
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">Checked it?</span>
      <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => vote(true)}>
        Still there
      </Button>
      <Button type="button" size="xs" variant="outline" disabled={pending} onClick={() => vote(false)}>
        Gone
      </Button>
    </div>
  );
}
