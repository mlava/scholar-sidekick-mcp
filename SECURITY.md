# Security Policy

## Reporting a vulnerability

Please report privately — do not open a public issue.

1. **Preferred:** [open a private security advisory](https://github.com/mlava/scholar-sidekick-mcp/security/advisories/new) on this repository.
2. **Or email:** mark@scholar-sidekick.com with `SECURITY` in the subject line.

Helpful to include: the affected version, what an attacker gains, and the smallest
reproduction you have (an MCP client config, a tool call, or a curl command is ideal).

This project has a single maintainer, so expect a human timeline: acknowledgement within
**3 business days**, an assessment within **10 business days**, and a fix released as soon
as one is ready — critical issues first. You will be credited in the release notes unless
you prefer otherwise. Please give us a chance to ship a fix before disclosing publicly.

## Supported versions

| Version | Supported |
| --- | --- |
| 0.8.x | ✅ Fixes released here |
| < 0.8 | ❌ Upgrade — `npx scholar-sidekick-mcp@latest` |

Only the latest published minor receives security fixes. There are no long-term support
branches; the server is a thin client over the Scholar Sidekick REST API, so upgrading is
a version bump with no migration.

## Scope

**In scope**

- This npm package (`scholar-sidekick-mcp`) and the published `dist/mcp-server.mjs` bundle
- The MCP server surface: tool, prompt, and resource definitions
- The hosted Scholar Sidekick REST API (`https://scholar-sidekick.com`) and the hosted MCP
  endpoint (`https://scholar-sidekick.com/api/mcp`) — report those here too

**Out of scope**

- Vulnerabilities in upstream data sources (Crossref, PubMed, arXiv, Unpaywall, Open Library,
  NASA ADS) — report those to their maintainers
- Bibliographic data that is wrong or incomplete — that is a correctness bug, not a
  vulnerability; open a normal issue
- Rate limiting, volumetric denial of service, or automated scanning of the hosted API
- Findings that require a compromised host or a malicious local user who already has the
  ability to run arbitrary code

Please do not run destructive or high-volume tests against the hosted API. If you need
headroom to test something, ask first.

## Security properties

Useful context if you are reviewing this server before enabling it:

- **All seven tools are read-only** (`readOnlyHint: true`, `destructiveHint: false`) — they
  issue HTTPS GET/POST calls to the Scholar Sidekick API and return the result. Nothing writes
  to disk, spawns a shell, evaluates strings, or mutates state.
- **One outbound host.** Requests go only to the configured base URL (default
  `https://scholar-sidekick.com`, overridable via `SCHOLAR_SIDEKICK_URL`) or, when
  `RAPIDAPI_KEY` is set, the RapidAPI gateway. Tool inputs are identifiers and citation
  metadata, never URLs to fetch.
- **No credentials required.** The server runs anonymously by default. Optional keys
  (`SCHOLAR_API_KEY`, `RAPIDAPI_KEY`) are read from the environment only — never from tool
  arguments, and never written to disk or logged.
- **Published with provenance.** Releases go to npm from GitHub Actions via OIDC trusted
  publishing with a build attestation (since v0.8.4), so the tarball is verifiably built from
  this repository. There is no long-lived npm token to steal.
- **Machine-readable tool surface.** [`tools.json`](tools.json) is the exact `tools/list`
  payload — names, descriptions, JSON Schemas, and annotations — generated from a live server
  instance and drift-guarded by a test. Review it without executing anything.
- **Sandboxed run available.** See [Run in a container](README.md#run-in-a-container-sandboxed)
  if you would rather the server not have host access.
