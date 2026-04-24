# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Is This?

**CIES Internal Check — Regulatory Auditor.** Internal compliance tool for the Hong Kong financial market. Runs server-side Playwright captures against four live regulatory sites for ~20 internal users (5 power users). Rebuilt April 2026 to move off Vercel serverless after an architectural-bug treadmill; now runs as a single long-lived Chromium on a GCP e2-micro VM (us-central1-a, project `cies-tool-494207`).

See `docs/superpowers/specs/2026-04-20-cies-rebuild-design.md` for the authoritative design. Section 13 documents accepted risks (no auth, no rate limiting) and their reversal triggers.

---

## Commands

```bash
npm run dev          # Dev server → http://localhost:3000
npm run build
npm run lint
npm run type-check
npx playwright install chromium   # Required once for local dev
```

No test runner. Verification is: type-check + lint + build + live-site smoke.

Local dev env:
```bash
INTERNAL_API_SECRET=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa \
CIES_DATA_DIR=/tmp/cies-data \
npm run dev
```

`scripts/smoke.ts` exists but is **stale** — it references old `../src/actions/*` paths that no longer exist. Do not run it.

---

## Tech Stack

Next.js 15 · React 19 · Tailwind v4 · Playwright (via `playwright` devDependency locally; `mcr.microsoft.com/playwright:v1.57.0-jammy-arm64` base image in prod) · JSZip · `p-limit` · Zod (input validation).

**Deleted from the Vercel era:** `@sparticuz/chromium`, mock-mode, Gemini env requirement, pkill zombie workaround, runtime font download, `vercel.json`.

---

## Architecture

```
src/
├── app/
│   ├── api/
│   │   ├── capture/{hkex,sfc,afrc,afrc-firm}/route.ts  # Route Handlers
│   │   ├── history/route.ts
│   │   ├── history/[id]/image/route.ts
│   │   └── health/route.ts
│   ├── {sfc,afrc,afrc-firm}/page.tsx                   # Legacy redirects → /
│   ├── logs/page.tsx                                    # Read-only viewer
│   ├── layout.tsx
│   └── page.tsx                                         # Renders ToolWorkspace
├── components/
│   ├── layout/{Sidebar.tsx, ToolWorkspace.tsx}          # Keep-alive switcher
│   ├── panels/{HkexPanel,SfcPanel,AfrcPanel,AfrcFirmPanel}.tsx
│   └── shared/{LanguageToggle,BulkInput,ScreenshotActions,DownloadZipButton,
│              RecentCaptures,CaptureButton,CaptureSkeleton,SearchForm}.tsx
├── lib/
│   ├── browser-singleton.ts     # Long-lived Chromium + watchdog
│   ├── semaphore.ts             # p-limit wrapper, cap 12
│   ├── capture-store.ts         # /data/captures/<tool>/<YYYY-MM-DD>/<uuid>.png + 24h cleanup
│   ├── capture-log.ts           # JSONL → /data/logs/captures.log
│   ├── self-ping.ts             # Hourly keep-alive
│   ├── run-capture.ts           # Orchestrator: semaphore + context + retry-once + log + store
│   ├── playwright-utils.ts      # Stealth context, robustClick, clipScreenshot
│   └── captures/{hkex,sfc,afrc,afrc-firm}.ts
└── env.ts                       # Zod-validated env — import this, not process.env
```

### Environment variables

**Always use `import { env } from '@/env'`** to access environment variables. `env.ts` validates at startup and will throw a clear error if required vars are missing. Direct `process.env` access bypasses this and should not be used.

### Keep-Alive Panel Switching

`ToolWorkspace.tsx` always mounts all 4 panels. Only the active one gets `display:block`. Preserves inputs/results/loading across tab switches. **Do not convert to conditional rendering.**

Active tab is persisted to `sessionStorage` (survives refresh, not window close).

### Runtime model

One `chromium.launch()` at first-request. Each capture opens a fresh `BrowserContext`. Watchdog respawns on disconnect or every 24 h. Concurrency semaphore (cap 12) queues overflow. Bulk captures (SFC loop, AFRC client-side loop) occupy one slot for the whole batch.

