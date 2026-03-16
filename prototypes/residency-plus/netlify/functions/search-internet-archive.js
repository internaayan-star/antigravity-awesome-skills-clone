/**
 * search-internet-archive.js — Internet Archive beta search for Residency+.
 *
 * SEARCH-ONLY: Returns lightweight metadata for Internet Archive items that match
 * a query and are tagged as audio/etree. This endpoint is used by the
 * Internet Archive Beta UI and does NOT participate in the main shuffle/player
 * pipeline.
 *
 * Example sanity check (in browser or curl):
 *   /.netlify/functions/search-internet-archive?q=dub&limit=5
 *
 * Expected: JSON { collection: [...] } with `identifier`, `title`, etc.
 */

const { allowOrigin, json } = require("./lib/sc-auth-lib.js");

const IA_SEARCH_URL = "https://archive.org/advancedsearch.php";

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
        "access-control-allow-headers": "content-type",
        "access-control-allow-methods": "GET,OPTIONS",
        vary: "Origin"
      }
    };
  }

  if (method !== "GET") {
    return json(405, { error: "Method not allowed" }, allowOrigin(origin) || "*");
  }

  const q = (event.queryStringParameters?.q || "").trim();
  const limit = Math.min(50, Math.max(1, parseInt(event.queryStringParameters?.limit || "20", 10)));

  if (!q) {
    return json(200, { collection: [] }, allowOrigin(origin) || "*");
  }

  try {
    // Simple audio search: (q) AND mediatype:(audio OR etree)
    const query = `(${q}) AND mediatype:(audio OR etree)`;
    const params = new URLSearchParams();
    params.set("q", query);
    params.set("rows", String(Math.min(limit, 24)));
    params.set("output", "json");
    params.set("sort[]", "downloads desc");
    ["identifier", "title", "creator", "publicdate", "mediatype"].forEach(f => params.append("fl[]", f));

    const url = `${IA_SEARCH_URL}?${params.toString()}`;
    console.log("[IA beta] request URL", url);

    const res = await fetch(url, {
      headers: { "User-Agent": "ResidencyPlus/IA-Beta-Search" }
    });
    if (!res.ok) {
      console.error("[IA beta] search error", res.status);
      return json(200, { collection: [] }, allowOrigin(origin) || "*");
    }
    const data = await res.json();
    const docs = data?.response?.docs || [];
    console.log("[IA beta] docs returned", docs.length);

    const collection = docs
      .map(doc => {
        const identifier = doc.identifier;
        if (!identifier) return null;
        const rawTitle = doc.title;
        const title = Array.isArray(rawTitle) ? rawTitle[0] : rawTitle || "Untitled";
        const creator = doc.creator;
        const artist = Array.isArray(creator) ? creator[0] : (creator || "");
        const detailsUrl = `https://archive.org/details/${identifier}`;
        return {
          id: identifier,
          title: String(title),
          artist: String(artist),
          url: detailsUrl,
          openUrl: detailsUrl,
          artworkUrl: null,
          _source: "internet_archive",
          _sourceLabel: "Internet Archive"
        };
      })
      .filter(Boolean);

    return json(200, { collection }, allowOrigin(origin) || "*");
  } catch (e) {
    console.error("[IA beta] unexpected error", e && e.message);
    return json(200, { collection: [] }, allowOrigin(origin) || "*");
  }
};
