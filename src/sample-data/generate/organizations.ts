import type { DevelopmentStage, OperatingStatus, PersonRole } from "@/domain/enums";
import type { ISODate } from "@/domain/types";
import { ARCHETYPES, forcedArchetypeQueue, type Archetype } from "../archetypes";
import { yearOf } from "../dates";
import type { SeededRandom } from "../random";
import { conditionDef } from "../taxonomy";
import { listPhrase, normalizeName } from "../text";
import {
  COMPANY_HEADS,
  COMPANY_TAILS,
  FIRST_NAMES,
  GOVERNMENT_AGENCY_NAMES,
  HOSPITAL_BASES,
  HOSPITAL_FORMATS,
  INVESTOR_HEADS,
  INVESTOR_TAILS,
  LAB_TOPICS,
  LAST_NAMES,
  NONPROFIT_NAMES,
  REAL_COMPANY_DENYLIST,
  TAIL_ABBREVIATIONS,
  UNIVERSITY_BASES,
  UNIVERSITY_FORMATS,
} from "../vocab/names";
import { PLACES, legalSuffix, type Place } from "../vocab/places";
import type { GenerationContext } from "./context";
import type { TaxonomyIndex } from "./taxonomy";

const DENYLIST = new Set(REAL_COMPANY_DENYLIST.map(normalizeName));

/** True when a generated name matches a real neurotechnology company. */
export function isRealCompanyName(name: string): boolean {
  const normalized = normalizeName(name);
  if (DENYLIST.has(normalized)) return true;
  return normalized.includes("neuralink");
}

export interface OrganizationHandle {
  id: string;
  slug: string;
  name: string;
  place: Place;
}

export interface PersonHandle {
  id: string;
  slug: string;
  fullName: string;
  organizationId: string;
}

export interface CompanyHandle extends OrganizationHandle {
  archetype: Archetype;
  foundedYear: number;
  foundedOn: ISODate;
  stage: DevelopmentStage;
  operatingStatus: OperatingStatus;
  university: OrganizationHandle | null;
  people: PersonHandle[];
  founders: PersonHandle[];
  /** Company statement backing the description claim. */
  statementSourceId: string;
}

export interface OrganizationSet {
  companies: CompanyHandle[];
  universities: OrganizationHandle[];
  hospitals: OrganizationHandle[];
  labs: OrganizationHandle[];
  investors: OrganizationHandle[];
  agencies: OrganizationHandle[];
  nonprofits: OrganizationHandle[];
  researchers: PersonHandle[];
}

function personName(rng: SeededRandom, context: GenerationContext): string {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const candidate = `${rng.pick(FIRST_NAMES)} ${rng.pick(LAST_NAMES)}`;
    if (!context.personNames.has(candidate)) return context.personNames.add(candidate);
  }
  throw new Error("Ran out of unique person names");
}

function companyName(rng: SeededRandom, context: GenerationContext): string {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const head = rng.pick(COMPANY_HEADS);
    const tail = rng.pick(COMPANY_TAILS);
    const candidate = `${head} ${tail}`;
    if (isRealCompanyName(candidate) || context.organizationNames.has(candidate)) continue;
    return context.organizationNames.add(candidate);
  }
  throw new Error("Ran out of unique company names");
}

function addPerson(
  context: GenerationContext,
  rng: SeededRandom,
  organizationId: string,
  title: string | null,
  researchAreas: string[],
): PersonHandle {
  const fullName = personName(rng, context);
  const id = context.ids.next("people");
  const slug = context.slugs.claim(fullName);
  context.dataset.people.push({
    id,
    slug,
    fullName,
    title,
    orcid: rng.chance(0.45)
      ? `0000-${String(rng.int(1000, 9999))}-${String(rng.int(1000, 9999))}-${String(rng.int(1000, 9999))}`
      : null,
    primaryOrganizationId: organizationId,
    researchAreas,
    ...context.provenance(rng),
  });
  return { id, slug, fullName, organizationId };
}

