import { z } from "zod";
import type { PublicationType } from "@/domain/enums";
import { getEnv } from "@/lib/env";
import { publicationRecordSchema } from "../normalized";
import { createHttpClient, queryString, type HttpClient } from "../http";
import type { FetchOptions, RawRecord, SourceAdapter } from "../types";

/**
 * Crossref REST API. Sending a mailto address joins the "polite pool", which Crossref
 * asks of automated callers and which gets more predictable service.
 */

const API = "https://api.crossref.org/works";

const dateParts = z.object({ "date-parts": z.array(z.array(z.number())).optional() }).optional();

const workSchema = z.object({
  DOI: z.string(),
  title: z.array(z.string()).optional(),
  abstract: z.string().optional(),
  "container-title": z.array(z.string()).optional(),
  issued: dateParts,
  created: dateParts,
  type: z.string().optional(),
  publisher: z.string().optional(),
  author: z
    .array(
      z.object({
        given: z.string().optional(),
        family: z.string().optional(),
        name: z.string().optional(),
      }),
    )
    .optional(),
  URL: z.string().optional(),
});

const responseSchema = z.object({
  message: z.object({ items: z.array(workSchema).optional() }),
});

const TYPE_MAP: Record<string, PublicationType> = {
  "journal-article": "peer_reviewed",
  "posted-content": "preprint",
  "proceedings-article": "conference",
  "book-chapter": "review",
};

/** Crossref date-parts arrive as [[year, month?, day?]]. */
export function fromDateParts(parts: number[][] | undefined): string | null {
  const first = parts?.[0];
  if (!first?.length) return null;
  const [year, month = 1, day = 1] = first;
  if (!year) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Crossref abstracts are JATS XML fragments; the tags are stripped, never rendered. */
export function stripJats(abstract: string | undefined): string | null {
  if (!abstract) return null;
  const text = abstract
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.length ? text : null;
}

export function createCrossrefAdapter(client?: HttpClient): SourceAdapter {
  const mailto = getEnv().INGEST_CONTACT_EMAIL;
  const http = client ?? createHttpClient({ requestsPerSecond: 5, timeoutMs: 20_000 });

  return {
    id: "crossref",
    name: "Crossref",
    sourceType: "peer_reviewed_paper",
    description: "Scholarly metadata (DOI, title, venue, authors) from the Crossref registry.",
    termsOfUse:
      "Public REST API. Crossref asks automated callers to send a mailto address (INGEST_CONTACT_EMAIL) to join the polite pool; metadata is distributed under CC0. Abstracts are only present when the publisher deposited them.",
    status: "available",

    async *fetch(query: string, options: FetchOptions): AsyncIterable<RawRecord> {
      const url = `${API}?${queryString({ query, rows: Math.min(100, options.limit), mailto, select: "DOI,title,abstract,container-title,issued,created,type,publisher,author,URL" })}`;
      const body = await http.getJson(url, responseSchema, { signal: options.signal });
      let yielded = 0;
      for (const work of body.message.items ?? []) {
        yield {
          upstreamId: work.DOI,
          payload: work,
          url: work.URL ?? `https://doi.org/${work.DOI}`,
          retrievedAt: new Date(),
        };
        yielded += 1;
        if (yielded >= options.limit) return;
      }
    },

    normalize(raw: RawRecord) {
      const work = workSchema.parse(raw.payload);
      const title = work.title?.[0];
      if (!title) return null;
      const publishedOn =
        fromDateParts(work.issued?.["date-parts"]) ?? fromDateParts(work.created?.["date-parts"]);
      const journal = work["container-title"]?.[0] ?? null;
      const authors = (work.author ?? []).flatMap((author) => {
        const name = author.name ?? [author.given, author.family].filter(Boolean).join(" ");
        return name ? [name] : [];
      });
      const publicationType = TYPE_MAP[work.type ?? ""] ?? "peer_reviewed";

      return publicationRecordSchema.parse({
        kind: "publication",
        url: raw.url,
        sourceTitle: title,
        sourceType: publicationType === "preprint" ? "preprint" : "peer_reviewed_paper",
        publisher: work.publisher ?? journal ?? "Crossref",
        publishedAt: publishedOn,
        retrievedAt: raw.retrievedAt,
        doi: work.DOI,
        pmid: null,
        title,
        abstract: stripJats(work.abstract),
        journal,
        publicationType,
        studyType: null,
        publishedOn,
        year: publishedOn ? Number(publishedOn.slice(0, 4)) : null,
        authorNames: authors,
        mentions: {
          organizationNames: [],
          personNames: authors,
          conditionNames: [],
          deviceNames: [],
        },
      });
    },
  };
}
