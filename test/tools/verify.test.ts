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
    headers: { "content-type": "application/json", "x-request-id": "rid-ver", ...extra },
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

describe("verifyCitation tool", () => {
  it("returns matched verdict for a clean citation", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        verdict: "matched",
        confidence: "high",
        matched: {
          title: "Fabricated citations: an audit across 2·5 million biomedical papers",
          authors: [{ family: "Topaz", given: "Maxim" }],
          issued: { year: 2026 },
        },
        mismatches: [],
        _provenance: { stages_run: ["compare"], resolved_via: "crossref" },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "verifyCitation",
      arguments: {
        title: "Fabricated citations: an audit across 2·5 million biomedical papers",
        doi: "10.1016/S0140-6736(26)00603-3",
        author: "Topaz",
        year: 2026,
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.verdict).toBe("matched");
    expect(parsed.confidence).toBe("high");
    expect(parsed.matched.authors[0].family).toBe("Topaz");
    // Envelope ok flag should be stripped
    expect(parsed.ok).toBeUndefined();

    await client.close();
    await server.close();
  });

  it("returns mismatch verdict on the Lancet Example C fabrication pattern", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        verdict: "mismatch",
        confidence: "high",
        matched: {
          title: "ChatGPT in Research: Balancing Ethics, Transparency and Advancement",
          authors: [{ family: "Graf" }],
        },
        mismatches: [
          { field: "title", claimed: "Microglial Modulation...", resolved: "ChatGPT in Research...", similarity: 0.12 },
        ],
        _provenance: { stages_run: ["compare", "search"], resolved_via: "crossref", registries_searched: [] },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "verifyCitation",
      arguments: {
        title:
          "Microglial Modulation via Cannabinoid Receptor 2 Alleviates Fibromyalgia-Related Central Sensitization and Pain Hypersensitivity",
        doi: "10.1016/j.neuroscience.2023.02.008",
        author: "Chen",
        year: 2023,
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.verdict).toBe("mismatch");
    expect(parsed.mismatches[0].field).toBe("title");

    await client.close();
    await server.close();
  });

  it("bundles flat MCP input into claimed + options on the API request", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        verdict: "matched",
        confidence: "high",
        matched: null,
        mismatches: [],
        _provenance: { stages_run: ["compare"], resolved_via: "crossref" },
      }),
    );

    const { server, client } = await setup();
    await client.callTool({
      name: "verifyCitation",
      arguments: {
        title: "Some Title",
        doi: "10.1234/x",
        author: "Doe",
        year: 2024,
        container: "Some Journal",
        screenWithLlm: true,
      },
    });

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toContain("/api/verify");
    const body = JSON.parse(call[1]!.body as string);
    // Flat MCP input → bundled API shape.
    expect(body.claimed.title).toBe("Some Title");
    expect(body.claimed.doi).toBe("10.1234/x");
    expect(body.claimed.year).toBe(2024);
    expect(body.claimed.container).toBe("Some Journal");
    expect(body.claimed.authors).toEqual([{ family: "Doe" }]);
    expect(body.options).toEqual({ screen_with_llm: true });

    await client.close();
    await server.close();
  });

  it("omits options block when screenWithLlm is not set", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        verdict: "matched",
        confidence: "high",
        matched: null,
        mismatches: [],
        _provenance: { stages_run: ["compare"], resolved_via: "crossref" },
      }),
    );

    const { server, client } = await setup();
    await client.callTool({
      name: "verifyCitation",
      arguments: { title: "x", doi: "10.1/y" },
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body.options).toBeUndefined();

    await client.close();
    await server.close();
  });

  it("returns 400 LLM_SCREEN_FORBIDDEN as an error when an anonymous caller requests the screen", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          ok: false,
          error: "llm_screen_requires_authentication",
          code: "LLM_SCREEN_FORBIDDEN",
        },
        400,
      ),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "verifyCitation",
      arguments: { title: "x", doi: "10.1/y", screenWithLlm: true },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("llm_screen_requires_authentication");

    await client.close();
    await server.close();
  });

  it("returns missing-key error when RAPIDAPI_KEY is not configured", async () => {
    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({
      baseUrl: "http://localhost:3000",
      timeoutMs: 5000,
      // no rapidApiKey
    });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

    const result = await client.callTool({
      name: "verifyCitation",
      arguments: { title: "x", doi: "10.1/y" },
    });
    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("RAPIDAPI_KEY");
    // Ensure no upstream fetch happened.
    expect(fetchMock).not.toHaveBeenCalled();

    await client.close();
    await server.close();
  });
});
