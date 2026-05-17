# SFC Screenshot Annotation — Design Spec

**Date:** 2026-05-18  
**Scope:** SFC Fund tool only  
**Status:** Approved

---

## Problem

SFC Fund screenshots are plain PNGs of a matched table row. No provenance — reviewers can't tell when the capture was taken or which website it came from.

## Solution

Annotate each SFC screenshot with:
- **Top bar** (dark blue `#1e3a5f`, white text): full source URL
- **Bottom bar** (light blue `#e8f0fe`, dark text): `Captured: YYYY-MM-DD HH:mm:ss HKT`

## Implementation

**File:** `src/lib/captures/sfc.ts` — inside the `for (const rawName of input.fundNames)` loop, replacing the current `firstRow.screenshot()` call.

### Steps (per fund name)

1. Compute `timestamp` (HKT, 24h) and `pageUrl` (`page.url()`) once before the loop.
2. After `firstRow.scrollIntoViewIfNeeded()`, use `firstRow.evaluate()` to inject:
   - `<tr id="__cies-url-bar__">` before `firstRow` — dark header with URL
   - `<tr id="__cies-ts-bar__">` after `firstRow` — light footer with timestamp
3. Grab bounding boxes for all three rows; compute a combined clip rect.
4. Call `page.screenshot({ type: 'png', clip })` to capture all three rows.
5. Fall back to `firstRow.screenshot()` if any bounding box is null.
6. Remove both injected rows via `page.evaluate()`.

### Key details

- `colspan="99"` on the injected `<td>` — HTML5 caps to actual column count, always spans full width.
- Timestamp computed once before the loop (consistent for bulk captures in one session).
- URL from `page.url()` — automatically reflects EN vs TC language selection.
- Cleanup always runs (even on fallback path).

## Verification

1. `npm run dev` with local env vars
2. Capture any SFC fund name
3. PNG must show: dark URL bar → fund row → light timestamp bar
4. Verify EN and TC produce different URLs in the bar
5. Verify bulk (multiple fund names) all get correct annotation
