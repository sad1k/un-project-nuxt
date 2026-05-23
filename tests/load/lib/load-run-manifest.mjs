import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const DEFAULT_LOAD_OUTPUT_DIR = "tests/load/output";

export function generateRunId(now = new Date()) {
  const stamp = now.toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "")
    .replace("T", "-");
  return `load-${stamp}-${randomBytes(3).toString("hex")}`;
}

export function createRunManifest({ baseUrl, outputDir = DEFAULT_LOAD_OUTPUT_DIR, runId, scenario }) {
  return {
    baseUrl,
    cleanupCommand: `npm run load:cleanup -- --run-id ${runId} --manifest ${outputDir}/${runId}-manifest.json`,
    createdAt: new Date().toISOString(),
    records: {
      locationIds: [],
      locationLogIds: [],
      postIds: [],
      s3ObjectKeys: [],
      userIds: [],
    },
    reportPath: null,
    runId,
    safeSessionTokenSuffixes: [],
    scenario,
  };
}

export async function writeManifest({ manifest, outputDir = DEFAULT_LOAD_OUTPUT_DIR }) {
  await mkdir(outputDir, { recursive: true });
  const manifestPath = join(outputDir, `${manifest.runId}-manifest.json`);
  await writeFile(manifestPath, `${JSON.stringify(redactManifest(manifest), null, 2)}\n`, "utf8");
  return manifestPath;
}

export async function readManifest(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export function rememberCreated(manifest, key, value) {
  if (value === undefined || value === null)
    return;

  const list = manifest.records[key] ?? [];
  list.push(value);
  manifest.records[key] = list;
}

export function safeTokenSuffix(token) {
  const text = String(token);
  return text.slice(Math.max(0, text.length - 6));
}

function redactManifest(manifest) {
  const clone = JSON.parse(JSON.stringify(manifest));
  delete clone.rawCookies;
  delete clone.sessionTokens;
  delete clone.csrfTokens;
  return clone;
}
