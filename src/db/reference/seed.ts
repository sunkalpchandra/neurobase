import { eq, sql } from "drizzle-orm";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { normalizeForMatch } from "@/ingestion/stages/resolve-entities";
import { CATEGORY_DEFS, CONDITION_DEFS } from "./taxonomy";

export interface ReferenceSummary {
  categories: number;
  conditions: number;
  aliases: number;
}

/**
 * Loads the controlled vocabulary. Idempotent: rows are matched on their slug, so
 * running it again refreshes names and adds anything new without disturbing the
 * ingested records that point at them.
 */
export async function seedReferenceData(db: Database): Promise<ReferenceSummary> {
  let aliases = 0;

  await db.transaction(async (tx) => {
    // Parents first, so the self-reference resolves.
    for (const pass of [0, 1]) {
      for (const category of CATEGORY_DEFS) {
        if (pass === 0 && category.parent) continue;
        if (pass === 1 && !category.parent) continue;
        const parentId = category.parent
          ? ((
              await tx
                .select({ id: schema.technologyCategories.id })
                .from(schema.technologyCategories)
                .where(eq(schema.technologyCategories.slug, category.parent))
                .limit(1)
            )[0]?.id ?? null)
          : null;
        await tx
          .insert(schema.technologyCategories)
          .values({
            slug: category.slug,
            name: category.name,
            description: category.description,
            parentId,
          })
          .onConflictDoUpdate({
            target: schema.technologyCategories.slug,
            set: {
              name: category.name,
              description: category.description,
              parentId,
              updatedAt: new Date(),
            },
          });
      }
    }

    for (const condition of CONDITION_DEFS) {
      const [row] = await tx
        .insert(schema.conditions)
        .values({
          slug: condition.slug,
          name: condition.name,
          category: condition.category,
          description: condition.description,
        })
        .onConflictDoUpdate({
          target: schema.conditions.slug,
          set: {
            name: condition.name,
            category: condition.category,
            description: condition.description,
            updatedAt: new Date(),
          },
        })
        .returning({ id: schema.conditions.id });
      if (!row) continue;

      // Registry spellings become aliases, which is how an ingested condition name
      // ("Spinal Cord Injuries") resolves onto the canonical entry.
      const names = [condition.name, ...(condition.synonyms ?? [])];
      const seen = new Set<string>();
      for (const name of names) {
        const normalized = normalizeForMatch(name);
        if (!normalized || seen.has(normalized)) continue;
        seen.add(normalized);
        const inserted = await tx
          .insert(schema.entityAliases)
          .values({ entityType: "condition", entityId: row.id, alias: name, normalized })
          .onConflictDoNothing()
          .returning({ id: schema.entityAliases.id });
        aliases += inserted.length;
      }
    }
  });

  const [categoryCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.technologyCategories);
  const [conditionCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.conditions);
  return { categories: categoryCount?.count ?? 0, conditions: conditionCount?.count ?? 0, aliases };
}
