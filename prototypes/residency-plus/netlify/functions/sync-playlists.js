/**
 * sync-playlists.js — Cloud continuity for playlists.
 * Synchronizes local playlists state to the Supabase database.
 * Method: GET/POST
 * Body (POST): { playlists: [{id, name, updated_at, items: [...]}] }
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
    logTelemetry("sync_disabled", { endpoint: "sync-playlists", origin });
    return json(200, { auth_enabled: false }, allowed || "*");
  }
  if (!allowed && origin) return json(403, { error: "Origin not permitted." }, "*");
  if (method !== "POST" && method !== "GET") return json(405, { error: "Method not allowed" }, allowed || "*");

  try {
    const user = getJwtUser(buildReqFromEvent(event));
    if (!user) {
      logTelemetry("sync_auth_invalid", { endpoint: "sync-playlists", origin });
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
      const pls = await supabaseRestCall(`playlists?select=id,name,updated_at&order=updated_at.desc`, "GET", null, user.token);
      if (!pls || pls.length === 0) {
        logTelemetry("sync_playlists_hydrate_empty", { endpoint: "sync-playlists", origin });
        return json(200, { hasData: false, playlists: [] }, allowed || "*");
      }

      const pItems = await supabaseRestCall(`playlist_items?select=playlist_id,soundcloud_url,title,artist,bucket,kind,duration_ms,added_at&order=added_at.asc`, "GET", null, user.token);
      const itemsByPl = {};
      if (pItems) {
        for (const t of pItems) {
          if (!itemsByPl[t.playlist_id]) itemsByPl[t.playlist_id] = [];
          itemsByPl[t.playlist_id].push({
            url: t.soundcloud_url,
            title: t.title,
            artist: t.artist,
            bucket: t.bucket,
            kind: t.kind,
            durationMs: t.duration_ms,
            addedAt: t.added_at
          });
        }
      }

      const mapped = pls.map(p => ({
        id: p.id,
        name: p.name,
        updated_at: p.updated_at,
        items: itemsByPl[p.id] || []
      }));
      logTelemetry("sync_playlists_hydrate_success", {
        endpoint: "sync-playlists",
        origin,
        playlists_count: mapped.length
      });
      return json(200, { hasData: true, playlists: mapped }, allowed || "*");
    }

    const body = JSON.parse(event.body || "{}");
    const playlists = body.playlists || [];
    if (!Array.isArray(playlists)) return json(400, { error: "Invalid payload format" }, allowed || "*");

    const maxPlaylists = entitlements.playlistsLimit;
    const maxItems = entitlements.playlistItemsLimit;

    const localPlaylists = playlists.slice(0, maxPlaylists);

    let syncedCount = 0;

    for (const pl of localPlaylists) {
      // 1. Upsert Playlist Record
      const plPayload = {
        id: pl.id,
        user_id: user.uid,
        name: pl.name,
        updated_at: pl.updated_at || new Date().toISOString()
      };

      await supabaseRestCall(`playlists?on_conflict=id`, "POST", plPayload, user.token);

      // 2. Clear existing playlist items in db (RLS protects other users' items)
      await supabaseRestCall(`playlist_items?playlist_id=eq.${pl.id}`, "DELETE", null, user.token);

      // 3. Insert new items
      const items = Array.isArray(pl.items) ? pl.items : [];
      const itemsPayload = items.slice(0, maxItems).map(t => ({
        playlist_id: pl.id,
        user_id: user.uid,
        soundcloud_url: t.url,
        title: t.title,
        artist: t.artist,
        bucket: t.bucket,
        kind: t.kind,
        duration_ms: t.durationMs,
        added_at: t.addedAt || new Date().toISOString()
      }));

      if (itemsPayload.length > 0) {
        await supabaseRestCall(`playlist_items`, "POST", itemsPayload, user.token);
      }

      syncedCount++;
    }

    // Pull all user playlist IDs from cloud. If cloud has IDs not in the local set, delete them.
    const cloudPlaylists = await supabaseRestCall(`playlists?select=id`, "GET", null, user.token) || [];
    const localIds = new Set(localPlaylists.map(p => p.id));

    for (const cloudPl of cloudPlaylists) {
      if (!localIds.has(cloudPl.id)) {
        await supabaseRestCall(`playlists?id=eq.${cloudPl.id}`, "DELETE", null, user.token);
      }
    }

    logTelemetry("sync_playlists_success", {
      endpoint: "sync-playlists",
      origin,
      synced: syncedCount,
      plan: entitlements.plan
    });

    return json(200, {
      synced: syncedCount,
    }, allowed || "*");

  } catch (err) {
    logTelemetry("sync_playlists_error", { endpoint: "sync-playlists", origin, error: err.message });
    return json(500, { error: err.message }, allowed || "*");
  }
};
