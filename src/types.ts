import { z } from "zod";

/* ─── MCP tool input schemas ──────────────────────────────────────────── */

export const FormatCitationInput = {
  text: z
    .string()
    .describe(
      "One or more identifiers (DOIs, PMIDs, ISBNs, arXiv IDs, etc.) separated by newlines",
    ),
  style: z
    .string()
    .optional()
    .describe("Citation style: vancouver (default), ama, apa, ieee, cse, or any CSL style ID"),
  lang: z.string().optional().describe("Locale for formatting (e.g. en-US, en-GB, fr-FR)"),
  footnote: z.boolean().optional().describe("Format as footnotes instead of bibliography entries"),
  output: z.enum(["text", "html", "json"]).optional().describe("Output format (default: text)"),
};

export const ExportCitationInput = {
  text: z
    .string()
    .describe("One or more identifiers (DOIs, PMIDs, ISBNs, etc.) separated by newlines"),
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
    .describe("Export format"),
  style: z.string().optional().describe("Citation style (used only for txt export)"),
  lang: z.string().optional().describe("Locale for formatting (e.g. en-US)"),
};

export const ResolveIdentifierInput = {
  text: z
    .string()
    .describe(
      "One or more identifiers to resolve (DOIs, PMIDs, PMCIDs, ISBNs, arXiv IDs, ISSNs, ADS bibcodes) separated by newlines",
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
] as const;
