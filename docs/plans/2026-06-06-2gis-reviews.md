# 2GIS Review Text Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Show real 2GIS review *text* (author, ★, text, date) on the explore place card instead of only the review count.

**Architecture:** Approach A (provider-integrated). The 2GIS provider already runs a Catalog search and holds the matched `item.id` — which *is* the reviews branch id. A new `fetch2GisBranchReviews(branchId)` calls the unofficial 2GIS reviews endpoint (the same one the 2GIS website uses) and returns `PlaceReviewSnippet[]`, attached to `provider.data.reviews` only on the full panel/sheet call (`withReviews` flag). The endpoint then prefers **free provider-native reviews (2GIS or Google) → optional paid TripAdvisor fallback** (only when `TRIPADVISOR_REVIEWS_ENABLED=true` and provider reviews are empty; **default OFF**). All failures fail soft to `[]`, so the rating never breaks.

**Tech Stack:** Nuxt 3 / Nitro server route, Zod, `node:test` source-assertion tests, pnpm.

**Design doc:** `docs/plans/2026-06-06-2gis-reviews-design.md`

**Branch:** currently on `main`. Create `feat/2gis-reviews` before Task 1:
```bash
git switch -c feat/2gis-reviews
```

**Testing note:** the `tests/server/*.test.mjs` suite asserts against **source text** (it `readFile`s the source and regex-matches it). So "write the failing test" = add a regex assertion that doesn't match yet; "make it pass" = write the source that matches. Run a single file with:
`node scripts/run-node-tests.mjs tests/server/<file>.test.mjs`

**Commit rule (repo):** plain message only — NO `Co-Authored-By`, NO "Generated with Claude Code" footer.

---

### Task 1: Add the env vars (`TWOGIS_REVIEWS_API_KEY` key + `TRIPADVISOR_REVIEWS_ENABLED` toggle)

**Files:**
- Modify: `lib/env.ts:39` (after `TWOGIS_API_KEY`) + `lib/env.ts:47` (after `TRIPADVISOR_MONTHLY_LIMIT`)
- Test: `tests/server/place-intelligence-2gis.test.mjs:23-29` (extend existing env test)

**Step 1: Add the failing assertion**

In `tests/server/place-intelligence-2gis.test.mjs`, inside the test
`"2GIS provider hits the public Catalog API and is gated on its own optional key"`, add:

```js
  assert.match(envSource, /TWOGIS_REVIEWS_API_KEY: z\.string\(\)\.optional\(\)/);
  assert.match(envSource, /TRIPADVISOR_REVIEWS_ENABLED: EnvBooleanSchema/);
```

**Step 2: Run the test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/place-intelligence-2gis.test.mjs`
Expected: FAIL on the new assertion (env var not present yet).

**Step 3: Add the env vars**

In `lib/env.ts`, add the 2GIS review key immediately after the `TWOGIS_API_KEY` line:

```ts
  TWOGIS_API_KEY: z.string().optional(),
  // Public key the 2GIS web client uses for its unofficial reviews endpoint (review text only;
  // the rating still comes from the official Catalog API). Optional override of the in-code
  // public default.
  TWOGIS_REVIEWS_API_KEY: z.string().optional(),
```

…and the TripAdvisor review-fallback toggle immediately after the `TRIPADVISOR_MONTHLY_LIMIT`
line, reusing the existing `EnvBooleanSchema` (defined at the top of the file):

```ts
  TRIPADVISOR_MONTHLY_LIMIT: z.coerce.number().int().positive().default(4500),
  // TripAdvisor reviews + photos share one billing quota. Keep the (paid) review fallback OFF
  // by default so the budget stays for photos; set to true to allow it when the free providers
  // (2GIS/Google) return no review text. Unset/empty → false.
  TRIPADVISOR_REVIEWS_ENABLED: EnvBooleanSchema,
```

**Step 4: Run the test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/place-intelligence-2gis.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add lib/env.ts tests/server/place-intelligence-2gis.test.mjs
git commit -m "feat(explore): add 2GIS reviews key + TripAdvisor reviews toggle env vars"
```

---

### Task 2: Add `fetch2GisBranchReviews` (unofficial reviews endpoint, fail-soft)

