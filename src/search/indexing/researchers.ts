import { eq } from "drizzle-orm";
import { organizations, people } from "@/db/schema";
import {
  claimSourceTypes,
  entityRef,
  joinText,
  metadataPairs,
  restrictTo,
  sourceQualityFor,
  sourceTypesFor,
  unique,
  type IndexContext,
} from "./context";
import type { SearchDocumentRow } from "./types";

const MAX_RESEARCH_AREAS = 5;

export async function buildResearcherDocuments(ctx: IndexContext): Promise<SearchDocumentRow[]> {
  const { db, ids } = ctx;
  const rows = await db
    .select({
      person: people,
      organization: {
        id: organizations.id,
        slug: organizations.slug,
        name: organizations.name,
        hqCountry: organizations.hqCountry,
      },
    })
    .from(people)
    .leftJoin(organizations, eq(organizations.id, people.primaryOrganizationId))
    .where(restrictTo(people.id, ids));
  if (rows.length === 0) return [];
  const claimSources = await claimSourceTypes(db, "researcher", ids);

  return rows.map(({ person, organization }) => {
    const subtitleParts = [person.title, organization?.name].filter((part): part is string =>
      Boolean(part),
    );
    const sourceTypes = sourceTypesFor(claimSources.get(person.id));
    return {
      entityType: "researcher",
      entityId: person.id,
      href: entityRef("researcher", person.id, person.slug, person.fullName).href,
      title: person.fullName,
      subtitle: subtitleParts.length > 0 ? subtitleParts.join(" · ") : null,
      description: person.title ?? "",
      body: joinText([person.fullName, person.title]),
      metadata: metadataPairs([
        ["Title", person.title],
        ["Organization", organization?.name],
        [
          "Research areas",
          person.researchAreas.length > 0
            ? person.researchAreas.slice(0, MAX_RESEARCH_AREAS).join(", ")
            : null,
        ],
      ]),
      entities: organization
        ? [entityRef("organization", organization.id, organization.slug, organization.name)]
        : [],
      keywords: unique([organization?.name, ...person.researchAreas]),
      technologyCategories: [],
      conditions: [],
      invasiveness: null,
      modality: null,
      developmentStage: null,
      evidenceStage: null,
      trialStatus: null,
      organizationKind: null,
      country: organization?.hqCountry ?? null,
      publishedOn: null,
      sourceTypes,
      sourceQuality: sourceQualityFor(sourceTypes),
      verificationStatus: person.verificationStatus,
      isSample: person.isSample,
      entityUpdatedAt: person.updatedAt,
    };
  });
}
