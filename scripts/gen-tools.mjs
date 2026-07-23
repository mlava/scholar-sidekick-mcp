// Regenerates tools.json — the machine-readable tool surface, taken verbatim from a live
// server instance (`tools/list`), never hand-written.
//
// Why this file exists: static security scanners (Canopii Trust Index, procurement review,
// agent allow-lists) extract a server's tools to check them for hidden instructions, schema
// strictness, and destructive scope. They cannot see ours — src/ is npmignored, the published
// tarball holds one esbuild bundle, and manifest.json is an MCPB-specific format generic
// scanners don't parse. Every tool-level check came back "no tools extracted".
//
// tools.json is the fix: the exact tools/list payload, committed at the repo root and shipped
// in the npm tarball, parseable without executing our code.
//
// Run: npm run gen:tools   (drift is guarded by test/tools-json-parity.test.ts)

import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { build } from "esbuild";

const ROOT = process.cwd();
const OUT = join(ROOT, "tools.json");
// src/ is TypeScript, so bundle it the way the shipped server is built, then import.
const TEMP_BUNDLE = join(ROOT, "dist", ".gen-tools-server.mjs");

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: TEMP_BUNDLE,
});

let tools;
try {
  const { createMcpServer } = await import(pathToFileURL(TEMP_BUNDLE).href);
  // Config is inert here: listing tools never calls the API.
  const server = createMcpServer({ baseUrl: "https://scholar-sidekick.com", timeoutMs: 1000 });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "gen-tools", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  ({ tools } = await client.listTools());
  await client.close();
} finally {
  await rm(TEMP_BUNDLE, { force: true });
  await rm(`${TEMP_BUNDLE}.map`, { force: true });
}

await writeFile(OUT, JSON.stringify(tools, null, 2) + "\n");
process.stdout.write(`Wrote tools.json (${tools.length} tools)\n`);
