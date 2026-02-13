import { describe, expect, it } from "vitest";

import { buildMetadata, errorResult } from "@/tools/helpers";

describe("errorResult", () => {
  it("includes error and requestId", () => {
    const result = errorResult({
      ok: false,
      status: 500,
      error: "Internal error",
      requestId: "rid-123",
      headers: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Error: Internal error (request-id: rid-123)",
    });
  });

  it("omits requestId when absent", () => {
    const result = errorResult({
      ok: false,
      status: 0,
      error: "Network error",
      headers: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({
      type: "text",
      text: "Error: Network error",
    });
  });

  it("handles missing error message", () => {
    const result = errorResult({
      ok: false,
      status: 500,
      headers: {},
    });

    expect(result.isError).toBe(true);
    expect(result.content[0]).toEqual({ type: "text", text: "Error: " });
  });
});

describe("buildMetadata", () => {
  it("extracts all Scholar headers", () => {
    const meta = buildMetadata({
      ok: true,
      status: 200,
      requestId: "rid-abc",
      headers: {
        "x-scholar-formatter": "csl",
        "x-scholar-style-used": "nature",
        "x-csl-warning": "fallback-to-default",
        "x-scholar-warnings": "Truncated line|Normalized",
      },
    });

    expect(meta).toEqual({
      requestId: "rid-abc",
      formatter: "csl",
      styleUsed: "nature",
      cslWarning: "fallback-to-default",
      warnings: "Truncated line|Normalized",
    });
  });

  it("returns empty object when no headers present", () => {
    const meta = buildMetadata({
      ok: true,
      status: 200,
      headers: {},
    });

    expect(meta).toEqual({});
  });

  it("omits missing headers", () => {
    const meta = buildMetadata({
      ok: true,
      status: 200,
      requestId: "rid-xyz",
      headers: {
        "x-scholar-formatter": "builtin",
      },
    });

    expect(meta).toEqual({
      requestId: "rid-xyz",
      formatter: "builtin",
    });
    expect(meta).not.toHaveProperty("styleUsed");
    expect(meta).not.toHaveProperty("cslWarning");
    expect(meta).not.toHaveProperty("warnings");
  });
});
