import { createPersonalizationRepository } from "@/data/personalization";
import { getDb } from "@/db/client";
import { apiRoute, jsonOk } from "@/lib/api";
import { getOrCreateProfileId, getProfileId } from "@/lib/profile";
import { savedItemInputSchema } from "@/lib/validation";
import { readJsonBody } from "../_shared";

const writeLimit = { name: "personalization-write", windowMs: 60_000, max: 60 };

export const GET = apiRoute(async () => {
  const profileId = await getProfileId();
  const items = profileId
    ? await createPersonalizationRepository(getDb()).listSaved(profileId)
    : [];
  return jsonOk({ items });
});

export const POST = apiRoute(
  async (request) => {
    const input = savedItemInputSchema.parse(await readJsonBody(request));
    const profileId = await getOrCreateProfileId();
    await createPersonalizationRepository(getDb()).save(
      profileId,
      input.entityType,
      input.entityId,
      input.note ?? null,
    );
    return jsonOk({ saved: true });
  },
  { rateLimit: writeLimit },
);

export const DELETE = apiRoute(
  async (request) => {
    const input = savedItemInputSchema
      .pick({ entityType: true, entityId: true })
      .parse(await readJsonBody(request));
    const profileId = await getProfileId();
    if (profileId)
      await createPersonalizationRepository(getDb()).unsave(
        profileId,
        input.entityType,
        input.entityId,
      );
    return jsonOk({ saved: false });
  },
  { rateLimit: writeLimit },
);
