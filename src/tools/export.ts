import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import type { ClientConfig } from "../client.js";
import { exportCitation } from "../client.js";
import { ExportCitationInput } from "../types.js";
import { errorResult } from "./helpers.js";

export function registerExportTool(server: McpServer, config: ClientConfig): void {
  server.registerTool(
    "exportCitation",
    {
      title: "Export Citation",
      description:
        "Export academic citations to bibliography file formats: " +
        "BibTeX (.bib), RIS, CSV, CSL-JSON, EndNote XML, EndNote Refer, " +
        "RefWorks, MEDLINE/NBIB, Zotero RDF, or plain text.",
      inputSchema: ExportCitationInput,
    },
    async (input) => {
      const result = await exportCitation(config, {
        text: input.text,
        format: input.format,
        style: input.style ?? undefined,
        lang: input.lang ?? undefined,
      });

      if (!result.ok) {
        return errorResult(result);
      }

      return {
        content: [{ type: "text" as const, text: result.data ?? "" }],
      };
    },
  );
}
