# BLOCKERS
_Last refreshed: 2026-02-18 08:42 EST_

Open blockers per lane. Update each operator session. Remove when resolved.

---

| ID | Lane | Blocker | Severity | Workaround | Owner |
|----|------|---------|----------|------------|-------|
| B-001 | Residency Quest | RQ-004 branch not yet merged to `main` | Medium | Branch is ready; merge + push is the immediate next action | Sean |
| B-002 | Local Clipper | Manual acceptance tests A–E not yet run | Medium | Pytests green; defer full acceptance to a night session with Streamlit + ffmpeg available | Sean |
| B-003 | Local Clipper | Streamlit port conflicts (8501/8502 sometimes occupied) | Low | Increment port or kill owner process; documented in SESSION_BOOT.md | Sean |
| B-004 | P0 Clip Factory | Acceptance needs overnight GPU run (3+ long videos) | High | All P0 code items done; blocked on compute window | Sean |
| B-005 | Roblox Horror | No code repo created yet | Low | Architecture doc (v3) is locked; repo setup is sprint gate 1 | Sean |
| B-006 | reidmd.net | QA checklist items from v8 not formally verified live | Low | Theme is deployed and visually stable; formal checklist pass is next | Sean |
| B-007 | antigravity-awesome-skills | `git push` 403 permission denied to `sickn33/antigravity-awesome-skills` | Medium | Commit saved locally (`a3b71aa`). Fix GitHub auth (token/SSH) then `git push -u origin main` | Sean |

---

## Resolution Log

| ID | Resolved | Resolution |
|----|----------|------------|
| _(none yet)_ | | |
