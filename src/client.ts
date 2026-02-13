import type { ApiResult, FormatApiResponse } from "./types.js";
import { SCHOLAR_HEADER_NAMES } from "./types.js";

/* ─── Config ──────────────────────────────────────────────────────────── */

export interface ClientConfig {
  baseUrl: string;
  rapidApiKey?: string;
  rapidApiHost?: string;
  timeoutMs: number;
}

const DEFAULT_RAPIDAPI_HOST = "scholar-sidekick.p.rapidapi.com";

export function createConfig(): ClientConfig {
  return {
    baseUrl: (
      process.env.SCHOLAR_SIDEKICK_URL ||
      `https://${process.env.RAPIDAPI_HOST || DEFAULT_RAPIDAPI_HOST}`
    ).replace(/\/$/, ""),
    rapidApiKey: process.env.RAPIDAPI_KEY || undefined,
    rapidApiHost: process.env.RAPIDAPI_HOST || DEFAULT_RAPIDAPI_HOST,
    timeoutMs: Number(process.env.SCHOLAR_SIDEKICK_TIMEOUT_MS) || 30_000,
  };
}

/* ─── Core HTTP caller ────────────────────────────────────────────────── */

export async function callApi<T>(
  config: ClientConfig,
  path: string,
  body: Record<string, unknown>,
  opts?: { expectRawText?: boolean },
): Promise<ApiResult<T>> {
  const url = `${config.baseUrl}${path}`;
  const requestId = crypto.randomUUID();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-request-id": requestId,
    "User-Agent": "scholar-sidekick-mcp/0.3.0",
  };

  if (config.rapidApiKey) {
    headers["X-RapidAPI-Key"] = config.rapidApiKey;
    headers["X-RapidAPI-Host"] = config.rapidApiHost || DEFAULT_RAPIDAPI_HOST;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const scholarHeaders: Record<string, string> = {};
    for (const name of SCHOLAR_HEADER_NAMES) {
      const v = res.headers.get(name);
      if (v) scholarHeaders[name] = v;
    }

    const responseRid = res.headers.get("x-request-id") ?? requestId;

    if (!res.ok) {
      let errorMsg = `HTTP ${res.status}`;
      try {
        const errBody = (await res.json()) as { error?: string; message?: string };
        errorMsg = errBody.error ?? errBody.message ?? errorMsg;
      } catch {
        /* use status text */
      }

      return {
        ok: false,
        status: res.status,
        error: errorMsg,
        requestId: responseRid,
        headers: scholarHeaders,
      };
    }

    const ct = res.headers.get("content-type") ?? "";
    let data: T;
    if (opts?.expectRawText || !ct.includes("application/json")) {
      data = (await res.text()) as unknown as T;
    } else {
      data = (await res.json()) as T;
    }

    return {
      ok: true,
      status: res.status,
      data,
      requestId: responseRid,
      headers: scholarHeaders,
    };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        ok: false,
        status: 0,
        error: `Request timed out after ${config.timeoutMs}ms`,
        requestId,
        headers: {},
      };
    }
    return {
      ok: false,
      status: 0,
      error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      requestId,
      headers: {},
    };
  } finally {
    clearTimeout(timer);
  }
}

/* ─── Convenience wrappers ────────────────────────────────────────────── */

export async function formatCitation(
  config: ClientConfig,
  input: {
    text: string;
    style?: string;
    lang?: string;
    footnote?: boolean;
    output?: string;
  },
): Promise<ApiResult<FormatApiResponse>> {
  return callApi<FormatApiResponse>(config, "/api/format", input);
}

export async function exportCitation(
  config: ClientConfig,
  input: {
    text: string;
    format: string;
    style?: string;
    lang?: string;
  },
): Promise<ApiResult<string>> {
  return callApi<string>(config, "/api/export", input, { expectRawText: true });
}
