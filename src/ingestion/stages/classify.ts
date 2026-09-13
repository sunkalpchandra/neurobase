import { CATEGORY_DEFS, CONDITION_DEFS } from "@/db/reference/taxonomy";
import type { NormalizedRecord } from "../normalized";

/**
 * Assigns a record to the controlled vocabulary from its own text.
 *
 * This is a match, not an inference: a category is attached only when the record itself
 * uses that category's name or one of its terms. A trial whose title says "deep brain
 * stimulation" is about deep brain stimulation; a trial that merely turned up in a
 * search for it is not.
 */

/** Terms that identify each category, beyond its own name. */
const CATEGORY_TERMS: Record<string, string[]> = {
  "brain-computer-interfaces": [
    "brain-computer interface",
    "brain computer interface",
    "brain-machine interface",
    "bci",
  ],
  "implantable-bcis": [
    "implanted brain-computer",
    "intracortical",
    "electrocorticograph",
    "ecog",
    "implantable bci",
  ],
  "noninvasive-bcis": [
    "non-invasive brain-computer",
    "noninvasive brain-computer",
    "eeg-based brain",
  ],
  "endovascular-bcis": ["endovascular", "stentrode"],
  neuromodulation: ["neuromodulation", "neurostimulation", "neural stimulation"],
  "deep-brain-stimulation": ["deep brain stimulation", "dbs"],
  "spinal-cord-stimulation": ["spinal cord stimulation", "epidural stimulation", "scs"],
  "peripheral-nerve-stimulation": [
    "peripheral nerve stimulation",
    "sacral nerve",
    "hypoglossal nerve",
    "occipital nerve",
    "tibial nerve",
  ],
  "vagus-nerve-stimulation": ["vagus nerve stimulation", "vagal nerve", "vns"],
  "focused-ultrasound": ["focused ultrasound", "lifu", "hifu", "ultrasound neuromodulation"],
  "transcranial-stimulation": [
    "transcranial magnetic stimulation",
    "transcranial direct current",
    "tdcs",
    "tacs",
    "tms",
  ],
  "responsive-neurostimulation": [
    "responsive neurostimulation",
    "closed-loop stimulation",
    "adaptive stimulation",
    "adaptive dbs",
  ],
  "sensory-prosthetics": ["sensory prosthes", "sensory feedback", "sensory restoration"],
  "retinal-prosthetics": ["retinal prosthes", "retinal implant", "visual prosthes", "bionic eye"],
  "cochlear-implants": ["cochlear implant", "auditory brainstem implant", "auditory prosthes"],
  "neuroprosthetic-limbs": [
    "prosthetic limb",
    "prosthetic hand",
    "prosthetic arm",
    "neuroprosthetic limb",
    "myoelectric",
  ],
  neurorehabilitation: ["rehabilitation", "motor recovery", "gait training", "neurorehabilitation"],
  "neural-recording-hardware": [
    "microelectrode array",
    "neural recording",
    "electrode array",
    "neural probe",
  ],
  "neural-decoding-software": [
    "neural decoding",
    "decoder",
    "decoding algorithm",
    "neural signal processing",
  ],
  "closed-loop-systems": ["closed-loop", "closed loop"],
  "neuroimaging-wearables": [
    "wearable eeg",
    "fnirs",
    "magnetoencephalograph",
    "meg",
    "wearable brain",
  ],
  optogenetics: ["optogenetic", "channelrhodopsin"],
  "epilepsy-monitoring": [
    "seizure detection",
    "seizure forecasting",
    "seizure monitoring",
    "intracranial eeg",
  ],
};

function haystack(record: NormalizedRecord): string {
  const parts: string[] = [];
  switch (record.kind) {
    case "clinical_trial":
      parts.push(
        record.title,
        record.officialTitle ?? "",
        record.summary ?? "",
        record.intervention ?? "",
      );
      break;
    case "publication":
      parts.push(record.title, record.abstract ?? "", ...record.topics);
      break;
    case "patent":
      parts.push(record.title, record.abstract ?? "");
      break;
    case "regulatory_action":
      parts.push(record.summary, record.deviceName ?? "");
      break;
    case "news_article":
      parts.push(record.title, record.summary);
      break;
    case "organization":
      parts.push(record.name, record.description);
      break;
  }
  return parts.join(" ").toLowerCase();
}

/** Whole-word match, so "scs" does not fire inside "discs". */
function mentions(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
}

/** Technology category slugs the record's own text supports. */
export function classifyCategories(record: NormalizedRecord): string[] {
  const text = haystack(record);
  if (!text) return [];
  return CATEGORY_DEFS.flatMap((category) => {
    const terms = [category.name.toLowerCase(), ...(CATEGORY_TERMS[category.slug] ?? [])];
    return terms.some((term) => mentions(text, term)) ? [category.slug] : [];
  });
}

/** Condition slugs the record's own text supports, matched through the same synonyms. */
export function classifyConditions(record: NormalizedRecord): string[] {
  const text = haystack(record);
  if (!text) return [];
  return CONDITION_DEFS.flatMap((condition) => {
    const terms = [
      condition.name.toLowerCase(),
      ...(condition.synonyms ?? []).map((s) => s.toLowerCase()),
    ];
    return terms.some((term) => mentions(text, term)) ? [condition.slug] : [];
  });
}
