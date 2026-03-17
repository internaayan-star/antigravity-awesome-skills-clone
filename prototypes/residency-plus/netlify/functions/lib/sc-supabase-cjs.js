/**
 * sc-supabase-cjs.js — CommonJS build of Supabase JWT + REST helpers.
 * Used by search-uploads.js (CJS) so we do not mix CJS/ESM in the same function.
 * Logic matches sc-supabase-lib.js (ESM); no ESM imports here.
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
 * @param {{ headers: { get: (name: string) => string | null } }} req
 */
function getJwtUser(req) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;
  const token = authHeader.replace("Bearer ", "").trim();
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(b64uDec(parts[1]));
    if (!payload || !payload.sub) return null;
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) return null;
    return { uid: payload.sub, email: payload.email, token };
  } catch {
    return null;
  }
}

async function supabaseRestCall(path, method, body, userToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error("Supabase env vars missing.");
  const authHeader = userToken ? `Bearer ${userToken}` : `Bearer ${SUPABASE_ANON_KEY}`;
  const headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: authHeader,
    "Content-Type": "application/json",
    Accept: "application/json",
    Prefer: "return=representation"
  };
  if (method === "POST" && body && body._upsert) {
    headers.Prefer = "return=representation,resolution=merge-duplicates";
    body = { ...body };
    delete body._upsert;
  }
  const url = `${SUPABASE_URL}/rest/v1/${path}`;
  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    let errStr = "Supabase API error";
    try {
      const errObj = await res.json();
      errStr = errObj.message || errStr;
    } catch {}
    throw new Error(`${errStr} (HTTP ${res.status})`);
  }
  if (res.status === 204) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

module.exports = { getJwtUser, supabaseRestCall };
