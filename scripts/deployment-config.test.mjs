import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("deployment image never embeds the development account store", async () => {
  const dockerfile = await readFile(resolve(repositoryRoot, "Dockerfile"), "utf8");

  assert.doesNotMatch(dockerfile, /COPY\s+data\/store\.json\b/i);
  assert.doesNotMatch(dockerfile, /seed-data\/store\.json/i);
});

test("Docker build context excludes all runtime data and obsolete build output", async () => {
  const dockerignore = await readFile(resolve(repositoryRoot, ".dockerignore"), "utf8");
  const gitignore = await readFile(resolve(repositoryRoot, ".gitignore"), "utf8");
  const patterns = new Set(
    dockerignore
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("#")),
  );

  assert.ok(patterns.has("/data/"), "root runtime data must stay out of remote builders");
  assert.ok(patterns.has("/apps/server/data/"), "server runtime data must stay out of remote builders");
  assert.ok(patterns.has("/packages/dnd-mcp/"), "obsolete generated MCP output must stay out of the image context");
  assert.ok(patterns.has("/docker-data/"), "documented Docker volumes must stay out of remote builders");
  for (const localOnlyPath of [".codex-tmp", ".chrome-debug", ".run"]) {
    assert.ok(patterns.has(localOnlyPath), `${localOnlyPath} must stay out of remote builders`);
  }
  assert.match(gitignore, /^\/docker-data\/$/mu, "documented Docker volumes must stay untracked");
  assert.match(gitignore, /^\.codex-tmp\/$/mu, "Codex scratch data must stay untracked");
  assert.match(gitignore, /^\.chrome-debug\/$/mu, "browser profiles must stay untracked");
});

test("container entrypoint preserves backups and forwards maintenance commands", async () => {
  const entrypointPath = resolve(repositoryRoot, "docker-entrypoint.sh");
  const entrypoint = await readFile(entrypointPath, "utf8");
  const attributes = await readFile(resolve(repositoryRoot, ".gitattributes"), "utf8");

  assert.match(entrypoint, /restore_backup_if_missing/);
  assert.doesNotMatch(entrypoint, /seed_if_missing|seed-data\/store\.json/);
  assert.match(entrypoint, /exec \/app\/shadow-edge-server "\$@"/);
  assert.doesNotMatch(entrypoint, /\r/u, "entrypoint must use Unix line endings");
  assert.match(attributes, /^\*\.sh text eol=lf$/mu);
});
