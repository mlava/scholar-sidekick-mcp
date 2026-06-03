# Scholar Sidekick MCP Server

[MCP](https://modelcontextprotocol.io) server for [Scholar Sidekick](https://scholar-sidekick.com) — resolve any scholarly identifier (DOI, PMID, PMCID, ISBN, arXiv, ISSN, NASA ADS bibcode, WHO IRIS URL) into 10,000+ CSL styles or nine export formats, plus retraction, open-access, and citation-fabrication-detection checks, from any AI assistant.

## Highlights

- **Eight identifier types out of the box** — DOIs, PMIDs, PMCIDs, ISBNs, arXiv IDs, ISSNs, NASA ADS bibcodes, and WHO IRIS URLs (rare in citation tooling).
- **Batch-friendly resolve / format / export** — each accepts a single identifier or a comma- or newline-separated list; the server normalises the list and resolves them in one round trip.
- **10,000+ citation styles** — five hand-tuned builtins (Vancouver, AMA, APA, IEEE, CSE) plus any [CSL style ID](https://github.com/citation-style-language/styles), with alias and dependent-style resolution.
- **Nine export formats** — BibTeX, RIS, CSL JSON, EndNote (XML/Refer), RefWorks, MEDLINE, Zotero RDF, CSV, plain text.
- **Retraction & open-access checks** — `checkRetraction` surfaces retractions, corrections, and expressions of concern (Crossref / Retraction Watch); `checkOpenAccess` returns OA status and the best legal landing or PDF URL (Unpaywall). Both accept any identifier type and resolve it to a DOI under the hood.
- **Citation-fabrication detection** — `verifyCitation` cross-checks a claimed citation against the resolved record at its identifier, detecting the dominant AI-driven fabrication pattern documented by [Topaz et al. (Lancet 2026)](https://doi.org/10.1016/S0140-6736(26)00603-3) — real DOI + invented title — that simple identifier resolution cannot catch. Long-form explainer at [scholar-sidekick.com/citation-integrity](https://scholar-sidekick.com/citation-integrity).
- **Composable workflow** — chain `resolveIdentifier` → `formatCitation` → `exportCitation` in one prompt for an end-to-end "raw IDs → exportable bibliography" pipeline.
- **Provenance metadata on every response** — formatted output is followed by a metadata block (`requestId`, `formatter`, `styleUsed`, `warnings`) so the assistant can show users *which* engine produced each citation.
- **No key required** — works anonymously against the public Scholar Sidekick API (rate-limited free tier); add a free first-party `ssk_` key for higher limits, or a RapidAPI key for paid/managed tiers.
- **Hosted HTTP endpoint (no install)** — prefer not to run a local stdio server? Connect any HTTP-capable MCP client straight to `https://scholar-sidekick.com/api/mcp` (Streamable HTTP, same 6 tools). See [Hosted HTTP endpoint](#hosted-http-endpoint-no-install).
- **REST API twin** — the same endpoints are available as the [Scholar Sidekick REST API](https://scholar-sidekick.com/docs) for non-MCP integrations.

## Tools

| Tool | Description |
| --- | --- |
| **resolveIdentifier** | Resolve DOIs, PMIDs, PMCIDs, ISBNs, arXiv IDs, ISSNs, ADS bibcodes, and WHO IRIS URLs to structured bibliographic metadata (CSL JSON). Accepts a single identifier or a comma/newline-separated batch. |
| **formatCitation** | Format one or many identifiers into Vancouver, AMA, APA, IEEE, CSE, or any of 10,000+ CSL styles. Output as text, HTML, or JSON. Returns formatted citations plus a provenance metadata block. |
| **exportCitation** | Export one or many identifiers to BibTeX, RIS, CSL JSON, EndNote (XML/Refer), RefWorks, MEDLINE, Zotero RDF, CSV, or plain text — ready to write to disk or hand to a reference manager. |
| **checkRetraction** | Check whether a single work has been retracted, corrected, or had an expression of concern raised. Sourced from Crossref `updated-by` (Retraction Watch). Resolves DOI/PMID/PMCID/arXiv/ADS inputs to a DOI before lookup. One identifier per call. |
| **checkOpenAccess** | Check whether a single work is openly accessible and where to find the best legal version. Sourced from Unpaywall. Returns OA status (gold/green/hybrid/bronze/closed), best landing/PDF URL, license, and version. Resolves DOI/PMID/PMCID/arXiv/ISBN/ADS inputs to a DOI before lookup. One identifier per call. |
| **verifyCitation** | Verify a claimed citation against the resolved record at its identifier. Detects the Topaz et al. (Lancet 2026) fabrication pattern — real DOI + invented title — that `resolveIdentifier` alone cannot catch. Returns one of four verdicts (`matched` / `mismatch` / `ambiguous` / `not_found`) plus per-field similarity scores and the resolved record so the user can see where the cited title and the actual paper diverged. Optional Stage 3 LLM screen rescues informal-abbreviation false positives (paid plans / first-party authentication only). One citation per call. |

## Setup

**No key required.** The server works anonymously against the public Scholar Sidekick API
(`https://scholar-sidekick.com`) at a rate-limited free tier — just install and go. To raise
your limits, create a free first-party `ssk_` key at
[scholar-sidekick.com/account](https://scholar-sidekick.com/account) and set `SCHOLAR_API_KEY`.
For paid/managed tiers, subscribe on
[RapidAPI](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick) and
set `RAPIDAPI_KEY` (which routes calls through the RapidAPI gateway).

> **Prefer zero install?** There's also a **hosted HTTP endpoint** at
> `https://scholar-sidekick.com/api/mcp` (Streamable HTTP) — connect any HTTP-capable MCP
> client directly, no `npx` needed. See [Hosted HTTP endpoint](#hosted-http-endpoint-no-install)
> below. The stdio package documented here is the local-install alternative (and the path for
> RapidAPI-keyed users).

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows). The `env` block is optional — omit it to run anonymously:

```json
{
  "mcpServers": {
    "scholar-sidekick": {
      "command": "npx",
      "args": ["-y", "scholar-sidekick-mcp@latest"],
      "env": {
        "SCHOLAR_API_KEY": "ssk_your-first-party-key"
      }
    }
  }
}
```

### Claude Code

```bash
# Anonymous (no key):
claude mcp add scholar-sidekick -- npx -y scholar-sidekick-mcp@latest

# With a free first-party key for higher limits:
claude mcp add scholar-sidekick \
  -e SCHOLAR_API_KEY=ssk_your-first-party-key \
  -- npx -y scholar-sidekick-mcp@latest
```

### Cursor / VS Code / Windsurf

Add to `.cursor/mcp.json` or `.vscode/mcp.json` (the `env` block is optional):

```json
{
  "mcpServers": {
    "scholar-sidekick": {
      "command": "npx",
      "args": ["-y", "scholar-sidekick-mcp@latest"],
      "env": {
        "SCHOLAR_API_KEY": "ssk_your-first-party-key"
      }
    }
  }
}
```

### Agent skill (optional)

Install a companion [Agent Skill](https://skills.sh) that teaches Claude Code, Cline, and other agents when and how to use these tools — it complements the server config above:

```bash
npx skills add mlava/scholar-sidekick-mcp
```

## Hosted HTTP endpoint (no install)

Don't want to run a local stdio server? Scholar Sidekick is also a **hosted Streamable HTTP
MCP** at `https://scholar-sidekick.com/api/mcp` — the same six tools, no `npx`, no local
process. It works **anonymously** (rate-limited free tier); add an `Authorization: Bearer ssk_…`
header (a free key from [scholar-sidekick.com/account](https://scholar-sidekick.com/account)) for
higher limits.

Point any HTTP-capable MCP client at it:

```json
{
  "mcpServers": {
    "scholar-sidekick": {
      "type": "http",
      "url": "https://scholar-sidekick.com/api/mcp"
    }
  }
}
```

In Claude Desktop, use **Settings → Connectors → Add custom connector** (or "Add HTTP server")
and paste the URL. Add the bearer token in the client's header/auth field if you have one.

Discovery: [`/.well-known/mcp.json`](https://scholar-sidekick.com/.well-known/mcp.json)
(SEP-1649 server card) lists this endpoint plus the no-auth ChatGPT Apps endpoint at
`/api/apps/mcp`. The stdio package above remains the local-install alternative and the path for
RapidAPI-keyed users.

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `SCHOLAR_API_KEY` | No | Free first-party `ssk_` key from [scholar-sidekick.com/account](https://scholar-sidekick.com/account); raises rate limits and enables the verifier's LLM screen. Sent as `Authorization: Bearer`. |
| `RAPIDAPI_KEY` | No | RapidAPI subscription key for paid/managed tiers; when set, calls route through the RapidAPI gateway. |
| `RAPIDAPI_HOST` | No | RapidAPI host (defaults to `scholar-sidekick.p.rapidapi.com`) |
| `SCHOLAR_SIDEKICK_URL` | No | Override the API base URL (defaults to `https://scholar-sidekick.com`, or the RapidAPI gateway when `RAPIDAPI_KEY` is set). |
| `SCHOLAR_SIDEKICK_TIMEOUT_MS` | No | Request timeout in milliseconds (default: 30000) |

No key at all → anonymous, rate-limited free tier. With both `SCHOLAR_API_KEY` and `RAPIDAPI_KEY` set, RapidAPI takes precedence.

## Supported Citation Styles

Scholar Sidekick supports **10,000+ CSL styles**, including all major formats used in academic publishing:

| Style | Keyword |
| --- | --- |
| Vancouver | `vancouver` |
| APA (7th ed.) | `apa` |
| AMA | `ama` |
| IEEE | `ieee` |
| CSE | `cse` |
| Chicago (author-date) | `chicago-author-date` |
| Harvard | `harvard-cite-them-right` |
| MLA | `modern-language-association` |
| Turabian | `turabian-fullnote-bibliography` |
| Nature | `nature` |
| BMJ | `bmj` |
| Lancet | `the-lancet` |

Any [CSL style ID](https://github.com/citation-style-language/styles) can be passed as the `style` parameter.

## Example Usage

Once connected, ask your AI assistant:

**Single identifier**

- "Format 10.1056/NEJMoa2033700 in Vancouver style"
- "Resolve PMID:30049270 and export as BibTeX"
- "Give me a Chicago citation for arXiv:2301.08745"

**Batch input** (comma- or newline-separated — every tool handles it)

- "Format these as APA: 10.1056/NEJMoa2033700, PMID:30049270, ISBN:9780192854087"
- "Resolve all of these and tell me which are journal articles vs books: 10.1056/NEJMoa2033700, ISBN:9780192854087, PMC7793608"

**End-to-end workflow** (the assistant chains `resolveIdentifier` → `formatCitation` → `exportCitation` in one prompt)

- "Resolve these three identifiers, format each in AMA, and export the set as BibTeX: 10.1056/NEJMoa2033700, PMID:30049270, ISBN:9780192854087"
- "Build me a Nature-style bibliography from this list and give me a `.bib` file at the end: PMID:30049270, arXiv:2301.08745, 10.1038/s41586-021-03819-2"

**Retraction & open-access checks** (one identifier per call)

- "Has 10.1016/S0140-6736(20)31180-6 been retracted?" → returns `isRetracted: true` with the retraction notice and date
- "Is the NumPy paper (10.1038/s41586-020-2649-2) open access? Where can I read it for free?" → returns OA status plus the best legal PDF URL with license and version
- "Check whether arXiv:2301.08745 has any corrections or expressions of concern." → resolves arXiv → DOI, then queries Retraction Watch

## Supported Identifiers

- DOIs (e.g. `10.1056/NEJMoa2033700`)
- PubMed IDs (e.g. `PMID:30049270`)
- PubMed Central IDs (e.g. `PMC7793608`)
- ISBNs (e.g. `ISBN:9780192854087`)
- arXiv IDs (e.g. `2301.08745`)
- ISSNs and eISSNs
- NASA ADS bibcodes
- WHO IRIS URLs

## Provenance & Determinism

Every `formatCitation` and `exportCitation` response is followed by a metadata block so the assistant — and the user — can see exactly which engine produced each citation:

- `formatter` — `builtin` (one of Vancouver, AMA, APA, IEEE, CSE — hand-tuned in TypeScript) or `csl` (citeproc-js with a CSL stylesheet).
- `styleUsed` — the canonical style ID after alias and dependent-style resolution (e.g. asking for `harvard` resolves to `harvard-cite-them-right`).
- `requestId` — for support, reproducibility, and log correlation.
- `warnings` — populated when a fallback was used or the requested style was a dependent of another.

Identifier resolution is deterministic given the same inputs and pinned upstream metadata. Repeated identical requests are cache-hit on the underlying REST API and surface that via the `x-scholar-cache` header.

## REST API

For programmatic access outside of MCP clients, the same capabilities are available as a REST API at [scholar-sidekick.com](https://scholar-sidekick.com/docs) — anonymously, with a free first-party `ssk_` key (`Authorization: Bearer`), or via [RapidAPI](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick) for paid tiers. Whichever credential you use here works there too.

## Development

```bash
npm install
npm run build    # Bundle to dist/mcp-server.mjs
npm test         # Run tests
npm run typecheck
```

## License

MIT

[![MCP Badge](https://lobehub.com/badge/mcp/mlavercombe-scholar-sidekick-mcp?style=flat)](https://lobehub.com/mcp/mlavercombe-scholar-sidekick-mcp)
