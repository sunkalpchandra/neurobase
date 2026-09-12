# Impact model (rules_v1)

`src/domain/impact` turns the structured facts recorded about a development into an
explainable assessment: one level per component, an overall level, a confidence level,
and a short paragraph that cites the facts. There is no numeric score anywhere, and the
rules are deterministic: the same `ImpactInput` always yields the same `ImpactAssessment`.

The assessment is **not a measure of scientific truth**. It is a rule-based reading of
what has been recorded (evidence stage, source types, participant counts, regulatory
action, funding amount, coverage). A high level can be reached by an adverse event such
as a recall, and a low level can simply mean that the facts have not been recorded yet.
The interface must show the assessment's `author` label (`ASSESSMENT_AUTHOR_LABELS`, e.g.
"Rule-based assessment") next to every explanation so readers know who or what made the
judgement, and must never present it as a fact about the development itself.

## Input

`ImpactInput` (`src/domain/impact/types.ts`) holds only observed or explicitly supplied
facts: event type, evidence stage, source types and ids, independent source count, linked
entity count, dates, human participants, regulatory action type, funding amount, an
editor- or ingestion-supplied novelty judgement, an optional comparison against a
previously reported metric, and whether the development addresses an unmet clinical need.
Nothing is inferred from free text. `asOf` anchors recency and `assessedAt`
(`asOf` + `T00:00:00.000Z`) so re-running the rules on stored inputs reproduces the record.

## Components and levels

Every component gets a level of `none`, `low`, `moderate`, or `high` and a one-sentence
rationale that cites the input facts. Source types are grouped as **strong**
(peer-reviewed paper, clinical trial registry, government database), **weak** (press
release, company statement), and neutral (everything else). "Weak only" means at least
one source exists and every source is weak.

### evidence_strength

| Situation                                                                                         | Level    |
| ------------------------------------------------------------------------------------------------- | -------- |
| No evidence stage recorded; concept or simulation                                                 | none     |
| Laboratory testing or animal study                                                                | low      |
| Any human stage, but no sources or weak sources only                                              | low      |
| Clinical study or beyond with a strong source and at least 20 participants                        | high     |
| Regulatory authorization or clinical/commercial use with a strong source                          | high     |
| Any other human stage (early feasibility, fewer than 20 or unreported participants, neutral-only) | moderate |

### scientific_novelty

`first_of_kind` → high, `notable` → moderate, `incremental` → low, null → none
("No novelty judgement has been recorded.").

### clinical_significance

Three signals are counted: addresses an unmet clinical need; evidence stage at or beyond
early human feasibility; event type is `trial_results` or `regulatory_milestone`.
3 → high, 2 → moderate, 1 → low, 0 → none. Without human testing the level is capped at
low, so concept-only and bench work are none or low.

### technical_improvement

The relative change is `(current − previous) / |previous|`, flipped when
`higherIsBetter` is false so a positive value always means better. It is rounded to one
decimal place as a percentage (the figure the rationale quotes) and the level is graded on
that rounded figure, so the text and the level agree at the thresholds even when floating
point puts the raw ratio a hair below a threshold. At least 20% → high, at least 5% → moderate,
any smaller improvement → low (a change that rounds to 0.0% is worded "less than 0.1%"),
unchanged → none, regression → low with "worse than" wording. A zero baseline cannot be
expressed as a percentage: any change is low and the rationale says so. No comparison
recorded → none.

### regulatory_progress

| Action type                                                                                       | Level    |
| ------------------------------------------------------------------------------------------------- | -------- |
| premarket_approval, de_novo_authorization, 510k_clearance, ce_mark, humanitarian_device_exemption | high     |
| breakthrough_device_designation, investigational_device_exemption                                 | moderate |
| recall, warning_letter (rationale states it is an adverse action; impact is not always positive)  | high     |
| other                                                                                             | low      |
| none recorded                                                                                     | none     |

### commercial_significance

Acquisition → high. Otherwise a disclosed amount: at least $100M → high, at least $20M →
moderate, more than $0 → low, exactly $0 → none. Otherwise partnership → moderate. A
funding round without an amount → none ("Amount not disclosed"). Anything else → none.

### field_attention

Independent publishers: ≥ 5 → high, 3–4 → moderate, 2 → low, ≤ 1 → none. When at least
one publisher has reported and four or more entities are linked, the level is raised one
step (capped at high) and the rationale says so.

### recency

Days from `occurredOn` to `asOf` (`daysBetween` in `src/lib/format.ts`): ≤ 30 → high,
≤ 180 → moderate, ≤ 365 → low, otherwise none. A development dated after `asOf` is treated
as current.

## Overall level

Mirrored exactly by `deriveOverallLevel` in `src/domain/impact/assess.ts`:

1. **high** when any of the following holds:
   - regulatory_progress is high (authorizations and adverse actions alike);
   - commercial_significance is high and evidence_strength is at least moderate;
   - evidence_strength is at least moderate, the strongest of clinical_significance,
     technical_improvement, and regulatory_progress is at least moderate, and at least one
     of those two is high.
2. otherwise **moderate** when at least two components other than recency are at least
   moderate;
3. otherwise **low**.

Recency never counts towards the overall level on its own: something being new is not
a reason for it to matter.

## Confidence

Confidence describes how well the facts are established, not how important they are.
Mirrored by `assessConfidence`:

1. **low** when there are no sources, or only press releases and company statements;
2. **high** for a regulatory action (or a device at the regulatory authorization stage or
   beyond) recorded in a government database;
3. **low** when fewer than five participants are reported;
4. **high** for a clinical study or beyond with a strong source and at least 20 participants;
5. **moderate** otherwise: early feasibility work, unreported or small cohorts, preprints
   and news reports, a single independent source.

`confidenceRationale` always says why, citing the participant count, the source types,
and whether the assessment relies on a single source.

## Explanation

`explanation` is one sentence on the level and one on confidence, in natural English
with Oxford commas, for example:

> High potential impact because this result was demonstrated in humans (12 participants),
> improved decoding accuracy by 23% over the previously reported result, and appeared in
> a peer-reviewed publication. Confidence is moderate because the study included 12
> participants and relies on a single source (a peer-reviewed paper).

For high and moderate levels the first sentence lists up to four contributing facts in a
fixed priority (evidence, technical improvement, regulatory action, clinical signal,
commercial signal, strong sources, novelty, coverage). For a low level it lists up to
three limiting facts and adds any contributing ones as an "although" aside. Percentages
and counts are quoted as reported; the text never contains a score.

## Record

`assessImpact` returns `author: "rules_v1"` (`IMPACT_RULES_VERSION`), `assessedAt` derived
from `asOf`, `sourceIds` copied from the input, and the eight components in
`IMPACT_COMPONENTS` order. Change a threshold here and in `assess.ts` together, and bump
the rules version when stored assessments would change.
