/**
 * sync-history.js — Cloud continuity for playback history.
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
        "access-control-allow-methods": "GET,POST,OPTIONS",
        vary: "Origin"
      }
    };
  }

  if (!AUTH_ENABLED) {
    logTelemetry("sync_disabled", { endpoint: "sync-history", origin });
    return json(200, { auth_enabled: false }, allowed || "*");
  }
  if (!allowed && origin) return json(403, { error: "Origin not permitted." }, "*");
  if (method !== "POST" && method !== "GET") return json(405, { error: "Method not allowed" }, allowed || "*");

  try {
    const user = getJwtUser(buildReqFromEvent(event));
    if (!user) {
      logTelemetry("sync_auth_invalid", { endpoint: "sync-history", origin });
      return json(401, { error: "Missing or invalid token" }, allowed || "*");
    }

    let plan = "free";
    try {
      const profile = await supabaseRestCall(`users?id=eq.${user.uid}&select=plan`, "GET", null, user.token);
      if (profile && profile.length > 0 && profile[0].plan) {
        plan = profile[0].plan;
      }
    } catch {
    }
    const entitlements = getEntitlementsForPlan(plan);

    if (method === "GET") {
      const data = await supabaseRestCall(`history?select=soundcloud_url,title,artist,bucket,played_at&order=played_at.desc&limit=50`, "GET", null, user.token);
      if (!data) {
        logTelemetry("sync_history_hydrate_empty", { endpoint: "sync-history", origin });
        return json(200, { hasData: false, items: [] }, allowed || "*");
      }

      const mapped = data.map(r => ({
        url: r.soundcloud_url,
        title: r.title,
        artist: r.artist,
        bucket: r.bucket,
        playedAt: r.played_at
      }));
      logTelemetry("sync_history_hydrate_success", { endpoint: "sync-history", origin, count: mapped.length });
      return json(200, { hasData: mapped.length > 0, items: mapped }, allowed || "*");
    }

    const body = JSON.parse(event.body || "{}");
    const tracks = body.tracks || [];
    if (!Array.isArray(tracks)) return json(400, { error: "Invalid payload format" }, allowed || "*");

    const limit = entitlements.historyLimit;

    const payload = tracks.slice(0, limit).map(t => ({
      user_id: user.uid,
      soundcloud_url: t.url,
      title: t.title,
      artist: t.artist,
      bucket: t.bucket,
      played_at: t.playedAt || new Date().toISOString()
    }));

    if (payload.length > 0) {
      await supabaseRestCall(`history`, "POST", payload, user.token);
    }

    logTelemetry("sync_history_success", {
      endpoint: "sync-history",
      origin,
      synced: payload.length,
      plan: entitlements.plan
    });

    return json(200, { synced: payload.length }, allowed || "*");

  } catch (err) {
    logTelemetry("sync_history_error", { endpoint: "sync-history", origin, error: err.message });
    return json(500, { error: err.message }, allowed || "*");
  }
};
