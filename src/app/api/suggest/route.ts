import { apiRoute, jsonOk } from "@/lib/api";
import { parseSuggestQuery, searchParamsToRecord } from "@/lib/validation";
import { getSearchService } from "@/search";

export const GET = apiRoute(
  async (request) => {
    const { q, limit } = parseSuggestQuery(searchParamsToRecord(new URL(request.url).searchParams));
    const suggestions = await getSearchService().suggest(q, limit);
    return jsonOk({ suggestions });
  },
  { rateLimit: { name: "suggest", windowMs: 60_000, max: 120 } },
);
