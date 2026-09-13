# NeuroBase

NeuroBase is a source-backed discovery platform and structured database for
neurotechnology: companies, devices, clinical trials, research, patents, funding,
regulatory actions and news, connected to the sources that support each claim.

The current build ships one credible end-to-end workflow: research feed → search →
company result → company profile → supporting source, plus directory and detail pages
for the other entity types, a personalisation foundation (save, follow, feedback,
"For you"), an ingestion pipeline with connectors for official public APIs, and a
clearly labelled development dataset.

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
npm run db:seed                 # loads the development sample and builds the search index
npm run dev                     # http://localhost:3000
```

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
| `npm run db:generate` / `db:migrate` / `db:seed` / `db:reset`                              | Drizzle migrations, sample data, wipe                               |
| `npm run ingest -- --list`                                                                 | Show ingestion adapters and their API / licensing status            |
| `npm run ingest -- --adapter clinicaltrials --query "brain computer interface" --limit 25` | Run a connector                                                     |

## Running it locally

```bash
npm run build
npm run start -- -p 3100     # http://localhost:3100
```

`npm run dev` is the same app with hot reload. Both need PostgreSQL running and the
database seeded (see Setup).

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
- [docs/SAMPLE-DATA.md](docs/SAMPLE-DATA.md) — what the development dataset is and is not
- [docs/API.md](docs/API.md) — HTTP endpoints

## Data assumptions

Every row carries provenance columns (`verification_status`, `confidence`,
`last_verified_at`, `is_sample`). Rows from the development dataset are fictional,
deterministic, and labelled "Development sample" in the interface; their URLs live on the
reserved `sample.neurobase.invalid` domain and their DOIs use the Crossref test prefix.
Nothing in the sample describes a real company, person, product or study. Real data
enters through the ingestion pipeline and is marked `machine_verified` until an editor
reviews it.

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
- An unknown company URL (`/companies/<unknown-slug>`) renders the correct "Page not
  found" page but answers `200` instead of `404`. Next.js streams that route's shell
  before `notFound()` resolves, which pins the status. The behaviour is specific to that
  route path: an identical page placed at `/companies/zzz/[slug]` or at the top level
  answers `404`, and the other seven detail routes answer `404` correctly. It is not
  fixable from application code, because a page cannot set a response status in the App
  Router. Everything a visitor sees — the page, its title, its links — is correct.
