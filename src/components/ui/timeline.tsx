import type { Route } from "next";
import Link from "next/link";
import { EVENT_TYPE_LABELS } from "@/domain/enums";
import type { TimelineEvent } from "@/domain/types";
import { cn } from "@/lib/cn";
import { routes } from "@/lib/routes";
import { FormattedDate } from "./formatted-date";
import { linkClass, microLabelClass } from "./styles";

export interface TimelineProps {
  events: TimelineEvent[];
  /** Accessible name of the list. */
  label?: string;
  className?: string;
}

/** Ordered list of dated events: date column, type label, title, summary and source links. */
export function Timeline({ events, label = "Timeline", className }: TimelineProps) {
  return (
    <ol aria-label={label} className={cn("divide-y divide-line-soft", className)}>
      {events.map((event) => (
        <li key={event.id} className="grid gap-x-4 gap-y-1 py-3 md:grid-cols-[7rem_1fr]">
          <FormattedDate value={event.occurredOn} className="text-xs text-ink-muted" />
          <div className="min-w-0">
            <p className={microLabelClass}>{EVENT_TYPE_LABELS[event.eventType]}</p>
            <p className="text-sm font-medium text-ink">
              {event.href ? (
                <Link href={event.href as Route} className="hover:underline">
                  {event.title}
                </Link>
              ) : (
                event.title
              )}
            </p>
            {event.summary ? (
              <p className="mt-0.5 max-w-prose text-sm text-ink-secondary">{event.summary}</p>
            ) : null}
            {event.sources.length > 0 ? (
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                {event.sources.map((source) => (
                  <li key={source.id}>
                    <Link href={routes.source(source.id) as Route} className={linkClass}>
                      {source.title}
                    </Link>
                    {source.publisher ? (
                      <span className="text-ink-muted"> · {source.publisher}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
