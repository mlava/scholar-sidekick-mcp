import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

import type { ApiResult } from "../types.js";

/** Normalize comma-separated identifiers to newline-separated. */
export function normalizeIdentifiers(text: string): string {
  return text.includes(",") && !text.includes("\n")
    ? text.split(",").map((s) => s.trim()).filter(Boolean).join("\n")
    : text;
}

/** Build an MCP error result from a failed API call. */
export function errorResult(result: ApiResult<unknown>): CallToolResult {
  const parts: string[] = [];
  if (result.error) parts.push(result.error);
  if (result.requestId) parts.push(`(request-id: ${result.requestId})`);

  return {
    content: [{ type: "text", text: `Error: ${parts.join(" ")}` }],
    isError: true,
  };
}

/** Build a metadata summary from Scholar API response headers. */
export function buildMetadata(result: ApiResult<unknown>): Record<string, string> {
  const meta: Record<string, string> = {};
  if (result.requestId) meta.requestId = result.requestId;
  const h = result.headers;
  if (h["x-scholar-formatter"]) meta.formatter = h["x-scholar-formatter"];
  if (h["x-scholar-style-used"]) meta.styleUsed = h["x-scholar-style-used"];
  if (h["x-csl-warning"]) meta.cslWarning = h["x-csl-warning"];
  if (h["x-scholar-warnings"]) meta.warnings = h["x-scholar-warnings"];
  return meta;
}
