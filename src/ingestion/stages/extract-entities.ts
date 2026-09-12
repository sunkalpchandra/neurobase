import type { NormalizedRecord } from "../normalized";

export interface ExtractedMentions {
  organizationNames: string[];
  personNames: string[];
  conditionNames: string[];
  deviceNames: string[];
}

function unique(values: Array<string | null | undefined>): string[] {
  const seen = new Map<string, string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (!seen.has(key)) seen.set(key, trimmed);
  }
  return [...seen.values()];
}

/**
 * Stage 4. Collects the names a record mentions, from both its structured fields and
 * the mention lists adapters provide. No free-text parsing: only fields the upstream
 * API labelled.
 */
export function extractEntities(record: NormalizedRecord): ExtractedMentions {
  const mentions = record.mentions;
  const organizationNames = [...mentions.organizationNames];
  const personNames = [...mentions.personNames];
  const deviceNames = [...mentions.deviceNames];

  switch (record.kind) {
    case "clinical_trial":
      organizationNames.push(record.sponsorName ?? "");
      break;
    case "publication":
      personNames.push(...record.authorNames);
      break;
    case "patent":
      organizationNames.push(record.assigneeName ?? "");
      personNames.push(...record.inventorNames);
      break;
    case "regulatory_action":
      organizationNames.push(record.applicantName ?? "");
      deviceNames.push(record.deviceName ?? "");
      break;
    case "organization":
      organizationNames.push(record.name);
      break;
    case "news_article":
      break;
  }

  return {
    organizationNames: unique(organizationNames),
    personNames: unique(personNames),
    conditionNames: unique(mentions.conditionNames),
    deviceNames: unique(deviceNames),
  };
}
