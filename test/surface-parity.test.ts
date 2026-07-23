import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { beforeAll, describe, expect, it } from "vitest";

// Two files describe this server's surface to the outside world:
//
//   tools.json     — what static scanners read (security indexes, procurement review, agent
//                    allow-lists). They can't execute the server or see src/, which is
//                    npmignored, and the published tarball is a single esbuild bundle.
//   manifest.json  — what ships inside the .mcpb bundles, to Claude Desktop and Smithery.
//
// Both are generated, and both silently misrepresent the server the moment a tool changes
// and they don't. This is the drift guard. If it fails: npm run sync:surface

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), "utf8");

type Listed = Record<string, unknown>;

let liveTools: Listed[];
let livePrompts: Listed[];
let liveResources: Listed[];

beforeAll(async () => {
  const { createMcpServer } = await import("@/server");
  // Config is inert: listing never calls the API.
  const server = createMcpServer({ baseUrl: "https://scholar-sidekick.com", timeoutMs: 1000 });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "parity-test", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  ({ tools: liveTools } = (await client.listTools()) as unknown as { tools: Listed[] });
  ({ prompts: livePrompts } = (await client.listPrompts()) as unknown as { prompts: Listed[] });
  ({ resources: liveResources } = (await client.listResources()) as unknown as {
    resources: Listed[];
  });
  await client.close();
});

describe("tools.json parity", () => {
  it("matches the live tools/list payload verbatim", () => {
    expect(JSON.parse(read("tools.json"))).toEqual(liveTools);
  });

  it("declares every tool read-only, non-destructive, and closed to unknown arguments", () => {
    // Scanners score three controls off exactly these fields: approval scope (a server with
    // no destructive tools needs no human-in-the-loop gate) and strict schemas (unexpected
    // arguments can't be smuggled past validation). Any future tool that can't claim all
    // three has to change this assertion first, in the open.
    for (const tool of liveTools) {
      expect(tool.annotations, tool.name as string).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
      });
      expect((tool.inputSchema as Listed).additionalProperties, tool.name as string).toBe(false);
    }
  });
});

describe("manifest.json parity", () => {
  const manifest = () => JSON.parse(read("manifest.json"));

  it("carries the live tool definitions", () => {
    const expected = liveTools.map((tool) => {
      // The manifest drops the SDK's transport metadata and the schema dialect marker; both
      // are noise to the two validators that read an .mcpb bundle.
      const { $schema: _schema, ...inputSchema } = tool.inputSchema as Listed;
      return {
        name: tool.name,
        title: tool.title,
        description: tool.description,
        inputSchema,
        annotations: tool.annotations,
      };
    });

    const actual = manifest().tools.map((tool: Listed) => {
      // outputSchema is manifest-only documentation — the server declares no structured output.
      const { outputSchema: _outputSchema, ...rest } = tool;
      return rest;
    });

    expect(actual).toEqual(expected);
  });

  it("carries the live prompt definitions", () => {
    const expected = livePrompts.map((prompt) => ({
      name: prompt.name,
      description: prompt.description,
      arguments: ((prompt.arguments ?? []) as Listed[]).map((argument) => ({
        name: argument.name,
        description: argument.description,
        required: argument.required ?? false,
      })),
    }));

    const actual = manifest().prompts.map((prompt: Listed) => {
      // `text` is the manifest-only prompt body clients render; the server holds its own copy.
      const { text: _text, ...rest } = prompt;
      return rest;
    });

    expect(actual).toEqual(expected);
  });

  it("carries the live resource definitions", () => {
    const expected = liveResources.map((resource) => ({
      name: resource.name,
      uri: resource.uri,
      title: resource.title,
      description: resource.description,
      mimeType: resource.mimeType,
    }));

    expect(manifest().resources).toEqual(expected);
  });
});
