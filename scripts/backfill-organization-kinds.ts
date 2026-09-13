import "dotenv/config";
import { parseArgs } from "node:util";
import { z } from "zod";
import { eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/db/client";
import * as schema from "../src/db/schema";
import type { OrganizationKind } from "../src/domain/enums";
import { createHttpClient, queryString } from "../src/ingestion/http";
import { INSTITUTION_KIND_MAP } from "../src/ingestion/adapters/openalex";
import { normalizeForMatch } from "../src/ingestion/stages/resolve-entities";

/**
 * Restates what kind of body each organization is, from what its sources actually say.
 *
 * Every organization in the database was recorded as a "company", because the pipeline
 * returned that as a default for anything a trial or a clearance named. It was never a
 * fact about any of them: 229 of the 444 are plainly universities, hospitals and
 * institutes, and "Aalborg University Hospital — Company" is a factual error in a
 * database whose whole claim is that it does not invent values.
 *
 * So the default is cleared and the value rebuilt from sources that state it:
 *
 *   - ClinicalTrials.gov publishes `leadSponsor.class` for every study. INDUSTRY is a
 *     company; NIH, FED and OTHER_GOV are government agencies. OTHER is not mapped — it
 *     covers universities, hospitals and foundations alike, and choosing one of them
 *     would put the guess back.
 *   - openFDA's applicant is the commercial entity holding a 510(k) or PMA clearance.
 *   - OpenAlex publishes a ROR-backed `type` for institutions it catalogues. Names are
 *     matched exactly after normalisation, against the display name and its published
 *     alternatives — a fuzzy match here would attach a stated type to the wrong body.
 *     Opt in with --catalogue: OpenAlex throttles single-name lookups hard, so the stage
 *     gives up after a short run of failures rather than stalling the whole backfill.
 *
 * What no source states stays null, and the interface shows it as an absence.
 *
 *   npm run backfill:kinds                # apply, registry + FDA only
 *   npm run backfill:kinds -- --dry-run   # report what would change, write nothing
 *   npm run backfill:kinds -- --catalogue # also ask OpenAlex about what is left
 */

const API = "https://clinicaltrials.gov/api/v2/studies";
const INSTITUTIONS = "https://api.openalex.org/institutions";

/** Only the classes that determine a kind on their own. See the note above about OTHER. */
const SPONSOR_CLASS_KINDS: Record<string, OrganizationKind> = {
  INDUSTRY: "company",
  NIH: "government_agency",
  FED: "government_agency",
  OTHER_GOV: "government_agency",
};

const responseSchema = z.object({
  studies: z
    .array(
      z.object({
        protocolSection: z.object({
          identificationModule: z.object({ nctId: z.string() }),
          sponsorCollaboratorsModule: z
            .object({ leadSponsor: z.object({ class: z.string().optional() }).optional() })
            .optional(),
        }),
      }),
    )
    .default([]),
  nextPageToken: z.string().optional(),
});

const institutionsResponse = z.object({
  results: z
    .array(
      z.object({
        display_name: z.string(),
        display_name_alternatives: z.array(z.string()).optional(),
        type: z.string().nullable().optional(),
      }),
    )
    .default([]),
});

/** NCT ids per request. The API accepts a filter of ids and caps a page at 100. */
const BATCH = 100;

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      "dry-run": { type: "boolean", default: false },
      catalogue: { type: "boolean", default: false },
    },
    allowPositionals: false,
  });
  const dryRun = values["dry-run"] ?? false;
  const useCatalogue = values.catalogue ?? false;
  const db = getDb();
  const http = createHttpClient({ requestsPerSecond: 1, timeoutMs: 20_000 });

  // Sponsors first: the registry states the class, so these are the rows a source can
  // speak to. A trial with no stored registry id cannot be looked up and is skipped.
  const sponsorRows = await db
    .select({
      registryId: schema.clinicalTrials.registryId,
      organizationId: schema.clinicalTrials.sponsorOrganizationId,
    })
    .from(schema.clinicalTrials)
    .where(isNotNull(schema.clinicalTrials.sponsorOrganizationId));

  const byNct = new Map<string, string>();
  for (const row of sponsorRows) {
    if (row.organizationId && row.registryId.startsWith("NCT")) {
      byNct.set(row.registryId, row.organizationId);
    }
  }
  console.log(`${byNct.size} trials with a sponsor and an NCT id`);

  // Organization id -> the kinds its sources state. A single organization sponsors many
  // trials, and they must agree before the value is written.
  const stated = new Map<string, Set<OrganizationKind>>();
  const unmapped = new Map<string, number>();

  const nctIds = [...byNct.keys()];
  for (let offset = 0; offset < nctIds.length; offset += BATCH) {
    const batch = nctIds.slice(offset, offset + BATCH);
    const url = `${API}?${queryString({
      "filter.ids": batch.join(","),
      pageSize: BATCH,
      fields:
        "protocolSection.identificationModule.nctId,protocolSection.sponsorCollaboratorsModule",
      format: "json",
    })}`;
    const body = await http.getJson(url, responseSchema);
    for (const study of body.studies) {
      const nctId = study.protocolSection.identificationModule.nctId;
      const organizationId = byNct.get(nctId);
      if (!organizationId) continue;
      const sponsorClass = study.protocolSection.sponsorCollaboratorsModule?.leadSponsor?.class;
      if (!sponsorClass) continue;
      const kind = SPONSOR_CLASS_KINDS[sponsorClass];
      if (!kind) {
        unmapped.set(sponsorClass, (unmapped.get(sponsorClass) ?? 0) + 1);
        continue;
      }
      const kinds = stated.get(organizationId) ?? new Set<OrganizationKind>();
      kinds.add(kind);
      stated.set(organizationId, kinds);
    }
    console.log(`  looked up ${Math.min(offset + BATCH, nctIds.length)}/${nctIds.length}`);
  }

  // Two sources disagreeing about the same organization is not something to average.
  // Leave those null and say so.
  const agreed = new Map<string, OrganizationKind>();
  let conflicted = 0;
  for (const [organizationId, kinds] of stated) {
    const [only] = [...kinds];
    if (kinds.size === 1 && only) agreed.set(organizationId, only);
    else conflicted += 1;
  }

  // openFDA applicants. The applicant on a device clearance is the entity that holds it,
  // which is a company by the nature of the record rather than by a field in it.
  const applicants = await db
    .selectDistinct({ organizationId: schema.regulatoryActions.organizationId })
    .from(schema.regulatoryActions)
    .where(isNotNull(schema.regulatoryActions.organizationId));
  let fromApplicant = 0;
  for (const row of applicants) {
    if (row.organizationId && !agreed.has(row.organizationId)) {
      agreed.set(row.organizationId, "company");
      fromApplicant += 1;
    }
  }

  // Anything still unstated gets one look in the OpenAlex institution catalogue, which
  // publishes a ROR-backed type. The match must be exact after normalisation: a search
  // endpoint returns near misses by design, and attaching "university" to the wrong body
  // because its name resembled another is the error this whole script exists to undo.
  const everyOrganization = await db
    .select({ id: schema.organizations.id, name: schema.organizations.name })
    .from(schema.organizations);
  const unstatedRows = useCatalogue ? everyOrganization.filter((row) => !agreed.has(row.id)) : [];
  const contact = process.env.INGEST_CONTACT_EMAIL?.trim() || undefined;
  let fromCatalogue = 0;
  let searched = 0;
  const catalogueTypes = new Map<string, number>();

  // OpenAlex throttles a run of single-name lookups hard, and a block there lasts hours.
  // Give up on the whole stage after a short run of failures rather than spending the
  // rest of the backfill collecting 429s: the registry and the FDA have already spoken
  // for most rows, and this stage only ever adds to what they said.
  const FAILURE_LIMIT = 5;
  let consecutiveFailures = 0;

  for (const row of unstatedRows) {
    if (consecutiveFailures >= FAILURE_LIMIT) {
      console.log(
        `  catalogue: stopped after ${FAILURE_LIMIT} consecutive failures at ${searched}/${unstatedRows.length}. OpenAlex is throttling; rerun with --catalogue later.`,
      );
      break;
    }
    searched += 1;
    const wanted = normalizeForMatch(row.name);
    if (!wanted) continue;
    const url = `${INSTITUTIONS}?${queryString({
      filter: `display_name.search:${row.name.replace(/[,|]/g, " ")}`,
      per_page: 25,
      mailto: contact,
    })}`;
    let body;
    try {
      body = await http.getJson(url, institutionsResponse);
    } catch (error: unknown) {
      // One organization failing a lookup must not end the backfill: the rest still
      // have sources that can speak for them.
      consecutiveFailures += 1;
      console.log(`  lookup failed for ${row.name}: ${String(error)}`);
      continue;
    }
    consecutiveFailures = 0;
    const match = body.results.find((institution) =>
      [institution.display_name, ...(institution.display_name_alternatives ?? [])].some(
        (candidate) => normalizeForMatch(candidate) === wanted,
      ),
    );
    if (!match?.type) continue;
    catalogueTypes.set(match.type, (catalogueTypes.get(match.type) ?? 0) + 1);
    const kind = INSTITUTION_KIND_MAP[match.type];
    if (!kind) continue;
    agreed.set(row.id, kind);
    fromCatalogue += 1;
    if (fromCatalogue % 25 === 0) {
      console.log(`  catalogue: ${fromCatalogue} matched of ${searched}/${unstatedRows.length}`);
    }
  }
  if (useCatalogue) {
    console.log(`  catalogue: ${fromCatalogue} matched of ${searched} looked up`);
  }

  const total = await db.$count(schema.organizations);
  console.log(
    [
      "",
      `organizations:            ${total}`,
      `stated by a trial sponsor: ${agreed.size - fromApplicant}`,
      `stated by an FDA applicant: ${fromApplicant}`,
      useCatalogue
        ? `stated by the OpenAlex catalogue: ${fromCatalogue}`
        : "OpenAlex catalogue:        skipped (pass --catalogue to include it)",
      `left unstated (null):      ${total - agreed.size}`,
      `sources disagreed:         ${conflicted}`,
      unmapped.size
        ? `classes with no mapping:   ${[...unmapped].map(([k, n]) => `${k}=${n}`).join(", ")}`
        : "classes with no mapping:   none",
      "",
    ].join("\n"),
  );

  if (dryRun) {
    console.log("Dry run: nothing written.");
    return;
  }

  await db.transaction(async (tx) => {
    // Clear the default first. Nothing sourced is lost here, because none of it was
    // sourced: every row carried the same value whatever its source said.
    await tx.update(schema.organizations).set({ kind: null, updatedAt: new Date() });

    // Group by kind so this is a handful of statements rather than one per organization.
    const byKind = new Map<OrganizationKind, string[]>();
    for (const [organizationId, kind] of agreed) {
      const ids = byKind.get(kind) ?? [];
      ids.push(organizationId);
      byKind.set(kind, ids);
    }
    for (const [kind, ids] of byKind) {
      for (let offset = 0; offset < ids.length; offset += 500) {
        await tx
          .update(schema.organizations)
          .set({ kind, updatedAt: new Date() })
          .where(inArray(schema.organizations.id, ids.slice(offset, offset + 500)));
      }
    }
  });

  const after = await db
    .select({ kind: schema.organizations.kind, count: sql<number>`count(*)::int` })
    .from(schema.organizations)
    .groupBy(schema.organizations.kind);
  console.log("Written. Organizations by kind:");
  for (const row of after.sort((a, b) => b.count - a.count)) {
    console.log(`  ${(row.kind ?? "(not stated)").padEnd(20)} ${row.count}`);
  }

  const stillCompanies = await db
    .$count(schema.organizations, eq(schema.organizations.kind, "company"))
    .catch(() => null);
  const unstated = await db.$count(schema.organizations, isNull(schema.organizations.kind));
  console.log(`\n/companies now lists ${stillCompanies ?? "?"}; ${unstated} have no stated kind.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(closeDb);
