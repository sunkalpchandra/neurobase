import { TRIAL_STATUS_LABELS } from "@/domain/enums";
import type { NormalizedRecord } from "../normalized";
import type { ClaimInput } from "../repository";

/**
 * Stage 8. Derives the claims a record supports. Each one is a single factual statement
 * that the record's own source backs, so the interface can show provenance per fact
 * rather than per page.
 */
export function buildClaims(record: NormalizedRecord): ClaimInput[] {
  switch (record.kind) {
    case "clinical_trial": {
      const claims: ClaimInput[] = [
        {
          claimKind: "trial_registration",
          statement: `${record.registryId} (${record.registry}) is registered as "${record.title}" with status ${TRIAL_STATUS_LABELS[record.status].toLowerCase()}.`,
        },
      ];
      if (record.enrollment !== null) {
        claims.push({
          claimKind: "trial_enrollment",
          statement: `${record.registryId} lists ${record.enrollment} participants (${record.enrollmentIsEstimate ? "estimated" : "actual"}).`,
        });
      }
      if (record.sponsorName) {
        claims.push({
          claimKind: "trial_sponsor",
          statement: `${record.registryId} is sponsored by ${record.sponsorName}.`,
        });
      }
      return claims;
    }
    case "publication": {
      const claims: ClaimInput[] = [
        {
          claimKind: "publication_record",
          statement: `"${record.title}" was published${record.journal ? ` in ${record.journal}` : ""}${record.publishedOn ? ` on ${record.publishedOn}` : ""}.`,
        },
      ];
      if (record.doi)
        claims.push({
          claimKind: "publication_identifier",
          statement: `The paper's DOI is ${record.doi}.`,
        });
      if (record.authorNames.length) {
        claims.push({
          claimKind: "publication_authors",
          statement: `Authors listed: ${record.authorNames.slice(0, 8).join(", ")}${record.authorNames.length > 8 ? " and others" : ""}.`,
        });
      }
      return claims;
    }
    case "patent": {
      return [
        {
          claimKind: "patent_filing",
          statement: `${record.jurisdiction} ${record.patentNumber} ("${record.title}") is ${record.status}${record.assigneeName ? ` and assigned to ${record.assigneeName}` : ""}.`,
        },
      ];
    }
    case "regulatory_action": {
      return [
        {
          claimKind: "regulatory_decision",
          statement: `${record.agency} recorded ${record.actionType.replace(/_/g, " ")}${record.referenceNumber ? ` (${record.referenceNumber})` : ""}${record.decisionDate ? ` on ${record.decisionDate}` : ""}: ${record.summary}`,
        },
      ];
    }
    case "news_article": {
      return [
        { claimKind: "news_report", statement: `${record.publisher} reported: "${record.title}".` },
      ];
    }
    case "organization": {
      return [{ claimKind: "description", statement: `${record.name}: ${record.description}` }];
    }
  }
}
