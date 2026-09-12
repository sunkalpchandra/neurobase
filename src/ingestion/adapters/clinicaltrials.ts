import { z } from "zod";
import type { TrialPhase, TrialStatus } from "@/domain/enums";
import { clinicalTrialRecordSchema } from "../normalized";
import { createHttpClient, queryString, type HttpClient } from "../http";
import type { FetchOptions, RawRecord, SourceAdapter } from "../types";

/**
 * ClinicalTrials.gov API v2 (https://clinicaltrials.gov/data-api/api). The API is
 * public, needs no key, and asks callers to identify themselves; records are in the
 * public domain.
 */

const API = "https://clinicaltrials.gov/api/v2/studies";

const dateStruct = z
  .object({ date: z.string().optional(), type: z.string().optional() })
  .optional();

const studySchema = z.object({
  protocolSection: z.object({
    identificationModule: z.object({
      nctId: z.string(),
      briefTitle: z.string().optional(),
      officialTitle: z.string().optional(),
      organization: z.object({ fullName: z.string().optional() }).optional(),
    }),
    statusModule: z
      .object({
        overallStatus: z.string().optional(),
        startDateStruct: dateStruct,
        completionDateStruct: dateStruct,
        lastUpdateSubmitDate: z.string().optional(),
      })
      .optional(),
    descriptionModule: z.object({ briefSummary: z.string().optional() }).optional(),
    conditionsModule: z.object({ conditions: z.array(z.string()).optional() }).optional(),
    designModule: z
      .object({
        phases: z.array(z.string()).optional(),
        studyType: z.string().optional(),
        designInfo: z
          .object({
            allocation: z.string().optional(),
            interventionModel: z.string().optional(),
            maskingInfo: z.object({ masking: z.string().optional() }).optional(),
            primaryPurpose: z.string().optional(),
          })
          .optional(),
        enrollmentInfo: z
          .object({ count: z.number().optional(), type: z.string().optional() })
          .optional(),
      })
      .optional(),
    armsInterventionsModule: z
      .object({
        interventions: z
          .array(z.object({ type: z.string().optional(), name: z.string().optional() }))
          .optional(),
      })
      .optional(),
    sponsorCollaboratorsModule: z
      .object({ leadSponsor: z.object({ name: z.string().optional() }).optional() })
      .optional(),
    outcomesModule: z
      .object({ primaryOutcomes: z.array(z.object({ measure: z.string().optional() })).optional() })
      .optional(),
  }),
});

const responseSchema = z.object({
  studies: z.array(studySchema).optional(),
  nextPageToken: z.string().optional(),
});

const STATUS_MAP: Record<string, TrialStatus> = {
  NOT_YET_RECRUITING: "not_yet_recruiting",
  RECRUITING: "recruiting",
  ENROLLING_BY_INVITATION: "enrolling_by_invitation",
  ACTIVE_NOT_RECRUITING: "active_not_recruiting",
  COMPLETED: "completed",
  SUSPENDED: "suspended",
  TERMINATED: "terminated",
  WITHDRAWN: "withdrawn",
  UNKNOWN: "unknown",
};

const PHASE_MAP: Record<string, TrialPhase> = {
  NA: "na",
  EARLY_PHASE1: "early_phase_1",
  PHASE1: "phase_1",
  PHASE2: "phase_2",
  PHASE3: "phase_3",
  PHASE4: "phase_4",
};

