import { BCI_ARCHETYPES } from "./bci";
import { NEUROMODULATION_ARCHETYPES } from "./neuromodulation";
import { SENSORY_REHAB_ARCHETYPES } from "./sensory-rehab";
import type { Archetype } from "./types";

export type { Archetype, MetricDef } from "./types";
export { EVIDENCE_FOR_STAGE } from "./types";

export const ARCHETYPES: readonly Archetype[] = [
  ...BCI_ARCHETYPES,
  ...NEUROMODULATION_ARCHETYPES,
  ...SENSORY_REHAB_ARCHETYPES,
];

const BY_KEY = new Map(ARCHETYPES.map((archetype) => [archetype.key, archetype]));

export function archetypeByKey(key: string): Archetype {
  const archetype = BY_KEY.get(key);
  if (!archetype) throw new Error(`Unknown sample archetype: ${key}`);
  return archetype;
}

/**
 * Coverage queue: archetypes with guarantees, interleaved round-robin so that small
 * scales still get a mix of technologies rather than only the first archetype.
 */
export function forcedArchetypeQueue(scale: number): Archetype[] {
  const remaining = ARCHETYPES.map((archetype) => ({
    archetype,
    left: Math.floor(archetype.forcedCompanies * scale),
  }));
  const queue: Archetype[] = [];
  let progressed = true;
  while (progressed) {
    progressed = false;
    for (const entry of remaining) {
      if (entry.left > 0) {
        queue.push(entry.archetype);
        entry.left -= 1;
        progressed = true;
      }
    }
  }
  return queue;
}
