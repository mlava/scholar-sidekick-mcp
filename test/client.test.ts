import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.hoisted(() => vi.fn());

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

function jsonResponse(body: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "x-request-id": "test-rid-123",
      ...extra,
    },
  });
}

function textResponse(body: string, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-request-id": "test-rid-456",
      ...extra,
    },
  });
}

describe("callApi", () => {
  it("sends POST with JSON body and extracts Scholar headers", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: true, formatter: "builtin" }, 200, {
        "x-scholar-formatter": "builtin",
        "x-scholar-style-used": "vancouver",
      }),
    );

    const { callApi, createConfig } = await import("@/client");
    const config = { ...createConfig(), baseUrl: "http://localhost:3000" };
    const result = await callApi(config, "/api/format", { text: "10.1234/test" });

    expect(result.ok).toBe(true);
    expect(result.status).toBe(200);
    expect(result.requestId).toBe("test-rid-123");
    expect(result.headers["x-scholar-formatter"]).toBe("builtin");
    expect(result.headers["x-scholar-style-used"]).toBe("vancouver");

    const call = fetchMock.mock.calls[0]!;
    expect(call[0]).toBe("http://localhost:3000/api/format");
    expect(call[1]!.method).toBe("POST");
    expect(call[1]!.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(call[1]!.body as string)).toEqual({ text: "10.1234/test" });
  });

  it("attaches RapidAPI headers when rapidApiKey is set", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const { callApi } = await import("@/client");
    const config = {
      baseUrl: "https://scholar-sidekick.p.rapidapi.com",
      rapidApiKey: "rapid-test-key",
      rapidApiHost: "scholar-sidekick.p.rapidapi.com",
      timeoutMs: 5000,
    };
    await callApi(config, "/api/format", { text: "test" });

    const call = fetchMock.mock.calls[0]!;
    expect(call[1]!.headers["X-RapidAPI-Key"]).toBe("rapid-test-key");
    expect(call[1]!.headers["X-RapidAPI-Host"]).toBe("scholar-sidekick.p.rapidapi.com");
  });

  it("omits RapidAPI headers when rapidApiKey is absent", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));

    const { callApi } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    await callApi(config, "/api/format", { text: "test" });

    const call = fetchMock.mock.calls[0]!;
    expect(call[1]!.headers["X-RapidAPI-Key"]).toBeUndefined();
    expect(call[1]!.headers["X-RapidAPI-Host"]).toBeUndefined();
  });

  it("maps HTTP 401 to structured error", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, error: "API key required", code: "AUTH_MISSING" }, 401),
    );

    const { callApi, createConfig } = await import("@/client");
    const config = { ...createConfig(), baseUrl: "http://localhost:3000" };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(401);
    expect(result.error).toBe("API key required");
  });

  it("maps HTTP 429 to structured error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Rate limit exceeded" }, 429));

    const { callApi, createConfig } = await import("@/client");
    const config = { ...createConfig(), baseUrl: "http://localhost:3000" };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(429);
    expect(result.error).toBe("Rate limit exceeded");
  });

  it("maps HTTP 400 validation error to structured error", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, error: "Missing 'text'." }, 400));

    const { callApi, createConfig } = await import("@/client");
    const config = { ...createConfig(), baseUrl: "http://localhost:3000" };
    const result = await callApi(config, "/api/format", {});

    expect(result.ok).toBe(false);
    expect(result.status).toBe(400);
    expect(result.error).toBe("Missing 'text'.");
  });

  it("handles network errors", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("fetch failed"));

    const { callApi, createConfig } = await import("@/client");
    const config = { ...createConfig(), baseUrl: "http://localhost:3000" };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toMatch(/Network error.*fetch failed/);
  });

  it("handles timeout via AbortError", async () => {
    const abortError = new DOMException("The operation was aborted", "AbortError");
    fetchMock.mockRejectedValueOnce(abortError);

    const { callApi } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 100 };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toMatch(/timed out/);
  });

  it("falls back to HTTP status when error body is not JSON", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain", "x-request-id": "rid-plain" },
      }),
    );

    const { callApi } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(500);
    expect(result.error).toBe("HTTP 500");
  });

  it("uses message field when error field is absent in error body", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ ok: false, message: "Something went wrong" }, 500),
    );

    const { callApi } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Something went wrong");
  });

  it("falls back to HTTP status when error body has neither error nor message", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false, code: "UNKNOWN" }, 502));

    const { callApi } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.error).toBe("HTTP 502");
  });

  it("handles response with null content-type (falls through ?? guard)", async () => {
    const resp = new Response("raw text fallback", {
      status: 200,
      headers: { "x-request-id": "rid-noct" },
    });
    // Response auto-sets text/plain; delete it to truly get null
    resp.headers.delete("content-type");
    fetchMock.mockResolvedValueOnce(resp);

    const { callApi } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    const result = await callApi<string>(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(true);
    expect(result.data).toBe("raw text fallback");
  });

  it("handles non-Error thrown values", async () => {
    fetchMock.mockRejectedValueOnce("string error");

    const { callApi } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    const result = await callApi(config, "/api/format", { text: "test" });

    expect(result.ok).toBe(false);
    expect(result.status).toBe(0);
    expect(result.error).toBe("Network error: string error");
  });

  it("strips trailing slash from base URL", async () => {
    const { createConfig } = await import("@/client");
    vi.stubEnv("SCHOLAR_SIDEKICK_URL", "http://example.com/");
    const config = createConfig();
    expect(config.baseUrl).toBe("http://example.com");
    vi.unstubAllEnvs();
  });

  it("defaults baseUrl to RapidAPI host when SCHOLAR_SIDEKICK_URL is unset", async () => {
    const { createConfig } = await import("@/client");
    vi.stubEnv("SCHOLAR_SIDEKICK_URL", "");
    const config = createConfig();
    expect(config.baseUrl).toBe("https://scholar-sidekick.p.rapidapi.com");
    vi.unstubAllEnvs();
  });

  it("reads RAPIDAPI_KEY and RAPIDAPI_HOST from env", async () => {
    const { createConfig } = await import("@/client");
    vi.stubEnv("RAPIDAPI_KEY", "my-rapid-key");
    vi.stubEnv("RAPIDAPI_HOST", "custom.rapidapi.com");
    const config = createConfig();
    expect(config.rapidApiKey).toBe("my-rapid-key");
    expect(config.rapidApiHost).toBe("custom.rapidapi.com");
    expect(config.baseUrl).toBe("https://custom.rapidapi.com");
    vi.unstubAllEnvs();
  });

  it("reads raw text response when expectRawText is set", async () => {
    fetchMock.mockResolvedValueOnce(textResponse("@article{key, title={Test}}"));

    const { callApi, createConfig } = await import("@/client");
    const config = { ...createConfig(), baseUrl: "http://localhost:3000" };
    const result = await callApi<string>(
      config,
      "/api/export",
      { text: "10.1234/test", format: "bib" },
      { expectRawText: true },
    );

    expect(result.ok).toBe(true);
    expect(result.data).toBe("@article{key, title={Test}}");
  });
});

describe("formatCitation", () => {
  it("calls /api/format with correct body", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, text: "Smith J. Title. 2020." }));

    const { formatCitation } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    const result = await formatCitation(config, {
      text: "10.1234/test",
      style: "apa",
      output: "text",
    });

    expect(result.ok).toBe(true);
    expect(result.data?.text).toBe("Smith J. Title. 2020.");

    const body = JSON.parse(fetchMock.mock.calls[0]![1]!.body as string);
    expect(body).toEqual({
      text: "10.1234/test",
      style: "apa",
      output: "text",
    });
  });
});

describe("exportCitation", () => {
  it("calls /api/export and returns raw text", async () => {
    fetchMock.mockResolvedValueOnce(textResponse("TY  - JOUR\nER  -\n"));

    const { exportCitation } = await import("@/client");
    const config = { baseUrl: "http://localhost:3000", timeoutMs: 5000 };
    const result = await exportCitation(config, {
      text: "10.1234/test",
      format: "ris",
    });

    expect(result.ok).toBe(true);
    expect(result.data).toContain("TY  - JOUR");
  });
});
