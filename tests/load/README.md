# WanderLog Load Testing

This folder contains dependency-free load scenarios for running against a local,
staging, or production-like WanderLog deployment. The runner uses Node's native
`fetch`, so it does not add project dependencies or change the app runtime.

## Quick Start

Start the app in another terminal, then run:

```bash
npm run load:smoke
```

Override the target:

```bash
LOAD_BASE_URL=http://localhost:3000 npm run load:public
```

Authenticated read scenarios need a browser session cookie copied from DevTools:

```bash
# Set LOAD_AUTH_COOKIE in your shell to the cookie copied from DevTools first.
npm run load:explore
```

## Phase 13 E2E Social Photo Load

The `e2e-social-photo` scenario is the Phase 13 local performance baseline. It
targets 100 synthetic users, 1000 uploaded public photos, 1000 feed posts, and a
10 minute run. It exercises custom place creation, signed S3-compatible upload,
image metadata write, public visibility, feed publishing, feed reads, public
place-photo reads, and public feed-globe reads.

Dry-run the resolved profile without seeding users, touching the DB, or uploading:

```bash
npm run load:e2e:dry-run
```

Run a tiny opt-in smoke profile when the local app, local DB, and storage are
configured:

```bash
LOAD_ENABLE_STORAGE_UPLOAD=1 npm run load -- e2e-social-photo --vus 2 --users 2 --duration 30s --target-photos 2 --target-posts 2 --max-error-rate 0.01 --max-read-p95 800 --max-write-p95 1500
```

Run the full local baseline:

```bash
LOAD_ENABLE_STORAGE_UPLOAD=1 npm run load:e2e
```

The default thresholds are:

- read p95 <= 800ms
- write p95 <= 1500ms
- error rate <= 1%
- timeout rate <= 0.5%

Reports and manifests are written under `tests/load/output/` by default. That
directory is gitignored except for `.gitignore`.

## Phase 13 Prerequisites

- Local app running, usually `http://localhost:3000`.
- Local DB URL through `TURSO_DATABASE_URL` or `LOAD_DATABASE_URL`; the seeder
  refuses non-local DB URLs unless `LOAD_ALLOW_NON_LOCAL_DB=1` is set.
- Better Auth tables in the local DB. The runner seeds synthetic non-admin users
  and sessions directly, then verifies sample sessions through `/api/auth/profile`.
- S3-compatible storage configuration for the app. The Phase 13 DB is local, but
  storage may be real external storage, so full upload requires
  `LOAD_ENABLE_STORAGE_UPLOAD=1` or `--allow-storage-upload`.
- Optional CSRF header through `LOAD_CSRF_TOKEN` if the local app requires one for
  mutating API calls.

## Data Retention And Cleanup

Phase 13 data is preserved after runs by default for diagnostics. Cleanup is a
separate cleanup command and must be run by run id:

```bash
npm run load:cleanup -- --run-id load-YYYYMMDD-HHmmss-abcdef --manifest tests/load/output/load-YYYYMMDD-HHmmss-abcdef-manifest.json
```

The cleanup command prints a dry-run summary first. Add `--force` to delete
run-marked local DB rows and best-effort S3 objects listed in the manifest:

```bash
npm run load:cleanup -- --run-id load-YYYYMMDD-HHmmss-abcdef --manifest tests/load/output/load-YYYYMMDD-HHmmss-abcdef-manifest.json --force
```

## Scenarios

- `smoke` - tiny public reachability check.
- `public` - public pages and public place-photo reads.
- `explore` - authenticated Explore read endpoints, avoiding external provider fan-out where possible.
- `auth` - authenticated diary, feed, and AI route-history reads.
- `ai-stream` - authenticated AI route streaming. Requires opt-in because it can spend real provider quota.
- `providers` - provider-touching Explore reads. Requires opt-in because it can hit Mapbox, Nominatim, Open-Meteo, or Google provider paths.
- `e2e-social-photo` - Phase 13 local e2e social/photo load baseline.

## Commands

```bash
npm run load -- --list
npm run load -- smoke --dry-run
npm run load -- public --base-url http://localhost:3000 --vus 25 --duration 2m
npm run load -- explore --max-error-rate 0.01 --max-p95 750
npm run load:e2e:dry-run
```

AI, provider-heavy, and storage-writing scenarios are gated:

```bash
# Set LOAD_AUTH_COOKIE in your shell first for the authenticated commands.
LOAD_ENABLE_AI_STREAM=1 npm run load:ai
LOAD_ENABLE_PROVIDER_LOAD=1 npm run load:providers
LOAD_ENABLE_STORAGE_UPLOAD=1 npm run load:e2e
```

## Environment

| Variable                     | Purpose                                                                   |
| ---------------------------- | ------------------------------------------------------------------------- |
| `LOAD_BASE_URL`              | Target base URL, default `http://localhost:3000`.                         |
| `LOAD_VUS`                   | Virtual users. CLI `--vus` overrides it.                                  |
| `LOAD_USERS`                 | Synthetic user count for `e2e-social-photo`.                              |
| `LOAD_DURATION`              | Duration such as `30s` or `2m`. CLI `--duration` overrides it.            |
| `LOAD_TIMEOUT_MS`            | Per-request timeout in milliseconds.                                      |
| `LOAD_AUTH_COOKIE`           | Cookie header for authenticated read scenarios. Do not commit this value. |
| `LOAD_AUTH_BEARER_TOKEN`     | Optional bearer token for token-based environments.                       |
| `LOAD_CSRF_TOKEN`            | Optional CSRF header for mutating endpoints.                              |
| `LOAD_ENABLE_AI_STREAM`      | Set to `1` to permit the `ai-stream` scenario.                            |
| `LOAD_ENABLE_PROVIDER_LOAD`  | Set to `1` to permit provider-touching scenarios.                         |
| `LOAD_ENABLE_STORAGE_UPLOAD` | Set to `1` to permit the full S3-compatible upload path.                  |
| `LOAD_DATABASE_URL`          | Optional local DB URL override for load seeding and cleanup.              |
| `LOAD_ALLOW_NON_LOCAL_DB`    | Set to `1` only when intentionally seeding a non-local DB.                |
| `LOAD_OUTPUT_DIR`            | Report and manifest output directory.                                     |
| `LOAD_RUN_ID`                | Optional explicit run id.                                                 |
| `LOAD_TARGET_PHOTOS`         | Uploaded photo target for `e2e-social-photo`.                             |
| `LOAD_TARGET_POSTS`          | Published post target for `e2e-social-photo`.                             |
| `LOAD_MAX_ERROR_RATE`        | Optional threshold from `0` to `1`.                                       |
| `LOAD_MAX_TIMEOUT_RATE`      | Optional timeout threshold from `0` to `1`.                               |
| `LOAD_MAX_P95_MS`            | Optional overall p95 latency threshold in milliseconds.                   |
| `LOAD_MAX_READ_P95_MS`       | Optional read p95 latency threshold in milliseconds.                      |
| `LOAD_MAX_WRITE_P95_MS`      | Optional write p95 latency threshold in milliseconds.                     |

## Safety Notes

- Phase 13 results are a local baseline, not production capacity.
- Prefer local or staging targets seeded with test data.
- Do not run provider-heavy scenarios against shared production quotas without an explicit budget.
- The default Explore scenario avoids `/api/explore/city-suggest` because that endpoint can call Nominatim or Mapbox.
- Keep real cookies, tokens, CSRF values, S3 keys, and signed URLs out of reports, manifests, and docs.
