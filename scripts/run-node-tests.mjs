import { spawn } from "node:child_process";
import { readdir, stat } from "node:fs/promises";
import { resolve } from "node:path";

const roots = process.argv.slice(2);

if (roots.length === 0) {
  roots.push("tests/server");
}

async function collectTestFiles(entryPath) {
  const absolutePath = resolve(entryPath);
  let entryStats;

  try {
    entryStats = await stat(absolutePath);
  }
  catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }

    throw error;
  }

  if (entryStats.isFile()) {
    return absolutePath.endsWith(".test.mjs") ? [absolutePath] : [];
  }

  if (!entryStats.isDirectory()) {
    return [];
  }

  const children = await readdir(absolutePath, { withFileTypes: true });
  const nested = await Promise.all(children.map((child) => {
    const childPath = resolve(absolutePath, child.name);
    return child.isDirectory() || child.isFile() ? collectTestFiles(childPath) : [];
  }));

  return nested.flat();
}

const discoveredFiles = (await Promise.all(roots.map(collectTestFiles)))
  .flat()
  .sort();

if (discoveredFiles.length === 0) {
  console.warn(`[server-tests] No .test.mjs files found under: ${roots.join(", ")}`);
  process.exit(0);
}

const child = spawn(process.execPath, ["--test", ...discoveredFiles], {
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`[server-tests] node --test exited from signal ${signal}`);
    process.exit(1);
  }

  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error("[server-tests] Failed to run node --test");
  console.error(error);
  process.exit(1);
});
