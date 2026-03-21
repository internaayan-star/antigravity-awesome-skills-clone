/**
 * sync-session-state.js — Cloud continuity for session state.
 * Method: GET/POST
 * Body (POST): { genre, source, dig_range, station_id }
 */

const { allowOrigin, json } = require("./lib/sc-auth-lib.js");
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

  if (!AUTH_ENABLED) return json(200, { auth_enabled: false }, allowed || "*");
  if (!allowed && origin) return json(403, { error: "Origin not permitted." }, "*");
  if (method !== "POST" && method !== "GET") return json(405, { error: "Method not allowed" }, allowed || "*");

  try {
    const user = getJwtUser(buildReqFromEvent(event));
    if (!user) return json(401, { error: "Missing or invalid token" }, allowed || "*");

    if (method === "GET") {
      const data = await supabaseRestCall(`session_state?select=genre,source,dig_range,station_id&limit=1`, "GET", null, user.token);
      if (!data || data.length === 0) return json(200, { hasData: false, state: null }, allowed || "*");
      return json(200, { hasData: true, state: data[0] }, allowed || "*");
    }

    const body = JSON.parse(event.body || "{}");

    const payload = {
      user_id: user.uid,
      genre: body.genre,
      source: body.source,
      dig_range: body.dig_range,
      station_id: body.station_id,
      updated_at: new Date().toISOString(),
      // Special flag handled by our supabaseRestCall helper to properly format the REST request
      _upsert: true
    };

    // Note: the helper strips _upsert and adds Prefer: return=representation,resolution=merge-duplicates
    await supabaseRestCall(`session_state?on_conflict=user_id`, "POST", payload, user.token);

    return json(200, { synced: true }, allowed || "*");

  } catch (err) {
    return json(500, { error: err.message }, allowed || "*");
  }
};
