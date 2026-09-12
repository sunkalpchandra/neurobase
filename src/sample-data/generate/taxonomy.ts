import type { GenerationContext } from "./context";
import { CATEGORY_DEFS, CONDITION_DEFS } from "../taxonomy";

export interface TaxonomyIndex {
  categoryIdBySlug: Map<string, string>;
  conditionIdBySlug: Map<string, string>;
}

/** Inserts the fixed taxonomies and returns slug → id lookups for later phases. */
export function generateTaxonomy(context: GenerationContext): TaxonomyIndex {
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORY_DEFS) {
    const id = context.ids.next("technology_categories");
    categoryIdBySlug.set(category.slug, id);
  }
  for (const category of CATEGORY_DEFS) {
    const id = categoryIdBySlug.get(category.slug);
    if (!id) continue;
    context.dataset.technologyCategories.push({
      id,
      slug: category.slug,
      name: category.name,
      description: category.description,
      parentId: category.parent ? (categoryIdBySlug.get(category.parent) ?? null) : null,
    });
  }

  const conditionIdBySlug = new Map<string, string>();
  for (const condition of CONDITION_DEFS) {
    const id = context.ids.next("conditions");
    conditionIdBySlug.set(condition.slug, id);
    context.dataset.conditions.push({
      id,
      slug: condition.slug,
      name: condition.name,
      category: condition.category,
      description: condition.description,
    });
  }

  return { categoryIdBySlug, conditionIdBySlug };
}