/** ClinicalTrials.gov dates are YYYY, YYYY-MM or YYYY-MM-DD; days default to the 1st. */
export function toIsoDay(value: string | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}$/.test(value)) return `${value}-01-01`;
  if (/^\d{4}-\d{2}$/.test(value)) return `${value}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return null;
}

function mapPhase(phases: string[] | undefined): TrialPhase {
  if (!phases?.length) return "na";
  const mapped = phases
    .map((phase) => PHASE_MAP[phase])
    .filter((phase): phase is TrialPhase => phase !== undefined);
  if (mapped.includes("phase_1") && mapped.includes("phase_2")) return "phase_1_2";
  if (mapped.includes("phase_2") && mapped.includes("phase_3")) return "phase_2_3";
  return mapped[0] ?? "na";
}

function describeDesign(
  design: z.infer<typeof studySchema>["protocolSection"]["designModule"],
): string | null {
  const info = design?.designInfo;
  if (!info) return null;
  const parts = [
    info.allocation,
    info.interventionModel,
    info.maskingInfo?.masking,
    info.primaryPurpose,
  ]
    .filter((part): part is string => Boolean(part))
    .map((part) => part.toLowerCase().replace(/_/g, " "));
  return parts.length ? parts.join(", ") : null;
}

export function createClinicalTrialsAdapter(client?: HttpClient): SourceAdapter {
  // The API documents no hard limit; one request per second is a courteous default.
  const http = client ?? createHttpClient({ requestsPerSecond: 1, timeoutMs: 20_000 });

  return {
    id: "clinicaltrials",
    name: "ClinicalTrials.gov",
    sourceType: "clinical_trial_registry",
    description: "Registered interventional and observational studies from the U.S. registry.",
    termsOfUse:
      "Public API v2, no key required. ClinicalTrials.gov asks callers to identify themselves (set INGEST_CONTACT_EMAIL) and to keep request rates modest. Records are U.S. Government works in the public domain.",
    status: "available",

    async *fetch(query: string, options: FetchOptions): AsyncIterable<RawRecord> {
      let pageToken: string | undefined;
      let yielded = 0;
      do {
        const url = `${API}?${queryString({
          "query.term": query,
          pageSize: Math.min(100, options.limit - yielded),
          pageToken,
          format: "json",
        })}`;
        const body = await http.getJson(url, responseSchema, { signal: options.signal });
        for (const study of body.studies ?? []) {
          const nctId = study.protocolSection.identificationModule.nctId;
          yield {
            upstreamId: nctId,
            payload: study,
            url: `https://clinicaltrials.gov/study/${nctId}`,
            retrievedAt: new Date(),
          };
          yielded += 1;
          if (yielded >= options.limit) return;
        }
        pageToken = body.nextPageToken;
      } while (pageToken && yielded < options.limit && !options.signal?.aborted);
    },

    normalize(raw: RawRecord) {
      const study = studySchema.parse(raw.payload);
      const {
        identificationModule,
        statusModule,
        descriptionModule,
        conditionsModule,
        designModule,
        armsInterventionsModule,
        sponsorCollaboratorsModule,
        outcomesModule,
      } = study.protocolSection;
      const title = identificationModule.briefTitle ?? identificationModule.officialTitle;
      if (!title) return null;
      const sponsor =
        sponsorCollaboratorsModule?.leadSponsor?.name ??
        identificationModule.organization?.fullName ??
        null;
      const devices = (armsInterventionsModule?.interventions ?? [])
        .filter((intervention) => intervention.type?.toUpperCase() === "DEVICE")
        .flatMap((intervention) => (intervention.name ? [intervention.name] : []));
      const startStruct = statusModule?.startDateStruct;
      const completionStruct = statusModule?.completionDateStruct;

      return clinicalTrialRecordSchema.parse({
        kind: "clinical_trial",
        url: raw.url,
        sourceTitle: `${identificationModule.nctId}: ${title}`,
        sourceType: "clinical_trial_registry",
        publisher: "ClinicalTrials.gov",
        publishedAt: toIsoDay(startStruct?.date),
        retrievedAt: raw.retrievedAt,
        registry: "clinicaltrials.gov",
        registryId: identificationModule.nctId,
        title,
        officialTitle: identificationModule.officialTitle ?? null,
        status: STATUS_MAP[statusModule?.overallStatus ?? "UNKNOWN"] ?? "unknown",
        phase: mapPhase(designModule?.phases),
        enrollment: designModule?.enrollmentInfo?.count ?? null,
        enrollmentIsEstimate:
          (designModule?.enrollmentInfo?.type ?? "ESTIMATED").toUpperCase() !== "ACTUAL",
        studyDesign: describeDesign(designModule),
        intervention: devices.length ? `Device: ${devices.join(", ")}` : null,
        summary: descriptionModule?.briefSummary ?? null,
        primaryOutcome: outcomesModule?.primaryOutcomes?.[0]?.measure ?? null,
        startDate: toIsoDay(startStruct?.date),
        completionDate: toIsoDay(completionStruct?.date),
        completionIsEstimate: (completionStruct?.type ?? "ESTIMATED").toUpperCase() !== "ACTUAL",
        sponsorName: sponsor,
        registryUpdatedOn: toIsoDay(statusModule?.lastUpdateSubmitDate),
        mentions: {
          organizationNames: sponsor ? [sponsor] : [],
          personNames: [],
          conditionNames: conditionsModule?.conditions ?? [],
          deviceNames: devices,
        },
      });
    },
  };
}
