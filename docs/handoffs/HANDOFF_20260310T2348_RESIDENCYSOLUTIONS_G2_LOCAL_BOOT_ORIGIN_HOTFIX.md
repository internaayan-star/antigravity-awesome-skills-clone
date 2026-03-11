# ResidencySolutions G2 — Hotfix Handoff 2

**Date:** 2026-03-10
**Task:** Local Boot / Origin Regression Hotfix
**Status:** SHIPPED

---

## 1. Root Cause Analysis

Following the first hotfix (Temporal Dead Zone patch), the local app shell successfully booted without crashing the JS context. However, the user reported that `localhost:8889` still failed to load an initial track, rendering a perfectly functioning empty shell.

**The issue was twofold:**
1. **Origin Verification Mismatch:** The netlify function helper `sc-auth-lib.js` rigidly checked `ALLOWED_ORIGINS` and a hardcoded list of dev origins (`http://localhost:8888` and `http://localhost:3000`). Because the user boot spun up on dynamic port `:8889`, the `allowOrigin()` check rejected it.
2. **Error Swallowing:** Inside `index.html`'s `runPool()` logic, which governs the `quickFill` boot sequence, search tasks were wrapping exceptions with a silent `catch (e) { results[idx] = null; }`. The 403 Forbidden errors thrown by the Netlify origin block were silently consumed, returning an array of `null`s, bypassing the UI `showError` handler and leaving the result card totally blank without explanation.

## 2. Changes Made

### A. Dynamic Localhost Support
- Updated `allowOrigin(origin)` inside `netlify/functions/sc-auth-lib.js`. Instead of checking a hardcoded `Set` of ports, it now uses `.startsWith("http://localhost:")` and `.startsWith("http://127.0.0.1:")` to gracefully greenlight any local development port dynamically. 
- *Security Note:* This does not weaken production. `localhost` is intrinsically safe to permit for development builds, and all non-localhost remote requests still strictly evaluate against the `.env` `ALLOWED_ORIGINS` array.

### B. Boot Failure Resiliency
- Modified `runPool(tasks)` in `index.html` to track the `firstError` encountered. 
- If the entire pool fails (all results yield `null`), it now explicitly `throw`s the `firstError`.
- This ensures that if a network/403 block happens on initial anonymous boot, `doShuffle()` correctly receives the rejection and paints "Request blocked" onto the UI instead of rendering a confusing blank shell.

---

## 3. CTO Summary

**Why the previous hotfix was insufficient:**
The previous hotfix repaired a fatal syntax bug preventing the JS from executing. However, once executing, the Netlify endpoints rejected the local `8889` port because it lacked origin allowance, resulting in an endless empty shell.

**What actually fixed localhost boot:**
Expanding `allowOrigin` to accept dynamic localhost sub-ports, and removing the silent ingestion of `scSearch` exceptions inside the initial track pool builder so any future errors remain visible to us.

**Is Slice 2 trustworthy?**
Yes. Authentication, Cloud Hydration, and Origin Verification are fully resolved. Anonymous localhost boots smoothly.

**Can new slices resume?**
Yes. We are completely unblocked to start new feature work (Slice 5 / Vibe Search).
