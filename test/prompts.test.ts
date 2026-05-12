import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { createMcpServer } from "@/server";

const TEST_CONFIG = {
  baseUrl: "http://localhost:3000",
  timeoutMs: 5000,
  rapidApiKey: "test-key",
};

async function withClient(): Promise<{ client: Client; close: () => Promise<void> }> {
  const server = createMcpServer(TEST_CONFIG);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test-client", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe("MCP Server prompts", () => {
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    cleanup = undefined;
  });

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  it("lists all seven prompts", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const { prompts } = await client.listPrompts();
    const names = prompts.map((p) => p.name).sort();
    expect(names).toEqual([
      "batch_format",
      "export",
      "format",
      "open_access",
      "resolve",
      "retraction",
      "verify",
    ]);
  });

  it("format prompt interpolates identifier and style", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.getPrompt({
      name: "format",
      arguments: { identifier: "10.1056/NEJMoa2033700", style: "vancouver" },
    });

    expect(result.messages).toHaveLength(1);
    expect(result.messages[0].role).toBe("user");
    const content = result.messages[0].content as { type: string; text: string };
    expect(content.type).toBe("text");
    expect(content.text).toContain("10.1056/NEJMoa2033700");
    expect(content.text).toContain("vancouver");
    expect(content.text).toContain("formatCitation");
  });

  it("export prompt interpolates identifier and format", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.getPrompt({
      name: "export",
      arguments: { identifier: "PMID:30049270", format: "bib" },
    });

    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("PMID:30049270");
    expect(content.text).toContain("bib");
    expect(content.text).toContain("exportCitation");
  });

  it("batch_format prompt interpolates identifiers and style", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.getPrompt({
      name: "batch_format",
      arguments: {
        identifiers: "10.1056/NEJMoa2033700, PMID:30049270, ISBN:9780192854087",
        style: "apa",
      },
    });

    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("10.1056/NEJMoa2033700");
    expect(content.text).toContain("PMID:30049270");
    expect(content.text).toContain("ISBN:9780192854087");
    expect(content.text).toContain("apa");
    expect(content.text).toContain("single formatCitation tool call");
  });

  it("resolve prompt interpolates identifier", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.getPrompt({
      name: "resolve",
      arguments: { identifier: "arXiv:2301.08745" },
    });

    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("arXiv:2301.08745");
    expect(content.text).toContain("resolveIdentifier");
  });

  it("retraction prompt interpolates identifier", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.getPrompt({
      name: "retraction",
      arguments: { identifier: "10.1016/S0140-6736(20)31180-6" },
    });

    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("10.1016/S0140-6736(20)31180-6");
    expect(content.text).toContain("checkRetraction");
  });

  it("open_access prompt interpolates identifier", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.getPrompt({
      name: "open_access",
      arguments: { identifier: "10.1038/s41586-020-2649-2" },
    });

    const content = result.messages[0].content as { type: string; text: string };
    expect(content.text).toContain("10.1038/s41586-020-2649-2");
    expect(content.text).toContain("checkOpenAccess");
  });

  it("each prompt has a title and description in the listing", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const { prompts } = await client.listPrompts();
    for (const prompt of prompts) {
      expect(prompt.title).toBeTruthy();
      expect(prompt.description).toBeTruthy();
    }
  });
});
