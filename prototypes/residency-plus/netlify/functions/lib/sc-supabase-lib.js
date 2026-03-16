/**
 * sc-supabase-lib.js (CJS) — Supabase auth + REST helpers for CJS Netlify handlers
 * (e.g. labs-search-uploads). Accepts event-style args; returns { data, error }.
 * Uses same env: SUPABASE_URL, SUPABASE_ANON_KEY. Secrets server-side only.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

function b64uDec(str) {
  try {
    return Buffer.from(str.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
  } catch {
    return null;
  }
}

/**
 * Get JWT user from Netlify event (event.headers). Returns { id, uid, token } or null.
 */
function getJwtUser(event) {
  const headers = event.headers || {};
  const authHeader = headers.authorization || headers.Authorization;
  if (!authHeader || !String(authHeader).startsWith("Bearer ")) return null;
  const token = String(authHeader).replace("Bearer ", "").trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(b64uDec(parts[1]));
    if (!payload || !payload.sub) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return { id: payload.sub, uid: payload.sub, token };
  } catch {
    return null;
  }
}

/**
 * Call Supabase REST API. opts: { method, path, query, jwt }.
 * path is e.g. "/rest/v1/user_uploads"; query = { select: "...", user_id: "eq.xxx", limit: "24" }.
 * Returns { data, error }. RLS is enforced by Supabase when using jwt.
 */
async function supabaseRestCall(opts) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return { data: null, error: { message: "Supabase env missing" } };
  }
  const { method = "GET", path, query = {}, jwt } = opts;
  const qs = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v != null && v !== "") qs.set(k, v);
  });
  const url = path.startsWith("http") ? path : `${SUPABASE_URL}${path}` + (qs.toString() ? "?" + qs.toString() : "");
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: jwt ? `Bearer ${jwt}` : `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
  try {
    const res = await fetch(url, { method, headers });
    const text = await res.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!res.ok) {
      return { data: null, error: { message: data?.message || `HTTP ${res.status}`, status: res.status } };
    }
    return { data, error: null };
  } catch (e) {
    return { data: null, error: { message: e && e.message ? e.message : "Supabase request failed" } };
  }
}

module.exports = { getJwtUser, supabaseRestCall };
