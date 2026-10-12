"use client";

import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useOptimistic, useRef, useTransition } from "react";

import { Avatar } from "@/components/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ChecklistItem } from "@/types/database";
import { addChecklistItem, addStarterPacking, deleteChecklistItem, toggleChecklistItem } from "./actions";

type Person = { user_id: string; name: string; avatar_url: string | null };

export function ChecklistCard({
  tripId,
  list,
  title,
  hint,
  items,
  people,
}: {
  tripId: string;
  list: "packing" | "todo";
  title: string;
  hint: string;
  items: ChecklistItem[];
  people: Person[];
}) {
  const [optimistic, setOptimistic] = useOptimistic(items, (state, change: { id: string; done: boolean }) =>
    state.map((i) => (i.id === change.id ? { ...i, done: change.done } : i)),
  );
  const [, startTransition] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const byId = new Map(people.map((p) => [p.user_id, p]));
  const done = optimistic.filter((i) => i.done).length;
  const sorted = [...optimistic].sort((a, b) => Number(a.done) - Number(b.done) || a.position - b.position);

  return (
    <section aria-labelledby={`${list}-h`} className="grid content-start gap-4 rounded-xl border bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id={`${list}-h`} className="text-xl font-semibold">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{hint}</p>
        </div>
        {optimistic.length > 0 && (
          <span className="shrink-0 text-sm text-muted-foreground">
            {done} of {optimistic.length}
          </span>
        )}
      </div>

      {sorted.length > 0 && (
        <ul className="grid gap-1">
          {sorted.map((item) => {
            const who = item.assigned_to ? byId.get(item.assigned_to) : undefined;
            return (
              <li key={item.id} className="group flex items-center gap-3 rounded-md px-1 py-1.5 hover:bg-muted/50">
                <input
                  id={`c-${item.id}`}
                  type="checkbox"
                  checked={item.done}
                  onChange={(e) => {
                    const next = e.target.checked;
                    startTransition(async () => {
                      setOptimistic({ id: item.id, done: next });
                      await toggleChecklistItem(tripId, item.id, next);
                    });
                  }}
                  className="size-4 accent-[var(--primary)]"
                />
                <label htmlFor={`c-${item.id}`} className={`flex-1 text-sm ${item.done ? "text-muted-foreground line-through" : ""}`}>
                  {item.title}
                  {item.due_on && <span className="ml-2 text-xs text-muted-foreground">by {item.due_on}</span>}
                </label>
                {who && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`Assigned to ${who.name}`}>
                    <Avatar name={who.name} url={who.avatar_url} size={20} />
                    <span className="max-sm:sr-only">{who.name}</span>
                  </span>
                )}
                <form action={deleteChecklistItem.bind(null, tripId, item.id)}>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon-xs"
                    className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Remove ${item.title}`}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </form>
              </li>
            );
          })}
        </ul>
      )}

      <form
        ref={form}
        action={async (fd) => {
          await addChecklistItem(tripId, list, fd);
          form.current?.reset();
        }}
        className="flex flex-wrap items-end gap-2"
      >
        <div className="grid min-w-48 flex-1 gap-1">
          <Label htmlFor={`${list}-new`} className="sr-only">
            New item
          </Label>
          <Input id={`${list}-new`} name="title" placeholder={list === "packing" ? "Sunscreen" : "Book the Pena Palace slot"} required maxLength={200} />
        </div>
        {people.length > 1 && (
          <div className="grid gap-1">
            <Label htmlFor={`${list}-who`} className="sr-only">
              Who
            </Label>
            <select id={`${list}-who`} name="assigned_to" defaultValue="" className="h-9 rounded-md border bg-background px-2 text-sm">
              <option value="">Anyone</option>
              {people.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        {list === "todo" && (
          <div className="grid gap-1">
            <Label htmlFor={`${list}-due`} className="sr-only">
              Due by
            </Label>
            <Input id={`${list}-due`} name="due_on" type="date" className="h-9 w-40" />
          </div>
        )}
        <Button type="submit" size="sm" className="h-9">
          <Plus aria-hidden="true" /> Add
        </Button>
      </form>

      {list === "packing" && optimistic.length === 0 && (
        <form action={addStarterPacking.bind(null, tripId)}>
          <Button type="submit" variant="outline" size="sm">
            <Sparkles aria-hidden="true" /> Start with the basics
          </Button>
        </form>
      )}
    </section>
  );
}
