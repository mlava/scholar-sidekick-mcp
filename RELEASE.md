# Releasing `scholar-sidekick-mcp`

Releases are **mostly manual**. The one automated step is **npm publish**:
cutting the GitHub Release triggers `.github/workflows/publish.yml`, which
publishes to npm via **trusted publishing** (OIDC — no `NPM_TOKEN` exists) and
attaches a **Sigstore provenance attestation** binding the tarball to the
release commit. `ci.yml` still runs typecheck + tests only.

Every release bumps one version across **six files**, publishes to **npm** and
the **official MCP registry**, and cuts a **GitHub Release** with the two
`.mcpb` bundles attached.

> **Ordering changed when publishing was automated.** npm publish used to run
> from your machine *before* the Release; it is now *caused by* the Release. So
> `mcp-publisher publish` — which validates that the npm version already exists
> — moved to **after** cutting the Release. Do not run `npm publish` by hand:
> the workflow will then fail on the immutable-version error.

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
| `plugin/.claude-plugin/plugin.json` | `version` |

Sanity check that nothing is stale:

```bash
node scripts/check-version-lockstep.mjs
```

This reads all six spots and diffs them against `package.json`, so a spot left
behind on an older version *fails* — which a `git grep` for the new version
cannot do (it only proves the spots you found are updated, never that one was
missed). The publish workflow runs the same check, plus the release tag, before
it will publish.

Why each matters:

- `SERVER_VERSION` is reported in the MCP `initialize` handshake (`serverInfo.version`).
- `CLIENT_VERSION` is the API `User-Agent` / `X-Scholar-Client` header.
- `manifest.json` is the source of truth for the `.mcpb` bundles.
- `server.json` is the official-registry entry. **Its version is immutable once
  published**, so even a metadata-only change (title, icon, description) needs a
  bump — and `packages[0].version` must point at a **real published npm version**.
- `plugin/.claude-plugin/plugin.json` is the Claude Code plugin manifest (this repo
  is also a **plugin marketplace**; `.claude-plugin/marketplace.json` at the root
  points at `./plugin`). **A stale `version` here silently freezes the plugin for
  installed users**: Claude Code pins the plugin to that string and only ships an
  update when it changes. `claude plugin validate .` warns if it is missing, but
  *cannot* tell that it is out of date — the `git grep` check above is the only
  guard. Do not drop this field: omitting it falls back to the git SHA, which fixes
  updates but fails `--strict` validation and shows no version in `/plugin`.

  > **Why the plugin lives in `plugin/`, not at the repo root.** A plugin root
  > containing `package.json` makes Claude Code run `npm install` on it at install
  > time — which pulled this repo's **~94MB of devDependencies** onto every user's
  > machine (the MCP server itself is a *separate* npm package, fetched at runtime
  > via `npx`). `plugin/` has no `package.json`, so the install stays small.
  > The skill is therefore duplicated (`skills/` for `npx skills add` + crawlers,
  > `plugin/skills/` for the plugin); `test/plugin-parity.test.ts` guards the drift.

## 2. Verify

```bash
npm run sync:surface
node scripts/check-version-lockstep.mjs && npm run typecheck && npm run test:ci
```

`sync:surface` regenerates both published descriptions of the server's surface from a live
instance — `tools.json` (what static security scanners read; they can't execute the server or
see `src/`) and the `tools` / `prompts` / `resources` arrays inside `manifest.json` (what ships
in the `.mcpb` bundles). Manifest-only fields — a prompt's `text`, a tool's `outputSchema` — are
preserved. Commit whatever it changes; `test/surface-parity.test.ts` fails the build on drift.

## 3. Build + pack the `.mcpb` bundles

```bash
npm run pack     # build (esbuild → dist/mcp-server.mjs), then scripts/pack.mjs
```

Produces two bundles from `manifest.json` (the committed full-schema manifest is
the source of truth; the slim Claude Desktop variant is derived + `mcpb`-validated):

- `scholar-sidekick-mcp.mcpb` — Claude Desktop (`.mcpb` / DXT)
- `scholar-sidekick-mcp.smithery.mcpb` — Smithery (full MCP schema)

Needs network (pulls `@anthropic-ai/mcpb` via `npx`). These files are build
artifacts — gitignored, never committed; they ship as Release assets in step 4.

## 4. Commit, push, and cut the GitHub Release (this publishes to npm)

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

Publishing the Release fires `.github/workflows/publish.yml`, which re-runs
typecheck + tests + the version-lockstep check (including that the tag matches
`package.json`), then runs `npm publish --provenance`. **Do not `npm publish`
by hand** — npm versions are immutable, so the workflow would then fail.

Watch it and confirm the version actually landed:

```bash
gh run watch "$(gh run list --workflow=publish.yml --limit=1 --json databaseId -q '.[0].databaseId')"
npm view scholar-sidekick-mcp version
```

If the workflow fails *after* the tag exists, fix forward and re-run it from the
Actions tab (`workflow_dispatch`) — do not delete and re-cut the Release.

**Why the `.mcpb` attachment matters:** the website's one-click Claude Desktop
install links to
`github.com/mlava/scholar-sidekick-mcp/releases/latest/download/scholar-sidekick-mcp.mcpb`,
so the newest Release is what that `latest` download resolves to. Ship a Release
without the asset and the one-click install 404s.

Web fallback (no `gh`): <https://github.com/mlava/scholar-sidekick-mcp/releases/new>
→ choose/create tag `vX.Y.Z` → drag both `.mcpb` files in → Publish release.

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

Run this **after step 4's workflow has published to npm** — it validates the npm
version exists. If it reports the version isn't found, wait ~1 min for npm to
propagate, then retry.

## 6. Refresh downstream listings that need a manual nudge

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
# after bumping the version in all six files:
npm run sync:surface         # refresh tools.json + manifest.json; commit any change
node scripts/check-version-lockstep.mjs
npm run typecheck && npm run test:ci
npm run pack
git commit -am "release: vX.Y.Z — <summary>" && git push

# cutting the Release publishes to npm (publish.yml, with provenance)
gh release create vX.Y.Z scholar-sidekick-mcp.mcpb scholar-sidekick-mcp.smithery.mcpb \
  --target main --title "vX.Y.Z — <summary>" --notes "<what changed>"
gh run watch "$(gh run list --workflow=publish.yml --limit=1 --json databaseId -q '.[0].databaseId')"

# only once npm has the new version:
mcp-publisher login github && mcp-publisher publish
# then (manual, browser): click "Refresh Metadata" at
#   https://lobehub.com/mcp/mlavercombe-scholar-sidekick-mcp
```

Verify provenance landed (should print an `attestations` block, not `undefined`):

```bash
npm view scholar-sidekick-mcp dist.attestations
```
