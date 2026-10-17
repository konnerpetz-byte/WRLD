"use client";

import { AlertTriangle, BedDouble, CalendarDays, Camera, FileUp, Link2, Mail, Paperclip, Plane, Ticket, Train } from "lucide-react";
import Link from "next/link";
import { startTransition, useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MODE } from "@/features/transit/modes";
import { formatMoney } from "@/lib/format";
import type { TransitMode } from "@/types/database";

import { dismissInbox, type ReadState, readImport, type SaveState, saveImport } from "./actions";
import type { ImportCandidate } from "./parse";
import { shrinkImage } from "./shrink-image";
import { TravelPartners } from "./travel-partners";

/** `rate`: trip currency per unit of the found price's currency (today's rate), for the review preview. */
type Row = ImportCandidate & { include: boolean; rate?: number; paidBy?: string | null; split?: string[] };
export type Member = { id: string; name: string };

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
  me = null,
  tripCurrency = "USD",
}: {
  tripId: string;
  timezones: string[];
  inbox?: InboxRow[];
  /** People already on the trip: to tell who on a booking still needs an invite, and who paid */
  members?: Member[];
  /** The signed-in traveler's id */
  me?: string | null;
  /** The trip's currency: prices in other currencies are shown converted */
  tripCurrency?: string;
  partySize?: number | null;
  /** The traveler's forward-to-import address, once inbound email is set up */
  address?: string | null;
}) {
  const [readState, read, reading] = useActionState<ReadState, FormData>(readImport.bind(null, tripId), {});
  const [rows, setRows] = useState<Row[] | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [picked, setPicked] = useState(0);

  // Photos are shrunk in the browser first (see shrink-image.ts), then everything goes up in one request.
  async function submit(fd: FormData) {
    setLocalError(null);
    const files = fd.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
    if (files.length > 6) return setLocalError("Pick up to 6 files at a time.");
    setPreparing(true);
    fd.delete("file");
    let total = 0;
    for (const f of files) {
      const ready = await shrinkImage(f);
      total += ready.size;
      fd.append("file", ready);
    }
    setPreparing(false);
    if (total > 4.3 * 1024 * 1024) return setLocalError("Those files are over 4 MB together. Try fewer at a time.");
    startTransition(() => read(fd));
  }
  const busy = reading || preparing;
  const error = localError ?? readState.error;
  const [handled, setHandled] = useState(readState);
  if (readState !== handled) {
    setHandled(readState);
    if (readState.candidates)
      setRows(
        readState.candidates.map((c) => {
          const converted = readState.converted?.[c.id];
          return { ...c, include: true, rate: converted && c.cost ? converted / c.cost : undefined };
        }),
      );
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
        partners={<TravelPartners tripId={tripId} people={readState.people} members={members.map((m) => m.name)} partySize={partySize} />}
        members={members}
        me={me}
        tripCurrency={tripCurrency}
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
      <form action={submit} className="grid gap-6 rounded-2xl border bg-card p-5">
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
              <FileUp className="size-4" aria-hidden="true" /> Or upload screenshots or files
            </Label>
            <Input
              id="imp-file"
              name="file"
              type="file"
              multiple
              // No HEIC here on purpose: iPhones then hand over photos as JPEG.
              accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp,.ics,.ical,.pdf,.eml,.html,.htm,.txt,text/calendar,application/pdf,message/rfc822,text/html,text/plain"
              aria-describedby="imp-file-help"
              onChange={(e) => setPicked(e.target.files?.length ?? 0)}
            />
            <p id="imp-file-help" className="text-xs text-muted-foreground">
              <Camera className="mr-1 inline size-3" aria-hidden="true" />
              Screenshots or photos of a confirmation or boarding pass (JPG, PNG). If it runs over several screens, pick them all
              together. Also: a ticket or itinerary PDF, a calendar file (.ics) or a saved email (.eml). Up to 6 files.
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

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? "Reading…" : "Find my bookings"}
          </Button>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {busy && picked > 0 ? "Reading images takes a few seconds each." : "Nothing is added until you check it."}
          </p>
        </div>
      </form>
    </div>
  );
}