function addOrganizationAliases(
  context: GenerationContext,
  handle: OrganizationHandle,
  shortForm: string,
  legal: string,
): void {
  context.alias("organization", handle.id, handle.name, normalizeName(handle.name));
  context.alias("organization", handle.id, shortForm, normalizeName(shortForm));
  context.alias("organization", handle.id, legal, normalizeName(legal));
}

/** Generates every organization kind, their people, and the relationships between them. */
export function generateOrganizations(
  context: GenerationContext,
  taxonomy: TaxonomyIndex,
): OrganizationSet {
  const rng = context.random("organizations");
  const peopleRng = context.random("people");

  const universities: OrganizationHandle[] = [];
  for (let index = 0; index < context.count(40); index += 1) {
    const base = UNIVERSITY_BASES[index % UNIVERSITY_BASES.length] ?? "Thornfield";
    const format = rng.pick(UNIVERSITY_FORMATS);
    const name = context.organizationNames.add(format.replace("{base}", base));
    const place = rng.pickWeighted(PLACES.map((value) => ({ value, weight: value.weight })));
    const id = context.ids.next("organizations");
    const slug = context.slugs.claim(name);
    context.dataset.organizations.push({
      id,
      slug,
      name,
      kind: "university",
      description: `${name} is a fictional university used in the development sample. Its neuroengineering groups publish on neural interfaces and host clinical collaborations.`,
      website: `https://sample.neurobase.invalid/orgs/${slug}`,
      hqCity: place.city,
      hqRegion: place.region,
      hqCountry: place.country,
      foundedYear: rng.int(1850, 1985),
      operatingStatus: "active",
      parentOrganizationId: null,
      primaryIndicationId: null,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      totalDisclosedFundingUsd: null,
      ...context.provenance(rng),
    });
    const handle: OrganizationHandle = { id, slug, name, place };
    addOrganizationAliases(context, handle, base, `${name} (${place.country})`);
    universities.push(handle);
  }

  const hospitals: OrganizationHandle[] = [];
  for (let index = 0; index < context.count(15); index += 1) {
    const base = HOSPITAL_BASES[index % HOSPITAL_BASES.length] ?? "Ravenmoor";
    const format = rng.pick(HOSPITAL_FORMATS);
    const name = context.organizationNames.add(format.replace("{base}", base));
    const place = rng.pickWeighted(PLACES.map((value) => ({ value, weight: value.weight })));
    const id = context.ids.next("organizations");
    const slug = context.slugs.claim(name);
    context.dataset.organizations.push({
      id,
      slug,
      name,
      kind: "hospital",
      description: `${name} is a fictional hospital used in the development sample. It sponsors and hosts neurotechnology studies.`,
      website: `https://sample.neurobase.invalid/orgs/${slug}`,
      hqCity: place.city,
      hqRegion: place.region,
      hqCountry: place.country,
      foundedYear: rng.int(1900, 2005),
      operatingStatus: "active",
      parentOrganizationId: null,
      primaryIndicationId: null,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      totalDisclosedFundingUsd: null,
      ...context.provenance(rng),
    });
    const handle: OrganizationHandle = { id, slug, name, place };
    addOrganizationAliases(context, handle, base, `${name} Trust`);
    hospitals.push(handle);
  }

  const labs: OrganizationHandle[] = [];
  const researchers: PersonHandle[] = [];
  for (let index = 0; index < context.count(25); index += 1) {
    const university = universities[index % universities.length];
    if (!university) break;
    const topic = LAB_TOPICS[index % LAB_TOPICS.length] ?? "Neural Interfaces";
    const name = context.organizationNames.add(`${university.name} ${topic} Laboratory`);
    const id = context.ids.next("organizations");
    const slug = context.slugs.claim(name);
    context.dataset.organizations.push({
      id,
      slug,
      name,
      kind: "research_lab",
      description: `Research laboratory at ${university.name} working on ${topic.toLowerCase()}. Part of the development sample.`,
      website: `https://sample.neurobase.invalid/orgs/${slug}`,
      hqCity: university.place.city,
      hqRegion: university.place.region,
      hqCountry: university.place.country,
      foundedYear: rng.int(1995, 2022),
      operatingStatus: "active",
      parentOrganizationId: university.id,
      primaryIndicationId: null,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      totalDisclosedFundingUsd: null,
      ...context.provenance(rng),
    });
    const handle: OrganizationHandle = { id, slug, name, place: university.place };
    addOrganizationAliases(context, handle, `${topic} Lab`, `${name}, ${university.place.city}`);
    labs.push(handle);

    const principal = addPerson(context, peopleRng, id, "Professor of Neuroengineering", [topic]);
    context.dataset.organizationPeople.push({
      organizationId: id,
      personId: principal.id,
      role: "principal_investigator",
      startYear: rng.int(2005, 2022),
      endYear: null,
    });
    researchers.push(principal);
    for (let member = 0; member < peopleRng.int(1, 3); member += 1) {
      const person = addPerson(context, peopleRng, id, "Research scientist", [topic]);
      context.dataset.organizationPeople.push({
        organizationId: id,
        personId: person.id,
        role: "researcher",
        startYear: rng.int(2012, 2025),
        endYear: null,
      });
      researchers.push(person);
    }
  }

  const investors: OrganizationHandle[] = [];
  for (let index = 0; index < context.count(30); index += 1) {
    const name = context.organizationNames.claimFirst(
      Array.from({ length: 40 }, () => `${rng.pick(INVESTOR_HEADS)} ${rng.pick(INVESTOR_TAILS)}`),
    );
    const place = rng.pickWeighted(PLACES.map((value) => ({ value, weight: value.weight })));
    const id = context.ids.next("organizations");
    const slug = context.slugs.claim(name);
    context.dataset.organizations.push({
      id,
      slug,
      name,
      kind: "investor",
      description: `${name} is a fictional investor in the development sample. It backs neurotechnology companies at seed and growth stages.`,
      website: `https://sample.neurobase.invalid/orgs/${slug}`,
      hqCity: place.city,
      hqRegion: place.region,
      hqCountry: place.country,
      foundedYear: rng.int(1990, 2021),
      operatingStatus: "active",
      parentOrganizationId: null,
      primaryIndicationId: null,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      totalDisclosedFundingUsd: null,
      ...context.provenance(rng),
    });
    const handle: OrganizationHandle = { id, slug, name, place };
    const head = name.split(" ")[0] ?? name;
    addOrganizationAliases(context, handle, head, `${name} ${legalSuffix(place.country)}`);
    investors.push(handle);
  }

  const agencies: OrganizationHandle[] = [];
  for (let index = 0; index < context.count(6); index += 1) {
    const name = context.organizationNames.add(
      GOVERNMENT_AGENCY_NAMES[index % GOVERNMENT_AGENCY_NAMES.length] ?? `Sample Agency ${index}`,
    );
    const place = rng.pickWeighted(PLACES.map((value) => ({ value, weight: value.weight })));
    const id = context.ids.next("organizations");
    const slug = context.slugs.claim(name);
    context.dataset.organizations.push({
      id,
      slug,
      name,
      kind: "government_agency",
      description: `${name} is a fictional public body in the development sample. It funds and reviews neurotechnology programmes.`,
      website: `https://sample.neurobase.invalid/orgs/${slug}`,
      hqCity: place.city,
      hqRegion: place.region,
      hqCountry: place.country,
      foundedYear: rng.int(1950, 2015),
      operatingStatus: "active",
      parentOrganizationId: null,
      primaryIndicationId: null,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      totalDisclosedFundingUsd: null,
      ...context.provenance(rng),
    });
    agencies.push({ id, slug, name, place });
  }

  const nonprofits: OrganizationHandle[] = [];
  for (let index = 0; index < context.count(6); index += 1) {
    const name = context.organizationNames.add(
      NONPROFIT_NAMES[index % NONPROFIT_NAMES.length] ?? `Sample Foundation ${index}`,
    );
    const place = rng.pickWeighted(PLACES.map((value) => ({ value, weight: value.weight })));
    const id = context.ids.next("organizations");
    const slug = context.slugs.claim(name);
    context.dataset.organizations.push({
      id,
      slug,
      name,
      kind: "nonprofit",
      description: `${name} is a fictional nonprofit in the development sample. It funds research and patient programmes.`,
      website: `https://sample.neurobase.invalid/orgs/${slug}`,
      hqCity: place.city,
      hqRegion: place.region,
      hqCountry: place.country,
      foundedYear: rng.int(1975, 2020),
      operatingStatus: "active",
      parentOrganizationId: null,
      primaryIndicationId: null,
      invasiveness: null,
      modality: null,
      developmentStage: null,
      totalDisclosedFundingUsd: null,
      ...context.provenance(rng),
    });
    nonprofits.push({ id, slug, name, place });
  }

  const companies = generateCompanies(context, taxonomy, rng, peopleRng, universities);
  linkRelationships(context, rng, companies);

  return { companies, universities, hospitals, labs, investors, agencies, nonprofits, researchers };
}

