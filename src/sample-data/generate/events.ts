import { assessImpact, type ImpactInput } from "@/domain/impact";
import type { EntityType, EventType, EvidenceStage, SourceType } from "@/domain/enums";
import type { ISODate } from "@/domain/types";
import { formatUsdCompact } from "@/lib/format";
import type { SeededRandom } from "../random";
import { conditionDef } from "../taxonomy";
import { NEWS_OUTLETS } from "../vocab/names";
import type { GenerationContext } from "./context";
import type { RegulatoryHandle, TrialHandle } from "./clinical";
import type { DeviceHandle } from "./devices";
import type { FundingRoundHandle } from "./funding";
import type { CompanyHandle } from "./organizations";
import type { PatentHandle, PublicationHandle } from "./research";

interface ImpactFacts {
  humanParticipants?: number | null;
  regulatoryActionType?: ImpactInput["regulatoryActionType"];
  fundingAmountUsd?: number | null;
  novelty?: ImpactInput["novelty"];
  technicalImprovement?: ImpactInput["technicalImprovement"];
  addressesUnmetNeed?: boolean;
}

/**
 * Attaches an explainable impact assessment to a development, derived from the same
 * facts the record itself states. The assessment is rule-based (author "rules_v1") and
 * carries the ids of the sources it relied on.
 */
function attachImpact(
  context: GenerationContext,
  eventId: string,
  eventType: EventType,
  occurredOn: ISODate,
  evidenceStage: EvidenceStage | null,
  sourceIds: string[],
  relatedEntityCount: number,
  facts: ImpactFacts,
): void {
  const event = context.dataset.events.find((row) => row.id === eventId);
  if (!event) return;
  const sourceTypes = sourceIds
    .map((sourceId) => context.dataset.sources.find((source) => source.id === sourceId)?.sourceType)
    .filter((sourceType): sourceType is SourceType => sourceType !== undefined);
  const publishers = new Set(
    sourceIds.map(
      (sourceId) =>
        context.dataset.sources.find((source) => source.id === sourceId)?.publisher ?? "",
    ),
  );
  const input: ImpactInput = {
    eventType,
    evidenceStage,
    sourceTypes,
    sourceIds,
    independentSourceCount: publishers.size,
    relatedEntityCount,
    occurredOn,
    asOf: context.calendar.asOf,
    humanParticipants: facts.humanParticipants ?? null,
    regulatoryActionType: facts.regulatoryActionType ?? null,
    fundingAmountUsd: facts.fundingAmountUsd ?? null,
    novelty: facts.novelty ?? null,
    technicalImprovement: facts.technicalImprovement ?? null,
    addressesUnmetNeed: facts.addressesUnmetNeed ?? false,
  };
  event.impact = assessImpact(input);
}

function novelty(rng: SeededRandom): ImpactInput["novelty"] {
  return rng.pickWeighted<ImpactInput["novelty"]>([
    { value: "incremental", weight: 5 },
    { value: "notable", weight: 3 },
    { value: "first_of_kind", weight: 1 },
    { value: null, weight: 2 },
  ]);
}

export interface EventInputs {
  companies: CompanyHandle[];
  devices: DeviceHandle[];
  trials: TrialHandle[];
  publications: PublicationHandle[];
  patents: PatentHandle[];
  fundingRounds: FundingRoundHandle[];
  regulatoryActions: RegulatoryHandle[];
}

/**
 * Developments across every entity type, plus the news articles that report them.
 * Several articles about one development share an event, which is what the feed groups.
 */
