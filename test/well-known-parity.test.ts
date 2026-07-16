// @vitest-environment node
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";

/**
 * Cross-repo parity: the website (scholar-sidekick repo) publishes a static MCP
 * discovery card at /.well-known/mcp.json whose capabilities are meant to mirror
 * what THIS server actually exposes. They drifted before — the card claimed
 * invented prompt/resource names ("compare-citation-styles", "citation-styles")
 * that this server never registered.
 *
 * EXPECTED is the contract for this server's surface. The first test asserts the
 * running server matches it (offline, always on). The second — opt-in via
 * CHECK_LIVE_WELL_KNOWN=1 — fetches the published card and asserts it agrees,
 * catching website-side drift without coupling normal CI to deploy timing.
 */
const EXPECTED = {
  tools: [
    "auditBibliography",
    "checkOpenAccess",
    "checkRetraction",
    "exportCitation",
    "formatCitation",
    "resolveIdentifier",
    "verifyCitation",
  ].sort(),
  prompts: [
    "batch_format",
    "export",
    "format",
    "open_access",
    "resolve",
    "retraction",
    "verify",
  ].sort(),
  resources: [
    "supported-formats",
    "supported-identifiers",
    "supported-styles",
    "verify-verdicts",
  ].sort(),
};

const names = (xs: { name: string }[]): string[] =>
  xs.map((x) => x.name).sort();

async function introspectServer(): Promise<{
  tools: string[];
  prompts: string[];
  resources: string[];
}> {
  const { createMcpServer } = await import("@/server");
  const server = createMcpServer({
    baseUrl: "http://localhost:3000",
    timeoutMs: 5000,
    rapidApiKey: "test-key",
  });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "parity-test", version: "0.0.1" });
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);

  const [tools, prompts, resources] = await Promise.all([
    client.listTools(),
    client.listPrompts(),
    client.listResources(),
  ]);

  await client.close();
  await server.close();

  return {
    tools: names(tools.tools),
    prompts: names(prompts.prompts),
    resources: names(resources.resources),
  };
}

describe("well-known parity (server surface ⇄ website /.well-known/mcp.json)", () => {
  it("the running server registers exactly the expected tools, prompts, and resources", async () => {
    const surface = await introspectServer();
    expect(surface.tools).toEqual(EXPECTED.tools);
    expect(surface.prompts).toEqual(EXPECTED.prompts);
    expect(surface.resources).toEqual(EXPECTED.resources);
  });

  it.skipIf(!process.env.CHECK_LIVE_WELL_KNOWN)(
    "published /.well-known/mcp.json matches the running server surface",
    async () => {
      const surface = await introspectServer();

      const res = await fetch(
        "https://scholar-sidekick.com/.well-known/mcp.json",
        {
          signal: AbortSignal.timeout(10_000),
        },
      );
      expect(res.ok, `fetch returned ${res.status}`).toBe(true);
      const card = (await res.json()) as {
        capabilities: {
          tools: string[];
          prompts: string[];
          resources: string[];
        };
      };

      expect([...card.capabilities.tools].sort()).toEqual(surface.tools);
      expect([...card.capabilities.prompts].sort()).toEqual(surface.prompts);
      expect([...card.capabilities.resources].sort()).toEqual(
        surface.resources,
      );
    },
  );
});
