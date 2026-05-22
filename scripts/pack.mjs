// Builds two .mcpb bundles from a single source-of-truth manifest.json (full MCP schema):
//   1. scholar-sidekick-mcp.mcpb          — Claude Desktop (DXT display schema: slim manifest)
//   2. scholar-sidekick-mcp.smithery.mcpb — Smithery registry (full MCP schema manifest)
//
// Why two bundles? The two validators want incompatible manifest shapes:
//   - Claude Desktop's `mcpb` validator REQUIRES the slim form — tools as {name, description}
//     only, prompt arguments as string[], no `resources` (it rejects inputSchema/title/etc.).
//   - Smithery's registry validator REQUIRES the full form — tools with `inputSchema` objects
//     and prompt arguments as objects ({name, description, required}).
//
// manifest.json (committed) is the full form = source of truth. The slim variant is derived
// here, never committed. The Claude Desktop bundle is gated by `mcpb validate` so a bad slim
// transform fails loudly instead of shipping an uninstallable bundle.

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const CD_OUT = join(ROOT, "scholar-sidekick-mcp.mcpb");
const SMITHERY_OUT = join(ROOT, "scholar-sidekick-mcp.smithery.mcpb");
const MCPB = ["--yes", "@anthropic-ai/mcpb@latest"];

// Explicit allowlist of bundle payload (manifest.json is written per-target below).
// An allowlist is safer than relying on .mcpbignore — a past bug swept internal docs into
// the public bundle when an ignore entry was missing.
const PAYLOAD = [
  "LICENSE",
  "README.md",
  "dist/mcp-server.mjs",
  "icon.png",
  "package.json",
  "server.json",
  "skills/scholar-sidekick/SKILL.md",
];

/** full MCP manifest -> Claude Desktop / DXT display-only manifest */
function toSlim(manifest) {
  const out = JSON.parse(JSON.stringify(manifest));
  if (Array.isArray(out.tools)) {
    out.tools = out.tools.map((t) => ({ name: t.name, description: t.description }));
  }
  if (Array.isArray(out.prompts)) {
    out.prompts = out.prompts.map((p) => {
      const slim = { name: p.name, description: p.description };
      if (Array.isArray(p.arguments)) {
        slim.arguments = p.arguments.map((a) => (typeof a === "string" ? a : a.name));
      }
      if (p.text !== undefined) slim.text = p.text;
      return slim;
    });
  }
  delete out.resources;
  delete out.resources_generated;
  return out;
}

/** Copy PAYLOAD + the given manifest into a fresh temp dir; return its path. */
async function stage(manifest) {
  const dir = await mkdtemp(join(tmpdir(), "ssmcp-pack-"));
  for (const rel of PAYLOAD) {
    const dest = join(dir, rel);
    await mkdir(dirname(dest), { recursive: true });
    await cp(join(ROOT, rel), dest);
  }
  await writeFile(join(dir, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
  return dir;
}

async function main() {
  if (!existsSync(join(ROOT, "dist/mcp-server.mjs"))) {
    console.error("dist/mcp-server.mjs missing — run `npm run build` first.");
    process.exit(1);
  }
  const full = JSON.parse(await readFile(join(ROOT, "manifest.json"), "utf8"));

  // 1. Claude Desktop bundle — slim manifest, validated then packed by mcpb.
  const cdDir = await stage(toSlim(full));
  console.log("Validating Claude Desktop (slim) manifest…");
  execFileSync("npx", [...MCPB, "validate", join(cdDir, "manifest.json")], { stdio: "inherit" });
  if (existsSync(CD_OUT)) await rm(CD_OUT);
  execFileSync("npx", [...MCPB, "pack", cdDir, CD_OUT], { stdio: "inherit" });
  await rm(cdDir, { recursive: true, force: true });
  console.log(`Wrote ${CD_OUT}`);

  // 2. Smithery bundle — full manifest. mcpb pack would reject it, so zip the staged dir.
  const smDir = await stage(full);
  if (existsSync(SMITHERY_OUT)) await rm(SMITHERY_OUT);
  // -D: omit directory entries so the file list matches the mcpb-packed bundle exactly.
  execFileSync("zip", ["-r", "-q", "-X", "-D", SMITHERY_OUT, "."], { cwd: smDir, stdio: "inherit" });
  await rm(smDir, { recursive: true, force: true });
  console.log(`Wrote ${SMITHERY_OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
