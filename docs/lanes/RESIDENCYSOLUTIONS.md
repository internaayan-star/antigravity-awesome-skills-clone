# ResidencySolutions Lane
_Last updated: 2026-03-10 10:25 EST_

## Overview
ResidencySolutions has TWO subcomponents:

### G1: Backend / Product Entitlements Core (NO UI)
- **Status:** UI frozen. SQLite default backend officially signed off.
- **Hard rule:** No UI changes. Run `scripts/guard-no-ui.ps1` if present.
- **Path:** `G:\DOWNLOADS5\reidchunes\residencysolutions-core`

### G2: RESIDENCY+ SoundCloud Digger Prototype
- **Live site (canonical):** [`residencysolutions.netlify.app`](https://residencysolutions.netlify.app)
- **Netlify account:** reiidmd@gmail.com | site ID: `03201d30-0c11-4620-a6e4-20d0150c7742`
- **Source (original):** `G:\DOWNLOADS5\reidchunes`
- **Source (repo copy):** `prototypes/residency-plus/` in this repo
- **Stack:** Static HTML + Netlify Functions (ES module format)
- **What it does:** SoundCloud crate-digging tool with genre filters, shuffle, stations, auto-dig, saved crate, and history. Uses SoundCloud OAuth2 API via serverless proxy.
- **Official wrapper endpoints deployed:** ✅ (2026-03-10)
- **Telemetry State:** Sanitized JSON pipeline confirmed live to Axiom `residency-plus` dataset. See [Axiom Runbook](../../prototypes/residency-plus/AXIOM_RUNBOOK.md), [Dashboards](../../prototypes/residency-plus/AXIOM_DASHBOARD_SPEC.md), [Alert Policy](../../prototypes/residency-plus/ALERT_POLICY.md), & [Bootstrap Checklist](../../prototypes/residency-plus/AXIOM_DASHBOARD_BOOTSTRAP_CHECKLIST.md).
- **Legacy endpoints:** REMOVED (quarantined 2026-03-10). Only `sc-official-search` and `sc-official-resolve` remain.

---

## How to Run Locally

### Prerequisites
```powershell
# Install Netlify CLI (if not installed)
npm install -g netlify-cli

# Verify
netlify --version
```

## API Access
- Apply via SoundCloud help article ("Otto" chatbot) to request API access + credentials.
- Use local `.env` for dev; **do not commit secrets**.
- Netlify Dev reads `.env` locally and can pull Netlify env vars (when not offline).

### Local dev modes
```powershell
cd "c:\Users\sean\antigravity-awesome-skills\prototypes\residency-plus"

# Offline mode (won't pull Netlify env vars)
$env:SOUNDCLOUD_CLIENT_ID="YOUR_CLIENT_ID"
netlify dev --offline --dir "." --functions "netlify/functions" --port 8888

# Online mode (can pull Netlify env vars / read from .env file)
netlify dev --dir "." --functions "netlify/functions" --port 8888
```

- **PowerShell note:** `curl` is an alias for `Invoke-WebRequest`; use `curl.exe -i` to see correct headers and non-2xx response bodies.
- **Expected when missing/placeholder:** Functions return 400 JSON with a missing env var message; UI shows a banner; no request spam.

App will be available at `http://localhost:8888`.

### Deploying to Netlify
```bash
# From prototype directory
netlify deploy --prod
```

Set `SOUNDCLOUD_CLIENT_ID` in: Netlify Dashboard → Site Settings → Environment Variables.

---

## Endpoints (Netlify Functions)

### Primary Endpoints (Official OAuth)
These use the **official SoundCloud OAuth2 client_credentials flow** (Bearer token) with origin allowlist + rate limiting.

| Function | Path | Params | Purpose |
|----------|------|--------|---------|
| `sc-official-search` | `/.netlify/functions/sc-official-search` | `q` (required), `limit` (max 20) | Search via official API |
| `sc-official-resolve`| `/.netlify/functions/sc-official-resolve`| `url` (required) | Resolve SC URL |

---

## Security Notes
- **Never hardcode `SOUNDCLOUD_CLIENT_ID` in frontend code.** It stays server-side in Netlify env vars.
- Functions proxy all SoundCloud API calls so the client ID never reaches the browser.
- `.env` file must be gitignored.

---

## File Inventory (`prototypes/residency-plus/`)

```
prototypes/residency-plus/
├── index.html                # Full RESIDENCY+ app
├── netlify.toml              # Build config
├── LAUNCH_CHECKLIST.md       # Pre-launch verification checklist
├── TELEMETRY_SPEC.md         # Specs for wrapper endpoint analytics
├── TELEMETRY_STORAGE_PLAN.md # Sink planning documentation
├── SMOKE_TEST.md             # Smoke tests & telemetry checkouts
├── AXIOM_RUNBOOK.md          # Operator pipeline diagnostics
├── AXIOM_DASHBOARD_SPEC.md   # Axiom UI visualization models
├── axiom_queries.apl.txt     # Axiom Kusto-like APL starter statements
├── ALERT_POLICY.md                         # Alert conditions and severities
├── AXIOM_DASHBOARD_BOOTSTRAP_CHECKLIST.md  # Step-by-step first dashboard setup
└── netlify/
    └── functions/
        ├── sc-auth-lib.js          # Shared OAuth & Ingest Scaffold
        ├── sc-official-search.js   # Target for search
        └── sc-official-resolve.js  # Target for resolve
```

---

## Roadmap / Upcoming Slices

0. **Local Dev Reliability Hardening / Emergency Reliability Slice**
   - Implemented `DEV_FIXTURE_MODE` and Last-Good-Result failover.
   - Local dev is now insulated from SoundCloud token path issues.
1. **Discovery Engine Upgrade**
   - High priority slice before Vibe Search begins.
2. **Auth + cloud persistence stabilization**
   - Ensuring Supabase and bidirectional sync are fully mature.
3. **SaaS plans + billing + entitlements**
   - Integrating Stripe and access control.
4. **Analytics + retention instrumentation**
   - Deeper user lifecycle tracking.
5. **Vibe Search v1**

### Critical Locking Rules
- **Vibe Search** does NOT begin until **Discovery Engine Upgrade** is complete.
- Local dev must be reliable enough to support product iteration (Fixture Mode + Last-Good enabled).
