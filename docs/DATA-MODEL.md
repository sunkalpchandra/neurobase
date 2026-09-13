# Data model

Schema source of truth: `src/db/schema/*.ts` (Drizzle). Migrations: `drizzle/*.sql`.
Every id is a UUID. Dates are `date` columns (calendar days) unless the value is an
instant, in which case they are `timestamptz`.

## Provenance columns (on every major entity)

| Column                     | Meaning                                                                      |
| -------------------------- | ---------------------------------------------------------------------------- |
| `verification_status`      | `unverified`, `machine_verified`, `editor_verified`, `disputed`, `retracted` |
| `confidence`               | `low`, `moderate`, `high` — how sure we are about the record as a whole      |
| `last_verified_at`         | When a person or process last checked the record against its sources         |
| `is_sample`                | True for the fictional development dataset                                   |
| `created_at`, `updated_at` | Row lifecycle; `updated_at` is the "NeuroBase update" date shown in feeds    |

Evidence stage (`evidence_stage`), source reliability (`sources.source_type`) and impact
(`events.impact`) are stored separately and never merged into one score.

## Entities

| Table                                 | Notes                                                                                                                                                                                                                                                 |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `organizations`                       | Companies, universities, hospitals, research labs, agencies, investors, nonprofits (`kind`). Company-only columns are nullable for other kinds. `total_disclosed_funding_usd` is derived from disclosed rounds and is null when nothing is disclosed. |
| `people`                              | Researchers, founders, executives. `organization_people` records roles.                                                                                                                                                                               |
| `devices`                             | Interface type, invasiveness, modality, development stage, evidence stage, known limitations. `device_metrics` holds reported performance figures with their source.                                                                                  |
| `clinical_trials`                     | Registry id and URL, status, phase, enrollment (+ type), design, dates (+ estimated/actual), sponsor.                                                                                                                                                 |
| `publications`                        | DOI/PMID, journal, type (peer-reviewed, preprint, …), study type, evidence stage. Authors, devices and affiliations through join tables.                                                                                                              |
| `patents`                             | Jurisdiction + number, filing/publication/grant dates, status, assignee, inventors, related devices.                                                                                                                                                  |
| `funding_rounds`                      | Round type, date, `amount_usd` (null = undisclosed, never estimated), investors with lead flag.                                                                                                                                                       |
| `regulatory_actions`                  | Agency, action type, decision date, reference number, linked organization/device/source.                                                                                                                                                              |
| `events`                              | Developments shown in the feed and timelines. `dedupe_key` merges duplicate reports; `impact` is a structured, explainable assessment; `source_count` is derived.                                                                                     |
| `news_articles`                       | Each article is also a `sources` row; articles about the same development share an `event_id`.                                                                                                                                                        |
| `technology_categories`, `conditions` | Taxonomies used as facets.                                                                                                                                                                                                                            |

## Provenance graph

| Table            | Relationship                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `sources`        | One row per retrievable document (unique URL): type, publisher, published and retrieved dates, verification, confidence. |
| `claims`         | A factual statement about an entity (`entity_type`, `entity_id`, `claim_kind`, `statement`).                             |
| `claim_sources`  | Claim ↔ source, with an optional excerpt.                                                                                |
| `event_sources`  | Event ↔ source.                                                                                                          |
| `event_entities` | Event ↔ any entity, with a role (subject, sponsor, investor, …).                                                         |

A source ledger for an entity is the union of the sources behind its claims and the
sources behind the events it appears in.

## Relationships

- Company develops Device (`devices.developer_organization_id`)
- Device targets Condition (`device_conditions`)
- Device appears in ClinicalTrial (`trial_devices`)
- ClinicalTrial is sponsored by Organization (`clinical_trials.sponsor_organization_id`)
- Researcher works at Organization (`people.primary_organization_id`, `organization_people`)
- Researcher authors Publication (`publication_authors`)
- Publication evaluates Device (`publication_devices`)
- Company owns Patent (`patents.assignee_organization_id`)
- Investor funds Company (`funding_round_investors`)
- Organization relates to Organization (`organization_relationships`: competitor, partner, parent, subsidiary, spinout_of, university_affiliation)
- Event references Sources (`event_sources`) and Entities (`event_entities`)
- Claim is supported by Source (`claim_sources`)

## Personalisation

`user_profiles` (anonymous today, `external_id` for a future identity provider),
`saved_items`, `follows` (topics, companies, researchers, labs, devices, conditions,
trials via `follow_target_type`), `feedback_signals` (more like this, less like this, hide).

## Search and ingestion

`search_documents` is a denormalised index with one row per searchable entity: text
fields, a stored generated `tsv` column, facet columns, display metadata and linked
entities. `search_embeddings` (optional, pgvector) stores one vector per document.
`ingestion_runs`, `review_queue` and `entity_aliases` support the pipeline in
`src/ingestion`.
