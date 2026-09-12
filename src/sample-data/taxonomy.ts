import type { ConditionCategory } from "@/domain/enums";

export interface CategoryDef {
  slug: string;
  name: string;
  description: string;
  parent: string | null;
}

export interface ConditionDef {
  slug: string;
  name: string;
  category: ConditionCategory;
  description: string;
  /** Phrase used mid-sentence: "people with ...". */
  phrase: string;
  /** Marks conditions the impact model treats as an unmet clinical need. */
  unmetNeed: boolean;
}

export const CATEGORY_DEFS: readonly CategoryDef[] = [
  {
    slug: "brain-computer-interfaces",
    name: "Brain-computer interfaces",
    parent: null,
    description:
      "Systems that decode neural activity into commands for communication, cursor control, prosthetics or other effectors.",
  },
  {
    slug: "implantable-bcis",
    name: "Implantable BCIs",
    parent: "brain-computer-interfaces",
    description:
      "Brain-computer interfaces using intracortical arrays or electrocorticography grids placed surgically.",
  },
  {
    slug: "noninvasive-bcis",
    name: "Noninvasive BCIs",
    parent: "brain-computer-interfaces",
    description:
      "Brain-computer interfaces driven by EEG, fNIRS or MEG signals recorded from outside the head.",
  },
  {
    slug: "endovascular-bcis",
    name: "Endovascular BCIs",
    parent: "brain-computer-interfaces",
    description:
      "Electrode arrays delivered through blood vessels to record cortical activity without open surgery.",
  },
  {
    slug: "neuromodulation",
    name: "Neuromodulation",
    parent: null,
    description:
      "Electrical, magnetic or ultrasonic stimulation of the nervous system to treat disease.",
  },
  {
    slug: "deep-brain-stimulation",
    name: "Deep brain stimulation",
    parent: "neuromodulation",
    description:
      "Implanted leads stimulating subcortical targets for movement, psychiatric and seizure disorders.",
  },
  {
    slug: "spinal-cord-stimulation",
    name: "Spinal cord stimulation",
    parent: "neuromodulation",
    description:
      "Epidural stimulation of the spinal cord for chronic pain and for restoring movement after injury.",
  },
  {
    slug: "peripheral-nerve-stimulation",
    name: "Peripheral nerve stimulation",
    parent: "neuromodulation",
    description:
      "Stimulation of peripheral, sacral, hypoglossal and other nerves outside the brain and spinal cord.",
  },
  {
    slug: "vagus-nerve-stimulation",
    name: "Vagus nerve stimulation",
    parent: "neuromodulation",
    description:
      "Implanted or transcutaneous stimulation of the vagus nerve for epilepsy, depression, rehabilitation and inflammation.",
  },
  {
    slug: "focused-ultrasound",
    name: "Focused ultrasound",
    parent: "neuromodulation",
    description:
      "Low-intensity focused ultrasound for noninvasive neuromodulation and targeted delivery.",
  },
  {
    slug: "transcranial-stimulation",
    name: "Transcranial stimulation",
    parent: "neuromodulation",
    description: "Transcranial magnetic and electrical stimulation delivered through the scalp.",
  },
  {
    slug: "responsive-neurostimulation",
    name: "Responsive neurostimulation",
    parent: "neuromodulation",
    description: "Stimulation triggered by detected neural events such as seizure onset.",
  },
  {
    slug: "sensory-prosthetics",
    name: "Sensory prosthetics",
    parent: null,
    description: "Devices restoring vision, hearing or touch by stimulating sensory pathways.",
  },
  {
    slug: "retinal-prosthetics",
    name: "Retinal prosthetics",
    parent: "sensory-prosthetics",
    description:
      "Epiretinal and subretinal implants restoring light perception in retinal degeneration.",
  },
  {
    slug: "cochlear-implants",
    name: "Cochlear implants",
    parent: "sensory-prosthetics",
    description:
      "Electrode arrays stimulating the auditory nerve for severe sensorineural hearing loss.",
  },
  {
    slug: "neuroprosthetic-limbs",
    name: "Neuroprosthetic limbs",
    parent: "sensory-prosthetics",
    description:
      "Prosthetic limbs controlled by and providing sensory feedback through peripheral nerve interfaces.",
  },
  {
    slug: "neurorehabilitation",
    name: "Neurorehabilitation",
    parent: null,
    description:
      "Technology-assisted recovery of motor, speech and cognitive function after stroke or injury.",
  },
  {
    slug: "neural-recording-hardware",
    name: "Neural recording hardware",
    parent: null,
    description: "Electrode arrays, probes and amplifiers for recording neural activity.",
  },
  {
    slug: "neural-decoding-software",
    name: "Neural decoding software",
    parent: null,
    description:
      "Algorithms and platforms that translate recorded neural signals into intended actions.",
  },
  {
    slug: "closed-loop-systems",
    name: "Closed-loop systems",
    parent: null,
    description:
      "Systems that adjust stimulation in real time based on recorded neural or physiological signals.",
  },
  {
    slug: "neuroimaging-wearables",
    name: "Neuroimaging wearables",
    parent: null,
    description:
      "Wearable EEG, fNIRS and MEG systems for monitoring brain activity outside the laboratory.",
  },
  {
    slug: "optogenetics",
    name: "Optogenetics",
    parent: null,
    description: "Light-based control and readout of genetically targeted neurons.",
  },
  {
    slug: "epilepsy-monitoring",
    name: "Epilepsy monitoring",
    parent: null,
    description:
      "Long-term seizure detection and forecasting with implanted or wearable recording systems.",
  },
];

