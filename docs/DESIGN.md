# NeuroBase design system

The interface should read as research software: dense, aligned, quiet. The references
are Linear (spacing, typography, restraint), Crunchbase and PitchBook (structured
entity data), PubMed and ClinicalTrials.gov (metadata presentation), Stripe docs
(hierarchy), Perplexity (visible sources). Use their principles, not their branding.

## Tokens

Defined in `src/app/globals.css` under `@theme` and exposed as Tailwind utilities.

| Token                                                      | Value                       | Use                                                                          |
| ---------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------- |
| `canvas`                                                   | #f7f8fa                     | Page background                                                              |
| `surface`                                                  | #ffffff                     | Panels, tables, cards                                                        |
| `surface-muted`                                            | #f1f3f6                     | Table headers, code, subdued areas                                           |
| `surface-hover`                                            | #f4f6f9                     | Row hover                                                                    |
| `ink`                                                      | #14171d                     | Primary text                                                                 |
| `ink-secondary`                                            | #4a5261                     | Secondary text, descriptions                                                 |
| `ink-muted`                                                | #646c7a                     | Metadata, timestamps, placeholders (4.76:1 on the lightest surface, WCAG AA) |
| `line` / `line-strong` / `line-soft`                       | #d9dee6 / #b9c1cd / #e8ebf0 | Borders                                                                      |
| `accent` / `accent-strong` / `accent-soft` / `accent-line` | #274690 …                   | Links, primary buttons, selected states                                      |
| `success` (+ `-soft`, `-line`)                             | #2f7a4d                     | Verified, authorized, recruiting, granted                                    |
| `warning` (+ `-soft`, `-line`)                             | #8f6408                     | Estimated, pending, unverified, suspended                                    |
| `critical` (+ `-soft`, `-line`)                            | #b12a22                     | Retracted, disputed, terminated, withdrawn                                   |
| `match`                                                    | #fff3bf                     | Search-match highlight background                                            |

Radii: `xs` 2px, `sm` 3px, `md` 4px, `lg` 6px. Nothing larger except fully round
avatars. Shadows: `shadow-panel` (1px) for sticky headers, `shadow-overlay` for
drawers and menus only.

Colour communicates meaning. Entity types are distinguished by a text label, never by
colour alone. Do not introduce additional hues.

## Typography

Geist Sans for the interface, Geist Mono for identifiers (NCT ids, patent numbers, DOIs).

| Role              | Class                                             | Notes                           |
| ----------------- | ------------------------------------------------- | ------------------------------- |
| Page title        | `text-xl font-semibold tracking-tight`            | One per page, describes content |
| Section title     | `text-base font-semibold`                         | Sentence case                   |
| Body              | `text-sm` (14px)                                  | Default                         |
| Metadata          | `text-xs text-ink-muted`                          | 12px, compact rows              |
| Micro label       | `text-2xs uppercase tracking-wide text-ink-muted` | Column headers, type labels     |
| Numbers in tables | add `tabular`                                     | Right-aligned                   |

Line length on reading surfaces (summaries, abstracts): `max-w-prose` (65ch).

## Layout

- App shell: sticky top bar (48px) with wordmark, primary navigation, global search,
  and Saved. Content in `max-w-[1440px] mx-auto px-4 md:px-6`.
- Search and directory pages: optional left filter column (`w-64`) visible from
  `lg:`; below that, filters open in a drawer.
- Right rail only when it adds context (profile pages: quick facts, sources count).
- Vertical rhythm: 4px base; sections separated by `border-t border-line` and
  `py-6`, not by large margins.
- Tables: `text-sm`, 8px×12px cell padding, header row on `surface-muted` with micro
  labels, row borders `line-soft`, hover `surface-hover`. Below `md:` tables render as
  stacked records (definition-list style), never squeezed.

## Components (src/components)

`ui/`: `Badge` (variants: neutral, accent, success, warning, critical; always text),
`Button` (primary, secondary, ghost; sizes sm/md), `Input`, `Select`, `Checkbox`,
`Tabs`/`AnchorNav`, `DataTable` (responsive), `MetadataList` (`<dl>` grid),
`EmptyState`, `ErrorState`, `Skeleton`, `Drawer` (accessible dialog with focus trap,
Escape, aria-modal, returns focus), `Pagination` / `LoadMore`, `Timeline`,
`Disclosure`, `VisuallyHidden`, `LiveRegion`.

`entities/`: `EntityChip` (type label + name link), `EvidenceStageLabel` (shows
"Stage 5 · Early human feasibility"), `SourceTypeLabel`, `VerificationLabel`,
`SampleDataNotice`, `SourceCard`, `SourceLedger`, `ImpactExplanation`,
`SaveButton`, `FollowButton`, `FeedbackMenu` (More like this / Less like this / Hide).

`shell/`: `AppHeader`, `PrimaryNav`, `MobileNav`, `GlobalSearch`, `PageHeader`,
`FilterPanel`, `FilterDrawer`.

## Rules

- Headings describe content ("Clinical trials", "Funding history"), never promote.
- No emoji, no icon-only controls without an accessible name, no gradients, no glass.
- Every interactive element is reachable by keyboard and shows the focus ring.
- Loading: skeletons that match the final layout. Spinners only inside buttons.
- Empty states say what is empty and what would fill it.
- Error states name the failure and offer a retry.
- Never invent numbers. If a value is unknown, show "—" or "Undisclosed".
