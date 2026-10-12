import { Camera, ExternalLink, Link2, MapPin, Music2, PlaySquare, StickyNote } from "lucide-react";

import { cn } from "@/lib/utils";
import type { SavedSpot, SpotSource } from "@/types/database";

export const SOURCE_LABEL: Record<SpotSource, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  youtube: "YouTube",
  maps: "Map pin",
  link: "Link",
  note: "Note",
};

const ICONS = { tiktok: Music2, instagram: Camera, youtube: PlaySquare, maps: MapPin, link: Link2, note: StickyNote } as const;

export function SourceIcon({ source, className }: { source: SpotSource; className?: string }) {
  const props = { className: cn("size-3.5", className), "aria-hidden": true } as const;
  switch (source) {
    case "tiktok":
      return <ICONS.tiktok {...props} />;
    case "instagram":
      return <ICONS.instagram {...props} />;
    case "youtube":
      return <ICONS.youtube {...props} />;
    case "maps":
      return <ICONS.maps {...props} />;
    case "note":
      return <ICONS.note {...props} />;
    default:
      return <ICONS.link {...props} />;
  }
}

/** Compact preview of a shared reel/TikTok/link (used in chat and lists). */
export function SpotPreview({ spot, compact = false }: { spot: SavedSpot; compact?: boolean }) {
  const host = spot.url ? safeHost(spot.url) : null;
  return (
    <div className={cn("flex gap-3 overflow-hidden rounded-lg border bg-card text-card-foreground", compact ? "p-2" : "p-3")}>
      {spot.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- previews come from many sites at unknown sizes
        <img
          src={spot.thumbnail_url}
          alt=""
          referrerPolicy="no-referrer"
          className={cn("shrink-0 rounded-md bg-muted object-cover", compact ? "h-16 w-12" : "h-24 w-[4.5rem]")}
        />
      ) : (
        <span className={cn("grid shrink-0 place-items-center rounded-md bg-open-soft text-primary", compact ? "h-16 w-12" : "h-24 w-[4.5rem]")}>
          <SourceIcon source={spot.source} className="size-5" />
        </span>
      )}
      <div className="grid min-w-0 content-start gap-1 text-sm">
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <SourceIcon source={spot.source} /> {SOURCE_LABEL[spot.source]}
          {spot.author && spot.author.toLowerCase() !== SOURCE_LABEL[spot.source].toLowerCase() ? ` · ${spot.author}` : ""}
        </span>
        <span className="line-clamp-2 font-medium">{spot.title ?? spot.note ?? spot.place_name ?? host ?? "Saved spot"}</span>
        {spot.place_name && (
          <span className="flex items-center gap-1 text-xs text-primary">
            <MapPin className="size-3" aria-hidden="true" /> {spot.place_name}
          </span>
        )}
        {spot.url && (
          <a
            href={spot.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground underline underline-offset-2"
          >
            Open on {host ?? "the web"} <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        )}
      </div>
    </div>
  );
}

function safeHost(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
