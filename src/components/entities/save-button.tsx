"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { EntityType } from "@/domain/enums";
import { Button, type ButtonSize } from "@/components/ui/button";
import { LiveRegion } from "@/components/ui/live-region";
import type { SaveAction } from "./actions";

export interface SaveButtonProps {
  entityType: EntityType;
  entityId: string;
  initialSaved: boolean;
  action: SaveAction;
  size?: ButtonSize;
  className?: string;
}

/** Toggles a saved item optimistically; aria-pressed reflects the current state. */
export function SaveButton({
  entityType,
  entityId,
  initialSaved,
  action,
  size = "sm",
  className,
}: SaveButtonProps) {
  const [saved, setSaved] = useState(initialSaved);
  const [optimisticSaved, setOptimisticSaved] = useOptimistic(saved);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const toggle = () => {
    const next = !optimisticSaved;
    startTransition(async () => {
      setOptimisticSaved(next);
      try {
        const result = await action({ entityType, entityId, saved: next });
        setSaved(result.saved);
        setMessage(result.saved ? "Saved." : "Removed from saved items.");
      } catch {
        setMessage("Could not update saved items. Try again.");
      }
    });
  };

  return (
    <>
      <Button
        variant={optimisticSaved ? "secondary" : "ghost"}
        size={size}
        aria-pressed={optimisticSaved}
        aria-busy={pending}
        onClick={toggle}
        className={className}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
          <path
            d="M4 2h8v12l-4-3-4 3V2z"
            fill={optimisticSaved ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        {optimisticSaved ? "Saved" : "Save"}
      </Button>
      <LiveRegion message={message} />
    </>
  );
}