**Background services** (`startWatchdog`, `startCleanupTimer`, `startSelfPing`) are bootstrapped lazily — they start on the first call to `/api/health` (or any capture route), not at server startup. In production, the first health check after deploy warms everything up.

### Capture route pattern

Each capture route: validate with Zod → call `orchestrateCapture` from `run-capture.ts` → return `{ success, results }`.

**Exception: `api/capture/sfc/route.ts`** does not use `orchestrateCapture` — it manually wires up `getBrowser` / `createStealthContext` / `withCaptureSlot` / `storeCapture` / `logCapture` because SFC returns multiple results (one per fund name) in a single browser session. If you add a new tool, follow the HKEX/AFRC pattern with `orchestrateCapture`, not the SFC pattern.

### Retry policy

Navigation failures (`goto`, `net::`, nav timeouts) → silent retry once in `run-capture.ts`. Selector failures → no retry, surface error to user (signals site redesign).

### Screenshot fallback

`clipScreenshot` tries `fullPage:true` first; on Chrome GPU texture-limit error, measures `document.body.scrollHeight` and clips to `min(scrollHeight, 4096)`.

---

## The Four Tools

### HKEX — Equities Capture
- URL: `https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK`
- Search selector: `input[placeholder="代號 / 關鍵字"]` (with fallbacks)
- Output: viewport-only PNG

### SFC — CIES Fund List
- URL: `.../en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES` or `.../tc/...`
- Accordion: `.accordin_expand`
- Row screenshot via `page.locator('tr', { hasText: name })`
- **EN / 中文 toggle:** direct URL swap, no in-page click

### AFRC Individual — CPA Register
- URL: `https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx`
- Selectors: `#vNAME`, `#vREGNO`, `#BTNUA_SEARCH`, `#GridContainerDiv`
- Post-click: `waitForNavigation` + `robustClick` (ASP.NET postback)

### AFRC Firm — CPA Firm Register
- URL: `.../ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx` (**different app** from AFRC Individual)
- Selectors: `#vNAME`, `#vCHINESENAME`, `#vREGNO`
- GeneXus quirk: inputs hidden during init — use `waitFor('attached')` + `fill({force:true})`

---

## Environment Variables

```env
INTERNAL_API_SECRET=<min 32 chars>        # Required
CIES_DATA_DIR=/data                       # Override for local dev (/tmp/cies-data)
CIES_SELF_PING_URL=https://.../api/health # Production only, prevents GCP idle reclaim
```

---

## Deployment

GCP VM: `cies-vm`, zone `us-central1-a`, project `cies-tool-494207`. SSH via `gcloud compute ssh cies-vm --project=cies-tool-494207 --zone=us-central1-a`.

Dockerfile builds on Playwright's official ARM64 image. `scripts/deploy-oracle.sh` does one-shot VM setup (Docker, git clone, image build, systemd service, cloudflared install). Manual steps after script: `cloudflared tunnel login/create/route dns`, then set `CIES_SELF_PING_URL` in `/opt/cies/.env` and restart.

---

## If you're about to add another serverless-era workaround, stop

The repo's pre-April-2026 history is a bug ledger of workarounds for Vercel serverless constraints (60 s timeout, 2 GB RAM, warm-container zombies, `/tmp` font download, sparticuz version pinning). Those constraints no longer exist in this architecture. If you see a new "browser closed" / "timeout exceeded" / "OOM" class bug, **check the GCP VM health first** (`/api/health`, `journalctl -u cies`) — do not add `pkill` hacks, texture-fallback patches, or timeout reductions. Recovery is already handled by the watchdog and semaphore.

---

## Known fragilities (genuine, not serverless-related)

- **HKEX Chinese placeholder** `代號 / 關鍵字` breaks if HKEX restyles the search box.
- **SFC accordion class** `.accordin_expand` and row-text filter are fragile to redesign.
- **AFRC control IDs** are stable ASP.NET IDs but must be re-verified if either page is updated. The Firm and Individual sites are separate applications.
- **AFRC Firm GeneXus** occasionally changes visibility timing — the `attached` + `force:true` dance handles current behavior.
- **Chrome GPU texture limit** on tall AFRC results — mitigated by `clipScreenshot` fallback.
