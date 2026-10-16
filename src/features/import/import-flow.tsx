"use client";

import { AlertTriangle, BedDouble, CalendarDays, FileUp, Link2, Mail, Paperclip, Plane, Ticket, Train } from "lucide-react";
import Link from "next/link";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MODE } from "@/features/transit/modes";
import type { TransitMode } from "@/types/database";

import { dismissInbox, type ReadState, readImport, type SaveState, saveImport } from "./actions";
import type { ImportCandidate } from "./parse";
import { TravelPartners } from "./travel-partners";

type Row = ImportCandidate & { include: boolean };

export type InboxRow = {
  id: string;
  subject: string | null;
  from: string | null;
  received: string;
  files: number;
};

/** Import bookings: forwarded emails, or paste / upload / link → review what WRLD found → add to the trip. */
export function ImportFlow({
  tripId,
  timezones,
  inbox = [],
  address = null,
  members = [],
  partySize = null,
}: {
  tripId: string;
  timezones: string[];
  inbox?: InboxRow[];
  /** Names of people already on the trip, to tell who on a booking still needs an invite */
  members?: string[];
  partySize?: number | null;
  /** The traveler's forward-to-import address, once inbound email is set up */
  address?: string | null;
}) {
  const [readState, read, reading] = useActionState<ReadState, FormData>(readImport.bind(null, tripId), {});
  const [rows, setRows] = useState<Row[] | null>(null);
  const [handled, setHandled] = useState(readState);
  if (readState !== handled) {
    setHandled(readState);
    if (readState.candidates) setRows(readState.candidates.map((c) => ({ ...c, include: true })));
  }

  if (rows)
    return (
      <Review
        tripId={tripId}
        rows={rows}
        setRows={setRows}
        timezones={timezones}
        note={readState.note}
        inboxId={readState.inboxId}
        partners={<TravelPartners tripId={tripId} people={readState.people} members={members} partySize={partySize} />}
      />
    );

  return (
    <div className="grid gap-6">
      <section aria-labelledby="inbox-h" className="grid gap-3 rounded-2xl border bg-card p-5">
        <h3 id="inbox-h" className="flex items-center gap-2 text-base font-semibold">
          <Mail className="size-4" aria-hidden="true" /> Forward your confirmations
        </h3>
        {address ? (
          <p className="text-sm text-muted-foreground">
            Forward airline, hotel and ticket emails to <strong className="font-mono text-foreground break-all">{address}</strong>. They
            show up here for you to check. Attached tickets and boarding passes are kept with the trip.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Coming soon: forward confirmation emails to your own WRLD address. For now, paste or upload them below.
          </p>
        )}
        {inbox.length > 0 && (
          <ul className="grid gap-2">
            {inbox.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5 text-sm">
                <span className="min-w-[12rem] flex-1">
                  <span className="block font-medium">{m.subject ?? "(no subject)"}</span>
                  <span className="block text-xs text-muted-foreground">
                    {[m.from, m.received].filter(Boolean).join(" · ")}
                    {m.files > 0 && (
                      <>
                        {" · "}
                        <Paperclip className="inline size-3" aria-hidden="true" /> {m.files} file{m.files === 1 ? "" : "s"}
                      </>
                    )}
                  </span>
                </span>
                <form action={read}>
                  <input type="hidden" name="inbox" value={m.id} />
                  <Button type="submit" size="sm" disabled={reading}>
                    Review
                  </Button>
                </form>
                <form action={dismissInbox.bind(null, m.id)}>
                  <Button type="submit" size="sm" variant="ghost">
                    Dismiss
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form action={read} className="grid gap-6 rounded-2xl border bg-card p-5">
        <div className="grid gap-2">
          <Label htmlFor="imp-text" className="text-base font-semibold">
            Paste a confirmation
          </Label>
          <p id="imp-text-help" className="text-sm text-muted-foreground">
            Copy the whole email from your airline, hotel, Airbnb or ticket site, including the dates and times, and paste it here.
          </p>
          <Textarea
            id="imp-text"
            name="text"
            rows={8}
            aria-describedby="imp-text-help"
            placeholder={"Your flight is confirmed\nUA 958  DTW → LIS\nMon, Nov 2, 2026  6:05 PM – 7:20 AM +1"}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-2">
            <Label htmlFor="imp-file" className="flex items-center gap-2 font-semibold">
              <FileUp className="size-4" aria-hidden="true" /> Or upload a file
            </Label>
            <Input
              id="imp-file"
              name="file"
              type="file"
              accept=".ics,.ical,.pdf,.eml,.html,.htm,.txt,text/calendar,application/pdf,message/rfc822,text/html,text/plain"
              aria-describedby="imp-file-help"
            />
            <p id="imp-file-help" className="text-xs text-muted-foreground">
              A calendar file (.ics) from &ldquo;Add to calendar&rdquo;, a ticket or itinerary PDF, or a saved email (.eml). Up to 5 MB.
            </p>
          </div>
          <div className="grid content-start gap-2">
            <Label htmlFor="imp-url" className="flex items-center gap-2 font-semibold">
              <Link2 className="size-4" aria-hidden="true" /> Or paste a link
            </Label>
            <Input id="imp-url" name="url" type="url" inputMode="url" placeholder="https:// or webcal://" aria-describedby="imp-url-help" />
            <p id="imp-url-help" className="text-xs text-muted-foreground">
              Calendar links (Airbnb, TripIt, your airline&rsquo;s calendar feed) and public event or tour pages work best. Pages behind a
              sign-in can&rsquo;t be read.
            </p>
          </div>
        </div>

        {readState.error && (
          <p role="alert" className="text-sm text-destructive">
            {readState.error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={reading}>
            {reading ? "Reading…" : "Find my bookings"}
          </Button>
          <p className="text-xs text-muted-foreground">Nothing is added until you check it.</p>
        </div>
      </form>
    </div>
  );
}

function Review({
  tripId,
  rows,
  setRows,
  timezones,
  note,
  inboxId,
  partners,
}: {
  tripId: string;
  partners?: React.ReactNode;
  rows: Row[];
  setRows: (r: Row[] | null) => void;
  timezones: string[];
  note?: string;
  /** Set when these came from a forwarded email: saving marks it done and keeps its attachments */
  inboxId?: string;
}) {
  const [saveState, save, saving] = useActionState<SaveState, FormData>(saveImport.bind(null, tripId), {});
  const update = (id: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? ({ ...r, ...patch } as Row) : r)));
  const chosen = rows.filter((r) => r.include);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- strip UI-only fields before sending
  const payload = JSON.stringify(chosen.map(({ include, id, found, warnings, ...rest }) => rest));

  if (saveState.ok) {
    return (
      <div role="status" className="grid gap-4 rounded-2xl border bg-card p-5">
        <p className="text-lg font-semibold">{saveState.note}</p>
        {saveState.failed && saveState.failed.length > 0 && <Failed list={saveState.failed} />}
        {partners}
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={`/trips/${tripId}/itinerary`}>See the itinerary</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/trips/${tripId}/transit`}>Flights &amp; transit</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={`/trips/${tripId}/lodging`}>Stays</Link>
          </Button>
          <Button type="button" variant="ghost" onClick={() => setRows(null)}>
            Import more
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {partners}
      <form action={save} className="grid gap-4">
        {inboxId && <input type="hidden" name="inbox" value={inboxId} />}
        <p role="status" className="text-sm text-muted-foreground">
          {note} Untick anything you don&rsquo;t want.
        </p>
        <ul className="grid gap-3">
          {rows.map((r) => (
            <li key={r.id} className={`grid gap-3 rounded-2xl border bg-card p-4 transition-opacity ${r.include ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2.5 font-semibold">
                  <input
                    type="checkbox"
                    checked={r.include}
                    onChange={(e) => update(r.id, { include: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  <KindIcon row={r} />
                  {r.kind === "transit"
                    ? `${MODE[r.mode].label}: ${r.from} → ${r.to}`
                    : r.kind === "stay"
                    ? `Stay: ${r.name}`
                    : `Ticket: ${r.title}`}
                </label>
                <span className="text-xs text-muted-foreground">Found in: {r.found}</span>
              </div>
              {r.warnings.length > 0 && (
                <p className="flex items-start gap-1.5 rounded-md bg-travel-soft px-2.5 py-1.5 text-xs">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  {r.warnings.join(" ")}
                </p>
              )}
              <fieldset disabled={!r.include} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <legend className="sr-only">Details</legend>
                {r.kind === "transit" && (
                  <>
                    <Field id={`${r.id}-mode`} label="Type">
                      <NativeSelect
                        id={`${r.id}-mode`}
                        value={r.mode}
                        onChange={(e) => update(r.id, { mode: e.target.value as TransitMode })}
                      >
                        {(Object.keys(MODE) as TransitMode[]).map((m) => (
                          <option key={m} value={m}>
                            {MODE[m].label}
                          </option>
                        ))}
                      </NativeSelect>
                    </Field>
                    <Field id={`${r.id}-num`} label={r.mode === "flight" ? "Flight number" : "Number"}>
                      <Input id={`${r.id}-num`} value={r.number ?? ""} onChange={(e) => update(r.id, { number: e.target.value })} />
                    </Field>
                    <Field id={`${r.id}-from`} label={r.mode === "flight" ? "From (airport code)" : "From"}>
                      <Input id={`${r.id}-from`} value={r.from} onChange={(e) => update(r.id, { from: e.target.value })} required />
                    </Field>
                    <Field id={`${r.id}-to`} label={r.mode === "flight" ? "To (airport code)" : "To"}>
                      <Input id={`${r.id}-to`} value={r.to} onChange={(e) => update(r.id, { to: e.target.value })} required />
                    </Field>
                    <Field id={`${r.id}-dep`} label="Departs (local time)">
                      <Input
                        id={`${r.id}-dep`}
                        type="datetime-local"
                        value={r.departLocal}
                        onChange={(e) => update(r.id, { departLocal: e.target.value })}
                        required
                      />
                    </Field>
                    <Field id={`${r.id}-deptz`} label="Departure time zone">
                      <ZoneSelect
                        id={`${r.id}-deptz`}
                        value={r.departTz}
                        zones={timezones}
                        onChange={(v) => update(r.id, { departTz: v })}
                      />
                    </Field>
                    <Field id={`${r.id}-arr`} label="Arrives (local time)">
                      <Input
                        id={`${r.id}-arr`}
                        type="datetime-local"
                        value={r.arriveLocal}
                        onChange={(e) => update(r.id, { arriveLocal: e.target.value })}
                        required
                      />
                    </Field>
                    <Field id={`${r.id}-arrtz`} label="Arrival time zone">
                      <ZoneSelect
                        id={`${r.id}-arrtz`}
                        value={r.arriveTz}
                        zones={timezones}
                        onChange={(v) => update(r.id, { arriveTz: v })}
                      />
                    </Field>
                  </>
                )}
                {r.kind === "stay" && (
                  <>
                    <Field id={`${r.id}-name`} label="Name">
                      <Input id={`${r.id}-name`} value={r.name} onChange={(e) => update(r.id, { name: e.target.value })} required />
                    </Field>
                    <Field id={`${r.id}-addr`} label="Address (optional)">
                      <Input id={`${r.id}-addr`} value={r.address ?? ""} onChange={(e) => update(r.id, { address: e.target.value })} />
                    </Field>
                    <Field id={`${r.id}-in`} label="Check-in">
                      <Input
                        id={`${r.id}-in`}
                        type="datetime-local"
                        value={r.checkInLocal}
                        onChange={(e) => update(r.id, { checkInLocal: e.target.value })}
                        required
                      />
                    </Field>
                    <Field id={`${r.id}-out`} label="Check-out">
                      <Input
                        id={`${r.id}-out`}
                        type="datetime-local"
                        value={r.checkOutLocal}
                        onChange={(e) => update(r.id, { checkOutLocal: e.target.value })}
                        required
                      />
                    </Field>
                  </>
                )}
                {r.kind === "activity" && (
                  <>
                    <Field id={`${r.id}-title`} label="Name">
                      <Input id={`${r.id}-title`} value={r.title} onChange={(e) => update(r.id, { title: e.target.value })} required />
                    </Field>
                    <Field id={`${r.id}-date`} label="Date">
                      <Input
                        id={`${r.id}-date`}
                        type="date"
                        value={r.date}
                        onChange={(e) => update(r.id, { date: e.target.value })}
                        required
                      />
                    </Field>
                    <Field id={`${r.id}-time`} label="Time (optional)">
                      <Input
                        id={`${r.id}-time`}
                        type="time"
                        value={r.time ?? ""}
                        onChange={(e) => update(r.id, { time: e.target.value || null })}
                      />
                    </Field>
                    <Field id={`${r.id}-where`} label="Where (optional)">
                      <Input id={`${r.id}-where`} value={r.address ?? ""} onChange={(e) => update(r.id, { address: e.target.value })} />
                    </Field>
                  </>
                )}
                <Field id={`${r.id}-conf`} label="Confirmation (optional)">
                  <Input
                    id={`${r.id}-conf`}
                    value={r.confirmation ?? ""}
                    onChange={(e) => update(r.id, { confirmation: e.target.value })}
                  />
                </Field>
              </fieldset>
            </li>
          ))}
        </ul>

        <input type="hidden" name="payload" value={payload} />
        {saveState.error && (
          <p role="alert" className="text-sm text-destructive">
            {saveState.error}
          </p>
        )}
        {saveState.failed && saveState.failed.length > 0 && <Failed list={saveState.failed} />}
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={saving || !chosen.length}>
            {saving ? "Adding…" : `Add ${chosen.length} to the trip`}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setRows(null)}>
            Start over
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="grid content-start gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      {children}
    </div>
  );
}

function ZoneSelect({ id, value, zones, onChange }: { id: string; value: string; zones: string[]; onChange: (v: string) => void }) {
  const list = zones.includes(value) ? zones : [value, ...zones];
  return (
    <NativeSelect id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {list.map((z) => (
        <option key={z} value={z}>
          {z.replaceAll("_", " ")}
        </option>
      ))}
    </NativeSelect>
  );
}

function KindIcon({ row }: { row: Row }) {
  const cls = "size-4 text-brand";
  if (row.kind === "stay") return <BedDouble className={cls} aria-hidden="true" />;
  if (row.kind === "activity")
    return row.time ? <Ticket className={cls} aria-hidden="true" /> : <CalendarDays className={cls} aria-hidden="true" />;
  return row.mode === "flight" ? <Plane className={cls} aria-hidden="true" /> : <Train className={cls} aria-hidden="true" />;
}

function Failed({ list }: { list: string[] }) {
  return (
    <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium">These couldn&rsquo;t be added:</p>
      <ul className="mt-1 list-disc pl-5">
        {list.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
