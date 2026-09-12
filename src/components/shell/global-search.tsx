"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ENTITY_TYPE_LABELS, ENTITY_TYPES } from "@/domain/enums";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import type { Suggestion } from "@/search/types";
import { Button } from "@/components/ui/button";
import { inputClass } from "@/components/ui/input";
import { LiveRegion } from "@/components/ui/live-region";
import { microLabelClass } from "@/components/ui/styles";

const DEBOUNCE_MS = 200;
const SUGGESTION_LIMIT = 6;
const MIN_PREFIX_LENGTH = 2;

function isSuggestion(value: unknown): value is Suggestion {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.title === "string" &&
    typeof record.href === "string" &&
    typeof record.entityType === "string" &&
    (ENTITY_TYPES as readonly string[]).includes(record.entityType)
  );
}

function parseSuggestions(payload: unknown): Suggestion[] {
  if (typeof payload !== "object" || payload === null) return [];
  const list = (payload as { suggestions?: unknown }).suggestions;
  return Array.isArray(list) ? list.filter(isSuggestion) : [];
}

export interface GlobalSearchProps {
  /** Initial value, e.g. the current query on the search page. */
  defaultValue?: string;
  className?: string;
}

/** Header search box: submits to /search and offers debounced suggestions in a combobox. */
export function GlobalSearch({ defaultValue = "", className }: GlobalSearchProps) {
  const router = useRouter();
  const id = useId();
  const inputId = `${id}-input`;
  const listboxId = `${id}-listbox`;
  const [value, setValue] = useState(defaultValue);
  // Suggestions are a response to typing: a prefilled value must not fetch or open on mount.
  const [touched, setTouched] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const prefix = value.trim();
    if (!touched || prefix.length < MIN_PREFIX_LENGTH) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const query = new URLSearchParams({ q: prefix, limit: String(SUGGESTION_LIMIT) });
        const response = await fetch(`/api/suggest?${query.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Suggest request failed: ${response.status}`);
        const found = parseSuggestions(await response.json());
        setSuggestions(found);
        setOpen(found.length > 0 && document.activeElement === inputRef.current);
        setActiveIndex(-1);
      } catch {
        // Suggestions are an enhancement: a failed or aborted request closes the list.
        if (!controller.signal.aborted) setOpen(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, touched]);

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const handleChange = (next: string) => {
    setTouched(true);
    setValue(next);
    if (next.trim().length < MIN_PREFIX_LENGTH) {
      setSuggestions([]);
      close();
    }
  };

  const navigateTo = (suggestion: Suggestion) => {
    close();
    router.push(suggestion.href as Route);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      if (suggestions.length === 0) return;
      event.preventDefault();
      setOpen(true);
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter") {
      const active = open && activeIndex >= 0 ? suggestions[activeIndex] : undefined;
      if (active) {
        event.preventDefault();
        navigateTo(active);
      }
    } else if (event.key === "Escape") {
      if (open) {
        event.preventDefault();
        close();
      }
    }
  };

  const activeId = open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <form
      role="search"
      action={routes.search()}
      method="get"
      className={cn("relative flex items-center gap-1.5", className)}
      onSubmit={close}
    >
      <label htmlFor={inputId} className="sr-only">
        Search NeuroBase
      </label>
      <div className="relative flex-1">
        <input
          ref={inputRef}
          id={inputId}
          name="q"
          type="search"
          value={value}
          placeholder="Search companies, devices, trials, research"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          onChange={(event) => handleChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlur={close}
          className={cn(inputClass, "h-8")}
        />
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Suggestions"
          hidden={!open}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-x-0 top-full z-30 mt-1 max-h-80 overflow-y-auto rounded-md border border-line bg-surface p-1 shadow-overlay"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={`${suggestion.entityType}:${suggestion.href}`}
              id={`${listboxId}-option-${index}`}
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => navigateTo(suggestion)}
              className={cn(
                "flex cursor-pointer items-baseline gap-2 rounded-sm px-2 py-1.5 text-sm",
                index === activeIndex
                  ? "bg-accent-soft text-ink"
                  : "text-ink hover:bg-surface-hover",
              )}
            >
              <span className={cn(microLabelClass, "w-20 shrink-0")}>
                {ENTITY_TYPE_LABELS[suggestion.entityType]}
              </span>
              <span className="truncate">{suggestion.title}</span>
            </li>
          ))}
        </ul>
      </div>
      <Button type="submit" variant="secondary" size="md">
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
          <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="m10.5 10.5 3 3" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Search
      </Button>
      <LiveRegion
        message={
          open
            ? `${suggestions.length} ${suggestions.length === 1 ? "suggestion" : "suggestions"} available.`
            : ""
        }
      />
    </form>
  );
}
