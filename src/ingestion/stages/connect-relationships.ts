import type { EntityType } from "@/domain/enums";
import type { NormalizedRecord } from "../normalized";
import type { ResolvedLinks } from "../repository";

export interface EventEntityLink {
  type: EntityType;
  id: string;
  role: string;
}

/**
 * Stage 7. Turns resolved ids into the entity links a development carries, with the
 * role each entity plays. Roles are what the interface shows next to a chip.
 */
export function connectRelationships(
  record: NormalizedRecord,
  links: ResolvedLinks,
): EventEntityLink[] {
  const connections: EventEntityLink[] = [];
  const role =
    record.kind === "clinical_trial"
      ? "sponsor"
      : record.kind === "patent"
        ? "assignee"
        : record.kind === "regulatory_action"
          ? "manufacturer"
          : record.kind === "publication"
            ? "author_affiliation"
            : "subject";
  if (links.organizationId)
    connections.push({ type: "organization", id: links.organizationId, role });
  for (const deviceId of links.deviceIds)
    connections.push({ type: "device", id: deviceId, role: "technology" });
  for (const personId of links.personIds)
    connections.push({ type: "researcher", id: personId, role: "author" });
  return connections;
}
