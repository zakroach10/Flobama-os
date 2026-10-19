/**
 * Ecamm HTTP transport.
 * Matches Companion ecamm-http.ts: GET only, required headers, encodeURIComponent query.
 */

import { REQUEST_TIMEOUT_MS, CLIENT_NAME, CLIENT_VERSION } from "./constants.mjs";

export class EcammHttpError extends Error {
  constructor(endpoint, status, bodySnippet) {
    super(`Ecamm HTTP ${status} on ${endpoint}: ${bodySnippet || ""}`.trim());
    this.name = "EcammHttpError";
    this.endpoint = endpoint;
    this.status = status;
    this.bodySnippet = bodySnippet;
  }
}

export class EcammParseError extends Error {
  constructor(endpoint, bodySnippet) {
    super(`Ecamm JSON parse failed for ${endpoint}`);
    this.name = "EcammParseError";
    this.endpoint = endpoint;
    this.bodySnippet = bodySnippet;
  }
}

export class EcammTimeoutError extends Error {
  constructor(endpoint, timeoutMs) {
    super(`Ecamm timeout (${timeoutMs}ms) on ${endpoint}`);
    this.name = "EcammTimeoutError";
    this.endpoint = endpoint;
    this.timeoutMs = timeoutMs;
  }
}

export function isAbortError(error) {
  return (
    error?.name === "AbortError" ||
    error?.name === "TimeoutError" ||
    /aborted|timeout/i.test(String(error?.message || error))
  );
}

/**
 * Values escaped with encodeURIComponent (not URLSearchParams) so spaces stay %20.
 * Cocoa/Ecamm does not decode "+" back to space.
 */
export function buildQuery(params) {
  if (!params) return "";
  const pairs = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`);
  return pairs.length > 0 ? `?${pairs.join("&")}` : "";
}

export function createHttp(options) {
  return new EcammHttp(options);
}

export function isTimeout(error) {
  return error?.name === "EcammTimeoutError" || error?.name === "TimeoutError";
}

export class EcammHttp {
  constructor(options) {
    this.options = {
      timeoutMs: REQUEST_TIMEOUT_MS,
      clientName: CLIENT_NAME,
      clientVersion: CLIENT_VERSION,
      deviceName: "Local Runner",
      log: () => {},
      verbose: false,
      ...options,
    };
    this.controller = new AbortController();
  }

  get host() {
    return this.options.host;
  }

  setHost(host) {
    this.options.host = host;
  }

  abortAll() {
    this.controller.abort();
    this.controller = new AbortController();
  }

  headers() {
    return {
      "User-Agent": `${this.options.clientName}/${this.options.clientVersion}`,
      "EcammLive-UUID": this.options.uuid,
      "EcammLive-ClientName": this.options.clientName,
      "EcammLive-DeviceName": this.options.deviceName,
    };
  }

  async raw(endpoint, params) {
    if (!this.options.host) throw new Error("Ecamm host not configured.");
    const url = `http://${this.options.host}/${endpoint}${buildQuery(params)}`;
    if (this.options.verbose) this.options.log("debug", `GET ${url}`);

    let response;
    const timeout = AbortSignal.timeout(this.options.timeoutMs);
    try {
      response = await fetch(url, {
        headers: this.headers(),
        signal: AbortSignal.any([timeout, this.controller.signal]),
      });
    } catch (error) {
      if (isAbortError(error) && !this.controller.signal.aborted) {
        throw new EcammTimeoutError(endpoint, this.options.timeoutMs);
      }
      throw error;
    }

    const body = await response.text();
    if (!response.ok) {
      throw new EcammHttpError(endpoint, response.status, body.slice(0, 200).trim());
    }
    if (this.options.verbose) {
      this.options.log("debug", `${endpoint} -> ${body.slice(0, 500)}`);
    }
    return body;
  }

  /** JSON read. */
  async get(endpoint, params) {
    const body = await this.raw(endpoint, params);
    try {
      return JSON.parse(body);
    } catch {
      throw new EcammParseError(endpoint, body.slice(0, 200));
    }
  }

  /** Action — body is typically "Done"; do not JSON-parse. */
  async set(endpoint, params) {
    await this.raw(endpoint, params);
  }
}
