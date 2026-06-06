# Show real 2GIS review text (not just the count) — Design

Date: 2026-06-06
Status: Approved (brainstorming). Not yet committed. Implementation plan: TBD (writing-plans).

## Context

On `/explore`, a generated route point opens a place card (desktop side panel + mobile
bottom sheet, both via `components/explore/place-detail.vue`) with a **"Отзывы"** tab.

Today that tab is frequently **empty while a review count is shown**:

- The 2GIS rating is fetched in `lib/explore/place-intelligence-providers.ts`
  (`fetch2GisPlaceIntelligence` → `search2GisPlace` → `normalize2GisPlace`). It requests only
  `fields=items.reviews` from the **Catalog API**, which returns aggregates
  (`general_rating`, `review_count`) — so the card can show `4.6 (202)` — but **no review
  text**. `normalize2GisPlace` therefore returns `{ rating }` only.
- The review **text** array (`intelligence.reviews`) is populated by the endpoint
  `server/api/explore/place-intelligence.get.ts` **only from TripAdvisor**
  (`fetchTripAdvisorPlaceReviews`), with a fallback to `providerResult.data?.reviews`:
  `reviews: tripAdvisorReviews.length ? tripAdvisorReviews : providerResult.data?.reviews`.
- TripAdvisor is **billable and quota-capped**, and for many RU venues returns nothing.

Result: 2GIS supplies the rating + count, TripAdvisor supplies no text → the tab shows
`Отзывов из источников пока нет` next to a count of 202. That mismatch is the bug.

## Key finding (verified)

- The **official** 2GIS API (Catalog/Places) **does not return review text** — only the
  aggregate rating and count. Confirmed by 2GIS docs and the existing code comment.
- 2GIS review **text** is only reachable via the **unofficial reviews endpoint** that the
  2GIS website itself uses. Verified live, end-to-end, against a real Moscow venue:
  - Catalog search already returns `item.id` (e.g. `4504128908502749`) — this **is** the
    reviews branch id. No extra lookup is needed to discover it.
  - `GET https://public-api.reviews.2gis.com/2.0/branches/{branchId}/reviews`
    `?key={publicKey}&locale=ru_RU&limit=…&rated=true&sort_by=date_edited`
    returns **HTTP 200** with full `text`, `rating`, `user.name`,
    `date_created`/`date_edited`, `photos`, `official_answer`, `is_verified`, `is_hidden`,
    `on_moderation`, plus `meta.branch_reviews_count`/`meta.branch_rating`.
  - Working public key (the site's own): `37c04fe6-a560-4549-b459-02309cf643ad`.
  - A `User-Agent` header is sent (the endpoint may 403 without one).

## Decisions (locked via brainstorming)

1. **Source:** the unofficial 2GIS reviews endpoint (the only way to get real 2GIS text).
   Accepted trade-offs: undocumented, may break without notice, formally against 2GIS ToS,
   borrowed public key → everything must fail soft.
2. **Precedence:** **2GIS first; Google when available; TripAdvisor reviews behind an env
   toggle, default OFF.** Model — free provider-native reviews (2GIS *or* Google) → optional
   paid TripAdvisor fallback (only when `TRIPADVISOR_REVIEWS_ENABLED=true` **and** provider
   reviews are empty). TripAdvisor reviews + photos share one billing quota, so keeping the
   review fallback off by default leaves the whole budget for photos. **Google is currently
   down** in this environment, so with the toggle off today's behavior = **2GIS-only** review
   text; Google slots in automatically (no code change) once its key/billing is fixed, and
   ranks above the optional TripAdvisor fallback.
3. **Architecture — Approach A (provider-integrated).** The 2GIS provider already does the
   Catalog search and holds `item.id`; it fetches reviews with that same id and returns them
   in `provider.data.reviews`. Guarantees rating, count, and review text come from the **same
   branch** (no cross-source mismatch), and costs **one** Catalog search.
4. **Card richness:** minimal — author, ★rating, text (≤500, truncated), date `YYYY-MM-DD`,
   source label "2ГИС". Same layout as today's TripAdvisor cards. (Official answer / review
   photos deferred to v2.)
5. **Surface scope:** full panel + bottom sheet only. The hover popup (`place-popup.ts`)
   stays "light" — no reviews fetched on `withPhoto=0` — preserving its zero-extra-request
   behavior. It keeps showing `4.6 / 5, 202 отзыва` as a teaser.