export function Review({
  tripId,
  rows,
  setRows,
  timezones,
  note,
  inboxId,
  partners,
  members,
  me,
  tripCurrency,
}: {
  tripId: string;
  partners?: React.ReactNode;
  members: Member[];
  me: string | null;
  tripCurrency: string;
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
  const payload = JSON.stringify(chosen.map(({ include, id, found, warnings, rate, ...rest }) => rest));

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
          {chosen.some((r) => r.cost != null) && (
            <Button asChild variant="outline">
              <Link href={`/trips/${tripId}/budget`}>Budget</Link>
            </Button>
          )}
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
                {r.kind !== "activity" && (
                  <PriceFields row={r} update={(patch) => update(r.id, patch)} members={members} me={me} tripCurrency={tripCurrency} />
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

/**
 * What the booking cost, in the currency the file shows. The budget converts it to the trip's
 * currency; with more than one traveler, who paid and who shares it feed the group balances.
 */
function PriceFields({
  row,
  update,
  members,
  me,
  tripCurrency,
}: {
  row: Row;
  update: (patch: Partial<Row>) => void;
  members: Member[];
  me: string | null;
  tripCurrency: string;
}) {
  const currency = row.currency ?? tripCurrency;
  const inTrip = row.cost != null && currency !== tripCurrency && row.rate ? row.cost * row.rate : null;
  const everyone = members.map((m) => m.id);
  const split = row.split?.length ? row.split : everyone;
  return (
    <div className="grid gap-3 sm:col-span-2">
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2 sm:grid-cols-[minmax(0,12rem)_6rem_minmax(0,1fr)]">
        <Field id={`${row.id}-cost`} label="Price paid (optional)">
          <Input
            id={`${row.id}-cost`}
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={row.cost ?? ""}
            onChange={(e) => update({ cost: e.target.value === "" ? null : Math.max(0, Number(e.target.value)) })}
          />
        </Field>
        <Field id={`${row.id}-cur`} label="Currency">
          <Input
            id={`${row.id}-cur`}
            value={currency}
            maxLength={3}
            autoCapitalize="characters"
            onChange={(e) => {
              const v = e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3);
              // A different currency than the one read: the preview rate no longer applies.
              update({ currency: v || null, rate: v === row.currency ? row.rate : undefined });
            }}
          />
        </Field>
        {row.kind === "transit" && (
          <Field id={`${row.id}-pts`} label="Miles or points (optional)">
            <Input
              id={`${row.id}-pts`}
              type="number"
              inputMode="numeric"
              min={0}
              step="1"
              value={row.points ?? ""}
              onChange={(e) => update({ points: e.target.value === "" ? null : Math.max(0, Math.round(Number(e.target.value))) })}
            />
          </Field>
        )}
      </div>
      {row.cost != null && currency !== tripCurrency && (
        <p className="text-xs text-muted-foreground">
          {inTrip != null
            ? `About ${formatMoney(inTrip, tripCurrency)} at today's rate. The budget shows it in ${tripCurrency}.`
            : `The budget converts it to ${tripCurrency} at the latest rate.`}
        </p>
      )}
      {((row.cost != null && row.cost > 0) || (row.points != null && row.points > 0)) && members.length > 1 && (
        <fieldset className="grid gap-2 rounded-lg border border-dashed p-3">
          <legend className="px-1 text-xs font-medium">Splitting it?</legend>
          <label className="grid gap-1 text-xs" htmlFor={`${row.id}-paid`}>
            Who paid
            <NativeSelect id={`${row.id}-paid`} value={row.paidBy ?? ""} onChange={(e) => update({ paidBy: e.target.value || null })}>
              <option value="">Don&rsquo;t split this</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.id === me ? `Me (${m.name})` : m.name}
                </option>
              ))}
            </NativeSelect>
          </label>
          {row.paidBy && (
            <div className="grid gap-1 text-xs">
              <span>Split equally between</span>
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {members.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={split.includes(m.id)}
                      onChange={(e) => {
                        const next = e.target.checked ? [...new Set([...split, m.id])] : split.filter((x) => x !== m.id);
                        if (!next.length) return; // someone has to share it
                        update({ split: next.length === everyone.length ? [] : next });
                      }}
                    />
                    {m.id === me ? "Me" : m.name}
                  </label>
                ))}
              </div>
              <p className="text-muted-foreground">
                It shows under Budget → who owes whom.{row.points ? " Miles count at the value your group agreed per point." : ""}
              </p>
            </div>
          )}
        </fieldset>
      )}
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
