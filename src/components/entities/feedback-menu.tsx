"use client";

import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import type { EntityType, FeedbackSignal } from "@/domain/enums";
import { cn } from "@/lib/cn";
import { buttonClassName } from "@/components/ui/button";
import { LiveRegion } from "@/components/ui/live-region";
import type { FeedbackAction } from "./actions";

const options: Array<{ signal: FeedbackSignal; label: string; confirmation: string }> = [
  { signal: "more_like_this", label: "More like this", confirmation: "Noted: more like this." },
  { signal: "less_like_this", label: "Less like this", confirmation: "Noted: less like this." },
  { signal: "hide", label: "Hide", confirmation: "Hidden from your feed." },
];

export interface FeedbackMenuProps {
  entityType: EntityType;
  entityId: string;
  action: FeedbackAction;
  className?: string;
}

/**
 * <details> menu offering "More like this", "Less like this" and "Hide"; announces the result.
 * Follows the menu button pattern: opening focuses the first item, Up/Down/Home/End move with
 * wrap-around, Escape or a choice closes the menu and returns focus to the summary.
 */
export function FeedbackMenu({ entityType, entityId, action, className }: FeedbackMenuProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  const focusItem = (index: number) => {
    setActiveIndex(index);
    itemRefs.current[index]?.focus();
  };

  const closeMenu = () => {
    const details = detailsRef.current;
    if (!details) return;
    details.open = false;
    details.querySelector("summary")?.focus();
  };

  const choose = (option: (typeof options)[number]) => {
    startTransition(async () => {
      try {
        await action({ entityType, entityId, signal: option.signal });
        setMessage(option.confirmation);
      } catch {
        setMessage("Could not record feedback. Try again.");
      }
      closeMenu();
    });
  };

  const handleToggle = () => {
    if (detailsRef.current?.open) focusItem(0);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (!detailsRef.current?.open) return;
    if (event.key === "Escape") {
      event.preventDefault();
      closeMenu();
      return;
    }
    const last = options.length - 1;
    const current = itemRefs.current.findIndex((item) => item === event.target);
    let next: number | null = null;
    if (event.key === "ArrowDown") next = current < 0 || current === last ? 0 : current + 1;
    else if (event.key === "ArrowUp") next = current <= 0 ? last : current - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    focusItem(next);
  };

  return (
    <>
      <details
        ref={detailsRef}
        onToggle={handleToggle}
        onKeyDown={handleKeyDown}
        className={cn("relative", className)}
      >
        <summary
          aria-haspopup="menu"
          aria-busy={pending}
          className={cn(
            buttonClassName({ variant: "ghost", size: "sm" }),
            "cursor-pointer list-none [&::-webkit-details-marker]:hidden",
          )}
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
            <circle cx="3" cy="8" r="1.25" fill="currentColor" />
            <circle cx="8" cy="8" r="1.25" fill="currentColor" />
            <circle cx="13" cy="8" r="1.25" fill="currentColor" />
          </svg>
          Feedback
        </summary>
        <div
          role="menu"
          aria-label="Feedback"
          className="absolute right-0 z-20 mt-1 min-w-40 rounded-md border border-line bg-surface p-1 shadow-overlay"
        >
          {options.map((option, index) => (
            <button
              key={option.signal}
              ref={(node) => {
                itemRefs.current[index] = node;
              }}
              type="button"
              role="menuitem"
              tabIndex={index === activeIndex ? 0 : -1}
              disabled={pending}
              onFocus={() => setActiveIndex(index)}
              onClick={() => choose(option)}
              className="block w-full rounded-sm px-2 py-1.5 text-left text-sm text-ink hover:bg-surface-hover disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}
        </div>
      </details>
      {/* Outside the <details>: a closed details hides its content, and hidden status text is not announced. */}
      <LiveRegion message={message} />
    </>
  );
}
