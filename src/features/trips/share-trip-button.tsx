"use client";

import { Share2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { shareLink } from "@/lib/native";

const NOTE = { copied: "Link copied", unavailable: "Couldn't share. Try again." } as const;

export function ShareTripButton({ tripId, title, dates }: { tripId: string; title: string; dates: string }) {
  const [note, setNote] = useState<string | null>(null);

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={async () => {
          const result = await shareLink({
            title,
            text: `${title}, ${dates}. Planned with WRLD.`,
            url: `${window.location.origin}/trips/${tripId}/itinerary`,
          });
          setNote(result === "copied" || result === "unavailable" ? NOTE[result] : null);
          if (result === "copied") setTimeout(() => setNote(null), 2500);
        }}
      >
        <Share2 aria-hidden="true" /> Share
      </Button>
      <span role="status" className="text-xs text-muted-foreground">
        {note}
      </span>
    </span>
  );
}
