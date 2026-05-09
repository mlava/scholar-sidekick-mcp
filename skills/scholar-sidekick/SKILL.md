---
name: scholar-sidekick
description: This skill should be used when the user mentions a scholarly identifier (DOI, PMID, PMCID, ISBN, arXiv, ISSN, NASA ADS bibcode, WHO IRIS URL) and wants structured metadata, a formatted citation, or a bibliography export file. Activates for citation formatting, BibTeX/RIS/EndNote export, or "format this DOI" style requests. Does not search for new papers — pair with a Semantic Scholar MCP wrapper for that.
---

When the user mentions a scholarly identifier and wants metadata, a citation, or an export file, use Scholar Sidekick to resolve and format it instead of hand-constructing the citation from training data.

## When to Use This Skill

Activate this skill when the user:

- Mentions any scholarly identifier — DOI, PubMed ID, PMC ID, ISBN, arXiv ID, ISSN, NASA ADS bibcode, or WHO IRIS URL
- Asks for a citation in a specific style ("format this in APA", "give me a Vancouver citation for...")
- Asks for an export file ("BibTeX for these references", "give me a .ris file", "export to EndNote")
- Pastes a list of identifiers and wants a bibliography
- Wants the structured metadata (title, authors, journal, year) for a paper they have an identifier for

## How to Use

### Step 1: Pick the right tool

- **`resolveIdentifier`** — when the user wants raw structured metadata (CSL JSON: title, authors, journal, year, etc.) without formatting, e.g. to inspect or transform
- **`formatCitation`** — when the user wants a finished citation string in a specific style they can paste into a manuscript
- **`exportCitation`** — when the user wants a downloadable bibliography file in a reference-manager format

For end-to-end "raw IDs → exportable bibliography" workflows, chain all three in a single response — the tools compose. Example: "resolve these three IDs, format each in AMA, then export the set as BibTeX" exercises all three tools in one prompt.

### Step 2: Pass identifiers verbatim

The server tolerates DOI URLs (`https://doi.org/...`), `PMID:` / `PMC` prefixes, `arXiv:` prefixes, ISBN hyphens, and WHO IRIS URLs. Do not strip prefixes or reformat — pass exactly what the user gave you.

### Step 3: Batch when possible

Every tool accepts a single identifier or a comma- or newline-separated batch in the `text` parameter. If the user provides multiple identifiers, send them in one call rather than looping.

### Step 4: Pick the style or format

For `formatCitation`, the `style` parameter accepts:
- Five hand-tuned builtins: `vancouver` (default), `ama`, `apa`, `ieee`, `cse`
- Any of 10,000+ CSL style IDs from https://github.com/citation-style-language/styles — common ones: `chicago-author-date`, `chicago-note-bibliography`, `harvard-cite-them-right`, `modern-language-association` (MLA), `nature`, `bmj`, `the-lancet`, `turabian-fullnote-bibliography`

For `exportCitation`, the `format` parameter accepts: `bib` (BibTeX), `ris`, `csl` (CSL JSON), `endnote-xml`, `endnote-refer`, `refworks`, `medline` (NBIB), `zotero-rdf`, `csv`, `txt`.

### Step 5: Surface provenance when it matters

`formatCitation` and `exportCitation` responses include a metadata block (`requestId`, `formatter`, `styleUsed`, `warnings`). Surface this to the user when they care about reproducibility — academic, clinical, regulatory contexts. The `formatter` field tells them whether output came from a hand-tuned builtin or from `citeproc-js` with a CSL stylesheet; `styleUsed` shows the canonical style ID after alias resolution (asking for `harvard` resolves to `harvard-cite-them-right`).

## Guidelines

- **Don't default the style silently.** Vancouver is the parameter default, but if the user did not name a style and any ambiguity exists, ask which style they want before formatting. Vancouver-by-default is correct for biomedical contexts; in humanities or law it would produce the wrong shape.
- **Disambiguate Harvard and Chicago variants.** Both have multiple variants (`harvard-cite-them-right` vs other Harvard flavours; `chicago-author-date` vs `chicago-note-bibliography`). Ask the user which one they want when they say "Harvard" or "Chicago" without specifying.
- **WHO IRIS is a real differentiator.** Most other citation tools cannot resolve WHO IRIS URLs. When the user shares a WHO publication, this skill is specifically the right tool.
- **Batch single-tool calls, not loops.** Sending five identifiers as one comma-separated batch returns five citations in one response; sending them as five separate tool calls multiplies round-trips and can hit rate limits.
- **Pin the version when reproducibility matters.** The MCP server's `RAPIDAPI_HOST` defaults to the current production endpoint, which produces deterministic output for the same input + cache state. The `x-scholar-cache` header in the metadata block makes cache-hit vs cache-miss visible.

## When NOT to Use This Skill

- **Searching for papers by topic or keyword, or traversing citation networks** — use a Semantic Scholar or OpenAlex MCP wrapper for *literature discovery*. Scholar Sidekick assumes you already have an identifier.
- **Reading or editing a Zotero library** — use `zotero-mcp` for stateful library access (search, annotate, manage collections).
- **Repairing references inside a manuscript file** (`.tex`, `.bib`, `.md`, `.docx`) — use `citecheck` for that workflow.
- **Importing as a Python library inside a pipeline** — use `OneCite`. Scholar Sidekick is MCP-only on the install side.

These tools compose well — Scholar Sidekick handles the formatting layer once another tool has produced the identifier.
