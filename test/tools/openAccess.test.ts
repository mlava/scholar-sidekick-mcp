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
    headers: { "content-type": "application/json", "x-request-id": "rid-oa", ...extra },
  });
}

async function setup() {
  const { createMcpServer } = await import("@/server");
  const server = createMcpServer({
    baseUrl: "http://localhost:3000",
    timeoutMs: 5000,
    rapidApiKey: "test-key",
  });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.1" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return { server, client };
}

describe("checkOpenAccess tool", () => {
  it("returns OA status as JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        doi: "10.1038/s41586-020-2649-2",
        result: {
          isOa: true,
          oaStatus: "hybrid",
          title: "Array programming with NumPy",
          bestLocation: {
            url: "https://www.nature.com/articles/s41586-020-2649-2.pdf",
            hostType: "publisher",
            license: "cc-by",
            version: "publishedVersion",
          },
          locations: [
            {
              url: "https://www.nature.com/articles/s41586-020-2649-2.pdf",
              hostType: "publisher",
              license: "cc-by",
              version: "publishedVersion",
            },
          ],
        },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "checkOpenAccess",
      arguments: { id: "10.1038/s41586-020-2649-2" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.doi).toBe("10.1038/s41586-020-2649-2");
    expect(parsed.result.isOa).toBe(true);
    expect(parsed.result.oaStatus).toBe("hybrid");
    expect(parsed.result.bestLocation.url).toContain("nature.com");
    // Envelope ok flag should be stripped
    expect(parsed.ok).toBeUndefined();

    await client.close();
    await server.close();
  });

  it("returns null result with reason when no DOI resolves", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        doi: null,
        resolvedFrom: { type: "isbn", value: "9780192854087" },
        result: null,
        reason: "no_doi",
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "checkOpenAccess",
      arguments: { id: "ISBN:9780192854087" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.doi).toBeNull();
    expect(parsed.reason).toBe("no_doi");
    expect(parsed.result).toBeNull();

    await client.close();
    await server.close();
  });

  it("posts to /api/oa-check with the trimmed id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, doi: "10.1038/test", result: null }));

    const { server, client } = await setup();
    await client.callTool({
      name: "checkOpenAccess",
      arguments: { id: "  10.1038/test  " },
    });

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toContain("/api/oa-check");
    const body = JSON.parse(call[1]!.body as string);
    expect(body.id).toBe("10.1038/test");

    await client.close();
    await server.close();
  });

  it("returns error on upstream 500", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "internal_error" }, 500));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "checkOpenAccess",
      arguments: { id: "10.1038/test" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("internal_error");

    await client.close();
    await server.close();
  });

  it("handles ok=false on a 200", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Unpaywall unreachable" }, 200));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "checkOpenAccess",
      arguments: { id: "10.1038/test" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Unpaywall unreachable");

    await client.close();
    await server.close();
  });

  it("works anonymously (no key) — calls upstream without auth headers", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        doi: "10.1038/test",
        result: {
          isOa: false,
          oaStatus: "closed",
          title: "A paper",
          bestLocation: null,
          locations: [],
        },
      }),
    );

    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({
      baseUrl: "http://localhost:3000",
      timeoutMs: 5000,
      // no rapidApiKey, no scholarApiKey → anonymous
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "checkOpenAccess",
      arguments: { id: "10.1038/test" },
    });

    expect(result.isError).toBeFalsy();
    expect(fetchMock).toHaveBeenCalled();
    const call = fetchMock.mock.calls[0]!;
    expect(call[1].headers["X-RapidAPI-Key"]).toBeUndefined();
    expect(call[1].headers["Authorization"]).toBeUndefined();

    await client.close();
    await server.close();
  });
});
