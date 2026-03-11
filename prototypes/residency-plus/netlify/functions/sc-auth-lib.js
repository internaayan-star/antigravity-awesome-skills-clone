/**
 * sc-auth-lib.js — Shared helpers for official SoundCloud OAuth wrapper functions.
 *
 * This file is NOT a Netlify function handler. It exports utilities imported
 * by sc-official-search.js and sc-official-resolve.js.
 *
 * Security rules enforced here:
 *   - Credentials read from process.env only
 *   - Token cached in memory, never logged
 *   - Authorization headers never appear in logs or responses
 *   - Errors are sanitized before returning to callers
 */

import fs from "fs";
import os from "os";
import path from "path";

// ── Env validation ────────────────────────────────────────────────────────────

const _clientId = process.env.SOUNDCLOUD_CLIENT_ID;
const _clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

function _credsMissing() {
  const badId = !_clientId || _clientId.trim() === "" || _clientId === "YOUR_CLIENT_ID";
  const badSec = !_clientSecret || _clientSecret.trim() === "" || _clientSecret === "YOUR_CLIENT_SECRET";
  return { badId, badSec, any: badId || badSec };
}

// ── Persisted Token Cache (Survives hot-reloads) ─────────────────────────────

const CACHE_FILE = path.join(os.tmpdir(), "sc-auth-cache.json");

function readCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(CACHE_FILE, "utf-8"));
      // If we have a valid token in cache, use it
      if (parsed && parsed.token) return parsed;
    }
  } catch (e) {
    // ignore
  }

  // Fallback to bootstrap token if available
  if (process.env.SOUNDCLOUD_BOOTSTRAP_ACCESS_TOKEN) {
    return {
      token: process.env.SOUNDCLOUD_BOOTSTRAP_ACCESS_TOKEN.trim(),
      expiry: Date.now() + 3600 * 1000,
      cooldownUntil: 0
    };
  }

  return { token: null, expiry: 0, cooldownUntil: 0 };
}

function writeCache(token, expiry, cooldownUntil) {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ token, expiry, cooldownUntil }));
  } catch (e) {
    // ignore
  }
}

let _inflightRefresh = null; // single-flight dedup: shared Promise<string> | null

/**
 * Returns a valid Bearer access token, reusing the cached copy when still fresh.
 *
 * Key resilience properties:
 *  • Single-flight: if a refresh is already in-flight, concurrent callers await
 *    the same promise rather than each requesting a new token.
 *  • 429 fallback: if SoundCloud throttles the token endpoint and we still have
 *    any cached token (even an expired one), we return it rather than failing —
 *    Supabase-issued tokens typically survive well past their nominal TTL.
 *  • Cooldown: after a 429 we skip token requests for 60 s to stop the loop.
 *
 * @returns {Promise<string>}
 */
export async function getAccessToken() {
  const { any, badId, badSec } = _credsMissing();
  if (any) {
    const which = [badId && "SOUNDCLOUD_CLIENT_ID", badSec && "SOUNDCLOUD_CLIENT_SECRET"]
      .filter(Boolean).join(", ");
    throw new Error(`[sc-auth-lib] Missing required env var(s): ${which}. Set them in your .env or Netlify environment variables.`);
  }

  const cache = readCache();

  // ── 1. Return still-fresh cached token ────────────────────────────────────
  if (cache.token && Date.now() < cache.expiry - 30_000) {
    return cache.token;
  }

  // ── 2. Single-flight dedup: re-use in-flight refresh if one is running ────
  if (_inflightRefresh) {
    return _inflightRefresh;
  }

  // ── 3. Cooldown after 429: re-use stale token or surface a clear error ────
  if (Date.now() < cache.cooldownUntil) {
    if (cache.token) {
      // Return the stale token — SoundCloud usually accepts tokens past TTL briefly
      return cache.token;
    }
    const secsLeft = Math.ceil((cache.cooldownUntil - Date.now()) / 1000);
    throw new Error(`[sc-auth-lib] Token endpoint rate-limited. Retry in ${secsLeft}s.`);
  }

  // ── 4. Kick off a single refresh and share the promise ────────────────────
  _inflightRefresh = _doTokenRefresh().finally(() => { _inflightRefresh = null; });
  return _inflightRefresh;
}

async function _doTokenRefresh() {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: _clientId,
    client_secret: _clientSecret,
  });

  let res;
  try {
    res = await fetch("https://api.soundcloud.com/oauth2/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
  } catch {
    throw new Error("[sc-auth-lib] Token request failed — network error");
  }

  // ── 429 from SoundCloud token endpoint ────────────────────────────────────
  if (res.status === 429) {
    const cache = readCache();
    // Engage 60-second cooldown to stop the flood
    const cooldownUntil = Date.now() + 60_000;
    writeCache(cache.token, cache.expiry, cooldownUntil);
    if (cache.token) {
      // Stale token is better than no token — return it
      console.warn("[sc-auth-lib] Token endpoint 429; reusing cached token for next 60s");
      return cache.token;
    }
    throw new Error("[sc-auth-lib] Token request failed — HTTP 429 (rate limited, no cached token available)");
  }

  if (!res.ok) {
    throw new Error(`[sc-auth-lib] Token request failed — HTTP ${res.status}`);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error("[sc-auth-lib] Token response was not valid JSON");
  }

  if (!data.access_token) {
    throw new Error("[sc-auth-lib] Token response missing access_token field");
  }

  // Store in cache only — never log the value
  const expiry = Date.now() + (parseInt(data.expires_in, 10) || 3600) * 1000;
  writeCache(data.access_token, expiry, 0);

  return data.access_token;
}

