import type {
  DevelopmentStage,
  EntityType,
  EvidenceStage,
  Invasiveness,
  Modality,
  OrganizationKind,
  SourceType,
  TrialStatus,
  VerificationStatus,
} from "@/domain/enums";
import type { EntityRef, ISODate } from "@/domain/types";

/** Entity types the indexer materialises. News articles are represented by their event. */
export const INDEXED_ENTITY_TYPES = [
  "organization",
  "device",
  "clinical_trial",
  "publication",
  "patent",
  "event",
  "researcher",
] as const satisfies readonly EntityType[];

export type IndexedEntityType = (typeof INDEXED_ENTITY_TYPES)[number];

export function isIndexedEntityType(value: EntityType): value is IndexedEntityType {
  return (INDEXED_ENTITY_TYPES as readonly EntityType[]).includes(value);
}

/** One row of search_documents as the indexer writes it (id, indexed_at and tsv are database-managed). */
export interface SearchDocumentRow {
  entityType: IndexedEntityType;
  entityId: string;
  href: string;
  title: string;
  subtitle: string | null;
  description: string;
  body: string;
  metadata: Array<{ label: string; value: string }>;
  entities: EntityRef[];
  keywords: string[];
  technologyCategories: string[];
  conditions: string[];
  invasiveness: Invasiveness | null;
  modality: Modality | null;
  developmentStage: DevelopmentStage | null;
  evidenceStage: EvidenceStage | null;
  trialStatus: TrialStatus | null;
  organizationKind: OrganizationKind | null;
  country: string | null;
  publishedOn: ISODate | null;
  sourceTypes: SourceType[];
  sourceQuality: number;
  verificationStatus: VerificationStatus;
  isSample: boolean;
  entityUpdatedAt: Date;
}