6. **Key handling:** optional env `TWOGIS_REVIEWS_API_KEY`, defaulting in code to the public
   site key constant. 2GIS reviews run only when `TWOGIS_API_KEY` is set (the branch id comes
   from the Catalog search, which needs that key).
7. **Sort:** newest first (`rated=true&sort_by=date_edited`); show up to 3 after filtering.

## Scope

**In scope:** new `fetch2GisBranchReviews(branchId)` provider function; wire it into the
2GIS provider gated by a `withReviews` flag; flip endpoint precedence to provider-native →
TripAdvisor; env var + key constant; fail-soft + timeout + UA; test updates.

**Out of scope (YAGNI, may add later):** server-side review caching (client already caches
the full intelligence payload in `useState` per session), pagination / "show more",
official-answer and review-photo rendering, sort modes other than newest, showing reviews in
the hover popup.

## Architecture & data flow (Approach A)

All provider work stays in `lib/explore/place-intelligence-providers.ts`.

### New constants
- `TWOGIS_REVIEWS_BASE_URL = "https://public-api.reviews.2gis.com/2.0/branches"`
- `TWOGIS_REVIEWS_PUBLIC_KEY = "37c04fe6-a560-4549-b459-02309cf643ad"` (overridable via env)
- `TWOGIS_REVIEWS_TIMEOUT_MS = 5000`

### New function
```
export async function fetch2GisBranchReviews(branchId: string): Promise<PlaceReviewSnippet[]>
```
- `GET {TWOGIS_REVIEWS_BASE_URL}/{branchId}/reviews` with
  `key`, `locale=ru_RU`, `limit=20`, `rated=true`, `sort_by=date_edited`,
  `fields=meta.branch_rating,meta.branch_reviews_count,reviews.hiding_reason`.
- Header `User-Agent` set (reuse the existing `WanderLog/1.0` UA string).
- Wrapped in `fetchWithTimeout(..., TWOGIS_REVIEWS_TIMEOUT_MS)`; any non-OK / throw → `[]`.
- Filter out reviews that are `is_hidden`, `on_moderation`, or have empty `text`.
- Map → `PlaceReviewSnippet`, take first 3 (see Normalization).

### 2GIS provider wiring
`fetch2GisPlaceIntelligence(input, opts?: { withReviews?: boolean })`:
- After `search2GisPlace` yields the matched `item` and `normalize2GisPlace` yields the
  rating, if `opts.withReviews` **and** `item.id` exists → `data.reviews =
  await fetch2GisBranchReviews(String(item.id).split("_")[0])`.
- `normalize2GisPlace` stays **rating-only** (existing test stays green); reviews are a
  separate concern attached by the caller.
- `search2GisPlace` must surface `item.id` (it already fetches the item; just keep the id).

### Dispatcher
`fetchPlaceIntelligence(input, opts?: { withReviews?: boolean })` threads `opts` to
`fetch2GisPlaceIntelligence`. (Google branch ignores `withReviews` — its reviews already
arrive free in the Text Search response via `normalizeReviews`.)

### Endpoint orchestration (`server/api/explore/place-intelligence.get.ts`)
Replace the parallel TripAdvisor fetch + `tripAdvisorReviews.length ? …` line with a
**provider-first, then conditional TripAdvisor** flow:

```
const [providerResult, community, resolvedPhoto] = await Promise.all([
  fetchPlaceIntelligence(input, { withReviews: includePhoto }),
  findCommunityPlaceSignal(input),
  includePhoto ? resolveRealPlacePhoto(input) : Promise.resolve(deferredPhoto),
]);

// Free provider-native reviews (2GIS or Google) first; pay for the billable TripAdvisor
// endpoint only when explicitly enabled AND the provider returned none.
let reviews = providerResult.data?.reviews ?? [];
if (includePhoto && reviews.length === 0 && env.TRIPADVISOR_REVIEWS_ENABLED)
  reviews = await fetchTripAdvisorPlaceReviews(input);
```

Then `provider: { ...providerResult.data, photo, reviews }` as today. Net effect:
- Common RU case (2GIS has reviews): TripAdvisor is **never called** → cheaper + faster.
- 2GIS/Google empty: TripAdvisor fallback runs (quota-gated, full-call-only) exactly as now.
- Hover popup (`includePhoto=false`): no 2GIS reviews, no TripAdvisor → unchanged, light.