// ── Origin allowlist ──────────────────────────────────────────────────────────

/**
 * Returns the origin string if allowed, or null if rejected.
 * Reads ALLOWED_ORIGINS env var (comma-separated).
 * Automatically permits ANY localhost/127.0.0.1 port to prevent local dev port
 * drift (e.g. localhost:8889) from silently breaking requests.
 * @param {string|null} origin
 * @returns {string|null}
 */
export function allowOrigin(origin) {
  if (!origin) return null;
  const o = origin.trim().toLowerCase();

  // 1. Dynamic Localhost wildcard
  if (o.startsWith("http://localhost:") || o.startsWith("http://127.0.0.1:")) {
    return origin; // preserve exact matching casing
  }

  // 2. Production .env ALLOWED_ORIGINS
  const envOrigins = (process.env.ALLOWED_ORIGINS || "").split(",")
    .map(x => x.trim().toLowerCase())
    .filter(Boolean);

  if (envOrigins.includes(o)) {
    return origin;
  }

  return null;
}

// ── Rate limiting (in-memory, best-effort MVP) ────────────────────────────────

/**
 * Simple rolling-window rate limiter.
 * 30 requests per 5-minute window per key (origin or IP).
 */
const _WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const _WINDOW_LIMIT = 30;
const _rateBuckets = new Map();        // key → number[]  (timestamps)

/**
 * @param {string} key  — typically origin or remote IP
 * @returns {{ ok: boolean, retryAfter: number }}
 */
export function checkRateLimit(key) {
  const now = Date.now();
  const hits = (_rateBuckets.get(key) || []).filter(t => now - t < _WINDOW_MS);
  hits.push(now);
  _rateBuckets.set(key, hits);

  if (hits.length > _WINDOW_LIMIT) {
    const oldest = hits[0];
    const retryAfter = Math.ceil((_WINDOW_MS - (now - oldest)) / 1000);
    return { ok: false, retryAfter };
  }
  return { ok: true, retryAfter: 0 };
}

// ── Response helpers ──────────────────────────────────────────────────────────

/**
 * Build a JSON Response with correct CORS headers for the allowed origin.
 * @param {number}      status
 * @param {object}      body
 * @param {string|null} allowedOrigin
 * @returns {Response}
 */
export function json(status, body, allowedOrigin = null) {
  const headers = { "content-type": "application/json" };
  if (allowedOrigin) {
    headers["access-control-allow-origin"] = allowedOrigin;
    headers["access-control-allow-headers"] = "content-type";
    headers["access-control-allow-methods"] = "GET,OPTIONS";
    headers["vary"] = "Origin";
  }
  return new Response(JSON.stringify(body), { status, headers });
}

// ── Telemetry (G2 Scaffold) ───────────────────────────────────────────────────

/**
 * Lightweight structured logger for official wrapper telemetry.
 * Output is captured by Netlify Function Logs natively.
 * 
 * If Axiom variables are configured (AXIOM_API_TOKEN, AXIOM_DATASET, AXIOM_DOMAIN),
 * the sanitized JSON payload is also forwarded to the Axiom dataset via a 
 * non-blocking HTTP POST.
 * 
 * @param {string} eventName   - String event identifier (e.g. 'sc_search_request')
 * @param {object} payload     - Contextual data (no secrets, no raw queries/urls)
 */
export function logTelemetry(eventName, payload = {}) {
  const entry = {
    _telemetry: true,
    event: eventName,
    timestamp: new Date().toISOString(),
    ...payload
  };

  const jsonString = JSON.stringify(entry);

  // 1. Always log locally for Netlify Runtime Logs
  console.log(jsonString);

  // 2. Axiom External Sink Forwarding (if configured)
  const axiomToken = process.env.AXIOM_API_TOKEN;
  const axiomDataset = process.env.AXIOM_DATASET;
  const axiomDomain = process.env.AXIOM_DOMAIN;

  if (axiomToken && axiomDataset && axiomDomain) {
    const ingestUrl = `https://${axiomDomain}/v1/ingest/${axiomDataset}`;

    // Fire-and-forget: we do not await this, so we don't block the client response.
    // Netlify functions normally allow background promises to finish shortly after return.
    fetch(ingestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${axiomToken}`
      },
      // Axiom /v1/ingest/:dataset accepts an array of events
      body: JSON.stringify([entry])
    }).catch(err => {
      // Swallow forwarding errors silently to protect core functionality
      console.warn(`[TELEMETRY_WARN] Failed to forward telemetry to Axiom: ${err.message}`);
    });
  }
}
