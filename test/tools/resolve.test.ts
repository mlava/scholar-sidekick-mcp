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
    headers: { "content-type": "application/json", "x-request-id": "rid-res", ...extra },
  });
}

async function setup() {
  const { createMcpServer } = await import("@/server");
  const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe("resolveIdentifier tool", () => {
  it("returns resolved items as JSON", async () => {
    const items = [
      {
        title: "A Nature paper",
        authors: [{ family: "Smith", given: "J" }],
        issued: { "date-parts": [[2020]] },
        identifiers: [{ type: "doi", value: "10.1038/test" }],
      },
    ];

    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, items }));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "resolveIdentifier",
      arguments: { text: "10.1038/test" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].title).toBe("A Nature paper");
    expect(parsed[0].identifiers[0].value).toBe("10.1038/test");

    await client.close();
    await server.close();
  });

  it("falls back to empty array when items is absent from response", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "resolveIdentifier",
      arguments: { text: "10.0000/nonexistent" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual([]);

    await client.close();
    await server.close();
  });

  it("returns empty array when items is empty", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, items: [] }));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "resolveIdentifier",
      arguments: { text: "10.0000/nonexistent" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(content[0].text)).toEqual([]);

    await client.close();
    await server.close();
  });

  it("returns error on API failure", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Resolve failed." }, 500));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "resolveIdentifier",
      arguments: { text: "bad" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Resolve failed.");

    await client.close();
    await server.close();
  });

  it("handles ok=false with missing data.error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false }, 200));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "resolveIdentifier",
      arguments: { text: "bad" },
    });

    expect(result.isError).toBe(true);

    await client.close();
    await server.close();
  });

  it("sends output=json to /api/format", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, items: [] }));

    const { server, client } = await setup();
    await client.callTool({
      name: "resolveIdentifier",
      arguments: { text: "10.1038/test" },
    });

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toContain("/api/format");
    const body = JSON.parse(call[1]!.body as string);
    expect(body.output).toBe("json");

    await client.close();
    await server.close();
  });
});
