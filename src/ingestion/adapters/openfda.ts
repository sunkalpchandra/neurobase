import { z } from "zod";
import { regulatoryActionRecordSchema } from "../normalized";
import { createHttpClient, queryString, type HttpClient } from "../http";
import type { FetchOptions, RawRecord, SourceAdapter } from "../types";

/**
 * openFDA device endpoints: 510(k) clearances and premarket approvals. Both are public
 * U.S. Government records; openFDA rate-limits anonymous callers to 240 requests per
 * minute and 1,000 per day.
 */

const K_API = "https://api.fda.gov/device/510k.json";
const PMA_API = "https://api.fda.gov/device/pma.json";

const clearanceSchema = z.object({
  k_number: z.string().optional(),
  pma_number: z.string().optional(),
  supplement_number: z.string().optional(),
  device_name: z.string().optional(),
  trade_name: z.string().optional(),
  applicant: z.string().optional(),
  decision_date: z.string().optional(),
  decision_code: z.string().optional(),
  decision_description: z.string().optional(),
  statement_or_summary: z.string().optional(),
  openfda: z.object({ device_name: z.string().optional() }).optional(),
});

const responseSchema = z.object({
  results: z.array(clearanceSchema).optional(),
  error: z.object({ code: z.string(), message: z.string() }).optional(),
});

/** openFDA decision dates are YYYYMMDD or YYYY-MM-DD. */
export function parseFdaDate(value: string | undefined): string | null {
  if (!value) return null;
  if (/^\d{8}$/.test(value))
    return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

export function createOpenFdaAdapter(client?: HttpClient): SourceAdapter {
  const http = client ?? createHttpClient({ requestsPerSecond: 3, timeoutMs: 20_000 });

  return {
    id: "openfda",
    name: "openFDA device clearances",
    sourceType: "government_database",
    description: "510(k) clearances and premarket approvals for medical devices.",
    termsOfUse:
      "openFDA is a public U.S. FDA API. Anonymous callers get 240 requests/minute and 1,000/day; an API key raises this. The FDA states the data is not for making medical decisions and that records may lag the official databases.",
    status: "available",

    async *fetch(query: string, options: FetchOptions): AsyncIterable<RawRecord> {
      const half = Math.max(1, Math.ceil(options.limit / 2));
      const endpoints: Array<{ api: string; search: string; kind: "510k" | "pma" }> = [
        { api: K_API, search: `device_name:"${query}"`, kind: "510k" },
        { api: PMA_API, search: `trade_name:"${query}"`, kind: "pma" },
      ];
      let yielded = 0;
      for (const endpoint of endpoints) {
        if (yielded >= options.limit || options.signal?.aborted) return;
        const url = `${endpoint.api}?${queryString({ search: endpoint.search, limit: half })}`;
        let body: z.infer<typeof responseSchema>;
        try {
          body = await http.getJson(url, responseSchema, { signal: options.signal });
        } catch {
          // openFDA answers 404 when a search matches nothing; that is not a failure.
          continue;
        }
        for (const result of body.results ?? []) {
          const reference = result.k_number ?? result.pma_number;
          if (!reference) continue;
          yield {
            upstreamId: reference,
            payload: { ...result, __endpoint: endpoint.kind },
            url: `${endpoint.api}?${queryString({ search: `${result.k_number ? "k_number" : "pma_number"}:"${reference}"` })}`,
            retrievedAt: new Date(),
          };
          yielded += 1;
          if (yielded >= options.limit) return;
        }
      }
    },

    normalize(raw: RawRecord) {
      const payload = raw.payload as Record<string, unknown>;
      const result = clearanceSchema.parse(payload);
      const reference = result.k_number ?? result.pma_number;
      if (!reference) return null;
      const deviceName =
        result.device_name ?? result.trade_name ?? result.openfda?.device_name ?? null;
      const isPma = payload.__endpoint === "pma" || Boolean(result.pma_number);
      const decisionDate = parseFdaDate(result.decision_date);
      const actionType = isPma ? "premarket_approval" : "510k_clearance";
      const summary = `FDA recorded ${isPma ? "premarket approval" : "510(k) clearance"} ${reference}${deviceName ? ` for ${deviceName}` : ""}${result.applicant ? `, applicant ${result.applicant}` : ""}.`;

      return regulatoryActionRecordSchema.parse({
        kind: "regulatory_action",
        url: raw.url,
        sourceTitle: `FDA ${reference}${deviceName ? `: ${deviceName}` : ""}`,
        sourceType: "government_database",
        publisher: "openFDA",
        publishedAt: decisionDate,
        retrievedAt: raw.retrievedAt,
        agency: "FDA",
        actionType,
        decisionDate,
        referenceNumber: reference,
        summary,
        applicantName: result.applicant ?? null,
        deviceName,
        mentions: {
          organizationNames: result.applicant ? [result.applicant] : [],
          personNames: [],
          conditionNames: [],
          deviceNames: deviceName ? [deviceName] : [],
        },
      });
    },
  };
}