const LEADERSHIP_ROLES: PersonRole[] = [
  "chief_executive",
  "chief_technology",
  "chief_scientific",
  "chief_medical",
];

function generateCompanies(
  context: GenerationContext,
  taxonomy: TaxonomyIndex,
  rng: SeededRandom,
  peopleRng: SeededRandom,
  universities: OrganizationHandle[],
): CompanyHandle[] {
  const target = context.count(260);
  const forced = forcedArchetypeQueue(context.scale);
  const companies: CompanyHandle[] = [];

  for (let index = 0; index < target; index += 1) {
    const archetype: Archetype = forced[index] ?? rng.pick(ARCHETYPES);
    const name = companyName(rng, context);
    const place = rng.pickWeighted(PLACES.map((value) => ({ value, weight: value.weight })));
    const id = context.ids.next("organizations");
    const slug = context.slugs.claim(name);
    const foundedYear = rng.int(2009, 2024);
    const foundedOn = `${foundedYear}-${String(rng.int(1, 12)).padStart(2, "0")}-${String(rng.int(1, 28)).padStart(2, "0")}`;
    const stage = rng.pickWeighted(
      Object.entries(archetype.stageWeights).map(([value, weight]) => ({
        value: value as DevelopmentStage,
        weight: weight ?? 1,
      })),
    );
    const operatingStatus: OperatingStatus = rng.chance(0.04)
      ? "acquired"
      : rng.chance(0.02)
        ? "closed"
        : "active";
    const primaryCondition = archetype.conditions[0] ?? "spinal-cord-injury";
    const university = rng.chance(0.45) ? rng.pick(universities) : null;

    const statementSourceId = context.source(rng, {
      path: `orgs/${slug}/about`,
      title: `${name}: technology overview`,
      sourceType: "company_statement",
      publisher: name,
      publishedAt: context.calendar.daysAgo(rng, 500, 10),
      notes: "Company statement from the development sample.",
      confidence: "moderate",
    });

    const conditionNames = archetype.conditions.map(
      (conditionSlug) => conditionDef(conditionSlug).phrase,
    );
    const description = `${name} develops ${archetype.productPhrase}. The company is based in ${place.city} and works on ${listPhrase(conditionNames)}.`;

    context.dataset.organizations.push({
      id,
      slug,
      name,
      kind: "company",
      description,
      website: `https://sample.neurobase.invalid/orgs/${slug}`,
      hqCity: place.city,
      hqRegion: place.region,
      hqCountry: place.country,
      foundedYear,
      operatingStatus,
      parentOrganizationId: null,
      primaryIndicationId: taxonomy.conditionIdBySlug.get(primaryCondition) ?? null,
      invasiveness: archetype.invasiveness,
      modality: archetype.modality,
      developmentStage: stage,
      totalDisclosedFundingUsd: null,
      ...context.provenance(rng),
    });

    for (const categorySlug of archetype.categories) {
      const categoryId = taxonomy.categoryIdBySlug.get(categorySlug);
      if (categoryId)
        context.dataset.organizationTechnologyCategories.push({ organizationId: id, categoryId });
    }
    for (const conditionSlug of archetype.conditions) {
      const conditionId = taxonomy.conditionIdBySlug.get(conditionSlug);
      if (conditionId)
        context.dataset.organizationConditions.push({ organizationId: id, conditionId });
    }

    const handle: OrganizationHandle = { id, slug, name, place };
    const [head = name, tail = ""] = name.split(" ");
    addOrganizationAliases(
      context,
      handle,
      `${head} ${TAIL_ABBREVIATIONS[tail] ?? "Neuro"}`,
      `${name} ${legalSuffix(place.country)}`,
    );

    const people: PersonHandle[] = [];
    const founders: PersonHandle[] = [];
    const founderCount = peopleRng.int(1, 2);
    for (let founderIndex = 0; founderIndex < founderCount; founderIndex += 1) {
      const person = addPerson(
        context,
        peopleRng,
        id,
        founderIndex === 0 ? "Chief Executive Officer" : "Chief Technology Officer",
        archetype.keywords.slice(0, 3),
      );
      context.dataset.organizationPeople.push({
        organizationId: id,
        personId: person.id,
        role: "founder",
        startYear: foundedYear,
        endYear: null,
      });
      context.dataset.organizationPeople.push({
        organizationId: id,
        personId: person.id,
        role: LEADERSHIP_ROLES[founderIndex] ?? "chief_technology",
        startYear: foundedYear,
        endYear: null,
      });
      people.push(person);
      founders.push(person);
    }
    if (peopleRng.chance(0.5)) {
      const role = peopleRng.pick(LEADERSHIP_ROLES.slice(2));
      const person = addPerson(
        context,
        peopleRng,
        id,
        role === "chief_medical" ? "Chief Medical Officer" : "Chief Scientific Officer",
        archetype.keywords.slice(0, 2),
      );
      context.dataset.organizationPeople.push({
        organizationId: id,
        personId: person.id,
        role,
        startYear: peopleRng.int(foundedYear, 2026),
        endYear: null,
      });
      people.push(person);
    }

    context.claim(rng, {
      entityType: "organization",
      entityId: id,
      claimKind: "description",
      statement: description,
      sourceIds: [statementSourceId],
      confidence: "moderate",
    });
    context.claim(rng, {
      entityType: "organization",
      entityId: id,
      claimKind: "founding_year",
      statement: `${name} was founded in ${foundedYear} and is headquartered in ${place.city}, ${place.countryName}.`,
      sourceIds: [statementSourceId],
      confidence: "moderate",
    });

    companies.push({
      id,
      slug,
      name,
      place,
      archetype,
      foundedYear,
      foundedOn,
      stage,
      operatingStatus,
      university,
      people,
      founders,
      statementSourceId,
    });
  }

  return companies;
}

