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

describe("MCP Server resources", () => {
  let cleanup: (() => Promise<void>) | undefined;

  beforeEach(async () => {
    cleanup = undefined;
  });

  afterEach(async () => {
    if (cleanup) await cleanup();
  });

  it("lists all three reference resources", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const { resources } = await client.listResources();
    const uris = resources.map((r) => r.uri).sort();
    expect(uris).toEqual([
      "scholar-sidekick://formats",
      "scholar-sidekick://identifiers",
      "scholar-sidekick://styles",
    ]);
  });

  it("each resource declares mimeType text/markdown and a description", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const { resources } = await client.listResources();
    for (const resource of resources) {
      expect(resource.mimeType).toBe("text/markdown");
      expect(resource.title).toBeTruthy();
      expect(resource.description).toBeTruthy();
    }
  });

  it("identifiers resource contains all 8 identifier types and WHO IRIS framing", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.readResource({ uri: "scholar-sidekick://identifiers" });
    expect(result.contents).toHaveLength(1);
    const text = (result.contents[0] as { text: string }).text;

    for (const id of [
      "DOI",
      "PubMed ID",
      "PubMed Central ID",
      "ISBN",
      "arXiv",
      "ISSN",
      "ADS bibcode",
      "WHO IRIS",
    ]) {
      expect(text).toContain(id);
    }
    expect(text).toContain("comma- or newline-separated batch");
  });

  it("styles resource lists builtins and CSL ID examples", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.readResource({ uri: "scholar-sidekick://styles" });
    const text = (result.contents[0] as { text: string }).text;

    for (const builtin of ["vancouver", "ama", "apa", "ieee", "cse"]) {
      expect(text).toContain(builtin);
    }
    for (const csl of [
      "chicago-author-date",
      "harvard-cite-them-right",
      "modern-language-association",
      "nature",
    ]) {
      expect(text).toContain(csl);
    }
    expect(text).toContain("10,000+");
  });

  it("formats resource lists all 10 export formats", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.readResource({ uri: "scholar-sidekick://formats" });
    const text = (result.contents[0] as { text: string }).text;

    for (const fmt of [
      "`bib`",
      "`ris`",
      "`csl`",
      "`endnote-xml`",
      "`endnote-refer`",
      "`refworks`",
      "`medline`",
      "`zotero-rdf`",
      "`csv`",
      "`txt`",
    ]) {
      expect(text).toContain(fmt);
    }
  });

  it("read response includes the requested URI", async () => {
    const { client, close } = await withClient();
    cleanup = close;

    const result = await client.readResource({ uri: "scholar-sidekick://identifiers" });
    expect(result.contents[0].uri).toBe("scholar-sidekick://identifiers");
  });
});
