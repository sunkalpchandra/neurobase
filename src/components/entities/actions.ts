import type { EntityType, FeedbackSignal, FollowTargetType } from "@/domain/enums";

/**
 * Shapes of the server actions the personalisation controls receive through their
 * `action` prop (see docs/ARCHITECTURE.md, cross-module contracts).
 */

export interface SaveActionInput {
  entityType: EntityType;
  entityId: string;
  saved: boolean;
}
export type SaveAction = (input: SaveActionInput) => Promise<{ saved: boolean }>;

export interface FollowActionInput {
  targetType: FollowTargetType;
  targetId: string;
  followed: boolean;
}
export type FollowAction = (input: FollowActionInput) => Promise<{ followed: boolean }>;

export interface FeedbackActionInput {
  entityType: EntityType;
  entityId: string;
  signal: FeedbackSignal;
}
export type FeedbackAction = (input: FeedbackActionInput) => Promise<void>;
