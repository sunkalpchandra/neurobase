# Search

NeuroBase search runs on PostgreSQL. Every searchable entity is denormalised into one
row of `search_documents` (see `src/db/schema/search.ts`); the service in `src/search`
parses the query, ranks rows with a documented formula, and returns facets alongside the
results. Semantic (embedding) search is optional and is only ever claimed when it is
actually active.

**The score is a retrieval ranking, not a measure of truth.** A high score means a
document matches the query well, is recent, and comes from a reliable kind of source. It
says nothing about whether the claims in the document are correct; provenance and
verification status are shown separately and are never folded into the score.

## Modules

| File                       | Responsibility                                                                 |
| -------------------------- | ------------------------------------------------------------------------------ |
| `types.ts`                 | Request, response, filter, facet, provider and indexer contracts.              |
| `text.ts`, `stop-words.ts` | Normalisation (NFKD, lower case, punctuation), heuristic singulars, stop list. |
| `synonyms.ts`              | Domain synonym groups (BCI / brain-computer interface, DBS, ALS, ...).         |
| `facet-terms.ts`           | Query phrases that mean a filter ("noninvasive", "companies", "in humans").    |
| `parser.ts`                | `parseQuery(text)`: terms, expansions, interpreted filters, tsquery text.      |
| `tsquery.ts`               | Builds the `to_tsquery` string; only `[a-z0-9]` from user text can reach it.   |
| `scoring.ts`               | Reference implementation of the ranking formula and weights.                   |
| `snippets.ts`              | `ts_headline` options and the snippet sanitiser (`<mark>` only).               |
| `sql.ts`, `facets.ts`      | Shared WHERE builder and the single-round-trip facet query.                    |
| `service.ts`, `index.ts`   | `createSearchService(db, deps)` and the `getSearchService()` singleton.        |
| `vector-support.ts`        | Cached check that the optional `search_embeddings` table exists.               |
| `embeddings/`              | `getEmbeddingsProvider()` and the OpenAI `text-embedding-3-small` provider.    |
| `indexer.ts`, `indexing/`  | `createSearchIndexer(db, options)`: batched document builders and upserts.     |

## Query pipeline

1. **Normalise.** The text is NFKD-normalised, lower-cased, diacritics and apostrophes
   removed, punctuation and hyphens replaced by spaces, and capped at 200 characters.
   Quoted text (`"speech decoding"`) becomes an exact phrase that is neither interpreted
   nor expanded.
2. **Segment.** A longest-match scan over the tokens looks phrases up in the facet
   dictionary first and the synonym dictionary second. Lookups use a canonical key
   (heuristic singular of each word), so `BCIs` matches `bci` and `retinal prostheses`
   matches `retinal prosthesis`.
3. **Interpret.** Facet phrases become `InterpretedFilter`s and leave the content terms:
   `noninvasive`/`non-invasive` → invasiveness; `implanted`/`implantable`/`invasive` →
   invasive; `companies`/`startups` → category companies; `trials` → category clinical
   trials; `active`/`recruiting`/`ongoing`/`enrolling` within three tokens of a trial
   word → the active trial statuses; `tested in humans`/`in humans`/`human participants`
   → the four human evidence stages; `stimulation`/`recording` → modality (including
   "both"); `papers`/`studies`/`publications`/`research` → research; `patents`,
   `devices`, `news` → their categories. Only the first category word acts as a filter;
   later ones stay content terms. A trial-status word without a nearby trial word stays
   a content term too, so "active electrode" is not a status filter.
4. **Apply.** The service merges interpreted filters into the request: explicit filters
   always win, an interpreted category applies only when the request category is `all`,
   and `applyInterpretedFilters: false` disables the merge (used when a searcher
   dismisses a chip). `parsed.interpreted` is returned so the interface can show what
   was inferred.
5. **Expand and build.** Each remaining term becomes an OR-group of itself and its
   synonyms; multi-word phrases use the `<->` (followed-by) operator; words of four or
   more characters get prefix matching (`:*`); groups are AND-ed. Every character outside
   `[a-z0-9]` is stripped from tokens before they are written, so `!`, `&`, `|`, `<->`,
   `:*`, quotes and parentheses in user text can never become operators. Stop words are
   a superset of the PostgreSQL `english` list, so no group is silently empty.

## Ranking formula

Each row gets four components in `[0, 1]`:

| Component  | Definition                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `keyword`  | `ts_rank_cd(tsv, query, 32)` — cover-density rank over the weighted `tsv` (title A, subtitle and keywords B, body C), normalised by flag 32 to `rank / (rank + 1)`. 0 in browse mode.          |
| `semantic` | `max(0, 1 − cosine_distance(embedding, query_embedding))` when hybrid mode is on and the document has an embedding; otherwise `NULL` (contributes 0).                                          |
| `recency`  | `exp(−ln 2 · age_days / 365)` — a one-year half-life on `published_on`, falling back to `entity_updated_at`.                                                                                   |
| `quality`  | `source_quality`: the best `SOURCE_TYPE_QUALITY` prior among the entity's linked sources (0.5 when it has none). A prior about the _kind_ of source, never a judgement of a specific document. |

```
final = w_keyword · keyword + w_semantic · coalesce(semantic, 0) + w_recency · recency + w_quality · quality
```

