# NeuroBase

NeuroBase is a source-backed discovery platform and structured database for
neurotechnology: organizations, devices, clinical trials, research, regulatory actions
and the developments that connect them, each linked to the source that supports it.

**Every record is real.** They come from public APIs — ClinicalTrials.gov, OpenAlex,
openFDA, PubMed and Crossref — through the pipeline in `src/ingestion`, and each one
keeps the URL, publisher and retrieval date it came from. Organizations are recorded
only when an authoritative source names them, with the type that source states.

The build ships: a research feed, search with interpreted filters, an **Ask** tab that
answers questions using only the indexed records and cites each claim, directory and
detail pages for every entity type, a personalisation foundation (save, follow,
feedback, "For you"), and a weekly refresh that pulls in new records.

## Requirements

- Node.js 22+
- PostgreSQL 15+ with the `pg_trgm` and `unaccent` extensions (bundled with Postgres)
- Optional: the `pgvector` extension for semantic search (lexical search works without it)

## Setup

```bash
cp .env.example .env            # adjust DATABASE_URL if needed
createdb neurobase && createdb neurobase_test
npm install --legacy-peer-deps  # see "Known issues" for why
npm run db:migrate              # applies drizzle/*.sql, plus pgvector tables when available
npm run db:reference            # loads the controlled vocabulary (categories, conditions)
npm run corpus                  # pulls real records from the public APIs, then indexes them
npm run dev                     # http://localhost:3000
```

`npm run corpus` takes roughly twenty minutes on a full run and is safe to repeat —
records are matched on their natural keys, so an existing one is refreshed rather than
duplicated. `npm run corpus -- --quick` builds a tenth of the volume for a smoke test.

Integration tests use `TEST_DATABASE_URL` (default `postgres://localhost:5432/neurobase_test`);
migrate it too: `DATABASE_URL=postgres://localhost:5432/neurobase_test npm run db:migrate`.

## Commands

| Command                                                                                    | Purpose                                                             |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------- |
| `npm run dev` / `npm run build` / `npm start`                                              | Next.js development server, production build, production server     |
| `npm run lint`, `npm run typecheck`, `npm run format:check`                                | ESLint, `tsc --noEmit`, Prettier                                    |
| `npm test`                                                                                 | Vitest: unit, component (jsdom) and integration (Postgres) projects |
| `npm run test:e2e`                                                                         | Playwright at 1440, 1024 and 390 px against a production build      |
| `npm run verify`                                                                           | Everything above except end-to-end, then a production build         |
| `npm run db:generate` / `db:migrate` / `db:reference` / `db:reset`                         | Drizzle migrations, controlled vocabulary, wipe                     |
| `npm run corpus`                                                                           | Pull real records from every live connector, then reindex           |
| `npm run corpus:report`                                                                    | What the database holds, and what the last week added               |
| `npm run db:fixtures`                                                                      | Load generated test fixtures instead of real data (tests only)      |
| `npm run schedule:install` / `schedule:uninstall`                                          | Weekly local refresh via launchd                                    |
| `npm run serve:install` / `serve:uninstall`                                                | Serve on :3100 via launchd, across logins                           |
| `npm run ingest -- --list`                                                                 | Show ingestion adapters and their API / licensing status            |
| `npm run ingest -- --adapter clinicaltrials --query "brain computer interface" --limit 25` | Run a connector                                                     |

## Running it locally

```bash
npm run build
npm run start -- -p 3100     # http://localhost:3100
```

`npm run dev` is the same app with hot reload. Both need PostgreSQL running and the
database seeded (see Setup).

### Keeping it up

That server dies with the shell that started it. To keep NeuroBase serving across logins
and restarts, register it with launchd:

```bash
npm run build
npm run serve:install        # http://localhost:3100, restarts if it dies
npm run serve:uninstall      # removes it
```

The installer refuses to register a service with no build behind it, and the server waits
for PostgreSQL to accept connections before it starts — at login launchd can reach it
first, and a server that starts without its database serves errors rather than records.
Logs land in `.serve-logs/serve.log`, rotated five generations deep on each restart.

Set `NEUROBASE_PORT` to serve somewhere other than 3100. This is a LaunchAgent, so it
starts at login rather than at boot and needs no `sudo`; it listens on localhost only.

