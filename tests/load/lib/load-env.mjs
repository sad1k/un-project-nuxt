/* eslint-disable node/no-process-env */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

export function loadDotEnv(path = ".env") {
  let raw;
  try {
    raw = readFileSync(resolve(process.cwd(), path), "utf8");
  }
  catch (error) {
    if (error?.code === "ENOENT")
      return { loaded: 0, path };

    throw error;
  }

  let loaded = 0;
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#"))
      continue;

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx < 0)
      continue;

    const key = trimmed.slice(0, eqIdx).trimEnd();
    const rawValue = trimmed.slice(eqIdx + 1);
    if (!/^\w+$/.test(key))
      continue;
    if (key in process.env)
      continue;

    let value = rawValue.trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1);

    process.env[key] = value;
    loaded += 1;
  }

  return { loaded, path };
}
