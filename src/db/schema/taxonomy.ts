import { index, pgTable, text, uniqueIndex, uuid, type AnyPgColumn } from "drizzle-orm/pg-core";
import { timestampColumns } from "./common";
import { conditionCategoryEnum } from "./enums";

export const technologyCategories = pgTable(
  "technology_categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parentId: uuid("parent_id").references((): AnyPgColumn => technologyCategories.id, {
      onDelete: "set null",
    }),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("technology_categories_slug_uidx").on(t.slug),
    index("technology_categories_parent_idx").on(t.parentId),
  ],
);

export const conditions = pgTable(
  "conditions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    category: conditionCategoryEnum("category").notNull(),
    description: text("description"),
    ...timestampColumns,
  },
  (t) => [
    uniqueIndex("conditions_slug_uidx").on(t.slug),
    index("conditions_category_idx").on(t.category),
  ],
);
