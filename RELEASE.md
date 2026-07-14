# Releasing `scholar-sidekick-mcp`

Releases are **manual** — CI (`.github/workflows/ci.yml`) runs typecheck + tests
only, no publish automation. Every release bumps one version across **six
files**, publishes to **npm** and the **official MCP registry**, and cuts a
**GitHub Release** with the two `.mcpb` bundles attached.

Replace `X.Y.Z` below with the new version (e.g. `0.8.1`) and `vX.Y.Z` with the
tag (e.g. `v0.8.1`). Tag convention is `vX.Y.Z`.

---

## 1. Bump the version in all six files

The version lives in six places — they must stay identical:

| File | Field |
|---|---|
| `package.json` | `version` |
| `server.json` | top-level `version` **and** `packages[0].version` |
| `manifest.json` | `version` |
| `src/server.ts` | `SERVER_VERSION` |
| `src/client.ts` | `CLIENT_VERSION` |
| `.claude-plugin/plugin.json` | `version` |

Sanity check that nothing is stale (should list all six, nothing older):

```bash
git grep -n "X\.Y\.Z" -- . ':(exclude)package-lock.json'
```

Why each matters:

- `SERVER_VERSION` is reported in the MCP `initialize` handshake (`serverInfo.version`).
- `CLIENT_VERSION` is the API `User-Agent` / `X-Scholar-Client` header.
- `manifest.json` is the source of truth for the `.mcpb` bundles.
- `server.json` is the official-registry entry. **Its version is immutable once
  published**, so even a metadata-only change (title, icon, description) needs a
  bump — and `packages[0].version` must point at a **real published npm version**.
- `.claude-plugin/plugin.json` is the Claude Code plugin manifest (this repo is
  also a **plugin marketplace** — see below). **A stale `version` here silently
  freezes the plugin for installed users**: Claude Code pins the plugin to that
  string and only ships an update when it changes. `claude plugin validate .`
  warns if it is missing, but *cannot* tell that it is out of date — the
  `git grep` check above is the only guard. Do not drop this field: omitting it
  falls back to the git SHA, which fixes updates but fails `--strict` validation
  and shows no version in the `/plugin` UI.

## 2. Verify

```bash
npm run typecheck && npm run test:ci
```

## 3. Build + pack the `.mcpb` bundles

```bash
npm run pack     # build (esbuild → dist/mcp-server.mjs), then scripts/pack.mjs
```

Produces two bundles from `manifest.json` (the committed full-schema manifest is
the source of truth; the slim Claude Desktop variant is derived + `mcpb`-validated):

- `scholar-sidekick-mcp.mcpb` — Claude Desktop (`.mcpb` / DXT)
- `scholar-sidekick-mcp.smithery.mcpb` — Smithery (full MCP schema)

Needs network (pulls `@anthropic-ai/mcpb` via `npx`). These files are build
artifacts — gitignored, never committed; they ship as Release assets in step 6.

## 4. Publish to npm

```bash
npm publish      # prepublishOnly rebuilds; ships the `mcpName` ownership field
```

## 5. Publish to the official MCP registry — the **non-GitHub** registry

> **Naming trap:** `mcp-publisher` targets **`registry.modelcontextprotocol.io`**
> (the canonical MCP registry). The `login github` part is only the **auth
> method** — GitHub OAuth proving you own the `io.github.mlava/*` namespace — it
> is **not** the GitHub registry. The **GitHub MCP Registry** (`github.com/mcp`)
> and the **VS Code `@mcp` gallery** are downstream: they mirror this one.

```bash
mcp-publisher login github
mcp-publisher publish        # reads server.json; validates npm X.Y.Z exists + mcpName matches
```

Run this **after** `npm publish` — it validates the npm version exists. If it
reports the version isn't found, wait ~1 min for npm to propagate, then retry.

## 6. Commit, push, and cut the GitHub Release (with the `.mcpb` assets)

```bash
git commit -am "release: vX.Y.Z — <summary>"
git push

# creates the tag + release AND uploads both .mcpb assets in one step
gh release create vX.Y.Z \
  scholar-sidekick-mcp.mcpb scholar-sidekick-mcp.smithery.mcpb \
  --target main \
  --title "vX.Y.Z — <summary>" \
  --notes "<what changed>"
```

**Why the `.mcpb` attachment matters:** the website's one-click Claude Desktop
install links to
`github.com/mlava/scholar-sidekick-mcp/releases/latest/download/scholar-sidekick-mcp.mcpb`,
so the newest Release is what that `latest` download resolves to. Ship a Release
without the asset and the one-click install 404s.

Web fallback (no `gh`): <https://github.com/mlava/scholar-sidekick-mcp/releases/new>
→ choose/create tag `vX.Y.Z` → drag both `.mcpb` files in → Publish release.

## 7. Refresh downstream listings that need a manual nudge

Most registries re-sync on their own (see Propagation below), but **LobeHub
caches its metadata and will not pick up the new version/card until you refresh
it by hand**:

- Open <https://lobehub.com/mcp/mlavercombe-scholar-sidekick-mcp> and click the
  **Refresh Metadata** button.

---

## Propagation (automatic, with lag — nothing to run)

- **Official MCP registry → GitHub MCP Registry** (`github.com/mcp`) mirror →
  **VS Code `@mcp` gallery** card. (The *first-time* listing needed a manual
  `partnerships@github.com` request; ongoing version/metadata updates flow via
  the mirror.)
- **Glama** re-scans the repo (`glama.json`).
- **Smithery** consumes the `.smithery.mcpb` bundle.

Verify the registry/gallery card a day or two later.

## Quick reference — the whole run

```bash
# after bumping the 5 version fields:
npm run typecheck && npm run test:ci
npm run pack
npm publish
mcp-publisher login github && mcp-publisher publish
git commit -am "release: vX.Y.Z — <summary>" && git push
gh release create vX.Y.Z scholar-sidekick-mcp.mcpb scholar-sidekick-mcp.smithery.mcpb \
  --target main --title "vX.Y.Z — <summary>" --notes "<what changed>"
# then (manual, browser): click "Refresh Metadata" at
#   https://lobehub.com/mcp/mlavercombe-scholar-sidekick-mcp
```
