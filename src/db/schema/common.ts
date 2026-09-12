import { boolean, timestamp } from "drizzle-orm/pg-core";
import { confidenceLevelEnum, verificationStatusEnum } from "./enums";

/**
 * Provenance and lifecycle columns shared by every major entity. `isSample` marks rows
 * that belong to the clearly labelled development dataset; the interface surfaces it.
 */
export const provenanceColumns = {
  verificationStatus: verificationStatusEnum("verification_status").notNull().default("unverified"),
  confidence: confidenceLevelEnum("confidence").notNull().default("moderate"),
  lastVerifiedAt: timestamp("last_verified_at", { withTimezone: true }),
  isSample: boolean("is_sample").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};

export const timestampColumns = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
};
