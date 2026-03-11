// Minimal ESM Netlify Function v2 test
export default async function handler(req) {
    return new Response(JSON.stringify({ ok: true, type: "ESM_V2" }), {
        status: 200,
        headers: { "content-type": "application/json" }
    });
}
