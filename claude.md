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

Next.js 15 · React 19 · Tailwind v4 · Playwright (via `playwright` devDependency locally; `playwright-core` as a production dependency) · JSZip · `p-limit` · Zod (input validation).

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

**Always use `import { env } from '@/env'`** to access environment variables. `env.ts` validates `INTERNAL_API_SECRET` and `NODE_ENV` at startup and will crash fast with a clear error if they are missing. `CIES_DATA_DIR` and `CIES_SELF_PING_URL` are read directly via `process.env` in `capture-store.ts` and `self-ping.ts` (not in the Zod schema).

### Keep-Alive Panel Switching

`ToolWorkspace.tsx` always mounts all 4 panels. Only the active one gets `display:block`. Preserves inputs/results/loading across tab switches. **Do not convert to conditional rendering.**

Active tab is persisted to `sessionStorage` (survives refresh, not window close).

### Runtime model

One `chromium.launch()` at first-request. Each capture opens a fresh `BrowserContext`. Watchdog respawns on disconnect or every 24 h. Concurrency semaphore (cap 12) queues overflow. Bulk captures (SFC loop, AFRC client-side loop) occupy one slot for the whole batch.

**Background services bootstrap:**
- `startWatchdog` + `startCleanupTimer` — start on the first call to `/api/health` **or** any capture route (via `ensureBackgroundStarted()` in `run-capture.ts`).
- `startSelfPing` — starts **only** from `/api/health`. In production, the health check after deploy warms everything up.

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
- **Multi-code input:** comma-separated codes are split client-side and fired **sequentially** (not parallel) to avoid saturating the e2-micro's single vCPU. Results stream into the UI as each code completes.
- Nav timeout: 60s
- Output: viewport-only PNG

### SFC — CIES Fund List
- URL: `.../en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES` or `.../tc/...`
- Accordion: `.accordin_expand` — all accordions are clicked in a loop (page may have one or many)
- **Row matching:** query is split on whitespace; each word becomes a chained `.filter({ hasText: /word/i })` on `page.locator('tr')`. This is AND logic — "aia income" matches any row containing both "aia" and "income" (case-insensitive).
- `waitFor` timeout on matched row: 20s (VM is slow to settle after accordion click)
- **EN / 中文 toggle:** direct URL swap, no in-page click

### AFRC Individual — CPA Register
- URL: `https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx`
- API schema: `{ searchType: 'name' | 'regNo', searchValue: string }`
- Selectors: `#vNAME`, `#vREGNO`, `#BTNUA_SEARCH`, `#GridContainerDiv`
- Post-click: `waitForNavigation` + `robustClick` (ASP.NET postback)

### AFRC Firm — CPA Firm Register
- URL: `.../ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx` (**different app** from AFRC Individual)
- API schema: `{ englishName?, chineseName?, regNo? }` — at least one required
- Selectors: `#vNAME`, `#vCHINESENAME`, `#vREGNO`
- GeneXus quirk: inputs hidden during init — use `waitFor('attached')` + `fill({force:true})`

---

## Environment Variables

```env
INTERNAL_API_SECRET=<min 32 chars>        # Required — validated by env.ts at startup
CIES_DATA_DIR=/data                       # Override for local dev (/tmp/cies-data)
CIES_SELF_PING_URL=https://.../api/health # Production only, prevents GCP idle reclaim
```

---

## Deployment

GCP VM: `cies-vm`, zone `us-central1-a`, project `cies-tool-494207`. SSH via:
```bash
gcloud compute ssh cies-vm --project=cies-tool-494207 --zone=us-central1-a
```

**Current production setup (running directly, not Docker):**
```bash
# On the VM, to deploy a new commit:
cd /opt/cies && sudo git pull && sudo npm ci && sudo npm run build && sudo systemctl restart cies
# Verify:
sudo systemctl is-active cies
curl http://127.0.0.1:3000/api/health
```
The service is defined at `/etc/systemd/system/cies.service` and runs `next start` as root with `EnvironmentFile=/opt/cies/.env`.

**`scripts/deploy-oracle.sh`** is a one-shot setup script (originally for Oracle Cloud, now used for GCP) that installs Docker, clones the repo, builds the Docker image, and writes the systemd service. The Dockerfile exists and is maintained, but the running production VM diverged to run `next start` directly (without Docker). If re-provisioning from scratch, the deploy script's Docker-based approach is the intended path; for day-to-day deploys on the existing VM, use the direct commands above.

**Cloudflare tunnel:** `cloudflared` is installed on the VM but the tunnel has not been authenticated. To set up a public HTTPS domain: `cloudflared tunnel login` (requires browser), then `create` / `route dns`, then set `CIES_SELF_PING_URL` in `/opt/cies/.env` and restart.

---

## If you're about to add another serverless-era workaround, stop

The repo's pre-April-2026 history is a bug ledger of workarounds for Vercel serverless constraints (60 s timeout, 2 GB RAM, warm-container zombies, `/tmp` font download, sparticuz version pinning). Those constraints no longer exist in this architecture. If you see a new "browser closed" / "timeout exceeded" / "OOM" class bug, **check the GCP VM health first** (`/api/health`, `journalctl -u cies`) — do not add `pkill` hacks, texture-fallback patches, or timeout reductions. Recovery is already handled by the watchdog and semaphore.

---

## Known fragilities (genuine, not serverless-related)

- **HKEX Chinese placeholder** `代號 / 關鍵字` breaks if HKEX restyles the search box.
- **SFC accordion class** `.accordin_expand` and the `tr`-based row filter are fragile to redesign.
- **AFRC control IDs** are stable ASP.NET IDs but must be re-verified if either page is updated. The Firm and Individual sites are separate applications.
- **AFRC Firm GeneXus** occasionally changes visibility timing — the `attached` + `force:true` dance handles current behavior.
- **Chrome GPU texture limit** on tall AFRC results — mitigated by `clipScreenshot` fallback.
