import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

// tools.json is the tool surface static scanners read — security indexes, procurement
// review, agent allow-lists. They cannot execute our server or parse src/ (npmignored,
// and the published tarball is a single esbuild bundle), so a stale tools.json would
// misrepresent us to every one of them.
//
// This is the drift guard. If it fails: npm run gen:tools

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), "utf8");

async function liveTools() {
  const { createMcpServer } = await import("@/server");
  // Config is inert: listing tools never calls the API.
  const server = createMcpServer({ baseUrl: "https://scholar-sidekick.com", timeoutMs: 1000 });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "parity-test", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  const { tools } = await client.listTools();
  await client.close();
  return tools;
}

describe("tools.json parity", () => {
  it("matches the live tools/list payload verbatim", async () => {
    const committed = JSON.parse(read("tools.json"));

    expect(committed).toEqual(await liveTools());
  });

  it("declares every tool read-only and non-destructive", async () => {
    // Scanners score "approval scope" off these hints: a server with no destructive tools
    // needs no human-in-the-loop gate. Every tool here is a read against a public API, so
    // any future tool that isn't must be a deliberate, visible change to this assertion.
    for (const tool of await liveTools()) {
      expect(tool.annotations, tool.name).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
      });
    }
  });
});

describe("manifest.json parity", () => {
  // manifest.json (the .mcpb bundles' source of truth) carries its own copy of the tool
  // surface. Its descriptions are abridged for display and have drifted from the live
  // server's prose, so this checks the contract-bearing parts only: which tools exist,
  // which arguments they take, and which are required.
  it("declares the same tools, arguments, and required fields as the live server", async () => {
    const manifest = JSON.parse(read("manifest.json"));
    const shape = (tools: { name: string; inputSchema: Record<string, unknown> }[]) =>
      Object.fromEntries(
        tools.map((tool) => [
          tool.name,
          {
            properties: Object.keys(tool.inputSchema.properties ?? {}).sort(),
            required: [...((tool.inputSchema.required as string[]) ?? [])].sort(),
          },
        ]),
      );

    expect(shape(manifest.tools)).toEqual(shape(await liveTools()));
  });
});
