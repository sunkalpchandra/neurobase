import { canonicalKey, splitWords } from "./text";

/**
 * Domain synonym groups. Each group is a set of phrases that a searcher would treat as
 * equivalent for retrieval; the first member is the canonical form. Phrases are
 * written in normalised form (lower case, no hyphens or apostrophes) because both the
 * dictionary and query tokens pass through normalizeText/canonicalKey before matching.
 *
 * Expansion widens recall only: a match on a synonym still ranks by the document's
 * own text, so the groups never make a document say something it does not say.
 */
export const SYNONYM_GROUPS: ReadonlyArray<ReadonlyArray<string>> = [
  ["brain computer interface", "bci", "brain machine interface", "bmi", "neural interface"],
  ["implanted", "implantable", "invasive", "implant"],
  ["noninvasive", "non invasive"],
  ["minimally invasive", "minimally invasive interface"],
  ["speech restoration", "speech decoding", "speech neuroprosthesis", "speech bci"],
  ["stroke rehabilitation", "stroke recovery", "motor rehabilitation", "stroke rehab"],
  [
    "retinal prosthesis",
    "retinal prostheses",
    "retinal implant",
    "visual prosthesis",
    "bionic eye",
  ],
  ["peripheral nerve stimulation", "peripheral neuromodulation", "peripheral nerve interface"],
  ["neural decoding", "decoder", "neural decoder", "decoding"],
  ["deep brain stimulation", "dbs"],
  ["spinal cord stimulation", "scs", "spinal stimulation"],
  ["vagus nerve stimulation", "vns", "vagal nerve stimulation"],
  ["transcranial magnetic stimulation", "tms", "rtms"],
  ["transcranial direct current stimulation", "tdcs", "transcranial electrical stimulation"],
  ["transcranial alternating current stimulation", "tacs"],
  ["electrocorticography", "ecog", "cortical surface electrode"],
  ["electroencephalography", "eeg", "electroencephalogram"],
  ["magnetoencephalography", "meg"],
  ["functional near infrared spectroscopy", "fnirs", "near infrared spectroscopy"],
  ["intracortical array", "intracortical", "microelectrode array", "penetrating electrode"],
  ["endovascular electrode", "endovascular", "endovascular interface"],
  ["focused ultrasound", "transcranial ultrasound", "ultrasound neuromodulation"],
  ["cochlear implant", "cochlear prosthesis", "auditory prosthesis"],
  ["optogenetics", "optogenetic"],
  ["paralysis", "tetraplegia", "quadriplegia", "spinal cord injury", "paralyzed", "paralysed"],
  ["als", "amyotrophic lateral sclerosis", "motor neuron disease", "motor neurone disease"],
  ["epilepsy", "seizure", "seizures", "epileptic", "drug resistant epilepsy"],
  ["parkinson disease", "parkinsons", "parkinson", "parkinsons disease", "parkinsonian"],
  ["depression", "major depressive disorder", "mdd", "treatment resistant depression"],
  ["chronic pain", "neuropathic pain", "intractable pain", "pain management"],
  ["blindness", "vision loss", "retinitis pigmentosa", "visual impairment", "blind"],
  ["deafness", "hearing loss", "hearing impairment", "deaf"],
  ["essential tremor", "tremor"],
  ["obsessive compulsive disorder", "ocd"],
  ["locked in syndrome", "locked in"],
  ["neuromodulation", "neurostimulation", "neural stimulation"],
  ["neuroprosthesis", "neuroprosthetic", "neural prosthesis", "neuroprostheses"],
  ["motor cortex", "primary motor cortex"],
  ["closed loop", "adaptive stimulation", "responsive stimulation"],
  ["premarket approval", "fda approval", "fda approved", "pma"],
  ["breakthrough device designation", "breakthrough designation", "breakthrough device"],
  ["ce mark", "ce marking", "ce marked"],
  ["investigational device exemption", "ide"],
  ["electrode", "electrodes", "microelectrode"],
  ["cursor control", "computer control"],
  ["memory prosthesis", "hippocampal prosthesis"],
  ["prosthetic limb", "bionic limb", "myoelectric prosthesis"],
  ["exoskeleton", "powered exoskeleton", "wearable robot"],
  ["traumatic brain injury", "tbi", "brain injury"],
  ["alzheimer disease", "alzheimers", "alzheimer", "alzheimers disease", "dementia"],
  ["migraine", "migraines", "headache"],
  ["sacral neuromodulation", "sacral nerve stimulation"],
  ["overactive bladder", "urinary incontinence", "bladder dysfunction"],
  ["post traumatic stress disorder", "ptsd"],
  ["autism", "autism spectrum disorder"],
  ["neurofeedback", "biofeedback"],
  ["machine learning", "deep learning", "artificial intelligence"],
  ["spiking activity", "action potentials", "single unit activity", "spikes"],
  ["local field potential", "lfp"],
  ["electromyography", "emg", "myoelectric"],
  ["functional electrical stimulation", "fes"],
  ["dorsal root ganglion stimulation", "drg stimulation"],
  ["obstructive sleep apnea", "sleep apnea", "osa"],
  ["stroke", "cerebrovascular accident", "ischemic stroke"],
  ["rehabilitation", "rehab"],
  ["funding", "financing", "investment", "fundraising"],
  ["acquisition", "acquired", "merger", "buyout"],
  ["partnership", "collaboration", "alliance"],
  ["regulatory approval", "regulatory clearance", "authorization", "authorisation", "clearance"],
];

export interface SynonymEntry {
  /** Dictionary phrase in its written (normalised) form. */
  term: string;
  /** Other members of the group. */
  synonyms: string[];
}

function buildIndex(): Map<string, SynonymEntry> {
  const index = new Map<string, SynonymEntry>();
  for (const group of SYNONYM_GROUPS) {
    for (const member of group) {
      const key = canonicalKey(splitWords(member));
      if (index.has(key)) continue;
      index.set(key, { term: member, synonyms: group.filter((other) => other !== member) });
    }
  }
  return index;
}

const SYNONYM_INDEX = buildIndex();

export const MAX_SYNONYM_PHRASE_WORDS = Math.max(
  ...SYNONYM_GROUPS.flatMap((group) => group.map((member) => splitWords(member).length)),
);

/** Looks up a canonical key (see canonicalKey) in the synonym dictionary. */
export function lookupSynonyms(key: string): SynonymEntry | undefined {
  return SYNONYM_INDEX.get(key);
}
