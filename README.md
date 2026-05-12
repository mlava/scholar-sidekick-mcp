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
- **REST API twin** — the same RapidAPI key works against the [Scholar Sidekick REST API](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick) for non-MCP integrations.

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

### Get a RapidAPI key

1. Subscribe to [Scholar Sidekick on RapidAPI](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick) (free tier available)
2. Copy your RapidAPI key

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "scholar-sidekick": {
      "command": "npx",
      "args": ["-y", "scholar-sidekick-mcp@latest"],
      "env": {
        "RAPIDAPI_KEY": "your-rapidapi-key"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add scholar-sidekick \
  -e RAPIDAPI_KEY=your-rapidapi-key \
  -- npx -y scholar-sidekick-mcp@latest
```

### Cursor / VS Code / Windsurf

Add to `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "mcpServers": {
    "scholar-sidekick": {
      "command": "npx",
      "args": ["-y", "scholar-sidekick-mcp@latest"],
      "env": {
        "RAPIDAPI_KEY": "your-rapidapi-key"
      }
    }
  }
}
```

## Environment Variables

| Variable | Required | Description |
| --- | --- | --- |
| `RAPIDAPI_KEY` | Yes | Your RapidAPI subscription key |
| `RAPIDAPI_HOST` | No | RapidAPI host (defaults to `scholar-sidekick.p.rapidapi.com`) |
| `SCHOLAR_SIDEKICK_TIMEOUT_MS` | No | Request timeout in milliseconds (default: 30000) |

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

For programmatic access outside of MCP clients, Scholar Sidekick is also available as a REST API on [RapidAPI](https://rapidapi.com/scholar-sidekick-scholar-sidekick-api/api/scholar-sidekick). Your same RapidAPI key works for both.

## Development

```bash
npm install
npm run build    # Bundle to dist/mcp-server.mjs
npm test         # Run tests
npm run typecheck
```

## License

MIT

[![MCP Badge](https://lobehub.com/badge/mcp/mlavercombe-scholar-sidekick-mcp)](https://lobehub.com/mcp/mlavercombe-scholar-sidekick-mcp)
