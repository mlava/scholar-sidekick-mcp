// @vitest-environment node
import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Cross-repo endpoint contract: this server's REST client (src/client.ts) pins a
 * fixed set of `/api/*` paths on the Scholar Sidekick website (scholar-sidekick
 * repo). The website's `well-known-parity.test.ts` sibling already guards the
 * TOOL / PROMPT / RESOURCE names; this file guards the thing that test doesn't —
 * the REST PATHS. If the website renames or removes an endpoint (e.g.
 * /api/oa-check), this client keeps calling the dead path and breaks only at
 * runtime, with no failing test. This closes that gap.
 *
 * Pattern (mirror of well-known-parity.test.ts):
 *   - Test 1 is OFFLINE + always-on: it reads src/client.ts and asserts the
 *     paths it actually calls are EXACTLY PINNED_ENDPOINTS — so the pinned list
 *     can never silently disagree with the code.
 *   - Test 2 is OPT-IN (CHECK_LIVE_CONTRACT=1): it fetches the published OpenAPI
 *     spec and asserts every pinned path is still a documented route — catching
 *     website-side drift without coupling normal CI to deploy timing.
 *
 * TEMPLATE: to add this guard to another sibling (scholar-sidekick-cli,
 * -vscode), copy this file, point CLIENT_SRC at that repo's HTTP client, and set
 * PINNED_ENDPOINTS to the paths it calls. Keep the offline test exact-set so the
 * list stays honest.
 */

// The `/api/*` paths this server's client pins. Keep sorted.
const PINNED_ENDPOINTS = [
  "/api/export",
  "/api/format",
  "/api/oa-check",
  "/api/retraction-check",
  "/api/verify",
].sort();

const CLIENT_SRC = path.join(process.cwd(), "src", "client.ts");
const OPENAPI_URL = "https://scholar-sidekick.com/.well-known/openapi.json";

/** Distinct `/api/...` string literals referenced in the client source. */
function endpointsReferencedInClient(): string[] {
  const src = fs.readFileSync(CLIENT_SRC, "utf8");
  const matches = src.match(/["'`](\/api\/[a-z0-9/-]+)["'`]/g) ?? [];
  const paths = matches.map((m) => m.replace(/["'`]/g, ""));
  return Array.from(new Set(paths)).sort();
}

describe("endpoint contract (client REST paths ⇄ website OpenAPI)", () => {
  it("src/client.ts calls exactly the pinned endpoints (keeps the list honest)", () => {
    expect(endpointsReferencedInClient()).toEqual(PINNED_ENDPOINTS);
  });

  it.skipIf(!process.env.CHECK_LIVE_CONTRACT)(
    "every pinned endpoint is still a documented path in the published OpenAPI spec",
    async () => {
      const res = await fetch(OPENAPI_URL, { signal: AbortSignal.timeout(10_000) });
      expect(res.ok, `fetch returned ${res.status}`).toBe(true);
      const spec = (await res.json()) as { paths: Record<string, unknown> };
      const documented = Object.keys(spec.paths);

      for (const pinned of PINNED_ENDPOINTS) {
        expect(
          documented,
          `${pinned} is pinned by src/client.ts but missing from the published OpenAPI spec — the website may have renamed or removed it`,
        ).toContain(pinned);
      }
    },
  );
});