export function generateEvents(context: GenerationContext, inputs: EventInputs): void {
  const rng = context.random("events");
  const { companies, devices, trials, publications, patents, fundingRounds, regulatoryActions } =
    inputs;

  // 1. Founding, for a subset of companies: enough for timelines without flooding the feed.
  for (const company of rng.sample(companies, Math.ceil(companies.length * 0.35))) {
    const id = context.event(rng, {
      eventType: "founding",
      title: `${company.name} founded in ${company.place.city}`,
      summary: `${company.name} was founded in ${company.foundedYear} to develop ${company.archetype.productPhrase}.`,
      occurredOn: company.foundedOn,
      primaryEntityType: "organization",
      primaryEntityId: company.id,
      entities: [
        { type: "organization", id: company.id },
        ...company.founders.map((founder) => ({
          type: "researcher" as EntityType,
          id: founder.id,
          role: "founder",
        })),
      ],
      sourceIds: [company.statementSourceId],
      dedupeParts: ["founding", company.slug],
    });
    if (id)
      attachImpact(
        context,
        id,
        "founding",
        company.foundedOn,
        null,
        [company.statementSourceId],
        1 + company.founders.length,
        {},
      );
  }

  // 2. Funding rounds.
  for (const round of fundingRounds) {
    const amountText =
      round.amountUsd === null ? "an undisclosed amount" : formatUsdCompact(round.amountUsd);
    const id = context.event(rng, {
      eventType: "funding_round",
      title: `${round.company.name} raises ${amountText} in ${round.roundType.replace(/_/g, " ")} funding`,
      summary: `${round.company.name} announced ${round.roundType.replace(/_/g, " ")} funding of ${amountText}${round.leadInvestor ? `, led by ${round.leadInvestor.name}` : ""}. The company develops ${round.company.archetype.productPhrase}.`,
      occurredOn: round.announcedOn,
      primaryEntityType: "organization",
      primaryEntityId: round.company.id,
      entities: [
        { type: "organization", id: round.company.id },
        { type: "funding_round", id: round.id, role: "round" },
        ...round.investors.map((investor) => ({
          type: "organization" as EntityType,
          id: investor.id,
          role: "investor",
        })),
      ],
      sourceIds: round.sourceIds,
      dedupeParts: ["funding", round.company.slug, round.roundType, round.announcedOn],
    });
    if (id) {
      attachImpact(
        context,
        id,
        "funding_round",
        round.announcedOn,
        null,
        round.sourceIds,
        1 + round.investors.length,
        {
          fundingAmountUsd: round.amountUsd,
        },
      );
      addArticles(
        context,
        rng,
        id,
        round.announcedOn,
        `${round.company.name} raises ${amountText}`,
        round.company,
      );
    }
  }

  // 3. Trial registrations and results.
  for (const trial of trials) {
    const condition = conditionDef(trial.device.archetype.conditions[0] ?? "spinal-cord-injury");
    const id = context.event(rng, {
      eventType: "trial_registered",
      title: `${trial.device.company.name} registers ${trial.registryId} for ${trial.device.name}`,
      summary: `${trial.title} was registered with an enrollment target of ${trial.enrollment} participants. The study is listed as ${trial.status.replace(/_/g, " ")}.`,
      occurredOn: trial.startDate,
      primaryEntityType: "clinical_trial",
      primaryEntityId: trial.id,
      entities: [
        { type: "clinical_trial", id: trial.id },
        { type: "device", id: trial.device.id, role: "intervention" },
        { type: "organization", id: trial.device.company.id, role: "developer" },
        { type: "organization", id: trial.sponsor.id, role: "sponsor" },
      ],
      sourceIds: [trial.sourceId],
      dedupeParts: ["trial-registered", trial.registryId],
    });
    if (id) {
      attachImpact(
        context,
        id,
        "trial_registered",
        trial.startDate,
        "clinical_study",
        [trial.sourceId],
        4,
        {
          humanParticipants: trial.enrollment,
          addressesUnmetNeed: condition.unmetNeed,
        },
      );
    }

    if (!trial.hasResults) continue;
    const resultsDate = context.calendar.dateBetween(
      rng,
      trial.completionDate,
      context.calendar.asOf,
    );
    const resultsSource = context.source(rng, {
      path: `registry/${trial.registryId}/results`,
      title: `${trial.registryId} results posting`,
      sourceType: "clinical_trial_registry",
      publisher: "Sample Clinical Trial Registry",
      publishedAt: resultsDate,
      confidence: "high",
    });
    const resultsId = context.event(rng, {
      eventType: "trial_results",
      title: `${trial.registryId} reports results for ${trial.device.name}`,
      summary: `Results were posted for ${trial.title}, which enrolled ${trial.enrollment} participants with ${condition.phrase}.`,
      occurredOn: resultsDate,
      primaryEntityType: "clinical_trial",
      primaryEntityId: trial.id,
      evidenceStage: "clinical_study",
      entities: [
        { type: "clinical_trial", id: trial.id },
        { type: "device", id: trial.device.id, role: "intervention" },
        { type: "organization", id: trial.device.company.id, role: "developer" },
      ],
      sourceIds: [resultsSource],
      dedupeParts: ["trial-results", trial.registryId],
    });
    if (resultsId) {
      attachImpact(
        context,
        resultsId,
        "trial_results",
        resultsDate,
        "clinical_study",
        [resultsSource],
        3,
        {
          humanParticipants: trial.enrollment,
          addressesUnmetNeed: condition.unmetNeed,
          novelty: novelty(rng),
        },
      );
      addArticles(
        context,
        rng,
        resultsId,
        resultsDate,
        `Results reported for ${trial.device.name}`,
        trial.device.company,
      );
    }
  }

  // 4. Publications worth surfacing: human studies and papers reporting an improvement.
  for (const publication of publications) {
    const notable = publication.improvement !== null || publication.participants !== null;
    if (!notable || !rng.chance(0.45)) continue;
    const condition = conditionDef(
      publication.company.archetype.conditions[0] ?? "spinal-cord-injury",
    );
    const entities: Array<{ type: EntityType; id: string; role?: string }> = [
      { type: "publication", id: publication.id },
      { type: "organization", id: publication.company.id, role: "author_affiliation" },
      ...publication.authors
        .slice(0, 3)
        .map((author) => ({ type: "researcher" as EntityType, id: author.id, role: "author" })),
    ];
    if (publication.device)
      entities.push({ type: "device", id: publication.device.id, role: "evaluated" });
    const id = context.event(rng, {
      eventType: "publication",
      title: publication.title,
      summary: `${publication.company.name} and collaborators published ${publication.publicationType === "preprint" ? "a preprint" : "a peer-reviewed paper"} on ${publication.device?.name ?? "their platform"}${publication.participants === null ? "" : ` reporting results from ${publication.participants} participant${publication.participants === 1 ? "" : "s"}`}.`,
      occurredOn: publication.publishedOn,
      primaryEntityType: "publication",
      primaryEntityId: publication.id,
      evidenceStage: publication.evidenceStage,
      entities,
      sourceIds: [publication.sourceId],
      dedupeParts: ["publication", publication.id],
    });
    if (id) {
      attachImpact(
        context,
        id,
        "publication",
        publication.publishedOn,
        publication.evidenceStage,
        [publication.sourceId],
        entities.length,
        {
          humanParticipants: publication.participants,
          technicalImprovement: publication.improvement,
          novelty: novelty(rng),
          addressesUnmetNeed: condition.unmetNeed,
        },
      );
      if (publication.improvement) {
        addArticles(
          context,
          rng,
          id,
          publication.publishedOn,
          `New results for ${publication.device?.name ?? publication.company.name}`,
          publication.company,
        );
      }
    }
  }

  // 5. Patents.
  for (const patent of patents) {
    const granted = patent.grantDate !== null;
    const occurredOn = patent.grantDate ?? patent.filingDate;
    const id = context.event(rng, {
      eventType: granted ? "patent_granted" : "patent_filed",
      title: `${patent.company.name} ${granted ? "granted" : "files"} patent ${patent.patentNumber}`,
      summary: `${patent.title}. Assigned to ${patent.company.name}${patent.device ? ` and linked to ${patent.device.name}` : ""}.`,
      occurredOn,
      primaryEntityType: "patent",
      primaryEntityId: patent.id,
      entities: [
        { type: "patent", id: patent.id },
        { type: "organization", id: patent.company.id, role: "assignee" },
        ...(patent.device
          ? [{ type: "device" as EntityType, id: patent.device.id, role: "technology" }]
          : []),
      ],
      sourceIds: [patent.sourceId],
      dedupeParts: ["patent", patent.patentNumber, granted ? "granted" : "filed"],
    });
    if (id)
      attachImpact(
        context,
        id,
        granted ? "patent_granted" : "patent_filed",
        occurredOn,
        null,
        [patent.sourceId],
        2,
        {},
      );
  }

  // 6. Device announcements.
  for (const device of devices) {
    const announcedOn = context.calendar.recentDate(rng);
    const specSource = context.dataset.sources.find(
      (source) => source.title === `${device.name} technical specification`,
    );
    const sourceIds = specSource?.id ? [specSource.id] : [device.company.statementSourceId];
    const condition = conditionDef(device.archetype.conditions[0] ?? "spinal-cord-injury");
    const id = context.event(rng, {
      eventType: "device_announced",
      title: `${device.company.name} announces ${device.name}`,
      summary:
        `${device.company.name} described ${device.name}, ${device.archetype.label === "cochlear implant" ? "a" : "an"} ${device.archetype.label} targeting ${device.archetype.neuralTargets[0] ?? "neural tissue"} for ${condition.phrase}.`.replace(
          /, an ([bcdfghjklmnpqrstvwxyz])/i,
          ", a $1",
        ),
      occurredOn: announcedOn,
      primaryEntityType: "device",
      primaryEntityId: device.id,
      evidenceStage: null,
      entities: [
        { type: "device", id: device.id },
        { type: "organization", id: device.company.id, role: "developer" },
      ],
      sourceIds,
      dedupeParts: ["device-announced", device.slug],
    });
    if (id) {
      attachImpact(context, id, "device_announced", announcedOn, null, sourceIds, 2, {
        novelty: novelty(rng),
        addressesUnmetNeed: condition.unmetNeed,
      });
      if (rng.chance(0.3))
        addArticles(
          context,
          rng,
          id,
          announcedOn,
          `${device.company.name} unveils ${device.name}`,
          device.company,
        );
    }
  }

  // 7. Regulatory milestones.
  for (const action of regulatoryActions) {
    const id = context.event(rng, {
      eventType: "regulatory_milestone",
      title: action.summary,
      summary: `${action.agency} recorded ${action.actionType.replace(/_/g, " ")} for ${action.device.name}, developed by ${action.device.company.name}. Reference ${action.referenceNumber}.`,
      occurredOn: action.decisionDate,
      primaryEntityType: "regulatory_action",
      primaryEntityId: action.id,
      evidenceStage:
        action.actionType === "recall" || action.actionType === "warning_letter"
          ? null
          : "regulatory_authorization",
      entities: [
        { type: "regulatory_action", id: action.id },
        { type: "device", id: action.device.id, role: "subject" },
        { type: "organization", id: action.device.company.id, role: "manufacturer" },
      ],
      sourceIds: [action.sourceId],
      dedupeParts: ["regulatory", action.referenceNumber],
    });
    if (id) {
      attachImpact(
        context,
        id,
        "regulatory_milestone",
        action.decisionDate,
        action.actionType === "recall" || action.actionType === "warning_letter"
          ? null
          : "regulatory_authorization",
        [action.sourceId],
        3,
        { regulatoryActionType: action.actionType },
      );
      addArticles(context, rng, id, action.decisionDate, action.summary, action.device.company);
    }
  }

  // 8. Partnerships and acquisitions between companies.
  const partnerTarget = context.count(24);
  for (let index = 0; index < partnerTarget; index += 1) {
    const company = companies[index % companies.length];
    const partner = companies[(index * 7 + 3) % companies.length];
    if (!company || !partner || company.id === partner.id) continue;
    const occurredOn = context.calendar.recentDate(rng);
    const sourceIds = [
      context.source(rng, {
        path: `news/partnership/${company.slug}-${partner.slug}-${occurredOn}`,
        title: `${company.name} and ${partner.name} announce a development partnership`,
        sourceType: "press_release",
        publisher: company.name,
        publishedAt: occurredOn,
        confidence: "moderate",
      }),
    ];
    const id = context.event(rng, {
      eventType: "partnership",
      title: `${company.name} partners with ${partner.name}`,
      summary: `${company.name} and ${partner.name} announced a partnership covering ${company.archetype.label} development and evaluation.`,
      occurredOn,
      primaryEntityType: "organization",
      primaryEntityId: company.id,
      entities: [
        { type: "organization", id: company.id },
        { type: "organization", id: partner.id, role: "partner" },
      ],
      sourceIds,
      dedupeParts: ["partnership", company.slug, partner.slug],
    });
    if (id) {
      attachImpact(context, id, "partnership", occurredOn, null, sourceIds, 2, {});
      context.dataset.organizationRelationships.push({
        id: context.ids.next("organization_relationships"),
        fromOrganizationId: company.id,
        toOrganizationId: partner.id,
        relationshipType: "partner",
        sourceId: sourceIds[0] ?? null,
        ...context.provenance(rng),
      });
    }
  }

  for (const company of companies.filter((candidate) => candidate.operatingStatus === "acquired")) {
    const acquirer = rng.pick(
      companies.filter((candidate) => candidate.operatingStatus === "active"),
    );
    const occurredOn = context.calendar.recentDate(rng);
    const sourceIds = [
      context.source(rng, {
        path: `news/acquisition/${company.slug}-${occurredOn}`,
        title: `${acquirer.name} acquires ${company.name}`,
        sourceType: "press_release",
        publisher: acquirer.name,
        publishedAt: occurredOn,
        confidence: "moderate",
      }),
    ];
    const id = context.event(rng, {
      eventType: "acquisition",
      title: `${acquirer.name} acquires ${company.name}`,
      summary: `${acquirer.name} acquired ${company.name}, which develops ${company.archetype.productPhrase}. Terms were not disclosed.`,
      occurredOn,
      primaryEntityType: "organization",
      primaryEntityId: company.id,
      entities: [
        { type: "organization", id: company.id },
        { type: "organization", id: acquirer.id, role: "acquirer" },
      ],
      sourceIds,
      dedupeParts: ["acquisition", company.slug],
    });
    if (id) {
      attachImpact(context, id, "acquisition", occurredOn, null, sourceIds, 2, {});
      addArticles(
        context,
        rng,
        id,
        occurredOn,
        `${acquirer.name} acquires ${company.name}`,
        acquirer,
      );
      context.dataset.organizationRelationships.push({
        id: context.ids.next("organization_relationships"),
        fromOrganizationId: acquirer.id,
        toOrganizationId: company.id,
        relationshipType: "parent",
        sourceId: sourceIds[0] ?? null,
        ...context.provenance(rng),
      });
    }
  }

  // 9. Field news that is not tied to a single company milestone.
  const newsTarget = context.count(30);
  for (let index = 0; index < newsTarget; index += 1) {
    const company = companies[(index * 5 + 1) % companies.length];
    if (!company) break;
    const occurredOn = context.calendar.daysAgo(rng, 400);
    const condition = conditionDef(company.archetype.conditions[0] ?? "spinal-cord-injury");
    const title = `Reimbursement and access questions follow progress in ${company.archetype.label}s`;
    const sourceIds = [
      context.source(rng, {
        path: `news/field/${index}-${occurredOn}`,
        title,
        sourceType: "news_report",
        publisher: rng.pick(NEWS_OUTLETS),
        publishedAt: occurredOn,
        confidence: "low",
      }),
    ];
    const id = context.event(rng, {
      eventType: "news",
      title,
      summary: `Coverage of how payers and health systems are approaching ${company.archetype.label}s for ${condition.phrase}, with ${company.name} among the companies named.`,
      occurredOn,
      primaryEntityType: "organization",
      primaryEntityId: company.id,
      entities: [{ type: "organization", id: company.id, role: "mentioned" }],
      sourceIds,
      dedupeParts: ["news-field", company.archetype.key, index],
    });
    if (id) {
      attachImpact(context, id, "news", occurredOn, null, sourceIds, 1, {});
      addArticles(context, rng, id, occurredOn, title, company);
    }
  }
}

