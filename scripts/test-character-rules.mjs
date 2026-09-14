import { loadCharacterRules } from "./character-rules-runtime.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const runtime = loadCharacterRules(true);
try {
  runtime.runTests();
} finally {
  runtime.cleanup();
}
const snapshotCheck = spawnSync(
  process.execPath,
  [
    fileURLToPath(new URL("./export-character-catalog.mjs", import.meta.url)),
    "--check",
  ],
  { stdio: "inherit" },
);
if (snapshotCheck.error) throw snapshotCheck.error;
if (snapshotCheck.status !== 0) process.exitCode = snapshotCheck.status ?? 1;
