"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type {
  FeedbackActionInput,
  FollowActionInput,
  SaveActionInput,
} from "@/components/entities/actions";
import { createPersonalizationRepository } from "@/data/personalization";
import { getDb } from "@/db/client";
import { ValidationError } from "@/lib/errors";
import { getOrCreateProfileId } from "@/lib/profile";
import { feedbackInputSchema, followInputSchema, savedItemInputSchema } from "@/lib/validation";

/**
 * Server actions behind the Save, Follow and feedback controls. Inputs are validated
 * again here because actions are callable from any client.
 */

const saveSchema = savedItemInputSchema.extend({ saved: z.boolean() });
const followSchema = followInputSchema.extend({ followed: z.boolean() });

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success) throw new ValidationError("Invalid input", result.error.issues);
  return result.data;
}

export async function saveAction(input: SaveActionInput): Promise<{ saved: boolean }> {
  const { entityType, entityId, saved, note } = parse(saveSchema, input);
  const profileId = await getOrCreateProfileId();
  const repository = createPersonalizationRepository(getDb());
  if (saved) await repository.save(profileId, entityType, entityId, note ?? null);
  else await repository.unsave(profileId, entityType, entityId);
  revalidatePath("/saved");
  return { saved };
}

export async function followAction(input: FollowActionInput): Promise<{ followed: boolean }> {
  const { targetType, targetId, followed } = parse(followSchema, input);
  const profileId = await getOrCreateProfileId();
  const repository = createPersonalizationRepository(getDb());
  if (followed) await repository.follow(profileId, targetType, targetId);
  else await repository.unfollow(profileId, targetType, targetId);
  revalidatePath("/saved");
  return { followed };
}

export async function feedbackAction(input: FeedbackActionInput): Promise<void> {
  const { entityType, entityId, signal } = parse(feedbackInputSchema, input);
  const profileId = await getOrCreateProfileId();
  await createPersonalizationRepository(getDb()).recordFeedback(
    profileId,
    entityType,
    entityId,
    signal,
  );
  revalidatePath("/saved");
}
