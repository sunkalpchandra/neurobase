import { uuidFromString } from "../random";
import type { GenerationContext } from "./context";
import { CATEGORY_DEFS, CONDITION_DEFS } from "../taxonomy";

export interface TaxonomyIndex {
  categoryIdBySlug: Map<string, string>;
  conditionIdBySlug: Map<string, string>;
}

/**
 * Fixture taxonomy rows are stored under their own slug namespace.
 *
 * The real controlled vocabulary (src/db/reference/taxonomy.ts) uses the same terms, and
 * a database can hold both — `npm run db:reference` then `npm run db:fixtures` is a
 * normal sequence. Sharing a slug would make the second load fail on the unique index,
 * and a fixture category is a fictional stand-in anyway, so it gets a namespace of its
 * own. The lookup map stays keyed by the plain slug, so the generators are unaffected.
 */
export const FIXTURE_SLUG_PREFIX = "fx-";

export function fixtureSlug(slug: string): string {
  return `${FIXTURE_SLUG_PREFIX}${slug}`;
}

/**
 * Taxonomy ids are derived from the slug alone, not from the run's seed.
 *
 * The vocabulary is the same in every fixture dataset, so two datasets generated with
 * different seeds must agree on it — otherwise loading one over the other collides on
 * the slug index with a row it cannot recognise as its own. Seed-independent ids let the
 * seeder skip rows that already exist and keep every reference pointing at them.
 */
function taxonomyId(kind: "category" | "condition", slug: string): string {
  return uuidFromString(`fixture-taxonomy:${kind}:${slug}`);
}

/** Inserts the fixed taxonomies and returns slug → id lookups for later phases. */
export function generateTaxonomy(context: GenerationContext): TaxonomyIndex {
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORY_DEFS) {
    categoryIdBySlug.set(category.slug, taxonomyId("category", category.slug));
  }
  for (const category of CATEGORY_DEFS) {
    const id = categoryIdBySlug.get(category.slug);
    if (!id) continue;
    context.dataset.technologyCategories.push({
      id,
      slug: fixtureSlug(category.slug),
      name: category.name,
      description: category.description,
      parentId: category.parent ? (categoryIdBySlug.get(category.parent) ?? null) : null,
    });
  }

  const conditionIdBySlug = new Map<string, string>();
  for (const condition of CONDITION_DEFS) {
    const id = taxonomyId("condition", condition.slug);
    conditionIdBySlug.set(condition.slug, id);
    context.dataset.conditions.push({
      id,
      slug: fixtureSlug(condition.slug),
      name: condition.name,
      category: condition.category,
      description: condition.description,
    });
  }

  return { categoryIdBySlug, conditionIdBySlug };
}
