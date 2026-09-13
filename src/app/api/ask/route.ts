import { z } from "zod";
import { getAskService } from "@/ask";
import { apiRoute, jsonOk } from "@/lib/api";
import { readJsonBody } from "../_shared";

const askSchema = z.object({
  question: z.string().trim().min(3).max(500),
  limit: z.coerce.number().int().min(1).max(24).optional(),
});

export const POST = apiRoute(
  async (request) => {
    const input = askSchema.parse(await readJsonBody(request));
    return jsonOk(await getAskService().answer(input));
  },
  // Answering runs a search and possibly a model call, so it is limited harder than search.
  { rateLimit: { name: "ask", windowMs: 60_000, max: 20 } },
);
