import type {
  DevelopmentStage,
  EntityType,
  EventType,
  FeedbackSignal,
  FollowTargetType,
  Invasiveness,
  Modality,
  OperatingStatus,
} from "@/domain/enums";
import type {
  ClinicalTrialSummary,
  CompanySummary,
  DeviceSummary,
  EntityRef,
  FeedItem,
  FollowedEntity,
  Paginated,
  PublicationSummary,
  SavedItem,
} from "@/domain/types";

/**
 * Query contracts for the data-access layer (src/data). Repositories accept these,
 * validate nothing (validation happens at the API/page boundary with zod), and return
 * the read models in src/domain/types.
 */

export const COMPANY_SORT_KEYS = ["name", "funding", "lastVerified", "founded", "updated"] as const;
export type CompanySortKey = (typeof COMPANY_SORT_KEYS)[number];

export interface CompanyDirectoryQuery {
  q?: string;
  technologyCategories?: string[];
  conditions?: string[];
  invasiveness?: Invasiveness[];
  modality?: Modality[];
  developmentStage?: DevelopmentStage[];
  country?: string[];
  operatingStatus?: OperatingStatus[];
  sort: CompanySortKey;
  direction: "asc" | "desc";
  cursor: string | null;
  pageSize: number;
}

export type CompanyDirectoryResult = Paginated<CompanySummary> & {
  /** Distinct values available for filter controls, with counts over the unfiltered set. */
  facets: {
    technologyCategories: Array<{ slug: string; name: string; count: number }>;
    conditions: Array<{ slug: string; name: string; count: number }>;
    countries: Array<{ code: string; count: number }>;
  };
};

export interface FeedQuery {
  /** Technology-category slug, or undefined for all topics. */
  topic?: string;
  eventTypes?: EventType[];
  cursor: string | null;
  pageSize: number;
}

export interface HomeFeedSections {
  developments: Paginated<FeedItem>;
  recentlyUpdatedCompanies: CompanySummary[];
  recentlyUpdatedDevices: DeviceSummary[];
  newTrials: ClinicalTrialSummary[];
  recentResearch: PublicationSummary[];
  topics: Array<{ slug: string; name: string; count: number }>;
}

export interface RelatedEntities {
  competitors: EntityRef[];
  partners: EntityRef[];
  investors: EntityRef[];
  universities: EntityRef[];
  devices: EntityRef[];
  trials: EntityRef[];
}

export interface PersonalizationRepository {
  listSaved(profileId: string): Promise<SavedItem[]>;
  /** "type:id" keys of every saved entity, for marking Save buttons on lists. */
  listSavedKeys(profileId: string): Promise<Set<string>>;
  /** "type:id" keys of every followed target. */
  listFollowKeys(profileId: string): Promise<Set<string>>;
  isSaved(profileId: string, entityType: EntityType, entityId: string): Promise<boolean>;
  save(
    profileId: string,
    entityType: EntityType,
    entityId: string,
    note?: string | null,
  ): Promise<void>;
  unsave(profileId: string, entityType: EntityType, entityId: string): Promise<void>;
  listFollows(profileId: string): Promise<FollowedEntity[]>;
  follow(profileId: string, targetType: FollowTargetType, targetId: string): Promise<void>;
  unfollow(profileId: string, targetType: FollowTargetType, targetId: string): Promise<void>;
  recordFeedback(
    profileId: string,
    entityType: EntityType,
    entityId: string,
    signal: FeedbackSignal,
  ): Promise<void>;
  /** Recommended developments with a "why this appeared" reason each. */
  forYou(profileId: string, limit: number): Promise<FeedItem[]>;
}
