import { getCompanyProfile } from "@/data/companies";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";

export const GET = apiRoute(async (_request, context) => {
  const { slug } = await context.params;
  if (typeof slug !== "string") throw new NotFoundError("Company not found");
  const profile = await getCompanyProfile(getDb(), slug);
  if (!profile) throw new NotFoundError("Company not found");
  return jsonOk(profile);
});
