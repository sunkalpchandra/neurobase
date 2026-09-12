# HTTP API

All endpoints return JSON. Errors use one envelope:

```json
{ "error": { "code": "bad_request | not_found | rate_limited | internal", "message": "…", "details": … } }
```

Rate-limited endpoints answer `429` with a `Retry-After` header. Limits are per client
address and per process (see `src/lib/rate-limit.ts`).

| Method | Path | Query / body | Returns |
| --- | --- | --- | --- |
| GET | `/api/search` | `q`, `category`, filters (`technologyCategories`, `conditions`, `invasiveness`, `modality`, `developmentStage`, `evidenceStage`, `trialStatus`, `organizationKind`, `country`, `publishedFrom`, `publishedTo`, `sourceTypes` — comma lists), `cursor`, `pageSize` ≤ 50 | `SearchResponse` (results with score breakdown, parsed query, mode, facets) |
| GET | `/api/suggest` | `q` (1–80 chars), `limit` ≤ 10 | `{ suggestions: Suggestion[] }` |
| GET | `/api/feed` | `topic` (category slug), `eventTypes`, `cursor`, `pageSize` ≤ 50 | `Paginated<FeedItem>` |
| GET | `/api/companies` | `q`, filters, `sort` (`name`, `funding`, `lastVerified`, `founded`, `updated`), `direction`, `cursor`, `pageSize` ≤ 100 | `CompanyDirectoryResult` |
| GET | `/api/companies/{slug}` | — | `CompanyProfile` |
| GET | `/api/companies/{slug}/related` | — | `RelatedEntities` |
| GET | `/api/sources/{id}` | — | `SourceDetail` |
| GET | `/api/saved` | cookie `nb_profile` | `{ items: SavedItem[] }` |
| POST | `/api/saved` | `{ entityType, entityId, note? }` | `{ saved: true }` |
| DELETE | `/api/saved` | `{ entityType, entityId }` | `{ saved: false }` |
| GET | `/api/follows` | cookie | `{ items: FollowedEntity[] }` |
| POST | `/api/follows` | `{ targetType, targetId }` | `{ followed: true }` |
| DELETE | `/api/follows` | `{ targetType, targetId }` | `{ followed: false }` |
| POST | `/api/feedback` | `{ entityType, entityId, signal }` | `{ recorded: true }` |

Cursors are opaque strings returned in `pageInfo.nextCursor`; pass them back unchanged.
Types are defined in `src/domain/types.ts`, `src/search/types.ts` and `src/data/types.ts`.
Validation schemas live in `src/lib/validation.ts`.
