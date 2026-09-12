import { apiRoute, jsonOk } from "@/lib/api";
import { parseSearchRequest, searchParamsToRecord } from "@/lib/validation";
import { getSearchService } from "@/search";

export const GET = apiRoute(
  async (request) => {
    const params = searchParamsToRecord(new URL(request.url).searchParams);
    const response = await getSearchService().search(parseSearchRequest(params));
    return jsonOk(response);
  },
  { rateLimit: { name: "search", windowMs: 60_000, max: 60 } },
);
