import type { Database } from "@/db/client";
import { listRecentlyUpdatedCompanies } from "./companies";
import { listRecentlyUpdatedDevices } from "./devices";
import { listFeed, listTopics } from "./events";
import { listRecentPublications } from "./publications";
import { listNewTrials } from "./trials";
import type { FeedQuery, HomeFeedSections } from "./types";

/** Everything the home page renders, fetched concurrently. */
export async function getHomeFeed(db: Database, feedQuery: FeedQuery): Promise<HomeFeedSections> {
  const [
    developments,
    recentlyUpdatedCompanies,
    recentlyUpdatedDevices,
    newTrials,
    recentResearch,
    topics,
  ] = await Promise.all([
    listFeed(db, feedQuery),
    listRecentlyUpdatedCompanies(db, 6),
    listRecentlyUpdatedDevices(db, 6),
    listNewTrials(db, 6),
    listRecentPublications(db, 6),
    listTopics(db, 12),
  ]);
  return {
    developments,
    recentlyUpdatedCompanies,
    recentlyUpdatedDevices,
    newTrials,
    recentResearch,
    topics,
  };
}
