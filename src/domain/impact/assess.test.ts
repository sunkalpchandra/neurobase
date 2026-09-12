import { describe, expect, it } from "vitest";
import { IMPACT_COMPONENTS } from "@/domain/enums";
import type { ImpactComponent, RegulatoryActionType } from "@/domain/enums";
import type { ImpactComponentAssessment } from "@/domain/types";
import { formatUsdCompact } from "@/lib/format";
import { IMPACT_RULES_VERSION, assessImpact } from "./index";
import type { ImpactInput } from "./types";

const AS_OF = "2026-09-12";

const BASE: ImpactInput = {
  eventType: "news",
  evidenceStage: null,
  sourceTypes: ["news_report"],
  sourceIds: ["source-1"],
  independentSourceCount: 1,
  relatedEntityCount: 1,
  occurredOn: "2026-09-01",
  asOf: AS_OF,
  humanParticipants: null,
  regulatoryActionType: null,
  fundingAmountUsd: null,
  novelty: null,
  technicalImprovement: null,
  addressesUnmetNeed: false,
};

function makeInput(overrides: Partial<ImpactInput> = {}): ImpactInput {
  return { ...BASE, ...overrides };
}

function componentOf(input: ImpactInput, name: ImpactComponent): ImpactComponentAssessment {
  const found = assessImpact(input).components.find((entry) => entry.component === name);
  if (!found) throw new Error(`missing component ${name}`);
  return found;
}

