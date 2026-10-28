import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

// Reuse Vite's existing esbuild dependency; tests use Node's built-in test runner.
const directory = await mkdtemp(join(tmpdir(), "nuance-tests-"));
try {
  const outfile = join(directory, "nuance.test.mjs");
  await build({ entryPoints: ["tests/nuance.test.ts"], outfile, bundle: true, platform: "node", format: "esm" });
  const result = spawnSync(process.execPath, ["--test", outfile], { stdio: "inherit" });
  process.exitCode = result.status ?? 1;
} finally { await rm(directory, { recursive: true, force: true }); }