## Normalization (review object → `PlaceReviewSnippet`)

`PlaceReviewSnippet` (`lib/explore/place-intelligence.ts`): `authorLabel?` (≤80), `text`
(1–500), `relativeTime?` (≤80), `rating?` (0–5), `source`.

| Snippet field | 2GIS source | Notes |
|---|---|---|
| `text` | `review.text` | trim; skip empty; `buildPlaceIntelligence` already truncates to 500 |
| `authorLabel` | `review.user.name` | optional; omit if missing |
| `rating` | `review.rating` | clamp 0–5 |
| `relativeTime` | `review.date_created` (or `date_edited`) | `.slice(0, 10)` → `YYYY-MM-DD`, like TripAdvisor |
| `source` | constant | `{ kind: "provider", label: "2ГИС", confidence: "medium" }` |

The 2GIS feed merges providers (`2gis`, `flamp`, `otello`, `booking`, …). v1 keeps whatever
the feed returns under the single "2ГИС" label (that is where the user sees them). Filtering
to `2gis`/`flamp` only is a possible future refinement.

## Config

`lib/env.ts`:
- `TWOGIS_REVIEWS_API_KEY: z.string().optional()` — review-endpoint key override; the
  provider uses `env.TWOGIS_REVIEWS_API_KEY || TWOGIS_REVIEWS_PUBLIC_KEY`.
- `TRIPADVISOR_REVIEWS_ENABLED: EnvBooleanSchema` — gates the paid TripAdvisor review
  fallback. Default OFF (unset/empty → `false` via the existing `EnvBooleanSchema`).

Both are optional and pass CI env validation when unset/empty. Document them in `.env`
alongside `TWOGIS_API_KEY` / `TRIPADVISOR_API_KEY`.

## Reliability, logging, security

- **Fail-soft:** all 2GIS-review failures resolve to `[]`; rating is a separate request and
  never breaks. Empty → endpoint falls back to TripAdvisor → "Отзывов пока нет".
- **Timeout + UA:** `fetchWithTimeout` (~5s) + `User-Agent` header.
- **Logging boundary:** dev-only `console.warn("[2gis-reviews]", …)` (mirrors `log2GisDebug`,
  gated on `NODE_ENV !== "production"`). The provider file's logging test forbids
  `console.log/debug/info/error` — only `console.warn` is allowed.
- **Key:** public (the site serves it); endpoint is unofficial → treated as best-effort.

## UI

No new UI. `place-detail.vue` already renders the "Отзывы" tab from `intelligence.reviews`
(author, ★, text, source label · date · confidence) and the tab count badge. Once data
flows, the tab fills and the badge shows e.g. `Отзывы 3`.

## Tests

- **Update** `tests/server/place-media-resolution.test.mjs` (the
  "TripAdvisor reviews … merged into place intelligence" test): the assertion
  `assert.match(endpointSource, /reviews: tripAdvisorReviews\.length/)` pins the old
  precedence and must change to the new provider-first → TripAdvisor expression. The rest
  (TripAdvisor still quota-gated, full-call-only) stays.
- **Extend** `tests/server/place-intelligence-2gis.test.mjs`: assert `fetch2GisBranchReviews`
  exists, hits `public-api.reviews.2gis.com/2.0/branches`, normalizes `text`/`rating`/author,
  filters hidden/moderation/empty, fails soft to `[]`, and keeps the `console.warn`-only
  logging boundary. The existing "normalize2GisPlace = rating only" test stays green.
- **Lint/typecheck/test** must pass before any commit (project rule).

## Verified probe (evidence)

Live end-to-end run (Catalog search → `item.id` → reviews endpoint) on
«Гранд кофемания, ресторан», branch `4504128908502749`:
- Catalog `items.reviews`: `general_rating 4.6`, `general_review_count 202`.
- Reviews endpoint: HTTP 200, 3 reviews, e.g. ★5 / «Ульяна Кузнецова» / 2026-05-22 /
  «Для центра Москвы здесь очень хорошие цены…».
- Per-review keys present: `text, rating, date_created, date_edited, user, photos,
  official_answer, is_verified, is_hidden, on_moderation, likes_count, provider`.
