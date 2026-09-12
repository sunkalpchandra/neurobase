import { createPersonalizationRepository } from "@/data/personalization";
import { getDb } from "@/db/client";
import { getProfileId } from "@/lib/profile";

/**
 * Saved/followed keys for the current anonymous profile, or empty sets when the visitor
 * has no profile yet. Reading never creates a profile.
 */
export async function loadPersonalizationState(): Promise<{
  profileId: string | null;
  savedKeys: Set<string>;
  followKeys: Set<string>;
}> {
  const profileId = await getProfileId();
  if (!profileId) return { profileId: null, savedKeys: new Set(), followKeys: new Set() };
  const repository = createPersonalizationRepository(getDb());
  const [savedKeys, followKeys] = await Promise.all([
    repository.listSavedKeys(profileId),
    repository.listFollowKeys(profileId),
  ]);
  return { profileId, savedKeys, followKeys };
}
