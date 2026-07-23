// Regenerates every published description of this server's surface from the one place that
// cannot lie: a live server instance. Nothing here is hand-written.
//
//   tools.json     — the exact tools/list payload, committed at the repo root and shipped in
//                    the npm tarball.
//   manifest.json  — the .mcpb bundles' source of truth. Its tools / prompts / resources
//                    arrays are refreshed in place; every manifest-only field (a prompt's
//                    `text`, versions, config) is preserved.
//
// Why: static security scanners, procurement reviews, and agent allow-lists read a server's
// tools without executing it. Ours were invisible — src/ is npmignored, the published tarball
// is a single esbuild bundle, and manifest.json is an MCPB-specific format generic scanners
// don't parse — so every tool-level control scored "no tools extracted". manifest.json had
// also drifted: its tool and prompt copy was an older, abridged edition of the live prose,
// and it ships to Smithery that way.
//
// Run: npm run sync:surface   (drift is guarded by test/surface-parity.test.ts)

import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { build } from "esbuild";

const ROOT = process.cwd();
const TOOLS_OUT = join(ROOT, "tools.json");
const MANIFEST = join(ROOT, "manifest.json");
// src/ is TypeScript, so bundle it the way the shipped server is built, then import.
const TEMP_BUNDLE = join(ROOT, "dist", ".sync-surface-server.mjs");

/**
 * Rebuild a manifest array from the live listing: live order, live values, and every
 * manifest-only field on the matching entry preserved (a prompt's `text`, say).
 */
function align(existing, live, key, project) {
  const byKey = new Map(existing.map((entry) => [entry[key], entry]));
  return live.map((liveEntry) => ({ ...(byKey.get(liveEntry[key]) ?? {}), ...project(liveEntry) }));
}

await build({
  entryPoints: ["src/server.ts"],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: TEMP_BUNDLE,
});

let tools;
let prompts;
let resources;
try {
  const { createMcpServer } = await import(pathToFileURL(TEMP_BUNDLE).href);
  // Config is inert here: listing never calls the API.
  const server = createMcpServer({ baseUrl: "https://scholar-sidekick.com", timeoutMs: 1000 });

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "sync-surface", version: "0.0.0" });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);

  ({ tools } = await client.listTools());
  ({ prompts } = await client.listPrompts());
  ({ resources } = await client.listResources());
  await client.close();
} finally {
  await rm(TEMP_BUNDLE, { force: true });
  await rm(`${TEMP_BUNDLE}.map`, { force: true });
}

await writeFile(TOOLS_OUT, JSON.stringify(tools, null, 2) + "\n");

const manifest = JSON.parse(await readFile(MANIFEST, "utf8"));

// The manifest carries no $schema inside inputSchema and none of the SDK's transport-level
// tool metadata (`execution`) — both are noise in an MCPB bundle, which two validators read.
manifest.tools = align(manifest.tools ?? [], tools, "name", (tool) => {
  const { $schema: _schema, ...inputSchema } = tool.inputSchema;
  return {
    name: tool.name,
    title: tool.title,
    description: tool.description,
    inputSchema,
    annotations: tool.annotations,
  };
});

// A prompt's `text` is manifest-only (the body clients show); the spread in align() keeps it.
manifest.prompts = align(manifest.prompts ?? [], prompts, "name", (prompt) => ({
  name: prompt.name,
  description: prompt.description,
  arguments: (prompt.arguments ?? []).map((argument) => ({
    name: argument.name,
    description: argument.description,
    required: argument.required ?? false,
  })),
}));

manifest.resources = align(manifest.resources ?? [], resources, "uri", (resource) => ({
  name: resource.name,
  uri: resource.uri,
  title: resource.title,
  description: resource.description,
  mimeType: resource.mimeType,
}));

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + "\n");

process.stdout.write(
  `Wrote tools.json (${tools.length} tools) and synced manifest.json ` +
    `(${manifest.tools.length} tools, ${manifest.prompts.length} prompts, ${manifest.resources.length} resources)\n`,
);
