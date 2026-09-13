import { z } from "zod";
import type { OrganizationKind, PublicationType } from "@/domain/enums";
import { getEnv } from "@/lib/env";
import { organizationRecordSchema, publicationRecordSchema } from "../normalized";
import { createHttpClient, queryString, type HttpClient } from "../http";
import type { FetchOptions, RawRecord, SourceAdapter } from "../types";

/**
 * OpenAlex (https://openalex.org). The whole catalogue is CC0 and the API needs no key;
 * sending a mailto address joins the polite pool. It is the only free source here that
 * carries author affiliations, which is what lets NeuroBase record real organizations.
 */

const WORKS = "https://api.openalex.org/works";
const INSTITUTIONS = "https://api.openalex.org/institutions";

const institutionRef = z.object({
  id: z.string().optional(),
  display_name: z.string().optional(),
  country_code: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
});

const workSchema = z.object({
  id: z.string(),
  doi: z.string().nullable().optional(),
  ids: z.object({ pmid: z.string().nullable().optional() }).optional(),
  title: z.string().nullable().optional(),
  display_name: z.string().nullable().optional(),
  publication_date: z.string().nullable().optional(),
  publication_year: z.number().nullable().optional(),
  type: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  abstract_inverted_index: z.record(z.string(), z.array(z.number())).nullable().optional(),
  primary_location: z
    .object({
      source: z
        .object({
          display_name: z.string().nullable().optional(),
          type: z.string().nullable().optional(),
        })
        .nullable()
        .optional(),
      landing_page_url: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
  authorships: z
    .array(
      z.object({
        author: z.object({ display_name: z.string().nullable().optional() }).optional(),
        institutions: z.array(institutionRef).optional(),
      }),
    )
    .optional(),
  topics: z.array(z.object({ display_name: z.string().optional() })).optional(),
});

const worksResponse = z.object({
  results: z.array(workSchema).optional(),
  meta: z.object({ next_cursor: z.string().nullable().optional() }).optional(),
});

const institutionSchema = z.object({
  id: z.string(),
  ror: z.string().nullable().optional(),
  display_name: z.string(),
  display_name_alternatives: z.array(z.string()).optional(),
  country_code: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  homepage_url: z.string().nullable().optional(),
  works_count: z.number().optional(),
});

const institutionsResponse = z.object({
  results: z.array(institutionSchema).optional(),
  meta: z.object({ next_cursor: z.string().nullable().optional() }).optional(),
});

/** OpenAlex work types mapped onto the publication vocabulary. */
const TYPE_MAP: Record<string, PublicationType> = {
  article: "peer_reviewed",
  preprint: "preprint",
  review: "review",
  "book-chapter": "review",
  proceedings: "conference",
  "proceedings-article": "conference",
  dissertation: "peer_reviewed",
  report: "peer_reviewed",
};

/** OpenAlex institution types mapped onto the organization vocabulary. */
export const INSTITUTION_KIND_MAP: Record<string, OrganizationKind> = {
  education: "university",
  company: "company",
  healthcare: "hospital",
  facility: "research_lab",
  nonprofit: "nonprofit",
  government: "government_agency",
  funder: "investor",
};

/**
 * OpenAlex stores abstracts as an inverted index (token → positions) because some
 * publishers forbid redistributing the plain text. Rebuilding it locally is what the
 * field is for and is documented by OpenAlex.
 */
export function reconstructAbstract(
  index: Record<string, number[]> | null | undefined,
): string | null {
  if (!index) return null;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  const text = words
    .filter((word) => word !== undefined)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 20 ? text : null;
}

/** OpenAlex prefixes DOIs with the resolver; the bare DOI is what we store. */
export function bareDoi(doi: string | null | undefined): string | null {
  if (!doi) return null;
  return doi.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").toLowerCase() || null;
}

function mailto(): string | undefined {
  return getEnv().INGEST_CONTACT_EMAIL;
}

export function createOpenAlexWorksAdapter(client?: HttpClient): SourceAdapter {
  const http =
    client ??
    createHttpClient({
      requestsPerSecond: 2,
      timeoutMs: 25_000,
      maxRetries: 5,
      baseBackoffMs: 2_000,
    });

  return {
    id: "openalex",
    name: "OpenAlex works",
    sourceType: "peer_reviewed_paper",
    description: "Research papers with author affiliations, venues, topics and abstracts.",
    termsOfUse:
      "OpenAlex is CC0 and needs no key. Sending a mailto address (INGEST_CONTACT_EMAIL) joins the polite pool, which OpenAlex asks of automated callers; the daily limit is 100,000 calls. Abstracts are stored as an inverted index and reconstructed locally, which is the documented use of that field.",
    status: "available",

    async *fetch(query: string, options: FetchOptions): AsyncIterable<RawRecord> {
      let cursor = "*";
      let yielded = 0;
      while (yielded < options.limit && !options.signal?.aborted) {
        const url = `${WORKS}?${queryString({
          filter: `title_and_abstract.search:${query},type:article|review|preprint,has_doi:true`,
          per_page: Math.min(200, options.limit - yielded),
          cursor,
          sort: "cited_by_count:desc",
          mailto: mailto(),
        })}`;
        const body = await http.getJson(url, worksResponse, { signal: options.signal });
        const results = body.results ?? [];
        if (results.length === 0) return;
        for (const work of results) {
          yield {
            upstreamId: work.id,
            payload: work,
            url: bareDoi(work.doi) ? `https://doi.org/${bareDoi(work.doi)}` : work.id,
            retrievedAt: new Date(),
          };
          yielded += 1;
          if (yielded >= options.limit) return;
        }
        const next = body.meta?.next_cursor;
        if (!next) return;
        cursor = next;
      }
    },

    normalize(raw: RawRecord) {
      const work = workSchema.parse(raw.payload);
      const title = work.title ?? work.display_name;
      if (!title) return null;
      const doi = bareDoi(work.doi);
      const journal = work.primary_location?.source?.display_name ?? null;
      const authors = (work.authorships ?? []).flatMap((authorship) =>
        authorship.author?.display_name ? [authorship.author.display_name] : [],
      );
      // OpenAlex states what each institution is, so the organization is recorded as a
      // university, hospital, company or lab rather than guessed from the record kind.
      const affiliations = new Map<
        string,
        { name: string; kind: OrganizationKind | null; country: string | null }
      >();
      for (const authorship of work.authorships ?? []) {
        for (const institution of authorship.institutions ?? []) {
          const name = institution.display_name;
          if (!name || affiliations.has(name.toLowerCase())) continue;
          const country = institution.country_code?.toUpperCase() ?? null;
          affiliations.set(name.toLowerCase(), {
            name,
            // A type OpenAlex does not publish, or one outside the map, is left unstated
            // rather than filed as a lab: the catalogue not saying is not evidence.
            kind: INSTITUTION_KIND_MAP[institution.type ?? ""] ?? null,
            country: country && /^[A-Z]{2}$/.test(country) ? country : null,
          });
        }
      }
      const publicationType = TYPE_MAP[work.type ?? ""] ?? "peer_reviewed";
      const publishedOn =
        work.publication_date ?? (work.publication_year ? `${work.publication_year}-01-01` : null);

      return publicationRecordSchema.parse({
        kind: "publication",
        url: raw.url,
        sourceTitle: title,
        sourceType: publicationType === "preprint" ? "preprint" : "peer_reviewed_paper",
        publisher: journal ?? "OpenAlex",
        publishedAt: publishedOn,
        retrievedAt: raw.retrievedAt,
        doi,
        pmid:
          work.ids?.pmid
            ?.replace(/^https?:\/\/pubmed\.ncbi\.nlm\.nih\.gov\//, "")
            .replace(/\/$/, "") ?? null,
        title,
        abstract: reconstructAbstract(work.abstract_inverted_index),
        journal,
        publicationType,
        studyType: null,
        publishedOn,
        year: work.publication_year ?? (publishedOn ? Number(publishedOn.slice(0, 4)) : null),
        authorNames: authors,
        topics: (work.topics ?? []).flatMap((topic) =>
          topic.display_name ? [topic.display_name] : [],
        ),
        affiliations: [...affiliations.values()],
        mentions: {
          organizationNames: [],
          personNames: authors,
          // OpenAlex topics name a research area, not a medical indication, so they are
          // carried as topics rather than pushed at the condition taxonomy.
          conditionNames: [],
          deviceNames: [],
        },
      });
    },
  };
}

export function createOpenAlexInstitutionsAdapter(client?: HttpClient): SourceAdapter {
  const http =
    client ??
    createHttpClient({
      requestsPerSecond: 2,
      timeoutMs: 25_000,
      maxRetries: 5,
      baseBackoffMs: 2_000,
    });

  return {
    id: "openalex-institutions",
    name: "OpenAlex institutions",
    sourceType: "government_database",
    description: "Universities, companies, hospitals and labs with country, type and homepage.",
    termsOfUse:
      "OpenAlex institution records are CC0 and need no key; they carry a ROR identifier, a type and a homepage. Used to record organizations that appear in the literature, with the OpenAlex record as the source.",
    status: "available",

    async *fetch(query: string, options: FetchOptions): AsyncIterable<RawRecord> {
      let cursor = "*";
      let yielded = 0;
      while (yielded < options.limit && !options.signal?.aborted) {
        const url = `${INSTITUTIONS}?${queryString({
          filter: `display_name.search:${query}`,
          per_page: Math.min(200, options.limit - yielded),
          cursor,
          sort: "works_count:desc",
          mailto: mailto(),
        })}`;
        const body = await http.getJson(url, institutionsResponse, { signal: options.signal });
        const results = body.results ?? [];
        if (results.length === 0) return;
        for (const institution of results) {
          yield {
            upstreamId: institution.id,
            payload: institution,
            url: institution.id,
            retrievedAt: new Date(),
          };
          yielded += 1;
          if (yielded >= options.limit) return;
        }
        const next = body.meta?.next_cursor;
        if (!next) return;
        cursor = next;
      }
    },

    normalize(raw: RawRecord) {
      const institution = institutionSchema.parse(raw.payload);
      const kind = INSTITUTION_KIND_MAP[institution.type ?? ""] ?? null;
      // Archives and unclassified entries are not organizations NeuroBase tracks.
      if (!kind) return null;
      const country = institution.country_code?.toUpperCase() ?? null;
      const description = `${institution.display_name} is a ${institution.type ?? "organization"} recorded in OpenAlex${country ? ` in ${country}` : ""}${institution.works_count ? `, credited with ${institution.works_count.toLocaleString("en-US")} indexed works` : ""}.`;

      return organizationRecordSchema.parse({
        kind: "organization",
        url: institution.ror ?? raw.url,
        sourceTitle: `OpenAlex institution record: ${institution.display_name}`,
        sourceType: "government_database",
        publisher: "OpenAlex",
        publishedAt: null,
        retrievedAt: raw.retrievedAt,
        name: institution.display_name,
        description,
        website: institution.homepage_url ?? null,
        country: country && /^[A-Z]{2}$/.test(country) ? country : null,
        organizationKind: kind,
        aliases: institution.display_name_alternatives ?? [],
        mentions: {
          organizationNames: [institution.display_name],
          personNames: [],
          conditionNames: [],
          deviceNames: [],
        },
      });
    },
  };
}
