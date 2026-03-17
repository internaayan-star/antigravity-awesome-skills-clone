/**
 * search-uploads.js — User uploads discovery adapter for Residency+.
 * When Authorization is present: returns the user's uploads from user_uploads (normalized).
 * When no auth or error: returns empty collection (production behaviour unchanged when flag off).
 */

const { allowOrigin, json } = require("./lib/sc-auth-lib.js");

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

function normalizeUploadRow(row) {
  if (!row) return null;
  const id = row.id || row.uuid || null;
  const title = row.title || row.name || "Untitled upload";
  const artist = row.artist || row.creator || row.uploader || "";
  const audioUrl = row.storage_url || row.audio_url || row.url || null;
  if (!id || !audioUrl) return null;
  return {
    id: String(id),
    title: String(title),
    artist: String(artist || ""),
    url: audioUrl,
    openUrl: audioUrl,
    artworkUrl: row.artwork_url || null,
    sourceId: "uploads",
    sourceLabel: "User Uploads",
    playbackType: "html5_audio",
    playableUrl: audioUrl,
    durationMs: typeof row.duration_ms === "number" ? row.duration_ms : null
  };
}

exports.handler = async function (event) {
  const method = event.httpMethod;
  const headers = event.headers || {};
  const origin = headers.origin || headers.Origin;

  if (method === "OPTIONS") {
    const allowed = allowOrigin(origin);
    if (!allowed) return { statusCode: 204 };
    return {
      statusCode: 204,
      headers: {
        "access-control-allow-origin": allowed,
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET,OPTIONS",
        vary: "Origin"
      }
    };
  }

  if (method !== "GET") {
    return json(405, { error: "Method not allowed" }, allowOrigin(origin) || "*");
  }

  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader || !String(authHeader).startsWith("Bearer ")) {
    return json(200, { collection: [] }, allowOrigin(origin) || "*");
  }

  const { getJwtUser, supabaseRestCall } = require("./lib/sc-supabase-cjs.js");

  const req = buildReqFromEvent(event);
  let user = null;
  try {
    user = getJwtUser(req);
  } catch (e) {
    console.log("[search-uploads] getJwtUser error", e && e.message);
    return json(200, { collection: [] }, allowOrigin(origin) || "*");
  }
  if (!user || !user.uid) {
    return json(200, { collection: [] }, allowOrigin(origin) || "*");
  }

  const limit = Math.min(50, Math.max(1, parseInt(event.queryStringParameters?.limit || "20", 10) || 20));
  const path = `user_uploads?select=id,title,artist,duration_ms,storage_url,artwork_url&user_id=eq.${user.uid}&order=created_at.desc&limit=${limit}`;

  try {
    const data = await supabaseRestCall(path, "GET", null, user.token);
    const rows = Array.isArray(data) ? data : [];
    const collection = rows.map(normalizeUploadRow).filter(Boolean);
    console.log("[search-uploads] uploads count", { uid: user.uid, count: collection.length });
    return json(200, { collection }, allowOrigin(origin) || "*");
  } catch (e) {
    console.error("[search-uploads] Supabase error", e && e.message);
    return json(200, { collection: [] }, allowOrigin(origin) || "*");
  }
};
