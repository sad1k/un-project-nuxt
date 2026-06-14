/* eslint-disable test/no-import-node-test */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

// Regression guard for the offline downloader's resilience to transient tile
// fetch failures. A city region is thousands of range requests against the
// same-origin PMTiles proxy; over a download that long a single connection
// routinely drops (`TypeError: Failed to fetch`). Before this, one such blip
// rejected the whole Promise.all batch and aborted an almost-complete region
// (observed: failed after 1938/2585 tiles). The fix retries each tile with
// backoff and keeps concurrency modest.
//
// The `node --test` harness has no TypeScript loader, so — like the other
// lib/offline suites — we assert against the source contract rather than
// importing the module.

const downloaderSource = await readFile("lib/offline/region-downloader.ts", "utf8");

test("concurrency is kept modest to spare the proxy and connection pool", () => {
  assert.match(downloaderSource, /export const CONCURRENCY = 4;/);
  // The old value hammered the browser's ~6-connection-per-host limit.
  assert.doesNotMatch(downloaderSource, /export const CONCURRENCY = 6;/);
});

test("per-tile retry budget and exponential backoff are configured", () => {
  assert.match(downloaderSource, /export const TILE_FETCH_ATTEMPTS = 3;/);
  assert.match(downloaderSource, /export const TILE_RETRY_BASE_MS = 250;/);
});

test("the fetch batch goes through the retry wrapper, not a bare fetch", () => {
  // The map callback must call fetchTileWithRetry(...) — a direct
  // fetchTileBytes(z, x, y) in the batch is exactly the fail-fast regression.
  assert.match(downloaderSource, /const data = await fetchTileWithRetry\(z, x, y, signal\);/);
  assert.doesNotMatch(downloaderSource, /const data = await fetchTileBytes\(z, x, y\);/);
});

test("retry succeeds within budget but rethrows once exhausted", () => {
  // Loop retries while attempts remain…
  assert.match(downloaderSource, /export async function fetchTileWithRetry\(/);
  assert.match(downloaderSource, /return await fetchTileBytes\(z, x, y\);/);
  // …and the failure only becomes fatal after the budget is spent.
  assert.match(downloaderSource, /if \(attempt >= attempts\)\r?\n\s+throw error;/);
  // Backoff grows exponentially: base * 2 ** (attempt - 1).
  assert.match(downloaderSource, /delay\(TILE_RETRY_BASE_MS \* 2 \*\* \(attempt - 1\), signal\)/);
});

test("cancellation short-circuits both the attempt loop and pending backoff", () => {
  // Aborting between attempts throws CancelledError immediately…
  assert.match(downloaderSource, /if \(signal\?\.aborted\)\r?\n\s+throw new CancelledError\(\);/);
  // …and a pending backoff rejects the moment the signal fires, so a long
  // sleep never delays a user-requested cancel.
  assert.match(downloaderSource, /signal\?\.addEventListener\("abort", onAbort, \{ once: true \}\)/);
  assert.match(downloaderSource, /function delay\(ms: number, signal\?: AbortSignal\)/);
});
