/**
 * client-telemetry.js — Thin client→Axiom telemetry bridge.
 *
 * Accepts high-signal product analytics events from the browser and forwards
 * them through the existing Axiom pipeline via sc-auth-lib.logTelemetry.
 *
 * Privacy / noise constraints:
 * - Only structured, explicit event names are accepted.
 * - Arbitrary raw payloads are discouraged; client should send small,
 *   non-sensitive aggregates (counts, booleans, simple labels).
 */

import { allowOrigin, json, logTelemetry } from "./lib/sc-auth-lib.js";

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    const origin = allowOrigin(req.headers.get("origin"));
    return new Response("", {
      status: 204,
      headers: {
        "access-control-allow-origin": origin || "*",
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "POST,OPTIONS",
      },
    });
  }

  const origin = allowOrigin(req.headers.get("origin"));
  if (!origin && req.headers.get("origin")) return json(403, { error: "Origin not permitted." });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" }, origin);

  try {
    const body = await req.json();
    const event = (body && body.event) || null;
    const payload = (body && body.payload) || {};

    if (!event || typeof event !== "string") {
      return json(400, { error: "Missing event name" }, origin);
    }

    // Forward to Axiom via existing logger. This must never affect UX.
    try {
      logTelemetry(event, {
        origin,
        ...payload,
      });
    } catch (e) {
      // Swallow telemetry forwarding errors; respond success to client.
    }

    return json(200, { ok: true }, origin);
  } catch (err) {
    // Do not break the app on telemetry failure. Treat malformed payloads
    // or missing body as a soft failure.
    return json(200, { ok: false }, origin);
  }
}

