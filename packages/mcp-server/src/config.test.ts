import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "./config.js";

test("loadConfig accepts a raw DND session and scopes media to cwd", () => {
  const config = loadConfig(
    {
      DND_MASTER_BASE_URL: "http://127.0.0.1:8080",
      DND_MASTER_SESSION_COOKIE: "signed-session-token",
    },
    "C:\\workspace",
  );

  assert.equal(config.baseUrl.href, "http://127.0.0.1:8080/");
  assert.equal(config.sessionCookie, "shadow_edge_session=signed-session-token");
  assert.deepEqual(config.mediaRoots, ["C:\\workspace"]);
});

test("loadConfig extracts only the DND session from a full cookie header", () => {
  const config = loadConfig({
    DND_MASTER_BASE_URL: "https://dnd.example.com",
    DND_MASTER_SESSION_COOKIE:
      "unrelated=do-not-forward; shadow_edge_session=signed-session-token; theme=dark",
  });

  assert.equal(config.sessionCookie, "shadow_edge_session=signed-session-token");
});

test("loadConfig requires exactly one authentication method", () => {
  assert.throws(
    () => loadConfig({ DND_MASTER_BASE_URL: "http://localhost:8080" }),
    /Set DND_MASTER_SESSION_COOKIE or DND_MASTER_BEARER_TOKEN/,
  );
  assert.throws(
    () =>
      loadConfig({
        DND_MASTER_BASE_URL: "http://localhost:8080",
        DND_MASTER_SESSION_COOKIE: "session",
        DND_MASTER_BEARER_TOKEN: "token",
      }),
    /Set only one/,
  );
});

test("loadConfig rejects non-loopback plaintext HTTP by default", () => {
  assert.throws(
    () =>
      loadConfig({
        DND_MASTER_BASE_URL: "http://dnd.example.com",
        DND_MASTER_SESSION_COOKIE: "session",
      }),
    /must use HTTPS outside localhost/,
  );
});
