import type { Database } from "@/db/client";
import type { EntityType } from "@/domain/enums";
import type { SourceLedgerEntry, TimelineEvent } from "@/domain/types";
import { routes } from "@/lib/routes";
import { ledgerFromClaims } from "./companies";
import { listEventsForEntity } from "./events";
import { loadClaimsForEntities, loadSourcesForEvents } from "./loaders";

/**
 * Timeline, claims and source ledger for any entity type: one query for events, one
 * for their sources, two for claims. Shared by device, trial, publication and patent
 * detail pages.
 */
export async function loadProvenanceBundle(db: Database, entityType: EntityType, entityId: string) {
  const [eventRows, claims] = await Promise.all([
    listEventsForEntity(db, entityType, entityId),
    loadClaimsForEntities(db, entityType, [entityId]).then((map) => map.get(entityId) ?? []),
  ]);
  const eventSources = await loadSourcesForEvents(
    db,
    eventRows.map((event) => event.id),
  );
  const timeline: TimelineEvent[] = eventRows.map((event) => ({
    id: event.id,
    eventType: event.eventType,
    title: event.title,
    summary: event.summary,
    occurredOn: event.occurredOn,
    href: routes.event(event.slug),
    sources: eventSources.get(event.id) ?? [],
  }));
  const sources: SourceLedgerEntry[] = ledgerFromClaims(
    claims,
    timeline.flatMap((event) =>
      event.sources.map((source) => ({
        source,
        event: {
          type: "event" as const,
          id: event.id,
          href: event.href ?? routes.news(),
          name: event.title,
        },
      })),
    ),
  );
  return { timeline, claims, sources };
}
