import { createPersonalizationRepository } from "@/data/personalization";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { getOrCreateProfileId } from "@/lib/profile";
import { feedbackInputSchema } from "@/lib/validation";
import { readJsonBody } from "../_shared";

export const POST = apiRoute(
  async (request) => {
    const input = feedbackInputSchema.parse(await readJsonBody(request));
    const profileId = await getOrCreateProfileId();
    await createPersonalizationRepository(getDb()).recordFeedback(
      profileId,
      input.entityType,
      input.entityId,
      input.signal,
    );
    return jsonOk({ recorded: true });
  },
  { rateLimit: { name: "personalization-write", windowMs: 60_000, max: 60 } },
);
