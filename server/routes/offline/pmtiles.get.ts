import { Buffer } from "node:buffer";

import env from "~/lib/env";

// Same-origin proxy for the Protomaps PMTiles archive. Browsers can't fetch the
// public daily build directly — build.protomaps.com sends no CORS headers — so
// the offline downloader points the `pmtiles` client at this route and we
// forward byte-range requests to the real upstream from the server, where CORS
// does not apply.
//
// Upstream resolution: a private `PMTILES_URL` (self-hosted or authenticated
// archive) wins; otherwise we resolve the most recent reachable Protomaps daily
// build. Those rotate — a new file each day, only ~a week retained — so we probe
// today back a few days and memoise the first that responds. The cache keeps the
// upstream (and therefore its ETag) stable across a session, which the pmtiles
// reader relies on.
//
// Deliberately NOT under /api/ so the service worker's `/api/` NetworkFirst rule
// never tries to cache these 206 range responses (the Cache API rejects 206).

const PMTILES_BUILD_HOST = "https://build.protomaps.com";
const BUILD_LOOKBACK_DAYS = 8;
// Only the headers the pmtiles reader needs to interpret a range response.
const PASSTHROUGH_HEADERS = ["content-range", "accept-ranges", "etag", "content-type", "last-modified"];

let cachedUpstream: string | null = null;

function pad2(value: number): string {
  return value < 10 ? `0${value}` : `${value}`;
}

// Candidate daily-build URLs, newest first: today (UTC) back BUILD_LOOKBACK_DAYS.
function recentBuildUrls(now: Date): string[] {
  const urls: string[] = [];
  for (let offset = 0; offset < BUILD_LOOKBACK_DAYS; offset += 1) {
    const day = new Date(now.getTime());
    day.setUTCDate(day.getUTCDate() - offset);
    const stamp = `${day.getUTCFullYear()}${pad2(day.getUTCMonth() + 1)}${pad2(day.getUTCDate())}`;
    urls.push(`${PMTILES_BUILD_HOST}/${stamp}.pmtiles`);
  }
  return urls;
}

async function resolveUpstream(): Promise<string> {
  if (env.PMTILES_URL)
    return env.PMTILES_URL;
  if (cachedUpstream)
    return cachedUpstream;

  for (const url of recentBuildUrls(new Date())) {
    try {
      const probe = await fetch(url, { headers: { Range: "bytes=0-0" } });
      if (probe.ok) {
        cachedUpstream = url;
        return url;
      }
    }
    catch {
      // Unreachable candidate — fall through to the next older build.
    }
  }
  throw createError({ statusCode: 502, statusMessage: "No reachable PMTiles upstream" });
}

export default defineEventHandler(async (event) => {
  const range = getHeader(event, "range");
  if (!range) {
    // The pmtiles reader always sends a Range; refuse full-archive GETs so a
    // stray request can't try to stream the multi-GB planet file.
    throw createError({ statusCode: 400, statusMessage: "Range header required" });
  }

  const fetchUpstream = (url: string) => fetch(url, { headers: { Range: range } });

  let upstream = await resolveUpstream();
  let res = await fetchUpstream(upstream);

  // A memoised daily build may have rotated out (404/403) mid-session — drop the
  // cache and re-resolve once before giving up. Skipped when an explicit
  // PMTILES_URL override is set, so its errors surface instead of being masked.
  if ((res.status === 404 || res.status === 403) && !env.PMTILES_URL) {
    cachedUpstream = null;
    upstream = await resolveUpstream();
    res = await fetchUpstream(upstream);
  }

  if (!res.ok) {
    throw createError({ statusCode: 502, statusMessage: `PMTiles upstream error ${res.status}` });
  }

  setResponseStatus(event, res.status);
  for (const name of PASSTHROUGH_HEADERS) {
    const value = res.headers.get(name);
    if (value)
      setResponseHeader(event, name, value);
  }

  return Buffer.from(await res.arrayBuffer());
});
