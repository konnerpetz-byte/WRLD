"use client";

import { useEffect, useId, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A text input that suggests matches as you type (ARIA combobox pattern).
 * Typing still works freely — picking a suggestion is optional.
 */
export function Autocomplete<T>({
  id,
  name,
  value,
  onValueChange,
  fetchOptions,
  optionKey,
  renderOption,
  onPick,
  placeholder,
  required,
  autoFocus,
  className,
  listClassName,
  minChars = 2,
  "aria-describedby": describedBy,
}: {
  id: string;
  name?: string;
  value: string;
  onValueChange: (value: string) => void;
  fetchOptions: (query: string, signal: AbortSignal) => Promise<T[]>;
  optionKey: (option: T) => string;
  renderOption: (option: T) => React.ReactNode;
  onPick: (option: T) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  listClassName?: string;
  minChars?: number;
  "aria-describedby"?: string;
}) {
  const listId = useId();
  const [options, setOptions] = useState<T[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const skipNext = useRef(false);
  const fetchRef = useRef(fetchOptions);
  useEffect(() => {
    fetchRef.current = fetchOptions;
  });

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    const q = value.trim();
    if (q.length < minChars) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const found = await fetchRef.current(q, controller.signal);
        setOptions(found);
        setOpen(true);
        setActive(-1);
      } catch {
        // Aborted or offline: keep typing working.
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, minChars]);

  function pick(option: T) {
    skipNext.current = true;
    onPick(option);
    setOpen(false);
    setActive(-1);
  }

  const showList = open && value.trim().length >= minChars && (options.length > 0 || loading);

  return (
    <div className="relative">
      <Input
        id={id}
        name={name}
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(options.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            pick(options[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => options.length && setOpen(true)}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-describedby={describedBy}
        autoComplete="off"
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
        className={className}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className={cn(
            "absolute top-full right-0 left-0 z-30 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
            listClassName,
          )}
        >
          {loading && options.length === 0 && <li className="px-3 py-2 text-sm text-muted-foreground">Searching…</li>}
          {options.map((option, i) => (
            <li
              key={optionKey(option)}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(option);
              }}
              onMouseEnter={() => setActive(i)}
              className={cn("cursor-pointer rounded-md px-3 py-2 text-sm", i === active && "bg-accent")}
            >
              {renderOption(option)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