**Files:**
- Modify: `lib/explore/place-intelligence-providers.ts` (constants after line 35; new exported function + logger near the other 2GIS code ~line 808)
- Test: `tests/server/place-intelligence-2gis.test.mjs` (new test)

**Step 1: Write the failing test**

Append to `tests/server/place-intelligence-2gis.test.mjs`:

```js
test("2GIS review text comes from the unofficial reviews endpoint, fail-soft", () => {
  assert.match(providerSource, /export async function fetch2GisBranchReviews/);
  assert.match(providerSource, /public-api\.reviews\.2gis\.com\/2\.0\/branches/);
  // Key: env override falling back to the in-code public default.
  assert.match(providerSource, /TWOGIS_REVIEWS_API_KEY \|\| TWOGIS_REVIEWS_PUBLIC_KEY/);
  // Normalizes text/rating/author/date and skips hidden / on-moderation / empty-text reviews.
  assert.match(providerSource, /is_hidden/);
  assert.match(providerSource, /on_moderation/);
  assert.match(providerSource, /date_created/);
  assert.match(providerSource, /label: "2ГИС"/);
  // Timeout + browser-like UA (the endpoint 403s otherwise).
  assert.match(providerSource, /TWOGIS_REVIEWS_TIMEOUT_MS/);
  assert.match(providerSource, /User-Agent/);
  // Server-only logging boundary: warn only, dedicated tag.
  assert.match(providerSource, /console\.warn\("\[2gis-reviews\]"/);
});
```

