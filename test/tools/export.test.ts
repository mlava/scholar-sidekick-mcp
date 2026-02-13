import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup() {
  const { createMcpServer } = await import("@/server");
  const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe("exportCitation tool", () => {
  it("returns BibTeX content", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("@article{Smith2020,\n  title={Test},\n  year={2020}\n}\n", {
        status: 200,
        headers: {
          "content-type": "text/x-bibtex; charset=utf-8",
          "x-request-id": "rid-exp",
        },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "exportCitation",
      arguments: { text: "10.1038/test", format: "bib" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("@article{Smith2020");

    await client.close();
    await server.close();
  });

  it("returns RIS content", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("TY  - JOUR\nTI  - Test\nPY  - 2020\nER  -\n", {
        status: 200,
        headers: {
          "content-type": "application/x-research-info-systems; charset=utf-8",
          "x-request-id": "rid-ris",
        },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "exportCitation",
      arguments: { text: "10.1038/test", format: "ris" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("TY  - JOUR");

    await client.close();
    await server.close();
  });

  it("returns empty string when data is undefined", async () => {
    // Simulate a 200 response with empty body (edge case)
    fetchMock.mockResolvedValueOnce(
      new Response("", {
        status: 200,
        headers: { "content-type": "text/plain", "x-request-id": "rid-empty" },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "exportCitation",
      arguments: { text: "10.1038/test", format: "bib" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBe("");

    await client.close();
    await server.close();
  });

  it("returns error on API failure", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "Missing 'text'." }), {
        status: 400,
        headers: { "content-type": "application/json", "x-request-id": "rid-err" },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "exportCitation",
      arguments: { text: "", format: "bib" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Error:");

    await client.close();
    await server.close();
  });
});
