#!/usr/bin/env node

/* eslint-disable no-console, node/no-process-env */

import { DeleteObjectsCommand, S3Client } from "@aws-sdk/client-s3";
import process from "node:process";

import { loadDotEnv } from "./lib/load-env.mjs";

loadDotEnv();

import { createLoadDbClient, deleteRunMarkedRows, findRunMarkedRows } from "./lib/load-local-db.mjs";
import { readManifest } from "./lib/load-run-manifest.mjs";

function parseCli(argv) {
  const options = {
    force: false,
    manifestPath: null,
    runId: null,
  };

  const args = [...argv];
  while (args.length > 0) {
    const arg = args.shift();
    switch (arg) {
      case "--force":
        options.force = true;
        break;
      case "--manifest":
        options.manifestPath = requireValue(arg, args.shift());
        break;
      case "--run-id":
        options.runId = requireValue(arg, args.shift());
        break;
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }

  if (!options.runId)
    throw new Error("Refusing cleanup without --run-id");

  return options;
}

function requireValue(flag, value) {
  if (!value || value.startsWith("-"))
    throw new Error(`${flag} requires a value`);

  return value;
}

const S3_DELETE_BATCH_LIMIT = 1000;

async function deleteS3Objects(keys) {
  if (keys.length === 0 || !process.env.S3_BUCKET)
    return { skipped: true, deleted: 0 };

  const client = new S3Client({
    credentials: process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? {
          accessKeyId: process.env.S3_ACCESS_KEY,
          secretAccessKey: process.env.S3_SECRET_KEY,
        }
      : undefined,
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true,
    region: process.env.S3_REGION || "auto",
  });

  let deleted = 0;
  let errors = 0;

  for (let offset = 0; offset < keys.length; offset += S3_DELETE_BATCH_LIMIT) {
    const batch = keys.slice(offset, offset + S3_DELETE_BATCH_LIMIT);
    const result = await client.send(new DeleteObjectsCommand({
      Bucket: process.env.S3_BUCKET,
      Delete: {
        Objects: batch.map(Key => ({ Key })),
        Quiet: true,
      },
    }));
    const batchErrors = result.Errors?.length ?? 0;
    deleted += batch.length - batchErrors;
    errors += batchErrors;
  }

  return { deleted, errors, skipped: false };
}

async function main() {
  const options = parseCli(process.argv.slice(2));
  const manifest = options.manifestPath ? await readManifest(options.manifestPath) : null;
  const client = createLoadDbClient();
  const found = await findRunMarkedRows(client, options.runId);
  const s3ObjectKeys = manifest?.records?.s3ObjectKeys ?? [];

  console.log(`[load-cleanup] runId=${options.runId}`);
  console.log(`[load-cleanup] matchedUsers=${found.userIds.length} s3Objects=${s3ObjectKeys.length}`);

  if (!options.force) {
    console.log("[load-cleanup] dry run only. Re-run with --force to delete local DB rows and best-effort S3 objects.");
    return;
  }

  const deletedRows = await deleteRunMarkedRows(client, options.runId);
  const deletedS3 = await deleteS3Objects(s3ObjectKeys);

  console.log(JSON.stringify({
    deletedRows,
    deletedS3,
    runId: options.runId,
  }, null, 2));
}

main().catch((error) => {
  console.error(`[load-cleanup] ${error.message}`);
  process.exit(1);
});