export const CONDITION_DEFS: readonly ConditionDef[] = [
  {
    slug: "spinal-cord-injury",
    name: "Spinal cord injury",
    category: "motor",
    phrase: "spinal cord injury",
    unmetNeed: true,
    description:
      "Traumatic or non-traumatic damage to the spinal cord causing paralysis and loss of sensation below the lesion.",
  },
  {
    slug: "amyotrophic-lateral-sclerosis",
    name: "Amyotrophic lateral sclerosis (ALS)",
    category: "motor",
    phrase: "amyotrophic lateral sclerosis",
    unmetNeed: true,
    description:
      "Progressive motor neuron disease that leads to loss of speech, movement and breathing.",
  },
  {
    slug: "stroke",
    name: "Stroke",
    category: "motor",
    phrase: "stroke",
    unmetNeed: false,
    description:
      "Loss of brain function after interrupted blood supply, frequently leaving motor and speech impairment.",
  },
  {
    slug: "epilepsy",
    name: "Epilepsy",
    category: "epilepsy",
    phrase: "drug-resistant epilepsy",
    unmetNeed: true,
    description: "Recurrent seizures; about a third of patients do not respond to medication.",
  },
  {
    slug: "parkinson-disease",
    name: "Parkinson disease",
    category: "motor",
    phrase: "Parkinson disease",
    unmetNeed: false,
    description: "Neurodegenerative disorder with tremor, rigidity and slowness of movement.",
  },
  {
    slug: "essential-tremor",
    name: "Essential tremor",
    category: "motor",
    phrase: "essential tremor",
    unmetNeed: false,
    description: "Action tremor of the hands and arms that impairs daily tasks.",
  },
  {
    slug: "major-depressive-disorder",
    name: "Major depressive disorder",
    category: "psychiatric",
    phrase: "treatment-resistant depression",
    unmetNeed: true,
    description:
      "Persistent depressed mood and loss of interest; a subset is resistant to medication.",
  },
  {
    slug: "chronic-pain",
    name: "Chronic pain",
    category: "pain",
    phrase: "chronic neuropathic pain",
    unmetNeed: false,
    description: "Pain persisting beyond normal healing, often of neuropathic origin.",
  },
  {
    slug: "retinitis-pigmentosa",
    name: "Blindness (retinitis pigmentosa)",
    category: "sensory",
    phrase: "blindness caused by retinitis pigmentosa",
    unmetNeed: true,
    description:
      "Inherited retinal degeneration that destroys photoreceptors and leads to blindness.",
  },
  {
    slug: "age-related-macular-degeneration",
    name: "Age-related macular degeneration",
    category: "sensory",
    phrase: "advanced dry age-related macular degeneration",
    unmetNeed: true,
    description: "Degeneration of the central retina causing loss of central vision.",
  },
  {
    slug: "sensorineural-hearing-loss",
    name: "Deafness (sensorineural hearing loss)",
    category: "sensory",
    phrase: "severe-to-profound sensorineural hearing loss",
    unmetNeed: false,
    description: "Hearing loss from damage to the cochlea or auditory nerve.",
  },
  {
    slug: "locked-in-syndrome",
    name: "Locked-in syndrome",
    category: "communication",
    phrase: "locked-in syndrome",
    unmetNeed: true,
    description:
      "Near-complete paralysis with preserved awareness, typically after brainstem stroke.",
  },
  {
    slug: "tetraplegia",
    name: "Tetraplegia",
    category: "motor",
    phrase: "tetraplegia",
    unmetNeed: true,
    description: "Paralysis of all four limbs following cervical spinal cord injury or disease.",
  },
  {
    slug: "obsessive-compulsive-disorder",
    name: "Obsessive-compulsive disorder",
    category: "psychiatric",
    phrase: "treatment-refractory obsessive-compulsive disorder",
    unmetNeed: true,
    description:
      "Intrusive thoughts and compulsive behaviours that can resist medication and therapy.",
  },
  {
    slug: "migraine",
    name: "Migraine",
    category: "pain",
    phrase: "chronic migraine",
    unmetNeed: false,
    description: "Recurrent severe headache attacks with sensory sensitivity.",
  },
  {
    slug: "tinnitus",
    name: "Tinnitus",
    category: "sensory",
    phrase: "chronic tinnitus",
    unmetNeed: false,
    description: "Perception of sound without an external source.",
  },
  {
    slug: "obesity",
    name: "Obesity",
    category: "other",
    phrase: "obesity",
    unmetNeed: false,
    description:
      "Excess body weight with metabolic consequences; a target of vagal and gastric neuromodulation.",
  },
  {
    slug: "overactive-bladder",
    name: "Overactive bladder",
    category: "other",
    phrase: "refractory overactive bladder",
    unmetNeed: false,
    description: "Urinary urgency and frequency that may not respond to medication.",
  },
  {
    slug: "obstructive-sleep-apnea",
    name: "Obstructive sleep apnea",
    category: "other",
    phrase: "obstructive sleep apnea",
    unmetNeed: false,
    description:
      "Repeated airway collapse during sleep, treated in some patients with hypoglossal nerve stimulation.",
  },
  {
    slug: "dystonia",
    name: "Dystonia",
    category: "motor",
    phrase: "generalised dystonia",
    unmetNeed: false,
    description: "Involuntary sustained muscle contractions causing abnormal postures.",
  },
  {
    slug: "post-traumatic-stress-disorder",
    name: "Post-traumatic stress disorder",
    category: "psychiatric",
    phrase: "post-traumatic stress disorder",
    unmetNeed: false,
    description:
      "Persistent stress response after trauma, with intrusive memories and hyperarousal.",
  },
  {
    slug: "alzheimer-disease",
    name: "Alzheimer disease",
    category: "cognitive",
    phrase: "early Alzheimer disease",
    unmetNeed: true,
    description: "Progressive dementia with memory loss and cognitive decline.",
  },
  {
    slug: "traumatic-brain-injury",
    name: "Traumatic brain injury",
    category: "cognitive",
    phrase: "moderate traumatic brain injury",
    unmetNeed: false,
    description: "Brain damage from external force with cognitive, motor and behavioural sequelae.",
  },
  {
    slug: "multiple-sclerosis",
    name: "Multiple sclerosis",
    category: "motor",
    phrase: "multiple sclerosis",
    unmetNeed: false,
    description: "Autoimmune demyelination causing motor, sensory and cognitive symptoms.",
  },
  {
    slug: "limb-loss",
    name: "Limb loss",
    category: "motor",
    phrase: "upper-limb amputation",
    unmetNeed: false,
    description: "Loss of a limb through amputation or congenital absence.",
  },
  {
    slug: "phantom-limb-pain",
    name: "Phantom limb pain",
    category: "pain",
    phrase: "phantom limb pain",
    unmetNeed: false,
    description: "Pain perceived in a limb that has been amputated.",
  },
  {
    slug: "aphasia",
    name: "Aphasia",
    category: "communication",
    phrase: "post-stroke aphasia",
    unmetNeed: false,
    description: "Loss of language production or comprehension, most often after stroke.",
  },
  {
    slug: "cluster-headache",
    name: "Cluster headache",
    category: "pain",
    phrase: "chronic cluster headache",
    unmetNeed: false,
    description: "Severe unilateral headache attacks occurring in clusters.",
  },
  {
    slug: "disorders-of-consciousness",
    name: "Disorders of consciousness",
    category: "cognitive",
    phrase: "disorders of consciousness",
    unmetNeed: true,
    description: "Vegetative and minimally conscious states after severe brain injury.",
  },
  {
    slug: "cerebral-palsy",
    name: "Cerebral palsy",
    category: "motor",
    phrase: "cerebral palsy",
    unmetNeed: false,
    description: "Motor disorders arising from early brain injury.",
  },
  {
    slug: "rheumatoid-arthritis",
    name: "Rheumatoid arthritis",
    category: "other",
    phrase: "rheumatoid arthritis",
    unmetNeed: false,
    description:
      "Autoimmune joint inflammation; a target of vagus nerve stimulation for inflammation control.",
  },
  {
    slug: "brainstem-stroke",
    name: "Brainstem stroke",
    category: "communication",
    phrase: "brainstem stroke",
    unmetNeed: true,
    description:
      "Stroke affecting the brainstem, a frequent cause of anarthria and locked-in syndrome.",
  },
];

export const CONDITIONS_BY_SLUG: ReadonlyMap<string, ConditionDef> = new Map(
  CONDITION_DEFS.map((condition) => [condition.slug, condition]),
);

export const CATEGORIES_BY_SLUG: ReadonlyMap<string, CategoryDef> = new Map(
  CATEGORY_DEFS.map((category) => [category.slug, category]),
);

export function conditionDef(slug: string): ConditionDef {
  const def = CONDITIONS_BY_SLUG.get(slug);
  if (!def) throw new Error(`Unknown sample condition: ${slug}`);
  return def;
}
