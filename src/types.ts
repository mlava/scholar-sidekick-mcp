import { z } from "zod";

/* ─── MCP tool input schemas ──────────────────────────────────────────── */

const BATCH_TEXT_DESCRIPTION =
  "One or more scholarly identifiers to process — DOI (with or without https://doi.org/), " +
  "PMID (with or without 'PMID:' prefix), PMCID (e.g. PMC7793608), ISBN (10 or 13 digit, hyphens " +
  "tolerated), arXiv ID (with or without 'arXiv:' prefix; old-style hep-ph/0501023 also accepted), " +
  "ISSN, NASA ADS bibcode (19 chars), or WHO IRIS URL. Pass identifiers verbatim — do not strip " +
  "prefixes. Multiple identifiers may be separated by newlines or commas; mixed types in one batch " +
  "are supported and resolved in a single round trip.";

export const FormatCitationInput = {
  text: z.string().describe(BATCH_TEXT_DESCRIPTION),
  style: z
    .string()
    .optional()
    .describe(
      "Citation style: 'vancouver' (default), 'ama', 'apa', 'ieee', 'cse', or any of 10,000+ CSL " +
        "style IDs from citation-style-language/styles (e.g. 'chicago-author-date', " +
        "'harvard-cite-them-right', 'modern-language-association', 'nature', 'bmj', 'the-lancet'). " +
        "Aliases and dependent styles resolve automatically — 'harvard' → 'harvard-cite-them-right'.",
    ),
  lang: z
    .string()
    .optional()
    .describe(
      "BCP-47 locale tag for formatting (e.g. 'en-US', 'en-GB', 'fr-FR'). Defaults to the locale " +
        "embedded in the chosen CSL style, typically en-US.",
    ),
  footnote: z
    .boolean()
    .optional()
    .describe(
      "When true, render as a footnote/note-style citation rather than a bibliography entry. Only " +
        "meaningful for note-style CSL styles (chicago-note-bibliography, turabian-fullnote-bibliography); " +
        "ignored by author-date and numeric styles.",
    ),
  output: z
    .enum(["text", "html", "json"])
    .optional()
    .describe(
      "Output format: 'text' (plain text, default), 'html' (marked-up HTML for web rendering), or " +
        "'json' (structured CSL items, equivalent to resolveIdentifier).",
    ),
};

export const ExportCitationInput = {
  text: z.string().describe(BATCH_TEXT_DESCRIPTION),
  format: z
    .enum([
      "bib",
      "ris",
      "csv",
      "csl",
      "endnote-refer",
      "endnote-xml",
      "refworks",
      "medline",
      "zotero-rdf",
      "txt",
    ])
    .describe(
      "Export format. 'bib' (BibTeX/.bib for LaTeX), 'ris' (RIS — most widely supported by " +
        "reference managers), 'csl' (CSL JSON for Pandoc/Quarto), 'endnote-xml' (EndNote XML import), " +
        "'endnote-refer' (EndNote Refer/tagged), 'refworks' (RefWorks tagged), 'medline' (NBIB for " +
        "PubMed round-trips), 'zotero-rdf' (Zotero RDF), 'csv' (spreadsheet-friendly), or 'txt' " +
        "(plain-text bibliography rendered with the optional `style` parameter).",
    ),
  style: z
    .string()
    .optional()
    .describe(
      "Citation style ID — used only when format='txt'. Same vocabulary as formatCitation's style " +
        "parameter (vancouver, apa, ama, ieee, cse, or any CSL style ID). Ignored by all other formats.",
    ),
  lang: z
    .string()
    .optional()
    .describe(
      "BCP-47 locale tag (e.g. 'en-US') — used only when format='txt' and style is set. Ignored by " +
        "structured formats.",
    ),
};

export const ResolveIdentifierInput = {
  text: z.string().describe(BATCH_TEXT_DESCRIPTION),
};

