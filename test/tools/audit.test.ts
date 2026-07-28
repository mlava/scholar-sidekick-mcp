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

function jsonResponse(
  body: unknown,
  status = 200,
  extra: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": "rid-audit",
      ...extra,
    },
  });
}

async function setup() {
  const { createMcpServer } = await import("@/server");
  const server = createMcpServer({
    baseUrl: "http://localhost:3000",
    timeoutMs: 5000,
    rapidApiKey: "test-key",
  });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.1" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}

const AUDIT_BODY = {
  ok: true,
  format: "bibtex",
  entries: [
    {
      index: 1,
      status: "ok",
      verdict: "mismatch",
      confidence: "high",
      matched: { title: "The real paper" },
      mismatches: [
        {
          field: "title",
          claimed: "An invented title",
          resolved: "The real paper",
        },
      ],
      retraction: null,
    },
  ],
  parseErrors: [],
  truncated: false,
  summary: {
    total: 1,
    matched: 0,
    mismatch: 1,
    ambiguous: 0,
    not_found: 0,
    errored: 0,
    retracted: 0,
  },
};

describe("auditBibliography tool", () => {
  it("returns the verdict table as parseable JSON in the first content item", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(AUDIT_BODY));

    const { client } = await setup();
    const result = await client.callTool({
      name: "auditBibliography",
      arguments: {
        bibliography: "@article{a, title={An invented title}, doi={10.1/x}}",
      },
    });

    expect(result.isError).toBeFalsy();
    const content = result.content as Array<{ type: string; text: string }>;
    const parsed = JSON.parse(content[0].text);
    expect(parsed.summary.mismatch).toBe(1);
    expect(parsed.entries[0].verdict).toBe("mismatch");
    // `ok` is stripped from the payload — it is transport, not audit data.
    expect(parsed.ok).toBeUndefined();
  });

  it("appends the evidence-report next step as a SEPARATE content item", async () => {
    // The first item must stay machine-parseable, so the attribution cannot be
    // concatenated into it. This is the same shape formatCitation uses for its
    // metadata block.
    fetchMock.mockResolvedValueOnce(jsonResponse(AUDIT_BODY));

    const { client } = await setup();
    const result = await client.callTool({
      name: "auditBibliography",
      arguments: {
        bibliography: "@article{a, title={An invented title}, doi={10.1/x}}",
      },
    });

    const content = result.content as Array<{ type: string; text: string }>;
    expect(content).toHaveLength(2);
    expect(content[1].text).toContain(
      "https://scholar-sidekick.com/tools/bibliography-audit",
    );
    // The JSON item stays clean.
    expect(content[0].text).not.toContain("scholar-sidekick.com");
    expect(() => JSON.parse(content[0].text)).not.toThrow();
  });

  it("carries no next step on an error result", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { ok: false, error: "Bad Request", code: "BAD_REQUEST" },
        400,
      ),
    );

    const { client } = await setup();
    const result = await client.callTool({
      name: "auditBibliography",
      arguments: { bibliography: "not a bibliography" },
    });

    expect(result.isError).toBe(true);
    const content = result.content as Array<{ type: string; text: string }>;
    expect(content.map((c) => c.text).join("\n")).not.toContain(
      "/tools/bibliography-audit",
    );
  });
});
