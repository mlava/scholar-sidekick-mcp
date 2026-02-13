# Scholar Sidekick MCP Server

[MCP](https://modelcontextprotocol.io) server for [Scholar Sidekick](https://scholar-sidekick.com) — resolve, format, and export academic citations from any AI assistant.

## Tools

| Tool | Description |
|------|-------------|
| **resolveIdentifier** | Resolve DOIs, PMIDs, PMCIDs, ISBNs, arXiv IDs, ISSNs, ADS bibcodes to structured bibliographic metadata |
| **formatCitation** | Format identifiers into Vancouver, AMA, APA, IEEE, CSE, or 10,000+ CSL styles. Output as text, HTML, or JSON |
| **exportCitation** | Export to BibTeX, RIS, CSL JSON, EndNote (XML/Refer), RefWorks, MEDLINE, Zotero RDF, CSV, or plain text |

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
|----------|----------|-------------|
| `RAPIDAPI_KEY` | Yes | Your RapidAPI subscription key |
| `RAPIDAPI_HOST` | No | RapidAPI host (defaults to `scholar-sidekick.p.rapidapi.com`) |
| `SCHOLAR_SIDEKICK_TIMEOUT_MS` | No | Request timeout in milliseconds (default: 30000) |

## Example Usage

Once connected, ask your AI assistant:

- "Format 10.1056/NEJMoa2033700 in Vancouver style"
- "Resolve PMID:30049270 and export as BibTeX"
- "Format these as APA: 10.1056/NEJMoa2033700, PMID:30049270, ISBN:9780192854087"

## Supported Identifiers

- DOIs (e.g. `10.1056/NEJMoa2033700`)
- PubMed IDs (e.g. `PMID:30049270`)
- PubMed Central IDs (e.g. `PMC7793608`)
- ISBNs (e.g. `ISBN:9780192854087`)
- arXiv IDs (e.g. `2301.08745`)
- ISSNs and eISSNs
- NASA ADS bibcodes
- WHO IRIS URLs

## Development

```bash
npm install
npm run build    # Bundle to dist/mcp-server.mjs
npm test         # Run tests
npm run typecheck
```

## License

MIT
