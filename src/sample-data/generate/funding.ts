import type { RoundType } from "@/domain/enums";
import type { ISODate } from "@/domain/types";
import { formatUsdCompact } from "@/lib/format";
import type { SeededRandom } from "../random";
import { listPhrase } from "../text";
import { NEWS_OUTLETS } from "../vocab/names";
import type { GenerationContext } from "./context";
import type { CompanyHandle, OrganizationHandle } from "./organizations";

export interface FundingRoundHandle {
  id: string;
  company: CompanyHandle;
  announcedOn: ISODate;
  roundType: RoundType;
  /** Null when the amount was not disclosed; never estimated. */
  amountUsd: number | null;
  investors: OrganizationHandle[];
  leadInvestor: OrganizationHandle | null;
  sourceIds: string[];
}

/** Typical disclosed amounts in USD by round type. */
const AMOUNT_RANGES: Partial<Record<RoundType, [number, number]>> = {
  pre_seed: [500_000, 3_000_000],
  seed: [2_000_000, 12_000_000],
  series_a: [10_000_000, 45_000_000],
  series_b: [30_000_000, 120_000_000],
  series_c: [60_000_000, 250_000_000],
  series_d_plus: [100_000_000, 400_000_000],
  grant: [250_000, 8_000_000],
  debt: [5_000_000, 60_000_000],
  ipo: [80_000_000, 500_000_000],
};

const ROUND_SEQUENCE: RoundType[] = [
  "pre_seed",
  "seed",
  "series_a",
  "series_b",
  "series_c",
  "series_d_plus",
];

function roundAmount(rng: SeededRandom, roundType: RoundType): number {
  const [low, high] = AMOUNT_RANGES[roundType] ?? [1_000_000, 20_000_000];
  // Round to the nearest 100k so amounts read like disclosed figures.
  return Math.round(rng.float(low, high) / 100_000) * 100_000;
}

/**
 * Funding history per company: rounds in sequence, about a fifth with no disclosed
 * amount, and the company's disclosed total kept in step with the rounds.
 */
export function generateFunding(
  context: GenerationContext,
  companies: CompanyHandle[],
  investors: OrganizationHandle[],
  nonprofits: OrganizationHandle[],
): FundingRoundHandle[] {
  const rng = context.random("funding");
  const rounds: FundingRoundHandle[] = [];
  const target = context.count(120);
  const funded = rng.shuffle(companies).slice(0, Math.max(1, Math.ceil(target / 1.6)));
  const totals = new Map<string, number>();

  for (const company of funded) {
    if (rounds.length >= target) break;
    const roundCount = rng.int(1, 3);
    let previousDate = company.foundedOn;
    for (let index = 0; index < roundCount && rounds.length < target; index += 1) {
      const roundType: RoundType = rng.chance(0.12)
        ? rng.chance(0.5)
          ? "grant"
          : "debt"
        : (ROUND_SEQUENCE[index] ?? "series_b");
      const announcedOn = context.calendar.dateBetween(rng, previousDate, context.calendar.asOf);
      previousDate = announcedOn;
      const disclosed = !rng.chance(0.2);
      const amountUsd = disclosed ? roundAmount(rng, roundType) : null;
      const investorPool = roundType === "grant" ? [...nonprofits, ...investors] : investors;
      const participants = rng.sample(investorPool, rng.int(1, 3));
      const leadInvestor = disclosed && participants[0] ? participants[0] : null;

      const outlet = rng.pick(NEWS_OUTLETS);
      const amountText = amountUsd === null ? "an undisclosed amount" : formatUsdCompact(amountUsd);
      const headline = `${company.name} raises ${amountText} in ${roundType.replace(/_/g, " ")} funding`;
      const sourceIds = [
        context.source(rng, {
          path: `news/${company.slug}-${roundType}-${announcedOn}`,
          title: headline,
          sourceType: "press_release",
          publisher: company.name,
          publishedAt: announcedOn,
          confidence: "moderate",
        }),
      ];
      if (rng.chance(0.6)) {
        sourceIds.push(
          context.source(rng, {
            path: `news/${outlet.toLowerCase().replace(/[^a-z0-9]+/g, "-")}/${company.slug}-${announcedOn}`,
            title: `${company.name} closes ${roundType.replace(/_/g, " ")} round`,
            sourceType: "news_report",
            publisher: outlet,
            publishedAt: announcedOn,
            confidence: "moderate",
          }),
        );
      }

      const id = context.ids.next("funding_rounds");
      context.dataset.fundingRounds.push({
        id,
        organizationId: company.id,
        announcedOn,
        roundType,
        amountUsd,
        currency: "USD",
        ...context.provenance(rng, { confidence: disclosed ? "moderate" : "low" }),
      });
      participants.forEach((investor, position) => {
        context.dataset.fundingRoundInvestors.push({
          fundingRoundId: id,
          investorOrganizationId: investor.id,
          isLead: leadInvestor !== null && position === 0,
        });
      });

      context.claim(rng, {
        entityType: "funding_round",
        entityId: id,
        claimKind: "funding_amount",
        statement:
          amountUsd === null
            ? `${company.name} announced ${roundType.replace(/_/g, " ")} funding on ${announcedOn}; the amount was not disclosed.`
            : `${company.name} announced ${formatUsdCompact(amountUsd)} in ${roundType.replace(/_/g, " ")} funding on ${announcedOn}, with participation from ${listPhrase(participants.map((investor) => investor.name))}.`,
        sourceIds,
        confidence: amountUsd === null ? "low" : "moderate",
      });

      if (amountUsd !== null) totals.set(company.id, (totals.get(company.id) ?? 0) + amountUsd);
      rounds.push({
        id,
        company,
        announcedOn,
        roundType,
        amountUsd,
        investors: participants,
        leadInvestor,
        sourceIds,
      });
    }
  }

  for (const organization of context.dataset.organizations) {
    if (organization.kind !== "company" || !organization.id) continue;
    const total = totals.get(organization.id);
    organization.totalDisclosedFundingUsd = total ?? null;
  }

  return rounds;
}
