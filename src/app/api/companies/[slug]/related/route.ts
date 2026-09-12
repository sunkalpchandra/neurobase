import { getRelatedEntities } from "@/data/companies";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { NotFoundError } from "@/lib/errors";

export const GET = apiRoute(async (_request, context) => {
  const { slug } = await context.params;
  if (typeof slug !== "string") throw new NotFoundError("Company not found");
  const related = await getRelatedEntities(getDb(), slug);
  if (!related) throw new NotFoundError("Company not found");
  return jsonOk(related);
});