| Mode                | keyword | semantic | recency | quality |
| ------------------- | ------- | -------- | ------- | ------- |
| Lexical (default)   | 0.55    | 0        | 0.20    | 0.25    |
| Hybrid (embeddings) | 0.35    | 0.30     | 0.15    | 0.20    |

The SQL computes `final` and orders by `final DESC, entity_updated_at DESC, id ASC`;
`scoring.ts` is the reference implementation, and every result carries its breakdown
(`SearchResult.score`) so the interface can show why a row ranked where it did. With no
query terms (browse mode) keyword is 0 and results are ordered by recency and quality.

## Round trips per search

1. Results page: one statement (CTE for the tsquery → scored rows → ordered page →
   `ts_headline` for the page rows only), run in parallel with
2. `COUNT(*)` under the same WHERE (cheap at this scale; it is `pageInfo.totalCount`).
3. Facets: a single `UNION ALL` of GROUP BY branches. Entity-type counts ignore the
   category (they feed the category tabs). Every other facet is counted within the
   category and under every filter except its own, so a multi-select facet keeps
   listing its alternatives.
4. Labels for technology-category and condition slugs, fetched once per search from
   `technology_categories` / `conditions`. Enum facets use the label maps in
   `src/domain/enums.ts`; countries use `Intl.DisplayNames`.

Semantic mode adds an embeddings request and, on first use, an `EXISTS` check that any
embeddings are stored.

## Snippets

`ts_headline` runs over an HTML-escaped copy of the body with
`StartSel=<mark>,StopSel=</mark>,MaxFragments=2,MaxWords=24,MinWords=8`. The result
passes through `sanitizeSnippet`, which keeps only literal `<mark>` / `</mark>` tags and
escapes every other character, so indexed text can never become markup. In browse mode
the snippet is the escaped start of the description.

## Cursor

`pageInfo.nextCursor` is base64url-encoded JSON `{"offset": n}`. It is present only
when the page query returned one row more than `pageSize`. Malformed cursors decode to
offset 0 and offsets are capped at 1000. Page size is clamped to 1–50.

## Lexical fallback

If the AND query matches nothing and the query has at least two term groups, the service
re-runs it with OR between the groups. `mode.description` then ends with "Results were
broadened: no document matched every term, so documents matching any term are shown."
The decision is made from the count, so every page of a broadened query is consistent.

## Semantic search

Lexical search is the default and needs nothing beyond PostgreSQL. `mode` is honest by
construction: `semantic: true` requires a configured provider **and** the
`search_embeddings` table **and** at least one stored embedding **and** a successful
query-embedding call. Otherwise `mode.description` names the missing piece, and when the
provider call fails mid-request the request degrades to lexical and says so.

To enable it:

1. Install pgvector on the server and run `npm run db:migrate` — `scripts/migrate.ts`
   applies `drizzle/optional/vector.sql` (a `vector(1536)` column with an HNSW cosine
   index) when the extension is available.
2. Set `EMBEDDINGS_PROVIDER=openai` and `OPENAI_API_KEY` in `.env`. The provider calls
   `text-embedding-3-small` over `fetch` with a 15 s timeout and validates the response
   with zod.
3. Run `npm run db:seed` (which reindexes and then calls `embedMissing()`), or call
   `createSearchIndexer(db, { embeddings }).embedMissing(limit)` yourself. It embeds
   `title + subtitle + description + body` (first 8000 characters) for documents that
   have no vector, 100 texts per provider call, and reports a reason when it skips.

Reindexing a document whose title or body changed deletes its stale embedding so the
next `embedMissing` recomputes it.

## Indexer

`createSearchIndexer(db, { embeddings? })` builds documents for organizations (every
kind), devices, clinical trials, publications, patents, events and researchers. News
articles are represented by their event. Each builder issues a fixed number of batched
queries (no per-row queries), resolves names through join tables, derives `sourceTypes`
from `claims → claim_sources → sources` plus the entity's direct sources (registry URL
for trials, article URL or DOI for publications, patent URL, `event_sources` for
events), and sets `sourceQuality` to the best `SOURCE_TYPE_QUALITY` among them. Rows are
upserted with `ON CONFLICT (entity_type, entity_id) DO UPDATE`; `reindexAll()` then
deletes documents whose entity no longer exists, and `reindexEntity()` deletes the
document when its entity is gone. Hrefs come from `hrefForEntity` in `src/lib/routes.ts`.

## Suggestions

`suggest(prefix, limit)` matches titles with `ILIKE prefix%` (wildcards escaped) or
`similarity(title, prefix) > 0.3` (pg_trgm), ordered by similarity, capped at 20.

## Tests

- Unit (`src/search/*.test.ts`): parser interpretations, tsquery injection attempts,
  scoring arithmetic, snippet sanitisation, cursor encoding, the OpenAI provider.
- Integration (`tests/integration/search/*.test.ts`, against `neurobase_test`): ranking
  order, category and facet filters, date ranges, cursor round trips, empty results,
  the OR fallback, facet counts and labels, suggestions, mode reporting, that every
  generated tsquery is accepted by `to_tsquery`, the hybrid path with a fake provider,
  and the indexer builders for every entity type. Tests only delete rows they created.
