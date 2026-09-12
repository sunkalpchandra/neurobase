import { createPersonalizationRepository } from "@/data/personalization";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { getOrCreateProfileId, getProfileId } from "@/lib/profile";
import { followInputSchema } from "@/lib/validation";
import { readJsonBody } from "../_shared";

const writeLimit = { name: "personalization-write", windowMs: 60_000, max: 60 };

export const GET = apiRoute(async () => {
  const profileId = await getProfileId();
  const items = profileId
    ? await createPersonalizationRepository(getDb()).listFollows(profileId)
    : [];
  return jsonOk({ items });
});

export const POST = apiRoute(
  async (request) => {
    const input = followInputSchema.parse(await readJsonBody(request));
    const profileId = await getOrCreateProfileId();
    await createPersonalizationRepository(getDb()).follow(
      profileId,
      input.targetType,
      input.targetId,
    );
    return jsonOk({ followed: true });
  },
  { rateLimit: writeLimit },
);

export const DELETE = apiRoute(
  async (request) => {
    const input = followInputSchema.parse(await readJsonBody(request));
    const profileId = await getProfileId();
    if (profileId)
      await createPersonalizationRepository(getDb()).unfollow(
        profileId,
        input.targetType,
        input.targetId,
      );
    return jsonOk({ followed: false });
  },
  { rateLimit: writeLimit },
);
