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
    headers: { "content-type": "application/json", "x-request-id": "rid-ret", ...extra },
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

describe("checkRetraction tool", () => {
  it("returns retraction status as JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        doi: "10.1016/s0140-6736(20)31180-6",
        result: {
          isRetracted: true,
          hasCorrections: false,
          hasConcern: false,
          notices: [
            {
              type: "retraction",
              label: "Retraction",
              doi: "10.1016/s0140-6736(20)31324-6",
              date: "2020-06-04",
              source: "crossref",
            },
          ],
          title: "Hydroxychloroquine or chloroquine ...",
        },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "checkRetraction",
      arguments: { id: "10.1016/S0140-6736(20)31180-6" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.doi).toBe("10.1016/s0140-6736(20)31180-6");
    expect(parsed.result.isRetracted).toBe(true);
    expect(parsed.result.notices).toHaveLength(1);
    // Envelope ok flag should be stripped
    expect(parsed.ok).toBeUndefined();

    await client.close();
    await server.close();
  });

  it("returns null result with reason when no DOI resolves (e.g. ISBN)", async () => {
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
      name: "checkRetraction",
      arguments: { id: "ISBN:9780192854087" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.doi).toBeNull();
    expect(parsed.reason).toBe("no_doi");
    expect(parsed.result).toBeNull();
    expect(parsed.resolvedFrom).toEqual({ type: "isbn", value: "9780192854087" });

    await client.close();
    await server.close();
  });

  it("posts to /api/retraction-check with the trimmed id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, doi: "10.1038/test", result: null }));

    const { server, client } = await setup();
    await client.callTool({
      name: "checkRetraction",
      arguments: { id: "  10.1038/test  " },
    });

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toContain("/api/retraction-check");
    const body = JSON.parse(call[1]!.body as string);
    expect(body.id).toBe("10.1038/test");

    await client.close();
    await server.close();
  });

  it("returns error on API failure", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, error: "Enter a DOI, PMID, PMCID, arXiv ID, or ADS bibcode." }, 400),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "checkRetraction",
      arguments: { id: "garbage" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Enter a DOI");

    await client.close();
    await server.close();
  });

  it("handles ok=false on a 200 (graceful upstream failure)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Crossref unreachable" }, 200));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "checkRetraction",
      arguments: { id: "10.1038/test" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Crossref unreachable");

    await client.close();
    await server.close();
  });

  it("returns missing-key message when RAPIDAPI_KEY is unset", async () => {
    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({
      baseUrl: "http://localhost:3000",
      timeoutMs: 5000,
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "checkRetraction",
      arguments: { id: "10.1038/test" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("RAPIDAPI_KEY");
    expect(fetchMock).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });
});