function linkRelationships(
  context: GenerationContext,
  rng: SeededRandom,
  companies: CompanyHandle[],
): void {
  const byArchetype = new Map<string, CompanyHandle[]>();
  for (const company of companies) {
    const list = byArchetype.get(company.archetype.key) ?? [];
    list.push(company);
    byArchetype.set(company.archetype.key, list);
  }

  for (const company of companies) {
    if (company.university) {
      context.dataset.organizationRelationships.push({
        id: context.ids.next("organization_relationships"),
        fromOrganizationId: company.id,
        toOrganizationId: company.university.id,
        relationshipType: rng.chance(0.5) ? "spinout_of" : "university_affiliation",
        sourceId: company.statementSourceId,
        ...context.provenance(rng),
      });
    }
    const peers = (byArchetype.get(company.archetype.key) ?? []).filter(
      (peer) => peer.id !== company.id,
    );
    for (const peer of rng.sample(peers, rng.int(0, 2))) {
      const exists = context.dataset.organizationRelationships.some(
        (relationship) =>
          relationship.relationshipType === "competitor" &&
          ((relationship.fromOrganizationId === company.id &&
            relationship.toOrganizationId === peer.id) ||
            (relationship.fromOrganizationId === peer.id &&
              relationship.toOrganizationId === company.id)),
      );
      if (exists) continue;
      context.dataset.organizationRelationships.push({
        id: context.ids.next("organization_relationships"),
        fromOrganizationId: company.id,
        toOrganizationId: peer.id,
        relationshipType: "competitor",
        sourceId: company.statementSourceId,
        ...context.provenance(rng, { confidence: "low" }),
      });
    }
  }
}

export { yearOf };
