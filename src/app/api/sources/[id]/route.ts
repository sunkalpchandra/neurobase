import { z } from "zod";
import { getSource } from "@/data/sources";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { NotFoundError, ValidationError } from "@/lib/errors";

export const GET = apiRoute(async (_request, context) => {
  const { id } = await context.params;
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) throw new ValidationError("Expected a source id");
  const source = await getSource(getDb(), parsed.data);
  if (!source) throw new NotFoundError("Source not found");
  return jsonOk(source);
});