const SINGLE_ID_DESCRIPTION_BASE =
  "A single scholarly identifier to check. 1–500 characters. " +
  "Non-DOI inputs are resolved to a DOI server-side before the lookup; if no DOI can be derived, " +
  "the tool returns doi=null with reason='no_doi'. Pass exactly one identifier — comma/newline " +
  "batches are NOT accepted by this tool; loop one call per identifier for multiple papers.";

export const CheckRetractionInput = {
  id: z
    .string()
    .min(1)
    .max(500)
    .describe(
      `${SINGLE_ID_DESCRIPTION_BASE} ` +
        "Accepted: DOI, PMID, PMCID, arXiv ID, or NASA ADS bibcode (with or without prefixes). " +
        "ISBN inputs are accepted but always return doi=null since books are not in the retraction graph.",
    ),
};

export const CheckOpenAccessInput = {
  id: z
    .string()
    .min(1)
    .max(500)
    .describe(
      `${SINGLE_ID_DESCRIPTION_BASE} ` +
        "Accepted: DOI, PMID, PMCID, arXiv ID, ISBN, or NASA ADS bibcode (with or without prefixes).",
    ),
};

/* ─── verifyCitation ─────────────────────────────────────────────────── */
// The /api/verify endpoint accepts a structured `claimed` object plus
// optional flags. The MCP surface keeps the shape flat for LLM ergonomics:
// every cited field is a top-level string the LLM can fill independently.
// The tool wrapper bundles them into `claimed` server-side. Only `title`
// plus exactly one identifier is required; the rest refine the verdict.

export const VerifyCitationInput = {
  title: z
    .string()
    .min(1)
    .max(2000)
    .describe(
      "The title as it appears in the cited reference. This is the field the verifier cross-checks against the resolved record at the supplied identifier. Required.",
    ),
  doi: z
    .string()
    .max(200)
    .optional()
    .describe(
      "DOI as cited (with or without https://doi.org/ prefix). Provide whichever identifier(s) the cited reference carries; the verifier uses the first one in priority order doi > pmid > pmcid > arxiv > ads > isbn > issn > whoIrisUrl.",
    ),
  pmid: z
    .string()
    .max(50)
    .optional()
    .describe("PubMed ID as cited (digits only, or with 'PMID:' prefix)."),
  pmcid: z
    .string()
    .max(50)
    .optional()
    .describe("PubMed Central ID (e.g. 'PMC1234567' or 'PMCID:1234567')."),
  isbn: z
    .string()
    .max(50)
    .optional()
    .describe("ISBN (10- or 13-digit, hyphens tolerated)."),
  arxiv: z
    .string()
    .max(50)
    .optional()
    .describe("arXiv ID (e.g. '2301.08745' or 'arXiv:2301.08745'; old-style 'hep-ph/0501023' accepted)."),
  issn: z.string().max(50).optional().describe("ISSN for journal-level resolution."),
  ads: z.string().max(50).optional().describe("NASA ADS bibcode (19 chars)."),
  whoIrisUrl: z.string().max(2000).optional().describe("WHO IRIS URL (https://iris.who.int/...)."),
  author: z
    .string()
    .max(200)
    .optional()
    .describe(
      "First-author family name as cited. Refines the verdict — a title-vs-resolved-title match plus an author mismatch raises suspicion of fabrication. Pass only the family name (e.g. 'Topaz', not 'Topaz, Maxim').",
    ),
  year: z
    .number()
    .int()
    .min(0)
    .max(9999)
    .optional()
    .describe("Publication year as cited. Wrong year alone does not flip the verdict, but >=2-year gap from the resolved record lowers confidence."),
  container: z
    .string()
    .max(500)
    .optional()
    .describe("Journal or container name as cited (e.g. 'The Lancet', 'Neuroscience'). Soft signal — surfaced as a mismatch field but does not gate the verdict."),
  screen_with_llm: z
    .boolean()
    .optional()
    .describe(
      "Opt-in Stage 3 LLM screen. Fires only when the pre-LLM verdict is mismatch with low confidence (the informal-abbreviation false-positive bucket). Gated: requires an authenticated first-party API key or a paid RapidAPI tier; anonymous / free callers receive 400 LLM_SCREEN_FORBIDDEN. Default false.",
    ),
};

