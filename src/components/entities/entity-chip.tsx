import type { Route } from "next";
import Link from "next/link";
import { ENTITY_TYPE_LABELS } from "@/domain/enums";
import type { EntityRef } from "@/domain/types";
import { cn } from "@/lib/cn";
import { microLabelClass } from "@/components/ui/styles";

export interface EntityChipProps {
  entity: EntityRef;
  /** Hide the type micro label when the surrounding context already states it. */
  showType?: boolean;
  className?: string;
}

/** Type micro label plus a name link, for related entities in cards and result rows. */
export function EntityChip({ entity, showType = true, className }: EntityChipProps) {
  return (
    <Link
      href={entity.href as Route}
      className={cn(
        "inline-flex max-w-full items-baseline gap-1.5 rounded-sm border border-line bg-surface px-1.5 py-0.5 text-xs no-underline hover:bg-surface-hover hover:border-line-strong",
        className,
      )}
    >
      {showType ? <span className={microLabelClass}>{ENTITY_TYPE_LABELS[entity.type]}</span> : null}
      <span className="truncate text-ink">{entity.name}</span>
    </Link>
  );
}

export interface EntityChipListProps {
  entities: EntityRef[];
  /** Accessible name of the list. */
  label?: string;
  /** Show at most this many chips and a "+n more" note. */
  max?: number;
  className?: string;
}

/** Wrapping list of EntityChips. Renders nothing when the list is empty. */
export function EntityChipList({
  entities,
  label = "Related entities",
  max,
  className,
}: EntityChipListProps) {
  if (entities.length === 0) return null;
  const visible = max === undefined ? entities : entities.slice(0, max);
  const hidden = entities.length - visible.length;
  return (
    <ul aria-label={label} className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {visible.map((entity) => (
        <li key={`${entity.type}:${entity.id}`} className="max-w-full">
          <EntityChip entity={entity} />
        </li>
      ))}
      {hidden > 0 ? <li className="text-xs text-ink-muted">+{hidden} more</li> : null}
    </ul>
  );
}
