import "dotenv/config";
import { parseArgs } from "node:util";
import { closeDb, getDb } from "../src/db/client";
import { findAdapter } from "../src/ingestion/adapters";
import { runPipeline } from "../src/ingestion/pipeline";
import { linkStoredRecords } from "../src/ingestion/classify-stored";
import { createDrizzleRepository } from "../src/ingestion/repository-drizzle";
import { getEmbeddingsProvider } from "../src/search/embeddings";
import { createSearchIndexer } from "../src/search/indexer";
import type { StageCounts } from "../src/ingestion/types";

/**
 * Builds the real corpus: a curated set of neurotechnology queries run against every
 * live connector, then a search reindex. Re-running is safe — records are matched on
 * their natural keys, so an existing row is refreshed rather than duplicated.
 *
 *   npm run corpus                 # full build
 *   npm run corpus -- --quick      # a tenth of the volume, for a smoke test
 *   npm run corpus -- --since 7    # weekly top-up: only records added in the last 7 days
 */

/** Query, adapter and how many records to take. Ordered so organizations exist early. */
interface CorpusQuery {
  adapter: string;
  query: string;
  limit: number;
}

/** The technologies NeuroBase covers, used to drive every connector. */
const TOPICS = [
  "brain-computer interface",
  "neural prosthesis",
  "deep brain stimulation",
  "spinal cord stimulation",
  "vagus nerve stimulation",
  "cochlear implant",
  "retinal prosthesis",
  "neuromodulation",
  "neural implant",
  "electrocorticography",
  "intracortical microelectrode",
  "transcranial magnetic stimulation",
  "transcranial direct current stimulation",
  "focused ultrasound neuromodulation",
  "responsive neurostimulation",
  "epilepsy seizure detection implant",
  "neural decoding",
  "speech neuroprosthesis",
  "peripheral nerve interface",
  "optogenetic stimulation",
  "closed-loop neurostimulation",
  "sacral nerve stimulation",
  "hypoglossal nerve stimulation",
  "neurorehabilitation robotics",
  "electroencephalography wearable",
];

/** openFDA indexes device names, so it needs product-style terms rather than topics. */
const DEVICE_TERMS = [
  "neurostimulator",
  "electroencephalograph",
  "cochlear",
  "stimulator",
  "electrode",
  "neurological",
  "brain",
  "nerve",
  "spinal",
  "evoked response",
];

const ORGANIZATION_TERMS = [
  "neurotechnology",
  "neural engineering",
  "neuroscience institute",
  "brain institute",
  "neurology",
  "bioelectronics",
  "neuroprosthetics",
  "neuromodulation",
];

function buildPlan(scale: number): CorpusQuery[] {
  const take = (n: number) => Math.max(3, Math.round(n * scale));
  // Ordered by how reliable the upstream is under load. OpenAlex throttles hard once a
  // burst trips its limit, so it runs last: a block there then costs only its own
  // records. The literature comes from three sources for the same reason — the research
  // side of the corpus must not empty because one API is unavailable.
  return [
    ...TOPICS.map((query) => ({ adapter: "clinicaltrials", query, limit: take(30) })),
    ...DEVICE_TERMS.map((query) => ({ adapter: "openfda", query, limit: take(20) })),
    ...TOPICS.map((query) => ({ adapter: "pubmed", query, limit: take(12) })),
    ...TOPICS.slice(0, 12).map((query) => ({ adapter: "crossref", query, limit: take(12) })),
    ...ORGANIZATION_TERMS.map((query) => ({
      adapter: "openalex-institutions",
      query,
      limit: take(25),
    })),
    ...TOPICS.map((query) => ({ adapter: "openalex", query, limit: take(24) })),
  ];
}

function addCounts(total: StageCounts, next: StageCounts): StageCounts {
  return {
    retrieved: total.retrieved + next.retrieved,
    normalized: total.normalized + next.normalized,
    invalid: total.invalid + next.invalid,
    duplicates: total.duplicates + next.duplicates,
    unresolved: total.unresolved + next.unresolved,
    organizations: total.organizations + next.organizations,
    devices: total.devices + next.devices,
    published: total.published + next.published,
    queued: total.queued + next.queued,
  };
}

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      quick: { type: "boolean", default: false },
      "skip-index": { type: "boolean", default: false },
      scale: { type: "string" },
    },
  });
  const scale = values.scale ? Number(values.scale) : values.quick ? 0.1 : 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`Invalid scale: ${values.scale}`);

  const db = getDb();
  const repository = createDrizzleRepository(db);
  const plan = buildPlan(scale);
  console.log(`Building the corpus from ${plan.length} queries across the live connectors.\n`);

  let totals: StageCounts = {
    retrieved: 0,
    normalized: 0,
    invalid: 0,
    duplicates: 0,
    unresolved: 0,
    organizations: 0,
    devices: 0,
    published: 0,
    queued: 0,
  };
  let failures = 0;

  for (const [index, entry] of plan.entries()) {
    const adapter = findAdapter(entry.adapter);
    if (!adapter) {
      console.error(`  ! unknown adapter ${entry.adapter}`);
      continue;
    }
    const label = `[${String(index + 1).padStart(3)}/${plan.length}] ${entry.adapter} · ${entry.query}`;
    try {
      const report = await runPipeline(repository, {
        adapter,
        query: entry.query,
        limit: entry.limit,
        createOrganizations: true,
      });
      totals = addCounts(totals, report.counts);
      console.log(
        `${label.padEnd(64)} +${report.counts.published} new, ${report.counts.duplicates} known, ${report.counts.organizations} orgs`,
      );
    } catch (error: unknown) {
      failures += 1;
      // One upstream being unavailable must not abandon the rest of the corpus.
      console.error(
        `${label.padEnd(64)} failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  console.log("\nTotals");
  for (const [stage, count] of Object.entries(totals)) {
    console.log(`  ${stage.padEnd(14)} ${String(count).padStart(6)}`);
  }
  if (failures) console.log(`  ${"failed queries".padEnd(14)} ${String(failures).padStart(6)}`);

  // Category, condition and indication links are derived from the records just stored,
  // so this runs after ingestion and before the index is rebuilt.
  const links = await linkStoredRecords(db);
  console.log(
    `\nLinked ${links.categories.organizationsLinked} organization and ${links.categories.devicesLinked} device categories across ${links.categories.categoriesUsed} categories, ${links.deviceConditions} device conditions, ${links.primaryIndications} primary indications.`,
  );

  if (values["skip-index"]) {
    console.log("\nSearch index not rebuilt (--skip-index).");
    return;
  }
  const indexer = createSearchIndexer(db, { embeddings: getEmbeddingsProvider() });
  const indexed = await indexer.reindexAll();
  console.log(`\nIndexed ${indexed.indexed} search documents.`);
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => closeDb());
