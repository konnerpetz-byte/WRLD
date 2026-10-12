import { BellRing, CalendarPlus, Check, ExternalLink, FileCheck2 } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ChecklistItem } from "@/types/database";
import { clearDocReminder, setDocReminder, toggleDocDone } from "./actions";
import { type DocRequirement, remindDate, RULES_CHECKED_ON } from "./rules";

const fmt = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

/** "Travel documents for you": what your passport needs for this trip, with a reminder for each. */
export function DocumentsCard({
  tripId,
  start,
  docs,
  saved,
  hasHome,
}: {
  tripId: string;
  start: string;
  docs: DocRequirement[];
  saved: ChecklistItem[];
  hasHome: boolean;
}) {
  const savedByKey = new Map(saved.map((s) => [s.doc_key, s]));
  return (
    <section aria-labelledby="docs-h" className="grid gap-4 rounded-2xl border bg-card p-5 lg:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="docs-h" className="flex items-center gap-2 text-xl font-semibold">
            <FileCheck2 className="size-5" aria-hidden="true" /> Travel documents for you
          </h2>
          <p className="text-sm text-muted-foreground">
            Based on your passport country and where this trip goes. Rules checked {fmt(RULES_CHECKED_ON)}; always confirm on the official site.
          </p>
        </div>
      </div>

      {!hasHome && (
        <p className="rounded-lg border border-dashed p-3 text-sm">
          Add your home country in{" "}
          <Link href="/account" className="font-medium text-primary underline underline-offset-2">
            Account
          </Link>{" "}
          to see the visas and travel authorizations your passport needs.
        </p>
      )}

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing extra needed: this trip stays in your home country.</p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {docs.map((d) => {
            const item = savedByKey.get(d.key);
            const suggested = remindDate(start, d.leadDays);
            return (
              <li key={d.key} className={`grid gap-2 rounded-xl border p-4 ${item?.done ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold">{d.title}</h3>
                  {d.level === "recommended" ? <Badge variant="outline">Optional</Badge> : <Badge variant="secondary">Needed</Badge>}
                  {item?.done && (
                    <Badge className="bg-open text-open-foreground">
                      <Check aria-hidden="true" /> Done
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{d.detail}</p>
                <a href={d.url} target="_blank" rel="noopener noreferrer" className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary underline underline-offset-2">
                  Official site <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>

                {item?.remind_on ? (
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1">
                      <BellRing className="size-3.5" aria-hidden="true" /> Reminder {fmt(item.remind_on)}
                    </span>
                    <Button asChild variant="outline" size="sm">
                      <a href={`/api/reminders/${item.id}`} download>
                        <CalendarPlus aria-hidden="true" /> Add to calendar
                      </a>
                    </Button>
                    <form action={toggleDocDone.bind(null, tripId, item.id, !item.done)}>
                      <Button type="submit" variant="ghost" size="sm">
                        {item.done ? "Not done" : "Mark done"}
                      </Button>
                    </form>
                    <form action={clearDocReminder.bind(null, tripId, item.id)}>
                      <Button type="submit" variant="ghost" size="sm" className="text-muted-foreground">
                        Remove
                      </Button>
                    </form>
                  </div>
                ) : (
                  <form action={setDocReminder.bind(null, tripId, d.key)} className="flex flex-wrap items-end gap-2">
                    <label className="grid gap-1 text-xs">
                      <span>Remind me on</span>
                      <input
                        type="date"
                        name="remind_on"
                        defaultValue={suggested}
                        min={new Date().toISOString().slice(0, 10)}
                        max={start}
                        required
                        className="h-8 rounded-md border bg-background px-2 text-sm"
                      />
                    </label>
                    <Button type="submit" size="sm">
                      <BellRing aria-hidden="true" /> Set reminder
                    </Button>
                  </form>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">
        Reminders show at the top of this trip when they&apos;re due. Use “Add to calendar” to get an alert on your phone too.
      </p>
    </section>
  );
}
