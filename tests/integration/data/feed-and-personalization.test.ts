import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { getEventBySlug, listFeed } from "@/data/events";
import { getHomeFeed } from "@/data/home";
import { createPersonalizationRepository } from "@/data/personalization";
import { getSource } from "@/data/sources";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import type { SampleDataset } from "@/sample-data/types";
import { removeTestDataset, seedTestDataset } from "./helpers";

let db: Database;
let dataset: SampleDataset;
let profileId: string;

beforeAll(async () => {
  ({ db, dataset } = await seedTestDataset());
  const [profile] = await db
    .insert(schema.userProfiles)
    .values({ kind: "anonymous" })
    .returning({ id: schema.userProfiles.id });
  profileId = profile!.id;
});

afterAll(async () => {
  await db.delete(schema.userProfiles).where(eq(schema.userProfiles.id, profileId));
  await removeTestDataset(db, dataset);
});

describe("feed", () => {
  it("lists developments newest first with entities, sources and impact", async () => {
    const page = await listFeed(db, { cursor: null, pageSize: 10 });
    expect(page.items.length).toBeGreaterThan(0);
    const dates = page.items.map((item) => item.occurredOn);
    expect([...dates].sort().reverse()).toEqual(dates);
    const withImpact = page.items.filter((item) => item.impact);
    expect(withImpact.length).toBeGreaterThan(0);
    expect(withImpact[0]!.impact!.author).toBe("rules_v1");
    expect(page.items.every((item) => item.sourceCount >= 1)).toBe(true);
  });

  it("filters by topic and event type", async () => {
    const home = await getHomeFeed(db, { cursor: null, pageSize: 5 });
    expect(home.topics.length).toBeGreaterThan(0);
    const topic = home.topics[0]!;
    const filtered = await listFeed(db, { topic: topic.slug, cursor: null, pageSize: 50 });
    expect(
      filtered.items.every((item) =>
        item.technologyCategories.some((category) => category.slug === topic.slug),
      ),
    ).toBe(true);
    const funding = await listFeed(db, {
      eventTypes: ["funding_round"],
      cursor: null,
      pageSize: 50,
    });
    expect(funding.items.every((item) => item.eventType === "funding_round")).toBe(true);
  });

  it("resolves an event detail with its sources and a source detail with its claims", async () => {
    const page = await listFeed(db, { cursor: null, pageSize: 1 });
    const slug = page.items[0]!.href.split("/").pop()!;
    const event = await getEventBySlug(db, decodeURIComponent(slug));
    expect(event).not.toBeNull();
    expect(event!.sources.length).toBeGreaterThanOrEqual(1);
    const claimSource = dataset.claimSources[0]!;
    const source = await getSource(db, claimSource.sourceId);
    expect(source).not.toBeNull();
    expect(source!.claims.length).toBeGreaterThan(0);
  });
});

describe("personalization", () => {
  it("saves, follows, records feedback and recommends with reasons", async () => {
    const repository = createPersonalizationRepository(db);
    const company = dataset.organizations.find((organization) => organization.kind === "company")!;
    await repository.save(profileId, "organization", company.id!);
    await repository.save(profileId, "organization", company.id!); // idempotent
    expect(await repository.isSaved(profileId, "organization", company.id!)).toBe(true);
    const saved = await repository.listSaved(profileId);
    expect(saved.map((item) => item.entityId)).toContain(company.id);

    await repository.follow(profileId, "organization", company.id!);
    const follows = await repository.listFollows(profileId);
    expect(follows[0]?.name).toBe(company.name);

    const recommended = await repository.forYou(profileId, 10);
    expect(recommended.length).toBeGreaterThan(0);
    expect(recommended[0]!.recommendationReason).toContain("Because you follow");

    const hidden = recommended[0]!;
    await repository.recordFeedback(profileId, "event", hidden.id, "hide");
    const afterHide = await repository.forYou(profileId, 10);
    expect(afterHide.some((item) => item.id === hidden.id)).toBe(false);

    await repository.recordFeedback(profileId, "event", hidden.id, "more_like_this");
    await repository.recordFeedback(profileId, "event", hidden.id, "less_like_this");
    const signals = await db
      .select()
      .from(schema.feedbackSignals)
      .where(eq(schema.feedbackSignals.profileId, profileId));
    expect(
      signals
        .filter((signal) => signal.entityId === hidden.id)
        .map((signal) => signal.signal)
        .sort(),
    ).toEqual(["hide", "less_like_this"]);

    await repository.unsave(profileId, "organization", company.id!);
    expect(await repository.isSaved(profileId, "organization", company.id!)).toBe(false);
    await repository.unfollow(profileId, "organization", company.id!);
    expect(await repository.listFollows(profileId)).toEqual([]);
  });
});
