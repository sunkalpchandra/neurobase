# NeuroBase architecture

NeuroBase is a Next.js 16 (App Router) application backed by PostgreSQL 15 through
Drizzle ORM. Everything is TypeScript with `strict` and `noUncheckedIndexedAccess` on.

## Layers

| Layer       | Directory                   | Responsibility                                                           |
| ----------- | --------------------------- | ------------------------------------------------------------------------ |
| Domain      | `src/domain`                | Controlled vocabularies, read-model types, the impact model. No I/O.     |
| Database    | `src/db`                    | Drizzle schema (`schema/`), connection client, migrations in `/drizzle`. |
| Data access | `src/data`                  | Repositories that turn rows into read models. Batched loads, no N+1.     |
| Search      | `src/search`                | Query parsing, ranking, indexing, optional embeddings.                   |
| Ingestion   | `src/ingestion`             | Source adapters and the retrieve → publish pipeline.                     |
| Sample data | `src/sample-data`           | Deterministic, clearly labelled development dataset.                     |
| Interface   | `src/components`, `src/app` | Shared components, app shell, pages, API routes.                         |
| Shared      | `src/lib`                   | Env, formatting, routes, validation helpers, rate limiting.              |

Dependencies point downward only: `app → components → data/search → db → domain`.
Components never import `src/db`; pages never write SQL.

## Route map

| Route                             | Purpose                                                                                   |
| --------------------------------- | ----------------------------------------------------------------------------------------- |
| `/`                               | Research feed: developments, updated profiles, new trials, recent research, topic filters |
| `/search`                         | Global search with categories, filters, interpreted filters, score inspection             |
| `/companies`                      | Company directory: filters, sort, cursor pagination, stacked records on mobile            |
| `/companies/[slug]`               | Company profile with anchored sections and a source ledger                                |
| `/research`, `/research/[id]`     | Publication list and detail                                                               |
| `/trials`, `/trials/[registryId]` | Clinical trial list and detail                                                            |
| `/devices`, `/devices/[slug]`     | Device list and detail                                                                    |
| `/patents/[id]`                   | Patent detail                                                                             |
| `/news`, `/news/[slug]`           | Developments (grouped events) list and detail                                             |
| `/sources/[id]`                   | Source detail: provenance and the claims it supports                                      |
| `/saved`                          | Saved items, followed entities, "For you" foundation                                      |
| `/api/*`                          | Typed JSON endpoints mirroring the pages (see `src/app/api`)                              |

Route strings come from `src/lib/routes.ts`; never hand-write an href.

## Conventions

- Server components by default. Add `"use client"` only to interactive leaves.
- Validate every request boundary with zod (`src/lib/validation`). Repositories trust
  their inputs.
- API errors always use the `ApiError` shape from `src/domain/types.ts`.
- Dates are ISO strings in read models and are rendered through `src/lib/format.ts`.
- Undisclosed or unknown values render as an en dash or the word "Undisclosed". Never
  render zero or an estimate in place of missing data.
- Rows from the development dataset have `isSample = true` and the interface shows the
  "Development sample" label near them.
- No `any`. Prefer narrow types over `unknown` casts.
- Tests: unit tests next to the module (`*.test.ts`), integration tests in
  `tests/integration` against `neurobase_test`, end-to-end tests in `tests/e2e`.

## Design rules (summary of docs/DESIGN.md)

Restrained, dense, research-software look. Light theme only. One accent colour; the
three semantic colours have fixed meaning. Borders and background shifts establish
hierarchy, not shadows. Corners 2–6 px. No gradients, glass effects, decorative
blobs, emoji icons, marketing copy, or invented metrics.

## Cross-module contracts

- `src/domain/impact/index.ts` exports `assessImpact(input: ImpactInput): ImpactAssessment`.
- `src/search/index.ts` exports `getSearchService(): SearchService`; `src/search/indexer.ts`
  exports `createSearchIndexer(db: Database, options?: { embeddings?: EmbeddingsProvider | null }): SearchIndexer`.
- `src/sample-data/index.ts` exports `generateSampleDataset(options?): SampleDataset` and
  `seedDatabase(db, dataset): Promise<SeedSummary>`.
- `src/data/*` repositories are plain async functions taking `Database` as their first
  argument (`getCompanyProfile(db, slug)`), so tests can pass the test database.
- `GET /api/suggest?q=<prefix>&limit=<n>` returns `{ suggestions: Suggestion[] }`
  (`src/search/types.ts`). The header search box consumes it with a 200 ms debounce.
- Interactive personalisation controls (`SaveButton`, `FollowButton`, `FeedbackMenu`) are
  presentational client components that receive a server action through an `action`
  prop; pages import the action from `src/app/actions/personalization.ts`.
- Anonymous profiles are identified by the httpOnly cookie `nb_profile` (UUID). The
  helper in `src/lib/profile.ts` returns the current profile id, creating the row and
  cookie on first write only.
