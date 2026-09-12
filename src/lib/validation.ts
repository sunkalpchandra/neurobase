import { z } from "zod";
import {
  DEVELOPMENT_STAGES,
  ENTITY_TYPES,
  EVENT_TYPES,
  EVIDENCE_STAGES,
  FEEDBACK_SIGNALS,
  FOLLOW_TARGET_TYPES,
  INVASIVENESS_LEVELS,
  MODALITIES,
  OPERATING_STATUSES,
  ORGANIZATION_KINDS,
  SEARCH_CATEGORIES,
  SOURCE_TYPES,
  TRIAL_STATUSES,
} from "@/domain/enums";
import { COMPANY_SORT_KEYS, type CompanyDirectoryQuery, type FeedQuery } from "@/data/types";
import type { SearchFilters, SearchRequest } from "@/search/types";
import { ValidationError } from "./errors";

/**
 * Request-boundary validation. Pages and API routes parse raw query strings through
 * these schemas and pass the typed result to repositories and services.
 */

export type RawParams = Record<string, string | string[] | undefined>;

const slug = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*$/i, "Expected a slug");
const countryCode = z
  .string()
  .trim()
  .length(2)
  .regex(/^[A-Za-z]{2}$/)
  .transform((value) => value.toUpperCase());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected YYYY-MM-DD");

/** Accepts "a,b", ["a","b"], or undefined and yields a de-duplicated array. */
function list<T extends z.ZodTypeAny>(item: T) {
  return z.preprocess((value: unknown) => {
    if (value === undefined || value === null || value === "") return undefined;
    const raw = Array.isArray(value) ? value : [value];
    const parts = raw.flatMap((entry) => (typeof entry === "string" ? entry.split(",") : []));
    const cleaned = parts.map((part) => part.trim()).filter(Boolean);
    return cleaned.length ? Array.from(new Set(cleaned)) : undefined;
  }, z.array(item).max(20).optional());
}

export const searchFiltersSchema = z.object({
  technologyCategories: list(slug),
  conditions: list(slug),
  invasiveness: list(z.enum(INVASIVENESS_LEVELS)),
  modality: list(z.enum(MODALITIES)),
  developmentStage: list(z.enum(DEVELOPMENT_STAGES)),
  evidenceStage: list(z.enum(EVIDENCE_STAGES)),
  trialStatus: list(z.enum(TRIAL_STATUSES)),
  organizationKind: list(z.enum(ORGANIZATION_KINDS)),
  country: list(countryCode),
  publishedFrom: isoDate.optional(),
  publishedTo: isoDate.optional(),
  sourceTypes: list(z.enum(SOURCE_TYPES)),
});

const pageSize = (defaultSize: number, max: number) =>
  z.coerce.number().int().min(1).max(max).default(defaultSize);
const cursor = z.string().trim().max(200).optional();

export const searchRequestSchema = searchFiltersSchema.extend({
  q: z.string().trim().max(200).default(""),
  category: z.enum(SEARCH_CATEGORIES).default("all"),
  cursor,
  pageSize: pageSize(20, 50),
});

export const suggestQuerySchema = z.object({
  q: z.string().trim().min(1).max(80),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

export const companyDirectorySchema = z.object({
  q: z.string().trim().max(120).optional(),
  technologyCategories: list(slug),
  conditions: list(slug),
  invasiveness: list(z.enum(INVASIVENESS_LEVELS)),
  modality: list(z.enum(MODALITIES)),
  developmentStage: list(z.enum(DEVELOPMENT_STAGES)),
  country: list(countryCode),
  operatingStatus: list(z.enum(OPERATING_STATUSES)),
  sort: z.enum(COMPANY_SORT_KEYS).default("name"),
  direction: z.enum(["asc", "desc"]).default("asc"),
  cursor,
  pageSize: pageSize(25, 100),
});

export const feedQuerySchema = z.object({
  topic: slug.optional(),
  eventTypes: list(z.enum(EVENT_TYPES)),
  cursor,
  pageSize: pageSize(20, 50),
});

export const listQuerySchema = z.object({
  cursor,
  pageSize: pageSize(25, 100),
});

export const savedItemInputSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.uuid(),
  note: z.string().trim().max(500).nullable().optional(),
});

export const followInputSchema = z.object({
  targetType: z.enum(FOLLOW_TARGET_TYPES),
  targetId: z.uuid(),
});

export const feedbackInputSchema = z.object({
  entityType: z.enum(ENTITY_TYPES),
  entityId: z.uuid(),
  signal: z.enum(FEEDBACK_SIGNALS),
});

function parseOrThrow<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new ValidationError("Invalid request parameters", result.error.issues);
  }
  return result.data;
}

/** Converts URLSearchParams to the record shape Next.js pages receive. */
export function searchParamsToRecord(params: URLSearchParams): RawParams {
  const record: RawParams = {};
  for (const key of new Set(params.keys())) {
    const values = params.getAll(key);
    record[key] = values.length > 1 ? values : values[0];
  }
  return record;
}

export function parseSearchRequest(input: RawParams): SearchRequest {
  const parsed = parseOrThrow(searchRequestSchema, input);
  const { q, category, cursor: parsedCursor, pageSize: size, ...filters } = parsed;
  return {
    q,
    category,
    cursor: parsedCursor ?? null,
    pageSize: size,
    filters: compactFilters(filters),
  };
}

export function parseCompanyDirectoryQuery(input: RawParams): CompanyDirectoryQuery {
  const parsed = parseOrThrow(companyDirectorySchema, input);
  return { ...parsed, cursor: parsed.cursor ?? null };
}

export function parseFeedQuery(input: RawParams): FeedQuery {
  const parsed = parseOrThrow(feedQuerySchema, input);
  return { ...parsed, cursor: parsed.cursor ?? null };
}

export function parseListQuery(input: RawParams): { cursor: string | null; pageSize: number } {
  const parsed = parseOrThrow(listQuerySchema, input);
  return { cursor: parsed.cursor ?? null, pageSize: parsed.pageSize };
}

export function parseSuggestQuery(input: RawParams): z.infer<typeof suggestQuerySchema> {
  return parseOrThrow(suggestQuerySchema, input);
}

function compactFilters(filters: SearchFilters): SearchFilters {
  const compact: SearchFilters = {};
  for (const [key, value] of Object.entries(filters) as Array<[keyof SearchFilters, unknown]>) {
    if (value === undefined) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    (compact as Record<string, unknown>)[key] = value;
  }
  return compact;
}

/** Serialises filters and options back into a query string for links. */
export function toSearchParams(
  values: Record<string, string | number | string[] | null | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
      continue;
    }
    params.set(key, String(value));
  }
  return params;
}
