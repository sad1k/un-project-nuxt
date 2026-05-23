import { performance } from "node:perf_hooks";

import { createMetricRecord } from "./load-metrics.mjs";

export function assertStorageUploadEnabled(enabled) {
  if (!enabled) {
    throw new Error("Full S3-compatible upload is disabled. Set LOAD_ENABLE_STORAGE_UPLOAD=1 or pass --allow-storage-upload.");
  }
}

export async function performSignedS3Upload({
  authHeaders,
  baseUrl,
  fixture,
  fetchImpl = fetch,
  record,
  signPath,
  storageUploadEnabled,
  timeoutMs,
}) {
  assertStorageUploadEnabled(storageUploadEnabled);

  const signResult = await timedJsonRequest({
    authHeaders,
    baseUrl,
    body: {
      checksum: fixture.checksum,
      contentLength: fixture.contentLength,
    },
    className: "write",
    fetchImpl,
    method: "POST",
    name: "photo_sign_upload",
    path: signPath,
    record,
    timeoutMs,
  });

  const uploadStartedAt = performance.now();
  const formData = new FormData();

  for (const [key, value] of Object.entries(signResult.fields))
    formData.append(key, String(value));

  formData.append("file", new Blob([fixture.bytes], { type: fixture.contentType }), fixture.filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(signResult.url, {
      body: formData,
      method: "POST",
      signal: controller.signal,
    });
    const text = await response.text();
    record(createMetricRecord({
      bytes: text.length,
      className: "write",
      durationMs: performance.now() - uploadStartedAt,
      method: "POST",
      name: "photo_s3_upload",
      ok: response.status >= 200 && response.status < 400,
      path: "[signed-s3-upload]",
      status: response.status,
    }));

    if (response.status < 200 || response.status >= 400)
      throw new Error(`S3-compatible upload failed with status ${response.status}`);
  }
  catch (error) {
    record(createMetricRecord({
      className: "write",
      durationMs: performance.now() - uploadStartedAt,
      error: error?.name === "AbortError" ? "timeout" : String(error?.message || error),
      method: "POST",
      name: "photo_s3_upload",
      ok: false,
      path: "[signed-s3-upload]",
      status: 0,
      timedOut: error?.name === "AbortError",
    }));
    throw error;
  }
  finally {
    clearTimeout(timeout);
  }

  return {
    key: signResult.key,
  };
}

export async function timedJsonRequest({
  authHeaders = {},
  baseUrl,
  body,
  className,
  fetchImpl = fetch,
  method,
  name,
  path,
  record,
  timeoutMs,
}) {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(new URL(path, baseUrl), {
      body: body === undefined ? undefined : JSON.stringify(body),
      headers: {
        "accept": "application/json",
        "content-type": "application/json",
        "user-agent": "WanderLog load runner",
        ...authHeaders,
      },
      method,
      signal: controller.signal,
    });
    const text = await response.text();
    const durationMs = performance.now() - startedAt;
    const ok = response.status >= 200 && response.status < 400;

    record(createMetricRecord({
      bytes: text.length,
      className,
      durationMs,
      method,
      name,
      ok,
      path,
      status: response.status,
    }));

    if (!ok)
      throw new Error(`${name} failed with status ${response.status}`);

    return text ? JSON.parse(text) : {};
  }
  catch (error) {
    record(createMetricRecord({
      className,
      durationMs: performance.now() - startedAt,
      error: error?.name === "AbortError" ? "timeout" : String(error?.message || error),
      method,
      name,
      ok: false,
      path,
      status: 0,
      timedOut: error?.name === "AbortError",
    }));
    throw error;
  }
  finally {
    clearTimeout(timeout);
  }
}