**Step 2: Run the test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/place-intelligence-2gis.test.mjs`
Expected: FAIL (function/constants not defined).

**Step 3: Add constants**

In `lib/explore/place-intelligence-providers.ts`, after the existing 2GIS block (after `TWOGIS_FIELDS`, line 35):

```ts
// 2GIS's official Catalog API exposes no review text, so review snippets come from the same
// unofficial endpoint the 2GIS website itself uses. Best-effort + fail-soft: undocumented and
// can change without notice. The branch id is the Catalog item id we already fetch.
const TWOGIS_REVIEWS_BASE_URL = "https://public-api.reviews.2gis.com/2.0/branches";
// The public key 2GIS ships in its own web client; override via env if it ever rotates.
const TWOGIS_REVIEWS_PUBLIC_KEY = "37c04fe6-a560-4549-b459-02309cf643ad";
const TWOGIS_REVIEWS_TIMEOUT_MS = 5000;
// The endpoint 403s a request with no/bot-like User-Agent, so send a browser-like one.
const TWOGIS_REVIEWS_USER_AGENT = "Mozilla/5.0 (compatible; WanderLog/1.0)";
const TWOGIS_REVIEWS_MAX = 3;
```

**Step 4: Add the function + logger**

Add near the other 2GIS functions (e.g. right after `normalize2GisRating`, ~line 842):

```ts
export async function fetch2GisBranchReviews(branchId: string): Promise<PlaceReviewSnippet[]> {
  const source: PlaceReviewSnippet["source"] = {
    kind: "provider",
    label: "2ГИС",
    confidence: "medium",
  };

  try {
    const url = new URL(`${TWOGIS_REVIEWS_BASE_URL}/${encodeURIComponent(branchId)}/reviews`);
    url.searchParams.set("limit", "20");
    url.searchParams.set("rated", "true");
    url.searchParams.set("sort_by", "date_edited");
    url.searchParams.set("fields", "meta.branch_rating,meta.branch_reviews_count,reviews.hiding_reason");
    url.searchParams.set("locale", TWOGIS_LOCALE);
    url.searchParams.set("key", env.TWOGIS_REVIEWS_API_KEY || TWOGIS_REVIEWS_PUBLIC_KEY);

    const response = await fetchWithTimeout(url, {
      headers: { "User-Agent": TWOGIS_REVIEWS_USER_AGENT },
    }, TWOGIS_REVIEWS_TIMEOUT_MS);
    if (!response.ok) {
      log2GisReviewsDebug("http_error", { branchId, status: response.status });
      return [];
    }

    const payload = await response.json();
    if (!isRecord(payload) || !Array.isArray(payload.reviews))
      return [];

    const snippets = payload.reviews
      .filter(isRecord)
      // Skip reviews 2GIS itself hides or holds for moderation.
      .filter(review => review.is_hidden !== true && review.on_moderation !== true)
      .map((review): PlaceReviewSnippet | null => {
        const text = typeof review.text === "string" ? review.text.trim() : "";
        if (!text)
          return null;

        const user = isRecord(review.user) ? review.user : {};
        const rating = parseNumeric(review.rating);
        const date = typeof review.date_created === "string" ? review.date_created.slice(0, 10) : undefined;

        return {
          authorLabel: typeof user.name === "string" && user.name.trim() ? user.name.trim() : undefined,
          text: text.length > 500 ? `${text.slice(0, 497).trimEnd()}…` : text,
          relativeTime: date,
          rating: rating !== null ? Math.min(Math.max(rating, 0), 5) : undefined,
          source,
        };
      })
      .filter((review): review is PlaceReviewSnippet => review !== null)
      .slice(0, TWOGIS_REVIEWS_MAX);

    log2GisReviewsDebug("reviews_hit", { branchId, count: snippets.length });
    return snippets;
  }
  catch (error) {
    log2GisReviewsDebug("unavailable", {
      branchId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}
```

Add the logger next to `log2GisDebug` (~line 1575):

```ts
function log2GisReviewsDebug(stage: string, details: Record<string, unknown>) {
  if (env.NODE_ENV === "production")
    return;

  console.warn("[2gis-reviews]", stage, details);
}
```

**Step 5: Run the test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/place-intelligence-2gis.test.mjs`
Expected: PASS (including the existing logging-boundary test — only `console.warn` is used).

**Step 6: Commit**

```bash
git add lib/explore/place-intelligence-providers.ts tests/server/place-intelligence-2gis.test.mjs
git commit -m "feat(explore): fetch 2GIS review text from the unofficial reviews endpoint"
```

---

### Task 3: Wire reviews into the 2GIS provider + dispatcher (`withReviews` gate)

**Files:**
- Modify: `lib/explore/place-intelligence-providers.ts` — `fetchPlaceIntelligence` (line 150), `fetch2GisPlaceIntelligence` (line 166), new `parse2GisBranchId` helper
- Test: `tests/server/place-intelligence-2gis.test.mjs` (extend dispatcher test)

**Step 1: Write the failing test**

In `tests/server/place-intelligence-2gis.test.mjs`, extend the dispatcher test (the
`"place intelligence dispatcher prefers 2GIS..."` test) with:

```js
  // Review text is only fetched for the full panel/sheet (withReviews), not the light popup.
  assert.match(providerSource, /options: \{ withReviews\?: boolean \}/);
  assert.match(providerSource, /options\.withReviews/);
  assert.match(providerSource, /fetch2GisBranchReviews\(/);
```

**Step 2: Run the test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/place-intelligence-2gis.test.mjs`
Expected: FAIL (wiring not present).

**Step 3: Thread the `withReviews` option through the dispatcher**

Replace `fetchPlaceIntelligence` (line 150) signature/body with:

```ts
export async function fetchPlaceIntelligence(input: {
  name: string;
  lat: number;
  long: number;
}, options: { withReviews?: boolean } = {}): Promise<ProviderResult> {
  // Prefer 2GIS (better RU coverage and avoids Google's paid Atmosphere tier). Fall back
  // to Google when 2GIS has no key configured, no match, or no rating for this place.
  if (env.TWOGIS_API_KEY) {
    const twoGisResult = await fetch2GisPlaceIntelligence(input, options);
    if (twoGisResult.available)
      return twoGisResult;
  }

  return fetchGooglePlaceIntelligence(input);
}
```

**Step 4: Attach reviews in the 2GIS provider**

Replace `fetch2GisPlaceIntelligence` (line 166) signature/body with (changes: new `options`
param; fetch reviews when `options.withReviews` and a branch id exists):

```ts
export async function fetch2GisPlaceIntelligence(input: {
  name: string;
  lat: number;
  long: number;
}, options: { withReviews?: boolean } = {}): Promise<ProviderResult> {
  if (!env.TWOGIS_API_KEY) {
    return {
      available: false,
      reason: "twogis_not_configured",
    };
  }

  try {
    const item = await search2GisPlace(input);
    if (!item) {
      return {
        available: false,
        reason: "twogis_no_match",
      };
    }

    const data = normalize2GisPlace(item);
    if (!data.rating) {
      return {
        available: false,
        reason: "twogis_no_rating",
      };
    }

    // Review text is a separate (unofficial, free) call; only spend it on the full
    // panel/sheet — the hover popup passes withReviews=false and stays light.
    if (options.withReviews) {
      const branchId = parse2GisBranchId(item.id);
      if (branchId)
        data.reviews = await fetch2GisBranchReviews(branchId);
    }

    return {
      available: true,
      data,
    };
  }
  catch {
    return {
      available: false,
      reason: "twogis_unavailable",
    };
  }
}
```

Add the helper next to `search2GisPlace` / `normalize2GisPlace` (~line 808):

```ts
function parse2GisBranchId(id: unknown): string {
  // The Catalog item id (e.g. "4504128908502749") is the reviews branch id; strip any
  // "_suffix" defensively.
  if (typeof id === "string" && id.trim())
    return id.split("_")[0];
  if (typeof id === "number" && Number.isFinite(id))
    return String(id);
  return "";
}
```

**Step 5: Run the test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/place-intelligence-2gis.test.mjs`
Expected: PASS.

**Step 6: Commit**

```bash
git add lib/explore/place-intelligence-providers.ts tests/server/place-intelligence-2gis.test.mjs
git commit -m "feat(explore): attach 2GIS reviews to the provider on the full-panel call"
```

---

### Task 4: Flip endpoint precedence to provider-native reviews → TripAdvisor fallback

**Files:**
- Modify: `server/api/explore/place-intelligence.get.ts:61-115`
- Test: `tests/server/place-media-resolution.test.mjs:153-165` (update the existing precedence test)

**Step 1: Update the test to the new precedence (it will fail against current code)**

In `tests/server/place-media-resolution.test.mjs`, replace the body of the test
`"TripAdvisor reviews are a quota-gated review source merged into place intelligence (full call only)"`
with (keep the title or rename to mention the new order):

```js
test("Provider-native reviews come first; TripAdvisor is the quota-gated fallback (full call only)", () => {
  assert.match(providerSource, /export async function fetchTripAdvisorPlaceReviews/);
  assert.match(providerSource, /\/reviews/);
  // Reviews hit a billable TripAdvisor endpoint → same quota gate + record as photos.
  const start = providerSource.indexOf("export async function fetchTripAdvisorPlaceReviews");
  const end = providerSource.indexOf("export async function fetchFlickrPlacePhoto", start);
  const reviewsFn = providerSource.slice(start, end);
  assert.match(reviewsFn, /isTripAdvisorQuotaExceeded/);
  assert.match(reviewsFn, /recordTripAdvisorCall/);
  // Endpoint: free provider reviews (2GIS/Google) first; pay for TripAdvisor only when empty,
  // only on the full call (includePhoto), and only when the toggle is on.
  assert.match(endpointSource, /fetchPlaceIntelligence\([\s\S]*?withReviews: includePhoto/);
  assert.match(endpointSource, /providerResult\.data\?\.reviews \?\? \[\]/);
  assert.match(endpointSource, /includePhoto && reviews\.length === 0 && env\.TRIPADVISOR_REVIEWS_ENABLED/);
  assert.match(endpointSource, /fetchTripAdvisorPlaceReviews/);
});
```

**Step 2: Run the test to verify it fails**

Run: `node scripts/run-node-tests.mjs tests/server/place-media-resolution.test.mjs`
Expected: FAIL (endpoint still uses the old `reviews: tripAdvisorReviews.length` line).

**Step 3: Rewrite the endpoint orchestration**

In `server/api/explore/place-intelligence.get.ts`, replace the `Promise.all` (lines 61-88) so
it drops the parallel TripAdvisor call and passes `withReviews`:

```ts
  const [providerResult, community, resolvedPhoto] = await Promise.all([
    fetchPlaceIntelligence({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    }, { withReviews: includePhoto }),
    findCommunityPlaceSignal({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    }),
    includePhoto
      ? resolveRealPlacePhoto({
          name: basePlace.name,
          lat: basePlace.coordinates.lat,
          long: basePlace.coordinates.long,
        })
      : Promise.resolve(deferredPhoto),
  ]);

  // Free provider-native reviews (2GIS or Google) first; pay for the billable TripAdvisor
  // endpoint only when explicitly enabled AND the provider returned none — and only on the
  // full panel/sheet call.
  let reviews = providerResult.data?.reviews ?? [];
  if (includePhoto && reviews.length === 0 && env.TRIPADVISOR_REVIEWS_ENABLED) {
    reviews = await fetchTripAdvisorPlaceReviews({
      name: basePlace.name,
      lat: basePlace.coordinates.lat,
      long: basePlace.coordinates.long,
    });
  }
```

Then replace the `provider:` block (lines 109-115) so it uses the resolved `reviews`:

```ts
    provider: {
      ...(providerResult.data ?? {}),
      photo: resolvedPhoto.status === "photo" ? toPlacePhoto(resolvedPhoto.photo, basePlace.name) : null,
      reviews,
    },
```

`fetchTripAdvisorPlaceReviews` is already imported (line 8). Add the env import near the top of
the file (it is **not** imported there yet):

```ts
import env from "~/lib/env";
```

**Step 4: Run the test to verify it passes**

Run: `node scripts/run-node-tests.mjs tests/server/place-media-resolution.test.mjs`
Expected: PASS.

**Step 5: Commit**

```bash
git add server/api/explore/place-intelligence.get.ts tests/server/place-media-resolution.test.mjs
git commit -m "feat(explore): prefer free provider reviews, use TripAdvisor only as fallback"
```

---

### Task 5: Full verification + optional live probe

**Step 1: Run the project's explore gate (lint + all server tests)**

Run: `pnpm verify:explore-foundation`
Expected: lint clean, all `tests/server` pass. (This is the mandatory pre-merge gate.)

**Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: no new type errors in the touched files.

**Step 3 (optional but recommended): Live smoke test against the real API**

With `TWOGIS_API_KEY` set in `.env`, start the dev server (`pnpm dev`), open `/explore`,
generate a route, open a generated stop's card, and confirm the **"Отзывы"** tab now shows
real 2GIS review text (author · date · «2ГИС») matching the count. Verify the hover popup
still opens instantly with no review text (light path unchanged).

If preferred, re-run the design-doc probe script logic ad hoc to confirm the endpoint still
returns 200 + review text for a known branch id.

**Step 4: Finish the branch**

REQUIRED SUB-SKILL: Use superpowers:finishing-a-development-branch to decide merge / PR / cleanup.

---

## Notes / gotchas

- **Logging boundary:** only `console.warn` is allowed in `place-intelligence-providers.ts`
  (the logging test forbids `console.log/debug/info/error`). The new logger uses `console.warn`.
- **`normalize2GisPlace` stays rating-only** — its existing test ("maps the reviews block to a
  rating signal only") must remain green. Reviews are attached by the caller, not the normalizer.
- **TripAdvisor review fallback is OFF by default** (`TRIPADVISOR_REVIEWS_ENABLED`). TripAdvisor
  reviews + photos share one billing quota; keeping reviews off leaves the budget for photos.
  Flip the env to `true` to enable the fallback. Photos are a separate chain — unaffected.
- **Google is currently down** in this environment, so with the toggle off, review text =
  2GIS-only today. Google needs no code change to participate — once its key/billing works it
  auto-fills `providerResult.data.reviews` and ranks above the optional TripAdvisor fallback.
- **`.env` (optional):** no need to set `TWOGIS_REVIEWS_API_KEY` (in-code public default) or
  `TRIPADVISOR_REVIEWS_ENABLED` (defaults to `false`). Set the toggle to `true` only when you
  want the paid TripAdvisor review fallback.
- **CI:** both new vars are optional (`z.string().optional()` / `EnvBooleanSchema` default
  `false`), so unset/empty CI secrets pass `nuxt prepare`/env validation; mapping them in
  `lint.yaml` is optional.
