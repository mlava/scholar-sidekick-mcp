import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { formatCitation } from "../client.js";
import { FormatCitationInput } from "../types.js";
import { buildMetadata, errorResult, missingKeyResult, normalizeIdentifiers } from "./helpers.js";

export function registerFormatTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "formatCitation",
    {
      title: "Format Citation",
      description:
        "Format scholarly identifiers into a finished citation in a specific style. " +
        "Use when the user wants a paste-ready citation string for a manuscript, slide, message, " +
        "footnote, or in-line reference. " +
        "Style defaults to vancouver if unspecified; ask the user before defaulting if any " +
        "ambiguity exists (e.g. 'Harvard' and 'Chicago' have multiple variants — confirm which one). " +
        "Supports five hand-tuned builtins (vancouver, ama, apa, ieee, cse) plus any of 10,000+ " +
        "CSL style IDs (chicago-author-date, harvard-cite-them-right, modern-language-association, " +
        "nature, bmj, the-lancet, etc.). Alias and dependent-style resolution apply, so 'harvard' " +
        "resolves to 'harvard-cite-them-right' and the canonical ID is reported back as styleUsed. " +
        "Output defaults to text; pass output=html for marked-up HTML or output=json for structured CSL items. " +
        "Accepts the same identifier formats as resolveIdentifier (DOI/PMID/PMCID/ISBN/arXiv/ISSN/ADS/" +
        "WHO IRIS, prefixes tolerated), single or comma/newline-separated batch — one round trip per call. " +
        "Returns: one of { text, html, items } depending on the output parameter, followed by a metadata " +
        "block ({formatter: 'builtin' | 'csl', styleUsed, requestId, warnings?}) appended as a second " +
        "text content item — surface this to the user when they care about reproducibility. " +
        "Use resolveIdentifier instead when the user wants raw metadata to inspect or transform; " +
        "use exportCitation when they want a downloadable bibliography file. " +
        "Read-only and idempotent — safe to retry. " +
        "Requires RAPIDAPI_KEY (set via env var or Claude Desktop extension settings); " +
        "without it the tool returns an isError configuration message. " +
        "Rate limits follow the user's RapidAPI subscription plan.",
      inputSchema: FormatCitationInput,
      annotations: {
        title: "Format Citation",
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: true,
      },
    },
    async (input) => {
      if (!config.rapidApiKey) return missingKeyResult();

      const result = await formatCitation(config, {
        text: normalizeIdentifiers(input.text),
        style: input.style ?? undefined,
        lang: input.lang ?? undefined,
        footnote: input.footnote ?? undefined,
        output: input.output ?? "text",
      });

      if (!result.ok || result.data?.ok === false) {
        return errorResult(
          result.data?.ok === false
            ? { ...result, error: result.data.error ?? result.error }
            : result,
        );
      }

      const data = result.data!;
      const output = data.text ?? data.html ?? JSON.stringify(data.items, null, 2);
      const metadata = buildMetadata(result);

      const content: Array<{ type: "text"; text: string }> = [{ type: "text", text: output ?? "" }];

      if (Object.keys(metadata).length > 0) {
        content.push({ type: "text", text: `\n---\nMetadata: ${JSON.stringify(metadata)}` });
      }

      return { content };
    },
  );
}