NeuroBase cannot be published on GitHub Pages: every route is server-rendered against
PostgreSQL at request time (search, filters, cursors, the feed) and the personalisation
controls are server actions, none of which a static file host can run. Deploying it
needs a Node host plus a Postgres instance — Vercel, Fly.io, Railway and a plain VPS all
work; the `DATABASE_URL` in `.env` is the only required configuration.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — layers, route map, conventions, cross-module contracts
- [docs/DESIGN.md](docs/DESIGN.md) — design tokens, typography, layout and component rules
- [docs/DATA-MODEL.md](docs/DATA-MODEL.md) — entities, relationships, provenance columns
- [docs/SEARCH.md](docs/SEARCH.md) — ranking formula, lexical fallback, enabling embeddings
- [docs/IMPACT.md](docs/IMPACT.md) — explainable impact assessment rules
- [docs/INGESTION.md](docs/INGESTION.md) — pipeline stages, adapters, what must not be scraped
- [docs/ASK.md](docs/ASK.md) — how answers are grounded, the two modes, and the prompt
- [docs/SAMPLE-DATA.md](docs/SAMPLE-DATA.md) — what the development dataset is and is not
- [docs/API.md](docs/API.md) — HTTP endpoints

## Where the records come from

| Connector               | Upstream                  | What it contributes                                                       |
| ----------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `clinicaltrials`        | ClinicalTrials.gov API v2 | Registered studies, their sponsors, conditions and devices                |
| `openalex`              | OpenAlex                  | Research papers, their abstracts, topics and **author affiliations**      |
| `openalex-institutions` | OpenAlex                  | Universities, companies, hospitals and labs, with their real type         |
| `openfda`               | openFDA                   | 510(k) clearances and premarket approvals, and the applicants behind them |
| `pubmed`                | NCBI E-utilities          | Biomedical literature records                                             |
| `crossref`              | Crossref                  | Scholarly metadata by DOI                                                 |

Every row carries provenance columns (`verification_status`, `confidence`,
`last_verified_at`, `is_sample`). Ingested rows are `machine_verified` until an editor
reviews them, and `is_sample = false`.

An organization is recorded only when an authoritative source names it — a registry
sponsor, an FDA applicant, an indexed affiliation — and is typed as what that source
says it is. Names that cannot be resolved confidently go to `review_queue` instead of
being guessed, which is why a record can show an em dash where a link would be. A sponsor
that is an individual investigator rather than an institution is queued, not recorded as
a company.

A device is recorded when an FDA clearance or a registry intervention names it, but a
clearance says only what the device is called. Its interface type, invasiveness, modality
and stages stay **null** until a record classifies them, and the interface shows an em
dash: a cochlear electrode displayed as "noninvasive" because that was a column default
would be a factual error.

Technology categories and conditions are attached from a record's own text, matched
against the vocabulary and its synonyms — a trial whose title says "deep brain
stimulation" is about deep brain stimulation. A record that merely turned up in a search
for a term is not classified by that term.

The controlled vocabulary in `src/db/reference/taxonomy.ts` is reference data, not
ingested data: the technology categories and medical indications the product facets by,
with the spellings registries actually use recorded as synonyms.

`src/sample-data` generates a fictional dataset for integration tests. It is not part of
the application's data path; every row it produces is marked `is_sample = true`.

## Asking questions

The **Ask** tab answers from the indexed records only. It retrieves with the same search
the rest of the product uses, hands the model nothing but those records, and requires a
citation on every factual sentence. With no model key configured it still answers — from
the records directly, grouped and cited, with no generated prose. Set `ANTHROPIC_API_KEY`
(or `OPENAI_API_KEY`) to get written answers instead.

## Staying current

`npm run corpus` re-runs the whole query plan; it is idempotent.

- **Locally:** `npm run schedule:install` registers a launchd job that refreshes every
  Sunday at 06:00 and logs to `.refresh-logs/`. Remove it with `npm run schedule:uninstall`.
- **On GitHub:** `.github/workflows/refresh.yml` runs the same refresh weekly. It is
  skipped unless the repository variable `REFRESH_ENABLED` is `true` and the
  `DATABASE_URL` secret points at a reachable database.

## Unfinished external integrations

- Semantic search needs an embeddings provider (`EMBEDDINGS_PROVIDER=openai` and
  `OPENAI_API_KEY`) and pgvector; until then the search page states that it runs in
  lexical mode.
- Patent, Semantic Scholar, company-website, lab-website and news connectors are
  registered as planned with their licensing or robots constraints documented in
  `docs/INGESTION.md`; ClinicalTrials.gov, PubMed, Crossref and openFDA connectors work.
- Authentication is not wired. Saved items and follows belong to an anonymous profile
  cookie; `user_profiles.external_id` is the hook for a future identity provider.
- The rate limiter is per process; use a shared store before scaling out.

## Known issues

- `npm install` on npm 10.9 can fail with "Cannot read properties of null (reading
  'edgesOut')" for this dependency set; `--legacy-peer-deps` avoids the resolver bug.
