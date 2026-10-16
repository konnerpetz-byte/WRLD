"use client";

import { FileUp, Paperclip, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type BookingOption = { id: string; type: "transit" | "lodging" | "item"; label: string };
export type FileRow = { id: string; name: string; path: string; size: number; bookingId: string | null };

const ACCEPT = "application/pdf,image/jpeg,image/png,image/webp,image/heic,.pkpass,text/plain,.eml";
const MAX = 15 * 1024 * 1024;
const kb = (n: number) => (n > 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1000))} KB`);
const safeName = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9.\-_ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 100) || "file";

/**
 * Tickets, boarding passes and confirmations, kept with the trip and attached
 * to the booking they belong to. Stored privately: only people on the trip can open them.
 */
export function TripFiles({ tripId, canEdit, bookings, files }: { tripId: string; canEdit: boolean; bookings: BookingOption[]; files: FileRow[] }) {
  const id = useId();
  const router = useRouter();
  const [attachTo, setAttachTo] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const label = (bookingId: string | null) => bookings.find((b) => b.id === bookingId)?.label ?? "Whole trip";

  const upload = (list: FileList | null) => {
    if (!list?.length) return;
    startTransition(async () => {
      const supabase = createClient();
      const booking = bookings.find((b) => b.id === attachTo);
      let done = 0;
      const problems: string[] = [];
      for (const file of Array.from(list)) {
        if (file.size > MAX) {
          problems.push(`${file.name} is over 15 MB`);
          continue;
        }
        const path = `${tripId}/${crypto.randomUUID()}-${safeName(file.name)}`;
        const { error: upErr } = await supabase.storage.from("trip-files").upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
        if (upErr) {
          problems.push(`${file.name}: ${upErr.message.includes("mime") ? "that file type isn't supported" : "upload failed"}`);
          continue;
        }
        const { error } = await supabase.from("trip_files").insert({
          trip_id: tripId,
          name: file.name.slice(0, 200),
          path,
          size_bytes: file.size,
          mime: (file.type || "application/octet-stream").slice(0, 100),
          booking_type: booking?.type ?? "trip",
          booking_id: booking?.id ?? null,
        });
        if (error) {
          await supabase.storage.from("trip-files").remove([path]);
          problems.push(`${file.name}: couldn't save`);
        } else done++;
      }
      setStatus([done ? `Added ${done} file${done === 1 ? "" : "s"}.` : "", ...problems].filter(Boolean).join(" "));
      router.refresh();
    });
  };

  const open = (f: FileRow) =>
    startTransition(async () => {
      const { data } = await createClient().storage.from("trip-files").createSignedUrl(f.path, 300);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
    });
  const relink = (f: FileRow, bookingId: string) =>
    startTransition(async () => {
      const b = bookings.find((x) => x.id === bookingId);
      await createClient()
        .from("trip_files")
        .update({ booking_id: b?.id ?? null, booking_type: b?.type ?? "trip" })
        .eq("id", f.id);
      router.refresh();
    });
  const remove = (f: FileRow) =>
    startTransition(async () => {
      const supabase = createClient();
      await supabase.storage.from("trip-files").remove([f.path]);
      await supabase.from("trip_files").delete().eq("id", f.id);
      router.refresh();
    });

  return (
    <div className="grid gap-4">
      {canEdit && (
        <div className="grid gap-3 rounded-xl border border-dashed p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label className="grid gap-1.5 text-sm font-medium">
            Attach to
            <select value={attachTo} onChange={(e) => setAttachTo(e.target.value)} className="h-10 rounded-lg border bg-background px-3 font-normal">
              <option value="">Whole trip</option>
              {bookings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <input id={`${id}-file`} type="file" multiple accept={ACCEPT} className="sr-only" onChange={(e) => upload(e.target.files)} disabled={pending} />
            <Button asChild disabled={pending}>
              <label htmlFor={`${id}-file`} className="cursor-pointer">
                <FileUp aria-hidden="true" /> {pending ? "Working…" : "Add tickets or files"}
              </label>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-2">PDF, photos (JPG, PNG, HEIC), Apple Wallet passes or saved emails, up to 15 MB each. Only people on this trip can open them.</p>
        </div>
      )}
      <p aria-live="polite" className="text-sm empty:hidden">
        {status}
      </p>
      {files.length ? (
        <ul className="grid gap-2">
          {files.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 rounded-xl border bg-card px-3 py-2.5 text-sm">
              <Paperclip className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <button type="button" onClick={() => open(f)} className="min-w-[10rem] flex-1 truncate text-left font-medium text-primary underline-offset-2 hover:underline">
                {f.name}
              </button>
              <span className="text-xs text-muted-foreground">{kb(f.size)}</span>
              {canEdit ? (
                <select
                  aria-label={`What ${f.name} belongs to`}
                  value={f.bookingId ?? ""}
                  onChange={(e) => relink(f, e.target.value)}
                  className="h-9 min-w-0 flex-1 rounded-lg border bg-background px-2 text-xs sm:max-w-56 sm:flex-none"
                >
                  <option value="">Whole trip</option>
                  {bookings.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.label}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="text-xs text-muted-foreground">{label(f.bookingId)}</span>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(f)}
                  aria-label={`Delete ${f.name}`}
                  className="grid size-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive focus-visible:outline-2 focus-visible:outline-ring"
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">No tickets yet. Add boarding passes, hotel confirmations and tickets so they travel with the trip and the export.</p>
      )}
    </div>
  );
}