/* ─── API response types ──────────────────────────────────────────────── */

export interface FormatApiResponse {
  ok: boolean;
  formatter?: string;
  styleUsed?: string;
  lang?: string;
  text?: string;
  html?: string;
  items?: unknown[];
  warnings?: string[];
  error?: string;
  code?: string;
}

export interface ResolvedFrom {
  type: string;
  value: string;
}

export interface RetractionNotice {
  type: string;
  label?: string;
  doi?: string;
  date?: string;
  source?: string;
}

export interface RetractionResult {
  isRetracted: boolean;
  hasCorrections: boolean;
  hasConcern: boolean;
  notices: RetractionNotice[];
  title: string | null;
}

export interface RetractionApiResponse {
  ok: boolean;
  doi: string | null;
  resolvedFrom?: ResolvedFrom;
  reason?: string;
  result: RetractionResult | null;
  error?: string;
}

export interface OaLocation {
  url: string;
  hostType?: string;
  license?: string;
  version?: string;
}

export interface OaResult {
  isOa: boolean;
  oaStatus: "gold" | "green" | "hybrid" | "bronze" | "closed";
  title: string | null;
  bestLocation: OaLocation | null;
  locations: OaLocation[];
}

export interface OaApiResponse {
  ok: boolean;
  doi: string | null;
  resolvedFrom?: ResolvedFrom;
  reason?: string;
  result: OaResult | null;
  error?: string;
}

export interface VerifyMismatch {
  field: "title" | "first_author" | "year" | "container";
  claimed: string | number | null;
  resolved: string | number | null;
  similarity: number;
}

export interface VerifyCandidate {
  /** Resolved BiblioItem the title-search aggregator surfaced. */
  item: Record<string, unknown>;
  registries: string[];
  /** 0-1 title similarity against the claim. */
  score: number;
}

export interface VerifyRegistrySearchStatus {
  registry: "crossref" | "pubmed" | "openalex";
  ok: boolean;
  count: number;
  reason?: string;
}

export interface VerifyLlmScreenProvenance {
  applied: boolean;
  model?: string;
  prompt_version?: string;
  verdict?: "informal_abbreviation" | "different_paper" | "uncertain";
  reasoning?: string;
  cost_usd?: number;
  reason?:
    | "verdict_not_eligible"
    | "daily_budget_exceeded"
    | "no_gateway"
    | "upstream_error"
    | "malformed_response";
}

export interface VerifyProvenance {
  stages_run: Array<"compare" | "search" | "llm_screen">;
  resolved_via: string | null;
  registries_searched?: VerifyRegistrySearchStatus[];
  llm_screen?: VerifyLlmScreenProvenance;
}

export interface VerifyApiResponse {
  ok: boolean;
  verdict?: "matched" | "mismatch" | "not_found" | "ambiguous" | "parsing_error";
  confidence?: "high" | "medium" | "low";
  /** Resolved BiblioItem when something resolved; null on not_found. */
  matched?: Record<string, unknown> | null;
  mismatches?: VerifyMismatch[];
  candidates?: VerifyCandidate[];
  _provenance?: VerifyProvenance;
  /** Set on the error envelope (ok: false). */
  error?: string;
  code?: string;
  requestId?: string;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data?: T;
  error?: string;
  requestId?: string;
  headers: Record<string, string>;
}

/* ─── Scholar header names to extract from API responses ──────────────── */

export const SCHOLAR_HEADER_NAMES = [
  "x-request-id",
  "x-scholar-cache",
  "x-scholar-formatter",
  "x-scholar-style-used",
  "x-csl-warning",
  "x-scholar-warnings",
  // verifier headers (Phase 12i)
  "x-scholar-verify-verdict",
  "x-scholar-verify-confidence",
  "x-scholar-verify-version",
] as const;
