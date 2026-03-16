/**
 * uploads-get.js — Get one upload's metadata by id. Ownership: only the owning user can read.
 * Backend-only; not wired to production UI.
 */
import { allowOrigin, json } from "./lib/sc-auth-lib.js";
import { getJwtUser, supabaseRestCall } from "./sc-supabase-lib.js";

const AUTH_ENABLED = process.env.AUTH_ENABLED === "true";

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    const origin = allowOrigin(req.headers.get("origin"));
    return new Response("", {
      status: 204,
      headers: {
        "access-control-allow-origin": origin || "*",
        "access-control-allow-headers": "content-type, authorization",
        "access-control-allow-methods": "GET,OPTIONS",
      },
    });
  }

  const origin = allowOrigin(req.headers.get("origin"));
  if (!origin && req.headers.get("origin")) return json(403, { error: "Origin not permitted." }, origin);
  if (req.method !== "GET") return json(405, { error: "Method not allowed" }, origin);

  if (!AUTH_ENABLED) {
    return json(404, { error: "Not found" }, origin);
  }

  const user = getJwtUser(req);
  if (!user) {
    return json(401, { error: "Missing or invalid token" }, origin);
  }

  const id = new URL(req.url || "").searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return json(400, { error: "Invalid id" }, origin);
  }

  // RLS ensures only owner can read; we filter by user_id for explicit ownership check
  const path = `user_uploads?id=eq.${encodeURIComponent(id)}&user_id=eq.${user.uid}&select=id,user_id,title,artist,original_filename,mime_type,duration_ms,artwork_url,storage_url,created_at,updated_at`;

  try {
    const data = await supabaseRestCall(path, "GET", null, user.token);
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) {
      return json(404, { error: "Not found" }, origin);
    }
    return json(200, rows[0], origin);
  } catch (e) {
    console.error("[uploads-get] error", e?.message);
    return json(500, { error: "Server error" }, origin);
  }
}
