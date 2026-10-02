import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import ts from "typescript";

const source = await readFile(new URL("../packages/api-client/src/index.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const { createApiClient, ApiError } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);
let posts = 0, polls = 0;
const server = createServer(async (request, response) => {
  response.setHeader("Content-Type", "application/json");
  if (request.method === "GET") {
    polls++;
    assert.equal(request.url, "/api/ai/jobs/job-test");
    response.end(JSON.stringify({ data: { id: "job-test", state: "succeeded", result: { data: { saved: true } } } }));
    return;
  }
  posts++;
  assert.equal(request.method, "POST");
  assert.equal(request.headers.prefer, "respond-async");
  assert.equal(request.headers["content-type"], "application/json");
  const chunks = []; for await (const chunk of request) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  assert.equal(body.prompt, "Background test");
  const isSession = body.sessionId === "session-test";
  const state = body.fail ? "failed" : (posts === 1 || isSession ? "queued" : "succeeded");
  response.writeHead(202);
  response.end(JSON.stringify({ data: { id: "job-test", state, httpStatus: body.fail ? 429 : 200,
    result: body.fail ? { error: { code: "rate_limit", message: "Try later" } } : { data: { saved: true } } } }));
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
try {
  const api = createApiClient(`http://127.0.0.1:${server.address().port}`);
  const input = { prompt: "Background test" };
  assert.deepEqual(await api.runCodexPrompt(input), { saved: true });
  assert.equal(polls, 1);
  for (const method of ["generateEntityDraft", "proposeEntity", "proposeWorldEvent", "formatPlayerFacingCard", "generateWorldEvent", "generateCombat"]) {
    assert.deepEqual(await api[method]("campaign-test", input), { saved: true });
  }
  assert.deepEqual(await api.proposeCampaign(input), { saved: true });
  const before = polls;
  assert.equal((await api.startCodexPrompt({ ...input, sessionId: "session-test" })).state, "queued");
  assert.equal(polls, before, "session submission must not wait for completion");
  await assert.rejects(api.runCodexPrompt({ ...input, fail: true }), error => error instanceof ApiError && error.code === "rate_limit" && error.status === 429);
  console.log("AI jobs client: all generation POST bodies/headers, polling, immediate session submission and provider errors passed.");
} finally { await new Promise(resolve => server.close(resolve)); }
