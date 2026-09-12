import { z } from "zod";
import { getEnv } from "@/lib/env";
import { publicationRecordSchema } from "../normalized";
import { createHttpClient, queryString, type HttpClient } from "../http";
import type { FetchOptions, RawRecord, SourceAdapter } from "../types";

/**
 * NCBI E-utilities (esearch + esummary). Without an API key NCBI allows 3 requests per
 * second; with NCBI_API_KEY the limit is 10. esummary does not return abstracts, so
 * publications ingested here have none until an abstract source is added.
 */

const BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";

const esearchSchema = z.object({
  esearchresult: z.object({
    idlist: z.array(z.string()).default([]),
    count: z.string().optional(),
  }),
});

const summarySchema = z.object({
  uid: z.string(),
  title: z.string().optional(),
  fulljournalname: z.string().optional(),
  source: z.string().optional(),
  pubdate: z.string().optional(),
  authors: z
    .array(z.object({ name: z.string().optional(), authtype: z.string().optional() }))
    .optional(),
  articleids: z
    .array(z.object({ idtype: z.string().optional(), value: z.string().optional() }))
    .optional(),
  pubtype: z.array(z.string()).optional(),
});

const esummarySchema = z.object({
  result: z.record(z.string(), z.unknown()),
});

const MONTHS: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
};

/** PubMed dates look like "2024", "2024 Mar" or "2024 Mar 15". */
export function parsePubmedDate(value: string | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})(?:\s+([A-Za-z]{3}))?(?:\s+(\d{1,2}))?/.exec(value.trim());
  if (!match) return null;
  const [, year, month, day] = match;
  const monthNumber = month ? (MONTHS[month.toLowerCase()] ?? "01") : "01";
  return `${year}-${monthNumber}-${(day ?? "1").padStart(2, "0")}`;
}

export function createPubMedAdapter(client?: HttpClient): SourceAdapter {
  const env = getEnv();
  const hasKey = Boolean(env.NCBI_API_KEY);
  const http =
    client ?? createHttpClient({ requestsPerSecond: hasKey ? 10 : 3, timeoutMs: 20_000 });
  const identity = {
    tool: "NeuroBase",
    email: env.INGEST_CONTACT_EMAIL,
    api_key: env.NCBI_API_KEY,
  };

  return {
    id: "pubmed",
    name: "PubMed (NCBI E-utilities)",
    sourceType: "peer_reviewed_paper",
    description:
      "Biomedical literature records from PubMed, retrieved through esearch and esummary.",
    termsOfUse:
      "NCBI E-utilities: 3 requests/second without a key, 10 with NCBI_API_KEY. Callers must send tool and email parameters (INGEST_CONTACT_EMAIL). Summaries do not include abstracts, so ingested papers carry a title, journal, date and authors only; bulk downloads must use NCBI's FTP datasets instead.",
    status: "available",

    async *fetch(query: string, options: FetchOptions): AsyncIterable<RawRecord> {
      const searchUrl = `${BASE}/esearch.fcgi?${queryString({
        db: "pubmed",
        term: query,
        retmode: "json",
        retmax: options.limit,
        sort: "date",
        ...identity,
      })}`;
      const search = await http.getJson(searchUrl, esearchSchema, { signal: options.signal });
      const ids = search.esearchresult.idlist.slice(0, options.limit);
      if (!ids.length) return;

      const summaryUrl = `${BASE}/esummary.fcgi?${queryString({
        db: "pubmed",
        id: ids.join(","),
        retmode: "json",
        ...identity,
      })}`;
      const summary = await http.getJson(summaryUrl, esummarySchema, { signal: options.signal });
      for (const pmid of ids) {
        const entry = summary.result[pmid];
        if (!entry) continue;
        yield {
          upstreamId: pmid,
          payload: entry,
          url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
          retrievedAt: new Date(),
        };
      }
    },

    normalize(raw: RawRecord) {
      const entry = summarySchema.parse(raw.payload);
      if (!entry.title) return null;
      const doi = entry.articleids?.find((id) => id.idtype === "doi")?.value ?? null;
      const journal = entry.fulljournalname ?? entry.source ?? null;
      const publishedOn = parsePubmedDate(entry.pubdate);
      const authors = (entry.authors ?? [])
        .filter((author) => author.authtype !== "CollectiveName")
        .flatMap((author) => (author.name ? [author.name] : []));
      const isPreprint = (entry.pubtype ?? []).some((type) =>
        type.toLowerCase().includes("preprint"),
      );
      const isReview = (entry.pubtype ?? []).some((type) => type.toLowerCase() === "review");

      return publicationRecordSchema.parse({
        kind: "publication",
        url: raw.url,
        sourceTitle: entry.title,
        sourceType: isPreprint ? "preprint" : "peer_reviewed_paper",
        publisher: journal ?? "PubMed",
        publishedAt: publishedOn,
        retrievedAt: raw.retrievedAt,
        doi,
        pmid: entry.uid,
        title: entry.title.replace(/\.$/, ""),
        // esummary carries no abstract; see termsOfUse.
        abstract: null,
        journal,
        publicationType: isPreprint ? "preprint" : isReview ? "review" : "peer_reviewed",
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
