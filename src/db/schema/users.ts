import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { entityTypeEnum, feedbackSignalEnum, followTargetTypeEnum, profileKindEnum } from "./enums";

/**
 * Personalisation is keyed by a profile, not a user account. Today profiles are
 * anonymous and identified by an httpOnly cookie; an authentication provider can later
 * map its user id onto `externalId` without changing the tables below.
 */
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: profileKindEnum("kind").notNull().default("anonymous"),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_profiles_external_uidx").on(t.externalId)],
);

export const savedItems = pgTable(
  "saved_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("saved_items_uidx").on(t.profileId, t.entityType, t.entityId),
    index("saved_items_profile_idx").on(t.profileId, t.createdAt),
  ],
);

export const follows = pgTable(
  "follows",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    targetType: followTargetTypeEnum("target_type").notNull(),
    targetId: uuid("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("follows_uidx").on(t.profileId, t.targetType, t.targetId),
    index("follows_profile_idx").on(t.profileId),
  ],
);

export const feedbackSignals = pgTable(
  "feedback_signals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => userProfiles.id, { onDelete: "cascade" }),
    entityType: entityTypeEnum("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    signal: feedbackSignalEnum("signal").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("feedback_signals_uidx").on(t.profileId, t.entityType, t.entityId, t.signal),
    index("feedback_signals_profile_idx").on(t.profileId),
  ],
);
