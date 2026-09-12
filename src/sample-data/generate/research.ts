import type {
  DevelopmentStage,
  EvidenceStage,
  PatentStatus,
  PublicationType,
  StudyType,
} from "@/domain/enums";
import type { ISODate } from "@/domain/types";
import { yearOf } from "../dates";
import type { SeededRandom } from "../random";
import { conditionDef } from "../taxonomy";
import { fill } from "../text";
import { CONFERENCES, JOURNALS, PATENT_OFFICE, PREPRINT_SERVER } from "../vocab/names";
import { SAMPLE_DOI_PREFIX, type GenerationContext } from "./context";
import type { DeviceHandle } from "./devices";
import type { CompanyHandle, PersonHandle } from "./organizations";

export interface PublicationHandle {
  id: string;
  title: string;
  device: DeviceHandle | null;
  company: CompanyHandle;
  publishedOn: ISODate;
  evidenceStage: EvidenceStage;
  publicationType: PublicationType;
  studyType: StudyType;
  participants: number | null;
  /** Reported improvement over the previously published result, when the paper claims one. */
  improvement: {
    metricName: string;
    previousValue: number;
    currentValue: number;
    higherIsBetter: boolean;
  } | null;
  sourceId: string;
  authors: PersonHandle[];
}

export interface PatentHandle {
  id: string;
  title: string;
  patentNumber: string;
  company: CompanyHandle;
  device: DeviceHandle | null;
  filingDate: ISODate;
  grantDate: ISODate | null;
  status: PatentStatus;
  sourceId: string;
}

const STUDY_TYPE_BY_STAGE: Record<DevelopmentStage, StudyType[]> = {
  research: ["computational", "bench_study"],
  preclinical: ["animal_study", "bench_study"],
  early_feasibility: ["first_in_human", "case_series", "case_report"],
  pivotal: ["randomized_controlled_trial", "prospective_cohort"],
  regulatory_review: ["prospective_cohort", "randomized_controlled_trial"],
  authorized: ["prospective_cohort", "randomized_controlled_trial"],
  commercial: ["prospective_cohort", "systematic_review"],
  discontinued: ["case_series"],
};

const EVIDENCE_BY_STUDY_TYPE: Record<StudyType, EvidenceStage> = {
  computational: "simulation",
  bench_study: "laboratory",
  animal_study: "animal",
  first_in_human: "early_human_feasibility",
  case_report: "early_human_feasibility",
  case_series: "early_human_feasibility",
  prospective_cohort: "clinical_study",
  randomized_controlled_trial: "clinical_study",
  systematic_review: "clinical_study",
  meta_analysis: "clinical_study",
};

const HUMAN_STUDY_TYPES: StudyType[] = [
  "first_in_human",
  "case_report",
  "case_series",
  "prospective_cohort",
  "randomized_controlled_trial",
];

/** Publications attached to devices and their developers, plus the patents companies hold. */
export function generateResearch(
  context: GenerationContext,
  devices: DeviceHandle[],
  companies: CompanyHandle[],
  researchers: PersonHandle[],
): { publications: PublicationHandle[]; patents: PatentHandle[] } {
  const rng = context.random("publications");
  const publications: PublicationHandle[] = [];
  const target = context.count(420);

  for (let index = 0; index < target; index += 1) {
    const device = devices.length ? devices[index % devices.length] : undefined;
    const company = device ? device.company : companies[index % Math.max(1, companies.length)];
    if (!company) break;
    const archetype = company.archetype;
    const condition = conditionDef(archetype.conditions[0] ?? "spinal-cord-injury");
    const studyType = rng.pick(
      STUDY_TYPE_BY_STAGE[device?.stage ?? company.stage] ?? ["computational"],
    );
    const evidenceStage = EVIDENCE_BY_STUDY_TYPE[studyType];
    const publicationType: PublicationType = rng.pickWeighted<PublicationType>([
      { value: "peer_reviewed", weight: 6 },
      { value: "preprint", weight: 2 },
      { value: "conference", weight: 1 },
      { value: "review", weight: 1 },
    ]);
    const publishedOn = context.calendar.recentDate(rng);
    const participants = HUMAN_STUDY_TYPES.includes(studyType) ? rng.int(1, 60) : null;
    const title = fill(rng.pick(archetype.publicationTitles), {
      device: device?.name ?? `${company.name} platform`,
      condition: condition.name,
      channels: device?.channels ?? rng.pick([64, 128, 256]),
      months: rng.int(3, 24),
      n: participants ?? rng.int(4, 24),
    });

    const journal =
      publicationType === "preprint"
        ? PREPRINT_SERVER
        : publicationType === "conference"
          ? rng.pick(CONFERENCES)
          : rng.pick(JOURNALS);
    const doi = `${SAMPLE_DOI_PREFIX}.${index + 1}`;
    const sourceId = context.source(rng, {
      path: `papers/${index + 1}`,
      title,
      sourceType: publicationType === "preprint" ? "preprint" : "peer_reviewed_paper",
      publisher: journal,
      publishedAt: publishedOn,
      confidence: publicationType === "preprint" ? "moderate" : "high",
    });

    const headline = device?.headline;
    const improvement =
      headline && rng.chance(0.35)
        ? (() => {
            const delta = rng.float(0.03, 0.4);
            const previous = headline.higherIsBetter
              ? headline.value / (1 + delta)
              : headline.value * (1 + delta);
            return {
              metricName: headline.name,
              previousValue: Number(previous.toFixed(headline.decimals + 1)),
              currentValue: headline.value,
              higherIsBetter: headline.higherIsBetter,
            };
          })()
        : null;

    const id = context.ids.next("publications");
    const abstract =
      `${title}. ${participants === null ? "This work reports bench and computational results" : `This study reports results from ${participants} participant${participants === 1 ? "" : "s"}`} for ${device?.name ?? company.name}, ${archetype.label === "cochlear implant" ? "a" : "an"} ${archetype.label}, in the context of ${condition.phrase}. Development sample record; the text is generated and describes no real study.`.replace(
        /, an ([bcdfghjklmnpqrstvwxyz])/i,
        ", a $1",
      );

    context.dataset.publications.push({
      id,
      doi,
      pmid: rng.chance(0.6) ? `S${String(10_000_000 + index)}` : null,
      title,
      abstract,
      journal,
      publicationType,
      studyType,
      publishedOn,
      year: yearOf(publishedOn),
      url: `https://sample.neurobase.invalid/papers/${index + 1}`,
      evidenceStage,
      ...context.provenance(rng, {
        confidence: publicationType === "preprint" ? "moderate" : "high",
      }),
    });

    const pool = [...company.people, ...rng.sample(researchers, 4)];
    const authors = rng.sample(pool, rng.int(2, Math.min(6, Math.max(2, pool.length))));
    authors.forEach((author, position) => {
      context.dataset.publicationAuthors.push({
        publicationId: id,
        personId: author.id,
        authorPosition: position + 1,
        isCorresponding: position === authors.length - 1,
      });
    });

    if (device) context.dataset.publicationDevices.push({ publicationId: id, deviceId: device.id });
    const organizationIds = new Set<string>([
      company.id,
      ...authors.map((author) => author.organizationId),
    ]);
    for (const organizationId of organizationIds) {
      context.dataset.publicationOrganizations.push({ publicationId: id, organizationId });
    }

    context.claim(rng, {
      entityType: "publication",
      entityId: id,
      claimKind: "study_result",
      statement: improvement
        ? `${title} reports ${improvement.currentValue} for ${improvement.metricName}, compared with ${improvement.previousValue} previously reported.`
        : `${title} reports ${participants === null ? "preclinical" : `results from ${participants} participant${participants === 1 ? "" : "s"}`} for ${device?.name ?? company.name}.`,
      sourceIds: [sourceId],
      confidence: publicationType === "preprint" ? "moderate" : "high",
    });

    publications.push({
      id,
      title,
      device: device ?? null,
      company,
      publishedOn,
      evidenceStage,
      publicationType,
      studyType,
      participants,
      improvement,
      sourceId,
      authors,
    });
  }

  const patents = generatePatents(context, rng, devices, companies);
  return { publications, patents };
}

