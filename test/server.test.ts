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

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "x-request-id": "rid-int", ...extra },
  });
}

describe("MCP Server integration", () => {
  it("lists all three tools", async () => {
    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.1" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["exportCitation", "formatCitation", "resolveIdentifier"]);

    await client.close();
    await server.close();
  });

  it("calls formatCitation tool end-to-end", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { ok: true, formatter: "builtin", styleUsed: "apa", text: "Smith, J. (2020). Test." },
        200,
        { "x-scholar-formatter": "builtin", "x-scholar-style-used": "apa" },
      ),
    );

    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.1" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test", style: "apa" },
    });

    expect(result.isError).toBeFalsy();
    const textContent = (result.content as Array<{ type: string; text: string }>).find(
      (c) => c.type === "text" && !c.text.startsWith("\n---"),
    );
    expect(textContent?.text).toContain("Smith, J. (2020). Test.");

    await client.close();
    await server.close();
  });

  it("calls exportCitation tool end-to-end", async () => {
    const bibtex = "@article{Smith2020,\n  title={Test}\n}\n";
    fetchMock.mockResolvedValueOnce(
      new Response(bibtex, {
        status: 200,
        headers: {
          "content-type": "text/x-bibtex; charset=utf-8",
          "x-request-id": "rid-exp",
        },
      }),
    );

    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.1" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

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

  it("calls resolveIdentifier tool end-to-end", async () => {
    const items = [
      { title: "Resolved Paper", identifiers: [{ type: "doi", value: "10.1038/test" }] },
    ];
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, items }));

    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.1" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "resolveIdentifier",
      arguments: { text: "10.1038/test" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed[0].title).toBe("Resolved Paper");

    await client.close();
    await server.close();
  });

  it("uses default config when none provided", async () => {
    vi.stubEnv("SCHOLAR_SIDEKICK_URL", "http://custom:9999");

    const { createMcpServer } = await import("@/server");
    // Call without config argument to hit the `config ?? createConfig()` branch
    const server = createMcpServer();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.1" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const { tools } = await client.listTools();
    expect(tools).toHaveLength(3);

    await client.close();
    await server.close();
    vi.unstubAllEnvs();
  });

  it("propagates API errors as isError=true", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429));

    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test-client", version: "0.0.1" });

    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Rate limit exceeded");

    await client.close();
    await server.close();
  });
});
