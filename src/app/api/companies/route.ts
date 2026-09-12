import { listCompanies } from "@/data/companies";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { parseCompanyDirectoryQuery, searchParamsToRecord } from "@/lib/validation";

export const GET = apiRoute(
  async (request) => {
    const query = parseCompanyDirectoryQuery(
      searchParamsToRecord(new URL(request.url).searchParams),
    );
    return jsonOk(await listCompanies(getDb(), query));
  },
  { rateLimit: { name: "companies", windowMs: 60_000, max: 120 } },
);