/**
 * Adds two to four independent reports of one development. Each article is also a
 * source on the event, which is what makes the feed's source count greater than one.
 */
function addArticles(
  context: GenerationContext,
  rng: SeededRandom,
  eventId: string,
  occurredOn: ISODate,
  headline: string,
  company: CompanyHandle,
): void {
  const outlets = rng.sample(NEWS_OUTLETS, rng.int(2, 4));
  outlets.forEach((outlet, index) => {
    const slug = `${outlet.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${company.slug}-${occurredOn}-${index}`;
    const title = index === 0 ? headline : `${headline} — analysis from ${outlet}`;
    const publishedAt = context.calendar.timestampOn(rng, occurredOn);
    const sourceId = context.source(rng, {
      path: `news/${slug}`,
      title,
      sourceType: "news_report",
      publisher: outlet,
      publishedAt: occurredOn,
      confidence: "low",
    });
    context.dataset.newsArticles.push({
      id: context.ids.next("news_articles"),
      title,
      summary: `${outlet} reports on ${headline.toLowerCase()}. Development sample article.`,
      url: `https://sample.neurobase.invalid/news/${slug}`,
      publisher: outlet,
      publishedAt,
      retrievedAt: context.calendar.timestampWithinDays(rng, 60),
      sourceId,
      eventId,
      ...context.provenance(rng, { confidence: "low" }),
    });
    context.addEventSource(eventId, sourceId);
  });
}
