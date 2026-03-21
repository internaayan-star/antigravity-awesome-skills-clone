/**
 * sync-vibes.js — Cloud continuity for vibe presets and recent vibes.
 * Method: GET/POST
 *  - GET:    hydrate vibe definitions from Supabase
 *  - POST:   push local vibe presets/history to Supabase
 *
 * Expected Supabase table: vibes
 * Columns:
 *  - user_id (text, PK part)
 *  - kind (text, PK part)           // "preset" | "recent" | future kinds
 *  - label (text)
 *  - prompt (text, PK part)         // normalized prompt/raw text
 *  - palette (jsonb, nullable)      // normalized palette payload
 *  - updated_at (timestamptz)
 */

const { allowOrigin, json, logTelemetry } = require("./lib/sc-auth-lib.js");
const { getJwtUser, supabaseRestCall } = require("./lib/sc-supabase-cjs.js");

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

function buildReqFromEvent(event) {
  const headers = event.headers || {};
  return {
    headers: {
      get: (name) => {
        const k = Object.keys(headers).find(x => x.toLowerCase() === name.toLowerCase());
        return k ? headers[k] : null;
      }
    }
  };
}

exports.handler = async function (event) {
  const method = event.httpMethod;
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin || "";
  const allowed = allowOrigin(origin) || null;

  if (method === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": allowed || "*",
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET,POST,OPTIONS",
        vary: "Origin"
      }
    };
  }

  if (!AUTH_ENABLED) {
    logTelemetry("sync_disabled", { endpoint: "sync-vibes", origin });
    return json(200, { auth_enabled: false }, allowed || "*");
  }
  if (!allowed && origin) {
    return json(403, { error: "Origin not permitted." }, "*");
  }
  if (method !== "GET" && method !== "POST") {
    return json(405, { error: "Method not allowed" }, allowed || "*");
  }

  try {
    const user = getJwtUser(buildReqFromEvent(event));
    if (!user) {
      logTelemetry("sync_auth_invalid", { endpoint: "sync-vibes", origin });
      return json(401, { error: "Missing or invalid token" }, allowed || "*");
    }

    if (method === "GET") {
      const rows = await supabaseRestCall(
        "vibes?select=kind,label,prompt,palette,updated_at&order=updated_at.desc&limit=100",
        "GET",
        null,
        user.token
      );

      if (!rows || rows.length === 0) {
        logTelemetry("sync_vibes_hydrate_empty", { endpoint: "sync-vibes", origin });
        return json(200, { hasData: false, items: [] }, allowed || "*");
      }

      const items = rows.map((r) => ({
        kind: r.kind || "recent",
        label: r.label || "",
        prompt: r.prompt || "",
        palette: r.palette || null,
        updatedAt: r.updated_at || null
      }));

      logTelemetry("sync_vibes_hydrate_success", {
        endpoint: "sync-vibes",
        origin,
        count: items.length
      });

      return json(200, { hasData: items.length > 0, items }, allowed || "*");
    }

    // POST: push local vibes to cloud
    const body = JSON.parse(event.body || "{}");
    const vibes = Array.isArray(body.vibes) ? body.vibes : [];

    // Keep payload intentionally small and future-friendly.
    const nowIso = new Date().toISOString();
    const payload = vibes
      .slice(0, 100)
      .filter((v) => v && typeof v.prompt === "string" && v.prompt.trim().length > 0)
      .map((v) => ({
        user_id: user.uid,
        kind: v.kind || "recent",
        label: v.label || "",
        prompt: v.prompt.trim(),
        palette: v.palette || null,
        updated_at: v.updatedAt || nowIso,
        _upsert: true
      }));

    if (payload.length > 0) {
      await supabaseRestCall(
        "vibes?on_conflict=user_id,kind,prompt",
        "POST",
        payload,
        user.token
      );
    }

    logTelemetry("sync_vibes_success", {
      endpoint: "sync-vibes",
      origin,
      synced: payload.length
    });

    return json(200, { synced: payload.length }, allowed || "*");
  } catch (err) {
    logTelemetry("sync_vibes_error", {
      endpoint: "sync-vibes",
      origin,
      error: err.message
    });
    return json(500, { error: err.message }, allowed || "*");
  }
};
