"use client";

import { useOptimistic, useState, useTransition } from "react";
import type { FollowTargetType } from "@/domain/enums";
import { Button, type ButtonSize } from "@/components/ui/button";
import { LiveRegion } from "@/components/ui/live-region";
import type { FollowAction } from "./actions";

export interface FollowButtonProps {
  targetType: FollowTargetType;
  targetId: string;
  initialFollowed: boolean;
  action: FollowAction;
  size?: ButtonSize;
  className?: string;
}

/** Follows or unfollows an entity optimistically; aria-pressed reflects the current state. */
export function FollowButton({
  targetType,
  targetId,
  initialFollowed,
  action,
  size = "sm",
  className,
}: FollowButtonProps) {
  const [followed, setFollowed] = useState(initialFollowed);
  const [optimisticFollowed, setOptimisticFollowed] = useOptimistic(followed);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const toggle = () => {
    const next = !optimisticFollowed;
    startTransition(async () => {
      setOptimisticFollowed(next);
      try {
        const result = await action({ targetType, targetId, followed: next });
        setFollowed(result.followed);
        setMessage(result.followed ? "Following." : "No longer following.");
      } catch {
        setMessage("Could not update follows. Try again.");
      }
    });
  };

  return (
    <>
      <Button
        variant={optimisticFollowed ? "secondary" : "primary"}
        size={size}
        aria-pressed={optimisticFollowed}
        aria-busy={pending}
        onClick={toggle}
        className={className}
      >
        <svg aria-hidden="true" viewBox="0 0 16 16" width="12" height="12">
          {optimisticFollowed ? (
            <path d="M3 8.5 6.5 12 13 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
          ) : (
            <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.5" />
          )}
        </svg>
        {optimisticFollowed ? "Following" : "Follow"}
      </Button>
      <LiveRegion message={message} />
    </>
  );
}
