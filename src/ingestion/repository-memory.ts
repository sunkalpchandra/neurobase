import type { IngestionRunStatus } from "@/domain/enums";
import { naturalKey, type NormalizedRecord } from "./normalized";
import type {
  IngestionRepository,
  PublishInput,
  PublishResult,
  ReviewInput,
  SimilarOrganization,
  SourceInput,
} from "./repository";
import type { StageCounts } from "./types";

export interface MemoryRepositorySeed {
  /** Normalised alias → organization id. */
  organizationAliases?: Record<string, string>;
  /** Organization id → display name, used by the similarity search. */
  organizations?: Record<string, string>;
  /** Lower-cased condition name → id. */
  conditions?: Record<string, string>;
  /** Lower-cased device name → id. */
  devices?: Record<string, string>;
  /** Natural keys that already exist in storage. */
  existing?: string[];
}

export interface MemoryRepository extends IngestionRepository {
  /** Organizations created from authoritative mentions, keyed by lower-cased name. */
  readonly createdOrganizations: Map<string, string>;
  /** Devices created from authoritative mentions, keyed by lower-cased name. */
  readonly createdDevices: Map<string, string>;
  readonly published: PublishInput[];
  readonly reviewed: ReviewInput[];
  readonly sources: SourceInput[];
  readonly runs: Array<{
    id: string;
    adapter: string;
    query: string;
    status: IngestionRunStatus;
    stats?: StageCounts;
  }>;
}

/** Character-trigram Dice coefficient, the same measure pg_trgm reports. */
export function trigramSimilarity(a: string, b: string): number {
  const grams = (value: string): Set<string> => {
    const padded = `  ${value.toLowerCase().trim()} `;
    const set = new Set<string>();
    for (let index = 0; index < padded.length - 2; index += 1)
      set.add(padded.slice(index, index + 3));
    return set;
  };
  const left = grams(a);
  const right = grams(b);
  if (left.size === 0 || right.size === 0) return 0;
  let shared = 0;
  for (const gram of left) if (right.has(gram)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/** In-memory repository for unit tests: records every write instead of storing it. */
export function createMemoryRepository(seed: MemoryRepositorySeed = {}): MemoryRepository {
  const published: PublishInput[] = [];
  const reviewed: ReviewInput[] = [];
  const sources: SourceInput[] = [];
  const runs: MemoryRepository["runs"] = [];
  const existing = new Set(seed.existing ?? []);
  const events = new Map<string, string>();
  const createdOrganizations = new Map<string, string>();
  const createdDevices = new Map<string, string>();
  let counter = 0;
  const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`;

  return {
    published,
    reviewed,
    sources,
    runs,
    createdOrganizations,
    createdDevices,

    async startRun(adapter, query) {
      const id = nextId("run");
      runs.push({ id, adapter, query, status: "running" });
      return id;
    },
    async finishRun(runId, status, stats) {
      const run = runs.find((entry) => entry.id === runId);
      if (run) {
        run.status = status;
        run.stats = stats;
      }
    },
    async resolveOrganizationByAlias(normalized) {
      return seed.organizationAliases?.[normalized] ?? null;
    },
    async findSimilarOrganizations(name, threshold) {
      const matches: SimilarOrganization[] = [];
      for (const [id, organizationName] of Object.entries(seed.organizations ?? {})) {
        const similarity = trigramSimilarity(name, organizationName);
        if (similarity >= threshold) matches.push({ id, name: organizationName, similarity });
      }
      return matches.sort((a, b) => b.similarity - a.similarity);
    },
    async resolveConditionByName(name) {
      return seed.conditions?.[name.toLowerCase()] ?? null;
    },
    async resolveDeviceByName(name) {
      return seed.devices?.[name.toLowerCase()] ?? null;
    },
    async findExistingByNaturalKey(record: NormalizedRecord) {
      return existing.has(naturalKey(record)) ? `existing-${naturalKey(record)}` : null;
    },
    async findEventByDedupeKey(dedupeKey) {
      return events.get(dedupeKey) ?? null;
    },
    async upsertSource(input) {
      sources.push(input);
      return nextId("source");
    },
    async ensureOrganization(input) {
      const key = input.name.toLowerCase();
      const existing = createdOrganizations.get(key);
      if (existing) return existing;
      const id = nextId("org");
      createdOrganizations.set(key, id);
      return id;
    },
    async ensureDevice(input) {
      const key = input.name.toLowerCase();
      const existing = createdDevices.get(key);
      if (existing) return existing;
      const id = nextId("device");
      createdDevices.set(key, id);
      return id;
    },
    async publish(input): Promise<PublishResult> {
      published.push(input);
      existing.add(naturalKey(input.record));
      let eventId: string | null = null;
      if (input.event) {
        eventId = events.get(input.event.dedupeKey) ?? nextId("event");
        events.set(input.event.dedupeKey, eventId);
      }
      return { entityType: "organization", entityId: nextId("entity"), updated: false, eventId };
    },
    async queueForReview(input) {
      reviewed.push(input);
    },
  };
}
