# PROJECT ROUTER
_Last refreshed: 2026-02-18 08:42 EST_

Single-page map of all active lanes. Scan this first every session.

---

## Lane Map

| Lane | Repo / Path | Branch | Status | Guardrails |
|------|------------|--------|--------|------------|
| **Residency Quest** | `G:\residency-quest` | `main` (RQ-001→003 merged); `feat/rq-004-class-weighted-xp` (ready to merge) | RQ-004 complete, pending merge to main | FL Studio-first gamified creative platform. **NOT Roblox.** |
| **Roblox Horror Pivot** | TBD (Roblox Studio) | n/a | Architecture locked (v3). No code repo yet. | Separate lane from RQ. Military Ruin Horror, 4–6 co-op. |
| **reidmd.net** | Shopify (Dawn theme) | live | Stabilized v8. Homepage cinematic + product page locked. | Never load homepage CSS on product pages. See `reidmd-theme-debug.md`. |
| **Local Clipper V6** | `G:\StreamSegments\local-clipper` | `feat/v6-parity-core` | Tests passing (3/3). Streamlit smoke OK. Manual acceptance A–E still pending. | Use `.venv` python only. Never stage `.venv/`. |
| **P0 Clip Factory** | (within local-clipper or adjacent) | n/a | All P0 items checked. Acceptance tests pending (needs overnight GPU run). | High-compute — night run only. |
| **antigravity-awesome-skills** | `c:\Users\sean\antigravity-awesome-skills` | `main` | Active. Shared context + skill sets. | This repo. Governance docs live here. |

---

## Hard Locks (Do Not Violate)

1. **Residency Quest = FL Studio-first gamified creative workflow platform (NOT Roblox).**
2. **Roblox Horror Pivot = separate lane.** Do not mix with RQ.
3. **Do not mix lanes** — one lane per operator session.
4. **ComfyUI-safe mode** during daytime runs — no GPU/CUDA/inference/transcoding.

---

## Key Context Files

| File | Purpose |
|------|---------|
| `ChatGPT_Context/RESIDENCY_QUEST_MASTER_v9.md` | RQ living brief |
| `ChatGPT_Context/ROBLOX_HORROR_PIVOT_MASTER_v3.md` | Roblox pivot master |
| `ChatGPT_Context/CODEX_CONTEXT.md` | Local Clipper V6 state |
| `ChatGPT_Context/SESSION_BOOT.md` | Clipper session boot protocol |
| `ChatGPT_Context/reidmd-theme-debug.md` | Shopify theme runbook |
| `ChatGPT_Context/P0_CLIP_FACTORY_CHECKLIST.md` | Clip factory checklist |
| `docs/NOW_NEXT_LATER.md` | Prioritized roadmap |
| `docs/BLOCKERS.md` | Open blockers |
