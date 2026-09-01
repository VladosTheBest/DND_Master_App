#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { DndMasterClient } from "./client.js";
import { loadConfig } from "./config.js";
import { createDndMcpServer } from "./server.js";

export async function main(): Promise<void> {
  const config = loadConfig();
  const client = new DndMasterClient(config);
  const server = createDndMcpServer(client);
  await server.connect(new StdioServerTransport());
}

const entrypoint = process.argv[1] ? pathToFileURL(process.argv[1]).href : undefined;
if (entrypoint === import.meta.url) {
  main().catch(() => {
    // stderr is safe for stdio MCP diagnostics. Never include environment values or tokens.
    console.error(
      "DND Master MCP failed to start. Check DND_MASTER_BASE_URL, authentication, and local package build.",
    );
    process.exitCode = 1;
  });
}
