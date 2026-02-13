/**
 * Isolated test for export.ts:32 `result.data ?? ""` null-coalescing branch.
 *
 * Through the real callApi pipeline, `result.data` is always a string when
 * ok=true (from `res.text()`). We use vi.doMock to inject an undefined data
 * value and exercise the defensive fallback.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.doMock("@/client", () => ({
  createConfig: () => ({ baseUrl: "http://localhost:3000", timeoutMs: 5000 }),
  exportCitation: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    data: undefined,
    requestId: "rid-undef",
    headers: {},
  }),
  formatCitation: vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    data: { ok: true, text: "stub" },
    requestId: "rid-stub",
    headers: {},
  }),
  callApi: vi.fn(),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

describe("exportCitation ?? fallback", () => {
  it("returns empty string when result.data is undefined", async () => {
    const { createMcpServer } = await import("@/server");
    const server = createMcpServer({ baseUrl: "http://localhost:3000", timeoutMs: 5000 });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

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
});
