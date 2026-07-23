#!/usr/bin/env node
/**
 * Guards the six-file version lockstep documented in RELEASE.md step 1.
 *
 * `package.json` is the reference; every other spot must match it exactly.
 * Optionally also asserts a release tag (`v<version>`) agrees — the publish
 * workflow passes `--expect-tag` so a mistagged release fails before it can
 * reach npm, where a wrong version is immutable.
 *
 * Usage:
 *   node scripts/check-version-lockstep.mjs
 *   node scripts/check-version-lockstep.mjs --expect-tag=v0.8.4
 *
 * Replaces the manual `git grep` sanity check: a grep proves the strings you
 * searched for are present, not that a spot was left behind on an older
 * version — which is exactly how `plugin/.claude-plugin/plugin.json` silently
 * froze the Claude Code plugin at a stale version.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel) => readFileSync(resolve(root, rel), "utf8");
const json = (rel) => JSON.parse(read(rel));

/** Pull `export const NAME = "x.y.z";` out of a TS source file. */
function tsConst(rel, name) {
  const match = read(rel).match(
    new RegExp(`export const ${name}\\s*=\\s*["']([^"']+)["']`),
  );
  return match?.[1];
}

const expected = json("package.json").version;

const spots = [
  ["package.json", "version", expected],
  ["server.json", "version", json("server.json").version],
  ["server.json", "packages[0].version", json("server.json").packages?.[0]?.version],
  ["manifest.json", "version", json("manifest.json").version],
  ["src/server.ts", "SERVER_VERSION", tsConst("src/server.ts", "SERVER_VERSION")],
  ["src/client.ts", "CLIENT_VERSION", tsConst("src/client.ts", "CLIENT_VERSION")],
  [
    "plugin/.claude-plugin/plugin.json",
    "version",
    json("plugin/.claude-plugin/plugin.json").version,
  ],
];

const drifted = spots.filter(([, , found]) => found !== expected);

for (const [file, field, found] of spots) {
  const ok = found === expected;
  console.log(`${ok ? "ok  " : "FAIL"}  ${found ?? "<missing>"}  ${file} (${field})`);
}

const expectTag = process.argv
  .find((a) => a.startsWith("--expect-tag="))
  ?.slice("--expect-tag=".length);

let tagMismatch = false;
if (expectTag) {
  tagMismatch = expectTag !== `v${expected}`;
  console.log(
    `${tagMismatch ? "FAIL" : "ok  "}  ${expectTag}  release tag (expected v${expected})`,
  );
}

if (drifted.length || tagMismatch) {
  console.error(
    `\nVersion lockstep broken — expected ${expected} everywhere.` +
      (drifted.length
        ? `\nStale: ${drifted.map(([f, field]) => `${f} (${field})`).join(", ")}`
        : "") +
      (tagMismatch ? `\nTag ${expectTag} does not match package.json ${expected}.` : "") +
      `\n\nSee RELEASE.md step 1.`,
  );
  process.exit(1);
}

console.log(`\nAll ${spots.length} version spots agree on ${expected}.`);
