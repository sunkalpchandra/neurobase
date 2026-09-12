import { bigint, boolean, date, index, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { provenanceColumns } from "./common";
import { roundTypeEnum } from "./enums";
import { organizations } from "./organizations";

export const fundingRounds = pgTable(
  "funding_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    announcedOn: date("announced_on", { mode: "string" }).notNull(),
    roundType: roundTypeEnum("round_type").notNull(),
    /** Null when the amount was not disclosed. Amounts are never estimated. */
    amountUsd: bigint("amount_usd", { mode: "number" }),
    currency: text("currency").notNull().default("USD"),
    ...provenanceColumns,
  },
  (t) => [index("funding_rounds_org_idx").on(t.organizationId), index("funding_rounds_date_idx").on(t.announcedOn)],
);

export const fundingRoundInvestors = pgTable(
  "funding_round_investors",
  {
    fundingRoundId: uuid("funding_round_id")
      .notNull()
      .references(() => fundingRounds.id, { onDelete: "cascade" }),
    investorOrganizationId: uuid("investor_organization_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    isLead: boolean("is_lead").notNull().default(false),
  },
  (t) => [
    primaryKey({ columns: [t.fundingRoundId, t.investorOrganizationId] }),
    index("funding_round_investors_investor_idx").on(t.investorOrganizationId),
  ],
);