function generatePatents(
  context: GenerationContext,
  rng: SeededRandom,
  devices: DeviceHandle[],
  companies: CompanyHandle[],
): PatentHandle[] {
  const patents: PatentHandle[] = [];
  const target = context.count(60);
  for (let index = 0; index < target; index += 1) {
    const device = devices.length ? devices[index % devices.length] : undefined;
    const company = device ? device.company : companies[index % Math.max(1, companies.length)];
    if (!company) break;
    const title = rng.pick(company.archetype.patentTitles);
    const filingDate = context.calendar.recentDate(rng);
    const status: PatentStatus = rng.pickWeighted<PatentStatus>([
      { value: "granted", weight: 4 },
      { value: "pending", weight: 3 },
      { value: "published", weight: 3 },
      { value: "expired", weight: 1 },
      { value: "abandoned", weight: 1 },
    ]);
    const granted = status === "granted" || status === "expired";
    const grantDate = granted
      ? context.calendar.dateBetween(rng, filingDate, context.calendar.asOf)
      : null;
    // Jurisdiction XX is the ISO user-assigned code, so no real patent office is implied.
    const patentNumber = `XX${String(yearOf(filingDate))}${String(100000 + index).slice(-6)}A1`;
    const sourceId = context.source(rng, {
      path: `patents/${patentNumber.toLowerCase()}`,
      title: `${patentNumber}: ${title}`,
      sourceType: "patent_record",
      publisher: PATENT_OFFICE,
      publishedAt: grantDate ?? filingDate,
      confidence: "high",
    });

    const id = context.ids.next("patents");
    context.dataset.patents.push({
      id,
      patentNumber,
      applicationNumber: `XX/${String(rng.int(100000, 999999))}`,
      title,
      abstract: `${title}. Development sample patent record assigned to ${company.name}; the text is generated and describes no real filing.`,
      jurisdiction: "XX",
      filingDate,
      publicationDate: context.calendar.dateBetween(
        rng,
        filingDate,
        grantDate ?? context.calendar.asOf,
      ),
      grantDate,
      status,
      assigneeOrganizationId: company.id,
      url: `https://sample.neurobase.invalid/patents/${patentNumber.toLowerCase()}`,
      ...context.provenance(rng, { confidence: "high", verificationStatus: "machine_verified" }),
    });

    for (const inventor of rng.sample(company.people, Math.min(2, company.people.length))) {
      context.dataset.patentInventors.push({ patentId: id, personId: inventor.id });
    }
    if (device) context.dataset.patentDevices.push({ patentId: id, deviceId: device.id });

    context.claim(rng, {
      entityType: "patent",
      entityId: id,
      claimKind: "patent_filing",
      statement: `${patentNumber} ("${title}") is assigned to ${company.name} and is ${status.replace(/_/g, " ")}.`,
      sourceIds: [sourceId],
      confidence: "high",
    });

    patents.push({
      id,
      title,
      patentNumber,
      company,
      device: device ?? null,
      filingDate,
      grantDate,
      status,
      sourceId,
    });
  }
  return patents;
}
