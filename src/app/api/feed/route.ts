import { listFeed } from "@/data/events";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { parseFeedQuery, searchParamsToRecord } from "@/lib/validation";

export const GET = apiRoute(
  async (request) => {
    const query = parseFeedQuery(searchParamsToRecord(new URL(request.url).searchParams));
    return jsonOk(await listFeed(getDb(), query));
  },
  { rateLimit: { name: "feed", windowMs: 60_000, max: 120 } },
);
