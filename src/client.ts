import type {
  ApiResult,
  AuditApiResponse,
  FormatApiResponse,
  OaApiResponse,
  RetractionApiResponse,
  VerifyApiResponse,
} from "./types.js";
import { SCHOLAR_HEADER_NAMES } from "./types.js";

/* ─── Config ──────────────────────────────────────────────────────────── */

export interface ClientConfig {
  baseUrl: string;
  rapidApiKey?: string;
  rapidApiHost?: string;
  /** First-party `ssk_` API key (from /account). Sent as `Authorization: Bearer`. */
  scholarApiKey?: string;
  timeoutMs: number;
}

/** Single source of truth for the client version (User-Agent + X-Scholar-Client). */
export const CLIENT_VERSION = "0.8.4";

const DEFAULT_RAPIDAPI_HOST = "scholar-sidekick.p.rapidapi.com";
const CANONICAL_BASE_URL = "https://scholar-sidekick.com";

export function createConfig(): ClientConfig {
  const rapidApiKey = process.env.RAPIDAPI_KEY || undefined;
  const rapidApiHost = process.env.RAPIDAPI_HOST || DEFAULT_RAPIDAPI_HOST;

  // Base URL precedence: explicit override > RapidAPI gateway (only when a RapidAPI
  // key is set) > the canonical public site (anonymous / first-party `ssk_` path).
  const baseUrl = (
    process.env.SCHOLAR_SIDEKICK_URL ||
    (rapidApiKey ? `https://${rapidApiHost}` : CANONICAL_BASE_URL)
  ).replace(/\/$/, "");

  return {
    baseUrl,
    rapidApiKey,
    rapidApiHost,
    scholarApiKey: process.env.SCHOLAR_API_KEY || undefined,
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
    "User-Agent": `scholar-sidekick-mcp/${CLIENT_VERSION}`,
    "X-Scholar-Client": `scholar-sidekick-mcp/${CLIENT_VERSION}`,
  };

  if (config.rapidApiKey) {
    headers["X-RapidAPI-Key"] = config.rapidApiKey;
    headers["X-RapidAPI-Host"] = config.rapidApiHost || DEFAULT_RAPIDAPI_HOST;
  } else if (config.scholarApiKey) {
    // First-party `ssk_` key against the canonical site.
    headers["Authorization"] = `Bearer ${config.scholarApiKey}`;
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
        const errBody = (await res.json()) as {
          error?: string;
          message?: string;
        };
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

export async function checkRetraction(
  config: ClientConfig,
  input: { id: string },
): Promise<ApiResult<RetractionApiResponse>> {
  return callApi<RetractionApiResponse>(config, "/api/retraction-check", input);
}

export async function checkOpenAccess(
  config: ClientConfig,
  input: { id: string },
): Promise<ApiResult<OaApiResponse>> {
  return callApi<OaApiResponse>(config, "/api/oa-check", input);
}

export async function verifyCitation(
  config: ClientConfig,
  input: {
    claimed: Record<string, unknown>;
    options?: { screen_with_llm?: boolean; bypassCache?: boolean };
  },
): Promise<ApiResult<VerifyApiResponse>> {
  return callApi<VerifyApiResponse>(config, "/api/verify", input);
}

export async function auditBibliography(
  config: ClientConfig,
  input: {
    bibliography?: string;
    format?: string;
    claims?: Array<Record<string, unknown>>;
    options?: { screen_with_llm?: boolean; checks?: string[] };
  },
): Promise<ApiResult<AuditApiResponse>> {
  return callApi<AuditApiResponse>(config, "/api/audit", input);
}
