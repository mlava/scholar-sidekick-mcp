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
    headers: { "content-type": "application/json", "x-request-id": "rid-fmt", ...extra },
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

describe("formatCitation tool", () => {
  it("returns formatted text with metadata", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        {
          ok: true,
          formatter: "builtin",
          styleUsed: "vancouver",
          text: "1. Smith J. Title. 2020.",
        },
        200,
        { "x-scholar-formatter": "builtin", "x-scholar-style-used": "vancouver" },
      ),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test", style: "vancouver" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Smith J. Title. 2020.");
    expect(content[1].text).toContain("vancouver");

    await client.close();
    await server.close();
  });

  it("returns error when API fails with 400", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Missing 'text'." }, 400));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("Missing 'text'.");

    await client.close();
    await server.close();
  });

  it("returns error when response body has ok=false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, error: "No valid identifiers found." }, 200),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "garbage-input" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("No valid identifiers found.");

    await client.close();
    await server.close();
  });

  it("returns JSON output when output=json", async () => {
    const items = [{ title: "Test", authors: [{ family: "Doe", given: "J" }] }];
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, items }, 200));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test", output: "json" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed[0].title).toBe("Test");

    await client.close();
    await server.close();
  });

  it("includes CSL warning and scholar warnings in metadata", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, text: "1. Smith." }, 200, {
        "x-scholar-formatter": "csl",
        "x-scholar-style-used": "vancouver",
        "x-csl-warning": "fallback-to-default",
        "x-scholar-warnings": "Normalized curly quotes",
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test", style: "unknown-style" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const metaBlock = content.find((c) => c.text.includes("Metadata:"));
    expect(metaBlock).toBeDefined();
    const metaJson = JSON.parse(metaBlock!.text.replace(/\n---\nMetadata: /, ""));
    expect(metaJson.cslWarning).toBe("fallback-to-default");
    expect(metaJson.warnings).toBe("Normalized curly quotes");

    await client.close();
    await server.close();
  });

  it("metadata block has only requestId when no scholar headers present", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, text: "1. Smith." }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBe("1. Smith.");
    // Metadata block exists but only has requestId (no scholar headers)
    const metaBlock = content.find((c) => c.text.includes("Metadata:"));
    expect(metaBlock).toBeDefined();
    const metaJson = JSON.parse(metaBlock!.text.replace(/\n---\nMetadata: /, ""));
    expect(metaJson.requestId).toBeDefined();
    expect(metaJson.formatter).toBeUndefined();
    expect(metaJson.styleUsed).toBeUndefined();

    await client.close();
    await server.close();
  });

  it("handles ok=false with missing data.error (falls back to result.error)", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false }, 200));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "test" },
    });

    expect(result.isError).toBe(true);

    await client.close();
    await server.close();
  });

  it("returns empty string when response has no text, html, or items", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }, 200));

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toBe("");

    await client.close();
    await server.close();
  });

  it("returns HTML output when requested", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, html: "<p>Smith J. <em>Title</em>. 2020.</p>" }, 200, {
        "x-scholar-formatter": "builtin",
      }),
    );

    const { server, client } = await setup();
    const result = await client.callTool({
      name: "formatCitation",
      arguments: { text: "10.1038/test", output: "html" },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content[0].text).toContain("<p>Smith J.");

    await client.close();
    await server.close();
  });
});
