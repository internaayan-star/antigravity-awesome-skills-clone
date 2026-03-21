/**
 * sync-crate.js — Cloud continuity for the saved crate.
 * Synchronizes the local crate state to the Supabase database.
 * Method: GET/POST
 * Body (POST): { tracks: [...] }
 */

const { allowOrigin, json, logTelemetry } = require("./lib/sc-auth-lib.js");
const { getJwtUser, supabaseRestCall } = require("./lib/sc-supabase-cjs.js");
const { getEntitlementsForPlan } = require("./lib/entitlements-lib.js");

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
        "access-control-allow-methods": "POST,OPTIONS",
        vary: "Origin"
      }
    };
  }

  if (!AUTH_ENABLED) {
    logTelemetry("sync_disabled", { endpoint: "sync-crate", origin });
    return json(200, { auth_enabled: false }, allowed || "*");
  }
  if (!allowed && origin) return json(403, { error: "Origin not permitted." }, "*");
  if (method !== "POST" && method !== "GET") return json(405, { error: "Method not allowed" }, allowed || "*");

  try {
    const user = getJwtUser(buildReqFromEvent(event));
    if (!user) {
      logTelemetry("sync_auth_invalid", { endpoint: "sync-crate", origin });
      return json(401, { error: "Missing or invalid token" }, allowed || "*");
    }

    // Determine plan for entitlement limits (falls back to free)
    let plan = "free";
    try {
      const profile = await supabaseRestCall(`users?id=eq.${user.uid}&select=plan`, "GET", null, user.token);
      if (profile && profile.length > 0 && profile[0].plan) {
        plan = profile[0].plan;
      }
    } catch {
      // If plan lookup fails, default entitlements still apply (free)
    }
    const entitlements = getEntitlementsForPlan(plan);

    if (method === "GET") {
      const data = await supabaseRestCall(`crate?select=soundcloud_url,title,artist,bucket,kind,duration_ms,saved_at&order=saved_at.desc`, "GET", null, user.token);
      if (!data) {
        logTelemetry("sync_crate_hydrate_empty", { endpoint: "sync-crate", origin });
        return json(200, { hasData: false, items: [] }, allowed || "*");
      }

      // Map back to local state keys
      const mapped = data.map(r => ({
        url: r.soundcloud_url,
        title: r.title,
        artist: r.artist,
        bucket: r.bucket,
        kind: r.kind,
        durationMs: r.duration_ms,
        savedAt: r.saved_at
      }));
      logTelemetry("sync_crate_hydrate_success", { endpoint: "sync-crate", origin, count: mapped.length });
      return json(200, { hasData: mapped.length > 0, items: mapped }, allowed || "*");
    }

    const body = JSON.parse(event.body || "{}");
    const tracks = body.tracks || [];
    if (!Array.isArray(tracks)) return json(400, { error: "Invalid payload format" }, allowed || "*");

    const limit = entitlements.crateLimit;

    const payload = tracks.slice(0, limit).map(t => ({
      user_id: user.uid,
      soundcloud_url: t.url,
      title: t.title,
      artist: t.artist,
      bucket: t.bucket,
      kind: t.kind,
      duration_ms: t.durationMs,
      saved_at: t.savedAt || new Date().toISOString()
    }));

    if (payload.length > 0) {
      // Upsert on conflict by (user_id, soundcloud_url)
      await supabaseRestCall(`crate?on_conflict=user_id,soundcloud_url`, "POST", payload, user.token);
    }

    // Return a representation of the server's truth (just counts for now)
    const serverData = await supabaseRestCall(`crate?select=id,soundcloud_url,saved_at`, "GET", null, user.token);

    const total = serverData ? serverData.length : 0;
    logTelemetry("sync_crate_success", {
      endpoint: "sync-crate",
      origin,
      synced: payload.length,
      total_cloud: total,
      plan: entitlements.plan
    });

    return json(200, {
      synced: payload.length,
      total_cloud: total
    }, allowed || "*");

  } catch (err) {
    logTelemetry("sync_crate_error", { endpoint: "sync-crate", origin, error: err.message });
    return json(500, { error: err.message }, allowed || "*");
  }
};