function daysBefore(asOf: string, days: number): string {
  const date = new Date(`${asOf}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/** The example from the module brief: peer-reviewed human study with a 23% improvement. */
const WORKED_EXAMPLE = makeInput({
  eventType: "publication",
  evidenceStage: "clinical_study",
  sourceTypes: ["peer_reviewed_paper"],
  humanParticipants: 12,
  technicalImprovement: {
    metricName: "decoding accuracy",
    previousValue: 100,
    currentValue: 123,
    higherIsBetter: true,
  },
});

describe("evidence_strength", () => {
  it.each([
    [null, "none"],
    ["concept", "none"],
    ["simulation", "none"],
    ["laboratory", "low"],
    ["animal", "low"],
  ] as const)("stage %s → %s", (stage, level) => {
    expect(componentOf(makeInput({ evidenceStage: stage }), "evidence_strength").level).toBe(level);
  });

  it("names the missing stage", () => {
    expect(componentOf(makeInput(), "evidence_strength").rationale).toBe(
      "No evidence stage has been recorded for this development.",
    );
  });

  it("is moderate for early human feasibility with fewer than five participants", () => {
    const component = componentOf(
      makeInput({
        evidenceStage: "early_human_feasibility",
        sourceTypes: ["peer_reviewed_paper"],
        humanParticipants: 3,
      }),
      "evidence_strength",
    );
    expect(component.level).toBe("moderate");
    expect(component.rationale).toContain("3 participants");
    expect(component.rationale).toContain("a peer-reviewed paper");
  });

  it("is high for a peer-reviewed clinical study with at least 20 participants", () => {
    const input = makeInput({
      evidenceStage: "clinical_study",
      sourceTypes: ["peer_reviewed_paper", "clinical_trial_registry"],
      humanParticipants: 20,
    });
    const component = componentOf(input, "evidence_strength");
    expect(component.level).toBe("high");
    expect(component.rationale).toContain("20 participants");
    expect(component.rationale).toContain("a peer-reviewed paper and a clinical trial registry");
    expect(componentOf({ ...input, humanParticipants: 19 }, "evidence_strength").level).toBe(
      "moderate",
    );
    expect(
      componentOf({ ...input, humanParticipants: 19 }, "evidence_strength").rationale,
    ).toContain("fewer than 20 participants");
  });

  it("drops a clinical study to low when only press releases support it", () => {
    const component = componentOf(
      makeInput({
        evidenceStage: "clinical_study",
        sourceTypes: ["press_release"],
        humanParticipants: 40,
      }),
      "evidence_strength",
    );
    expect(component.level).toBe("low");
    expect(component.rationale).toContain("supported only by a press release");
  });

  it("drops a clinical study to low when it has no sources", () => {
    const component = componentOf(
      makeInput({ evidenceStage: "clinical_study", sourceTypes: [], humanParticipants: 40 }),
      "evidence_strength",
    );
    expect(component.level).toBe("low");
    expect(component.rationale).toContain("no linked sources");
  });

  it("caps a preprint-only clinical study at moderate", () => {
    const component = componentOf(
      makeInput({
        evidenceStage: "clinical_study",
        sourceTypes: ["preprint"],
        humanParticipants: 50,
      }),
      "evidence_strength",
    );
    expect(component.level).toBe("moderate");
    expect(component.rationale).toContain("no peer-reviewed, registry, or government source");
  });

  it("caps feasibility-stage evidence at moderate even with a large peer-reviewed cohort", () => {
    const component = componentOf(
      makeInput({
        evidenceStage: "early_human_feasibility",
        sourceTypes: ["peer_reviewed_paper"],
        humanParticipants: 25,
      }),
      "evidence_strength",
    );
    expect(component.level).toBe("moderate");
    expect(component.rationale).toContain("25 participants");
    expect(component.rationale).toContain(
      "feasibility-stage evidence is treated as moderate at most",
    );
  });

  it("caps a peer-reviewed clinical study at moderate when the cohort size is unreported", () => {
    const component = componentOf(
      makeInput({
        evidenceStage: "clinical_study",
        sourceTypes: ["peer_reviewed_paper"],
        humanParticipants: null,
      }),
      "evidence_strength",
    );
    expect(component.level).toBe("moderate");
    expect(component.rationale).toContain("an unreported number of participants");
    expect(component.rationale).toContain("the participant count was not reported");
  });

  it("is high for an authorized device recorded in a government database", () => {
    const component = componentOf(
      makeInput({
        evidenceStage: "regulatory_authorization",
        sourceTypes: ["government_database"],
      }),
      "evidence_strength",
    );
    expect(component.level).toBe("high");
    expect(component.rationale).toContain("a government database");
  });

  it("is high for a device in clinical or commercial use with a strong source", () => {
    const component = componentOf(
      makeInput({
        evidenceStage: "clinical_or_commercial_use",
        sourceTypes: ["clinical_trial_registry", "news_report"],
      }),
      "evidence_strength",
    );
    expect(component.level).toBe("high");
    expect(component.rationale).toBe(
      "The device has reached the clinical or commercial use stage, reported in a clinical trial registry and a news report.",
    );
  });
});

describe("scientific_novelty", () => {
  it.each([
    ["first_of_kind", "high"],
    ["notable", "moderate"],
    ["incremental", "low"],
    [null, "none"],
  ] as const)("novelty %s → %s", (novelty, level) => {
    expect(componentOf(makeInput({ novelty }), "scientific_novelty").level).toBe(level);
  });

  it("explains a missing novelty judgement", () => {
    expect(componentOf(makeInput(), "scientific_novelty").rationale).toBe(
      "No novelty judgement has been recorded.",
    );
  });
});

describe("clinical_significance", () => {
  it("is high for trial results in humans addressing an unmet need", () => {
    const component = componentOf(
      makeInput({
        eventType: "trial_results",
        evidenceStage: "clinical_study",
        addressesUnmetNeed: true,
      }),
      "clinical_significance",
    );
    expect(component.level).toBe("high");
    expect(component.rationale).toBe(
      "The development addresses a condition with an unmet clinical need, has been tested in humans (clinical study), and is reported as trial results.",
    );
  });

  it("is moderate for a human feasibility study addressing an unmet need", () => {
    const component = componentOf(
      makeInput({
        eventType: "publication",
        evidenceStage: "early_human_feasibility",
        addressesUnmetNeed: true,
      }),
      "clinical_significance",
    );
    expect(component.level).toBe("moderate");
    expect(component.rationale).toContain(
      "but is not reported as trial results or a regulatory milestone",
    );
  });

  it("is low for human testing alone", () => {
    expect(
      componentOf(
        makeInput({ eventType: "publication", evidenceStage: "clinical_study" }),
        "clinical_significance",
      ).level,
    ).toBe("low");
  });

  it("caps concept-stage work at low even with other signals", () => {
    const component = componentOf(
      makeInput({ eventType: "trial_results", evidenceStage: "concept", addressesUnmetNeed: true }),
      "clinical_significance",
    );
    expect(component.level).toBe("low");
    expect(component.rationale).toContain("capped at low");
  });

  it("is none for bench work without other signals", () => {
    const component = componentOf(
      makeInput({ evidenceStage: "laboratory" }),
      "clinical_significance",
    );
    expect(component.level).toBe("none");
    expect(component.rationale).toContain("has not been tested in humans (laboratory testing)");
  });
});

describe("technical_improvement", () => {
  function improvement(previousValue: number, currentValue: number, higherIsBetter = true) {
    return makeInput({
      technicalImprovement: {
        metricName: "decoding accuracy",
        previousValue,
        currentValue,
        higherIsBetter,
      },
    });
  }

  it("is none without a comparison", () => {
    expect(componentOf(makeInput(), "technical_improvement").level).toBe("none");
  });

  it.each([
    [100, 120, "high", "20%"],
    [100, 119, "moderate", "19%"],
    [100, 105, "moderate", "5%"],
    [100, 104, "low", "4%"],
    [100, 100.5, "low", "0.5%"],
    // Raw ratios a hair below the threshold (0.1999…, 0.04999…): the level must match the 20% / 5% the text quotes.
    [0.1, 0.12, "high", "20%"],
    [1.1, 1.32, "high", "20%"],
    [0.07, 0.084, "high", "20%"],
    [0.2, 0.21, "moderate", "5%"],
  ] as const)("%d → %d is %s", (previous, current, level, percent) => {
    const component = componentOf(improvement(previous, current), "technical_improvement");
    expect(component.level).toBe(level);
    expect(component.rationale).toContain(`Improved decoding accuracy by ${percent}`);
  });

  it("never quotes a change as 0% in either direction", () => {
    const better = componentOf(improvement(1000, 1000.3), "technical_improvement");
    expect(better.level).toBe("low");
    expect(better.rationale).toBe(
      "Improved decoding accuracy by less than 0.1% over the previously reported result (1,000 to 1,000.3).",
    );
    const worse = componentOf(improvement(1000, 999.7), "technical_improvement");
    expect(worse.level).toBe("low");
    expect(worse.rationale).toBe(
      "Reported decoding accuracy is less than 0.1% worse than the previously reported result (1,000 to 999.7).",
    );
    expect(assessImpact(improvement(1000, 1000.3)).explanation).toContain(
      "improved decoding accuracy by less than 0.1% over the previously reported result",
    );
  });

  it("is none when the metric is unchanged", () => {
    const component = componentOf(improvement(100, 100), "technical_improvement");
    expect(component.level).toBe("none");
    expect(component.rationale).toContain("unchanged");
  });

  it("describes a regression as worse than the previous result", () => {
    const component = componentOf(improvement(100, 88), "technical_improvement");
    expect(component.level).toBe("low");
    expect(component.rationale).toBe(
      "Reported decoding accuracy is 12% worse than the previously reported result (100 to 88).",
    );
  });

  it("honours metrics where lower is better", () => {
    const component = componentOf(improvement(200, 150, false), "technical_improvement");
    expect(component.level).toBe("high");
    expect(component.rationale).toContain("25%");
    expect(componentOf(improvement(150, 200, false), "technical_improvement").rationale).toContain(
      "worse than",
    );
  });

  it("does not compute a percentage from a zero baseline", () => {
    const better = componentOf(improvement(0, 5), "technical_improvement");
    expect(better.level).toBe("low");
    expect(better.rationale).toContain("zero baseline");
    expect(better.rationale).toContain("better than");
    const worse = componentOf(improvement(0, -5), "technical_improvement");
    expect(worse.level).toBe("low");
    expect(worse.rationale).toContain("worse than");
  });
});

describe("regulatory_progress", () => {
  const authorizations: RegulatoryActionType[] = [
    "premarket_approval",
    "de_novo_authorization",
    "510k_clearance",
    "ce_mark",
    "humanitarian_device_exemption",
  ];
  it.each(authorizations)("%s is high", (regulatoryActionType) => {
    const component = componentOf(makeInput({ regulatoryActionType }), "regulatory_progress");
    expect(component.level).toBe("high");
    expect(component.rationale).toContain("market authorization");
  });

  it.each(["breakthrough_device_designation", "investigational_device_exemption"] as const)(
    "%s is moderate",
    (regulatoryActionType) => {
      expect(componentOf(makeInput({ regulatoryActionType }), "regulatory_progress").level).toBe(
        "moderate",
      );
    },
  );

  it.each(["recall", "warning_letter"] as const)(
    "%s is high but adverse",
    (regulatoryActionType) => {
      const component = componentOf(makeInput({ regulatoryActionType }), "regulatory_progress");
      expect(component.level).toBe("high");
      expect(component.rationale).toContain("adverse regulatory action");
    },
  );

  it("is low for an unclassified action and none without one", () => {
    expect(
      componentOf(makeInput({ regulatoryActionType: "other" }), "regulatory_progress").level,
    ).toBe("low");
    const none = componentOf(makeInput(), "regulatory_progress");
    expect(none.level).toBe("none");
    expect(none.rationale).toBe("No regulatory action has been recorded.");
  });
});

describe("commercial_significance", () => {
  it("is high for an acquisition", () => {
    expect(
      componentOf(makeInput({ eventType: "acquisition" }), "commercial_significance").level,
    ).toBe("high");
  });

  it.each([
    [100_000_000, "high", 100_000_000],
    [99_999_999, "moderate", 100_000_000],
    [20_000_000, "moderate", 20_000_000],
    [19_999_999, "low", 20_000_000],
    [1, "low", 1],
  ] as const)("funding of %d is %s", (fundingAmountUsd, level, cited) => {
    const component = componentOf(
      makeInput({ eventType: "funding_round", fundingAmountUsd }),
      "commercial_significance",
    );
    expect(component.level).toBe(level);
    expect(component.rationale).toContain(formatUsdCompact(fundingAmountUsd));
    expect(component.rationale).toContain(formatUsdCompact(cited));
  });

  it("is none for an undisclosed round and says so", () => {
    const component = componentOf(
      makeInput({ eventType: "funding_round" }),
      "commercial_significance",
    );
    expect(component.level).toBe("none");
    expect(component.rationale).toContain("Amount not disclosed");
  });

  it("is none for a round recorded as zero", () => {
    expect(
      componentOf(
        makeInput({ eventType: "funding_round", fundingAmountUsd: 0 }),
        "commercial_significance",
      ).level,
    ).toBe("none");
  });

  it("is moderate for a partnership and none otherwise", () => {
    expect(
      componentOf(makeInput({ eventType: "partnership" }), "commercial_significance").level,
    ).toBe("moderate");
    expect(componentOf(makeInput(), "commercial_significance").level).toBe("none");
  });
});

describe("field_attention", () => {
  it.each([
    [0, "none"],
    [1, "none"],
    [2, "low"],
    [3, "moderate"],
    [4, "moderate"],
    [5, "high"],
    [9, "high"],
  ] as const)("%d independent publishers → %s", (independentSourceCount, level) => {
    expect(componentOf(makeInput({ independentSourceCount }), "field_attention").level).toBe(level);
  });

  it.each([
    [1, "low", "1 independent publisher"],
    [2, "moderate", "2 independent publishers"],
  ] as const)(
    "raises one step to %s from %d publisher(s) when four entities are linked",
    (independentSourceCount, level, coverage) => {
      const component = componentOf(
        makeInput({ independentSourceCount, relatedEntityCount: 4 }),
        "field_attention",
      );
      expect(component.level).toBe(level);
      expect(component.rationale).toBe(
        `Reported by ${coverage} and linked to 4 entities, which raises the level one step.`,
      );
    },
  );

  it("does not nudge with fewer than four linked entities", () => {
    const component = componentOf(
      makeInput({ independentSourceCount: 2, relatedEntityCount: 3 }),
      "field_attention",
    );
    expect(component.level).toBe("low");
    expect(component.rationale).toBe(
      "Reported by 2 independent publishers and linked to 3 entities.",
    );
  });

  it("does not mention a nudge that changes nothing, and never nudges from zero coverage", () => {
    const high = componentOf(
      makeInput({ independentSourceCount: 5, relatedEntityCount: 10 }),
      "field_attention",
    );
    expect(high.level).toBe("high");
    expect(high.rationale).not.toContain("raises");
    const none = componentOf(
      makeInput({ independentSourceCount: 0, relatedEntityCount: 10 }),
      "field_attention",
    );
    expect(none.level).toBe("none");
    expect(none.rationale).toContain("Not reported by any independent publisher");
  });
});

describe("recency", () => {
  it.each([
    [0, "high"],
    [30, "high"],
    [31, "moderate"],
    [180, "moderate"],
    [181, "low"],
    [365, "low"],
    [366, "none"],
  ] as const)("%d days ago → %s", (days, level) => {
    const component = componentOf(makeInput({ occurredOn: daysBefore(AS_OF, days) }), "recency");
    expect(component.level).toBe(level);
    expect(component.rationale).toContain(`${days} day`);
  });

  it("treats a development dated after the reference date as current", () => {
    const component = componentOf(makeInput({ occurredOn: "2026-10-01" }), "recency");
    expect(component.level).toBe("high");
    expect(component.rationale).toContain("after the reference date");
  });
});

describe("overall level and explanation", () => {
  it("reproduces the worked example", () => {
    const assessment = assessImpact(WORKED_EXAMPLE);
    expect(assessment.level).toBe("high");
    expect(assessment.confidence).toBe("moderate");
    expect(assessment.explanation).toBe(
      "High potential impact because this result was demonstrated in humans (12 participants), improved decoding accuracy by 23% over the previously reported result, and appeared in a peer-reviewed publication. Confidence is moderate because the study included 12 participants and relies on a single source (a peer-reviewed paper).",
    );
    expect(assessment.confidenceRationale).toBe(
      "The study included 12 participants and relies on a single source (a peer-reviewed paper).",
    );
  });

  it("is high for an adverse regulatory action and says it is adverse", () => {
    const assessment = assessImpact(
      makeInput({
        eventType: "regulatory_milestone",
        regulatoryActionType: "recall",
        sourceTypes: ["government_database"],
      }),
    );
    expect(assessment.level).toBe("high");
    expect(assessment.explanation).toContain(
      "was subject to a recall, an adverse regulatory action",
    );
    expect(assessment.confidence).toBe("high");
    expect(assessment.confidenceRationale).toContain("Recall, recorded in a government database");
  });

  it("is high for an acquisition backed by at least moderate evidence", () => {
    const assessment = assessImpact(
      makeInput({
        eventType: "acquisition",
        evidenceStage: "early_human_feasibility",
        sourceTypes: ["peer_reviewed_paper", "press_release"],
        humanParticipants: 8,
      }),
    );
    expect(assessment.level).toBe("high");
    expect(assessment.explanation).toContain("is an acquisition");
  });

  it("is moderate for an acquisition without evidence but with wide coverage", () => {
    const assessment = assessImpact(
      makeInput({
        eventType: "acquisition",
        independentSourceCount: 3,
        sourceTypes: ["news_report"],
      }),
    );
    expect(assessment.level).toBe("moderate");
    expect(assessment.explanation).toMatch(/^Moderate potential impact because this development/);
  });

  it("is moderate when two components other than recency are at least moderate", () => {
    const assessment = assessImpact(
      makeInput({
        eventType: "partnership",
        independentSourceCount: 3,
        sourceTypes: ["news_report"],
      }),
    );
    expect(assessment.level).toBe("moderate");
    expect(assessment.explanation).toContain(
      "involves a partnership and was reported by 3 independent publishers",
    );
  });

  it("does not let recency count towards moderate", () => {
    const input = makeInput({ eventType: "partnership", occurredOn: AS_OF });
    expect(componentOf(input, "recency").level).toBe("high");
    expect(componentOf(input, "commercial_significance").level).toBe("moderate");
    expect(assessImpact(input).level).toBe("low");
  });

  it("is high for strong evidence with a moderate clinical signal", () => {
    const assessment = assessImpact(
      makeInput({
        eventType: "publication",
        evidenceStage: "clinical_study",
        sourceTypes: ["peer_reviewed_paper"],
        independentSourceCount: 2,
        humanParticipants: 30,
        addressesUnmetNeed: true,
      }),
    );
    expect(assessment.level).toBe("high");
    expect(assessment.confidence).toBe("high");
    expect(assessment.explanation).toContain("addresses a condition with an unmet clinical need");
  });

  it("stays moderate when evidence and the clinical signal are both moderate but neither is high", () => {
    const input = makeInput({
      eventType: "publication",
      evidenceStage: "clinical_study",
      sourceTypes: ["peer_reviewed_paper"],
      humanParticipants: 10,
      addressesUnmetNeed: true,
    });
    expect(componentOf(input, "evidence_strength").level).toBe("moderate");
    expect(componentOf(input, "clinical_significance").level).toBe("moderate");
    const assessment = assessImpact(input);
    expect(assessment.level).toBe("moderate");
    expect(assessment.explanation).toMatch(
      /^Moderate potential impact because this result was demonstrated in humans \(10 participants\)/,
    );
  });

  it("explains a low level by what is missing, with positives as an aside", () => {
    const assessment = assessImpact(
      makeInput({
        eventType: "funding_round",
        fundingAmountUsd: 5_000_000,
        sourceTypes: ["press_release"],
      }),
    );
    expect(assessment.level).toBe("low");
    expect(assessment.explanation).toBe(
      `Low potential impact because this development has no recorded evidence stage, is supported only by a press release, and has no recorded novelty judgement, although it disclosed ${formatUsdCompact(5_000_000)} in funding. Confidence is low because the development is supported only by a press release.`,
    );
  });

  it("uses a regression's wording in the explanation", () => {
    const assessment = assessImpact({
      ...WORKED_EXAMPLE,
      technicalImprovement: {
        metricName: "decoding accuracy",
        previousValue: 100,
        currentValue: 90,
        higherIsBetter: true,
      },
    });
    expect(assessment.level).toBe("low");
    expect(assessment.explanation).toContain(
      "reported decoding accuracy 10% worse than the previously reported result",
    );
  });
});

describe("confidence", () => {
  it("is high for a large peer-reviewed clinical study", () => {
    const assessment = assessImpact(
      makeInput({
        evidenceStage: "clinical_study",
        sourceTypes: ["peer_reviewed_paper", "clinical_trial_registry"],
        independentSourceCount: 2,
        humanParticipants: 30,
      }),
    );
    expect(assessment.confidence).toBe("high");
    expect(assessment.confidenceRationale).toBe(
      "The study included 30 participants and is reported in a peer-reviewed paper and a clinical trial registry by 2 independent publishers.",
    );
  });

  it("is high for an authorization recorded in a government database", () => {
    const assessment = assessImpact(
      makeInput({ regulatoryActionType: "510k_clearance", sourceTypes: ["government_database"] }),
    );
    expect(assessment.confidence).toBe("high");
    expect(assessment.confidenceRationale).toContain(
      "510(k) clearance, recorded in a government database",
    );
  });

  it("is low when only company statements support the facts", () => {
    const assessment = assessImpact(
      makeInput({
        evidenceStage: "clinical_study",
        sourceTypes: ["company_statement", "press_release"],
        humanParticipants: 40,
      }),
    );
    expect(assessment.confidence).toBe("low");
    expect(assessment.confidenceRationale).toBe(
      "The study included 40 participants and is supported only by a company statement and a press release.",
    );
  });

  it.each([
    [3, "low", "included only 3 participants"],
    [4, "low", "included only 4 participants"],
    [5, "moderate", "included 5 participants"],
  ] as const)("is %s with %d participants", (humanParticipants, confidence, cited) => {
    const assessment = assessImpact(
      makeInput({
        evidenceStage: "early_human_feasibility",
        sourceTypes: ["peer_reviewed_paper"],
        humanParticipants,
      }),
    );
    expect(assessment.confidence).toBe(confidence);
    expect(assessment.confidenceRationale).toContain(cited);
  });

  it("is moderate for early feasibility work", () => {
    const assessment = assessImpact(
      makeInput({
        evidenceStage: "early_human_feasibility",
        sourceTypes: ["peer_reviewed_paper"],
        humanParticipants: 10,
      }),
    );
    expect(assessment.confidence).toBe("moderate");
    expect(assessment.confidenceRationale).toContain("is at the early human feasibility stage");
  });

  it("is low without sources", () => {
    const assessment = assessImpact(makeInput({ sourceTypes: [] }));
    expect(assessment.confidence).toBe("low");
    expect(assessment.confidenceRationale).toBe("The development has no linked sources.");
  });

  it("is moderate for a large study reported only in a preprint", () => {
    const assessment = assessImpact(
      makeInput({
        evidenceStage: "clinical_study",
        sourceTypes: ["preprint"],
        humanParticipants: 30,
      }),
    );
    expect(assessment.confidence).toBe("moderate");
    expect(assessment.confidenceRationale).toContain("relies on a single source (a preprint)");
  });
});

describe("assessment record", () => {
  it("labels the author with the rules version and anchors the timestamp to asOf", () => {
    const assessment = assessImpact(WORKED_EXAMPLE);
    expect(IMPACT_RULES_VERSION).toBe("rules_v1");
    expect(assessment.author).toBe(IMPACT_RULES_VERSION);
    expect(assessment.assessedAt).toBe("2026-09-12T00:00:00.000Z");
  });

  it("copies the source ids rather than sharing the array", () => {
    const input = makeInput({ sourceIds: ["a", "b"] });
    const assessment = assessImpact(input);
    expect(assessment.sourceIds).toEqual(["a", "b"]);
    expect(assessment.sourceIds).not.toBe(input.sourceIds);
  });

  it("returns exactly one assessment per component in vocabulary order", () => {
    const components = assessImpact(WORKED_EXAMPLE).components.map((entry) => entry.component);
    expect(components).toEqual([...IMPACT_COMPONENTS]);
  });

  it("is deterministic and indifferent to source type order", () => {
    const input = makeInput({
      evidenceStage: "clinical_study",
      sourceTypes: ["press_release", "peer_reviewed_paper", "clinical_trial_registry"],
      humanParticipants: 25,
    });
    const first = assessImpact(input);
    const second = assessImpact(input);
    expect(second).toEqual(first);
    expect(second).not.toBe(first);
    const reordered = assessImpact({
      ...input,
      sourceTypes: ["clinical_trial_registry", "peer_reviewed_paper", "press_release"],
    });
    expect(reordered).toEqual(first);
  });

  it("does not mutate its input", () => {
    const input = makeInput({ sourceIds: ["x"], sourceTypes: ["preprint", "news_report"] });
    const snapshot = structuredClone(input);
    assessImpact(input);
    expect(input).toEqual(snapshot);
  });

  it("never phrases the explanation as a numeric score", () => {
    const inputs: ImpactInput[] = [
      BASE,
      WORKED_EXAMPLE,
      makeInput({ eventType: "acquisition", independentSourceCount: 6, relatedEntityCount: 8 }),
      makeInput({ eventType: "funding_round", fundingAmountUsd: 150_000_000 }),
      makeInput({ regulatoryActionType: "warning_letter", sourceTypes: ["government_database"] }),
      makeInput({ evidenceStage: "animal", novelty: "first_of_kind", sourceTypes: ["preprint"] }),
      makeInput({ evidenceStage: "concept", sourceTypes: [], occurredOn: "2024-01-01" }),
    ];
    for (const input of inputs) {
      const assessment = assessImpact(input);
      const text = `${assessment.explanation} ${assessment.confidenceRationale} ${assessment.components
        .map((entry) => entry.rationale)
        .join(" ")}`;
      expect(text).not.toMatch(/\d\s*\/\s*100/);
      expect(text).not.toMatch(/score/i);
      const sentences = assessment.explanation.split(/(?<=\.)\s+(?=[A-Z])/);
      expect(sentences.length).toBeGreaterThanOrEqual(1);
      expect(sentences.length).toBeLessThanOrEqual(3);
      expect(assessment.explanation.endsWith(".")).toBe(true);
    }
  });
});
