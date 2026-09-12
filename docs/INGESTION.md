# Ingestion

Records enter NeuroBase through connectors to official public APIs. Nothing is scraped
from HTML, and nothing is published without a retrievable source.

## Pipeline

`runPipeline(repository, options)` in `src/ingestion/pipeline.ts` runs ten stages. Each
stage is a pure function over records plus an explicit repository interface, so every
one is unit-tested against an in-memory fake (`src/ingestion/repository-memory.ts`).

| #   | Stage                 | File                              | What it does                                                                                                   |
| --- | --------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | retrieve              | `stages/retrieve.ts`              | Pulls raw records from an adapter up to the limit. Refuses planned adapters.                                   |
| 2   | normalize             | `stages/normalize.ts`             | Adapter maps the payload onto the shared record shape. A throw is captured, not propagated.                    |
| 3   | validate              | `stages/validate.ts`              | Re-parses with the zod schema in `normalized.ts`. Failures go to the review queue and stop.                    |
| 4   | extract entities      | `stages/extract-entities.ts`      | Collects mentioned organization, person, condition and device names from labelled fields only.                 |
| 5   | resolve entities      | `stages/resolve-entities.ts`      | Exact alias match, then `pg_trgm` similarity ≥ 0.6. Ambiguous or weak matches are reported unresolved.         |
| 6   | detect duplicates     | `stages/detect-duplicates.ts`     | Looks up the natural key (registry id, DOI/PMID, patent number, reference number, URL).                        |
| 7   | connect relationships | `stages/connect-relationships.ts` | Turns resolved ids into event entity links with roles.                                                         |
| 8   | store provenance      | `stages/store-provenance.ts`      | Derives one claim per stated fact; the source row is written by the repository.                                |
| 9   | queue for review      | `pipeline.ts`                     | Writes a `review_queue` row for every validation failure and unresolved mention.                               |
| 10  | publish               | `stages/publish.ts` + repository  | Upserts the entity, its links and claims, then creates or refreshes the development with an impact assessment. |

Two rules shape the behaviour:

- **A record with an unresolved mention still publishes.** The link is left null and the
  mention is queued for an editor. Partial data with a recorded gap beats no data.
- **Re-running an adapter is safe.** Stage 6 finds the existing row by natural key and
  stage 10 updates it, so counts move from `published` to `duplicates` on the second run.

Ingested rows are written with `verification_status = machine_verified`,
`confidence = moderate` and `is_sample = false`. Evidence stage and novelty are editorial
judgements: ingestion records the weakest defensible value rather than inferring one from
an abstract.

## Adapters

`npm run ingest -- --list` prints this table with the full terms of use.

| Adapter            | Status    | Upstream                               | Notes                                                                                                                                                               |
| ------------------ | --------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `clinicaltrials`   | available | ClinicalTrials.gov API v2              | No key. Identify yourself with `INGEST_CONTACT_EMAIL`. Records are U.S. Government works in the public domain.                                                      |
| `pubmed`           | available | NCBI E-utilities (esearch + esummary)  | 3 req/s anonymous, 10 with `NCBI_API_KEY`. `tool` and `email` parameters are required. **esummary returns no abstract**, so ingested papers have `abstract = null`. |
| `crossref`         | available | Crossref REST API                      | Sends `mailto` to join the polite pool. Metadata is CC0. Abstracts arrive as JATS XML and are stripped to text.                                                     |
| `openfda`          | available | openFDA `device/510k` and `device/pma` | 240 req/min and 1,000/day anonymously. The FDA notes records may lag the official databases.                                                                        |
| `semanticscholar`  | planned   | Semantic Scholar Academic Graph        | Free but needs a requested API key above a very low anonymous rate.                                                                                                 |
| `patents`          | planned   | PatentsView / EPO OPS / Google Patents | All require registration, quotas or BigQuery terms. The sample dataset uses the reserved `XX` jurisdiction instead.                                                 |
| `company-websites` | planned   | Manufacturer sites                     | **Deliberately not implemented.** A crawler would have to honour robots.txt and per-site terms, and many manufacturers prohibit automated collection.               |
| `lab-websites`     | planned   | University group pages                 | Not implemented, same reason. Lab records come from publication metadata and editor submissions.                                                                    |
| `news`             | planned   | Trade and general press                | Not implemented. Aggregation needs a licensed feed or explicit RSS permission; scraping article text would infringe copyright.                                      |

### What must not be scraped, and why

Company product pages, university lab pages and news article bodies are all reachable
with a plain HTTP client, and all three are excluded on purpose: the first two because
robots.txt and site terms commonly forbid automated collection, the third because
article text is copyrighted. The codebase has no HTML parser for this reason — if a
future connector needs one, the licence question has to be answered first.

## HTTP behaviour

`src/ingestion/http.ts` is the only way out to the network:

- Per-host token bucket at the adapter's documented rate.
- `AbortController` timeout, 15 s by default.
- Up to 3 retries with exponential backoff on 408, 425, 429 and 5xx, and on network
  errors. A 4xx or an unexpected response shape is **not** retried — a shape change
  upstream should fail loudly rather than loop.
- Every response body is validated with zod before any field is read.
- `User-Agent: NeuroBase/0.1 (+<INGEST_CONTACT_EMAIL>)`.

## Review queue

`review_queue` rows carry the upstream payload, the record kind, the reason and the run
id. Reasons come in three shapes: a validation failure (`Validation failed at status: …`),
an unresolved mention (`No organization matches "…" above similarity 0.6`), and an
ambiguous match (`"…" matches both "…" and "…" with similar confidence`). Rows stay
`pending` until an editor approves or rejects them.

## Running it

```bash
npm run ingest -- --list
npm run ingest -- --adapter clinicaltrials --query "brain computer interface" --limit 25 --dry-run
npm run ingest -- --adapter clinicaltrials --query "brain computer interface" --limit 25
npm run ingest -- --adapter pubmed --query "neural decoding" --limit 10
npm run ingest -- --adapter openfda --query "neurostimulator" --limit 10
```

`--dry-run` runs every stage through validation and entity resolution and prints what
would be written, without touching the database.

Ingestion does not rebuild the search index. After a run:

```bash
npx tsx -e "import('./src/search/indexer').then(async (m) => { const { getDb } = await import('./src/db/client'); console.log(await m.createSearchIndexer(getDb()).reindexAll()); })"
```

## Testing

- `tests/unit/ingestion/adapters.test.ts` runs each adapter's normaliser over fixtures in
  `tests/fixtures/ingestion/`, captured from the live APIs and trimmed to the fields the
  adapters read.
- `tests/unit/ingestion/pipeline.test.ts` covers the stages and the pipeline against the
  in-memory repository, plus the HTTP client's retry, rate-limit and validation behaviour.
- `tests/integration/ingestion/pipeline.test.ts` runs the real pipeline against PostgreSQL
  with a fake adapter (no network), and deletes only the rows it created.
