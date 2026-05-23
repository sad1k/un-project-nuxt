/* eslint-disable node/no-process-env */
import { createHmac, randomBytes } from "node:crypto";

import { createLoadDbClient, insertLoadSession, insertLoadUser } from "./load-local-db.mjs";
import { safeTokenSuffix } from "./load-run-manifest.mjs";

export const LOAD_SESSION_COOKIE_NAME = "better-auth.session_token";

function resolveBetterAuthSecret() {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret)
    throw new Error("BETTER_AUTH_SECRET is required to sign synthetic load-test session cookies");

  return secret;
}

export async function seedSyntheticAuthUsers({
  count = 100,
  dbClient = createLoadDbClient(),
  runId,
} = {}) {
  if (!runId)
    throw new Error("runId is required for synthetic auth seeding");

  const secret = resolveBetterAuthSecret();
  const users = [];
  const safeSessionTokenSuffixes = [];

  for (let index = 0; index < count; index += 1) {
    const ordinal = String(index + 1).padStart(3, "0");
    const userId = await insertLoadUser(dbClient, {
      email: `load+${runId}-${ordinal}@example.test`,
      name: `[${runId}] Load User ${ordinal}`,
    });
    const token = randomBytes(32).toString("hex");
    await insertLoadSession(dbClient, {
      token,
      userId,
    });

    users.push({
      cookieHeader: buildSessionCookieHeader(token, secret),
      email: `load+${runId}-${ordinal}@example.test`,
      id: userId,
      safeSessionTokenSuffix: safeTokenSuffix(token),
    });
    safeSessionTokenSuffixes.push(safeTokenSuffix(token));
  }

  return {
    safeSessionTokenSuffixes,
    users,
  };
}

export function signSessionToken(token, secret) {
  return createHmac("sha256", secret).update(token).digest("base64");
}

export function buildSessionCookieHeader(token, secret = resolveBetterAuthSecret()) {
  const signature = signSessionToken(token, secret);
  const signed = `${token}.${signature}`;
  return `${LOAD_SESSION_COOKIE_NAME}=${encodeURIComponent(signed)}`;
}

export async function preflightSeededAuth({ baseUrl, fetchImpl = fetch, sampleSize = 3, timeoutMs = 15000, users }) {
  const sample = users.slice(0, Math.min(sampleSize, users.length));
  const failures = [];

  for (const user of sample) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetchImpl(new URL("/api/auth/profile", baseUrl), {
        headers: {
          "accept": "application/json",
          "cookie": user.cookieHeader,
          "user-agent": "WanderLog load runner auth preflight",
        },
        signal: controller.signal,
      });

      if (response.status < 200 || response.status >= 400) {
        failures.push({
          safeSessionTokenSuffix: user.safeSessionTokenSuffix,
          status: response.status,
        });
      }
    }
    catch (error) {
      failures.push({
        error: error?.name === "AbortError" ? "timeout" : String(error?.message || error),
        safeSessionTokenSuffix: user.safeSessionTokenSuffix,
        status: 0,
      });
    }
    finally {
      clearTimeout(timeout);
    }
  }

  if (failures.length > 0) {
    throw new Error(`/api/auth/profile rejected seeded sessions: ${JSON.stringify(failures)}`);
  }

  return {
    checked: sample.length,
    endpoint: "/api/auth/profile",
  };
}
