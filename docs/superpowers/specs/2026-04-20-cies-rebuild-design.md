# CIES Internal Check — Rebuild Design

**Date:** 2026-04-20
**Author:** Marco (with Claude, brainstorming session)
**Status:** Draft pending user review

---

## 1. Why rebuild

The current CIES-SaaS app has accumulated 15 consecutive `fix:` commits on the serverless-Chromium layer since October 2025. Every fix has surfaced a new bug in adjacent code. Root cause is architectural, not incidental: Playwright on Vercel Hobby (60s function timeout, 2 GB memory ceiling, single-process warm-container Chromium, no persistent filesystem for fonts) is a fundamentally hostile combination for browser-automation workloads. Patching symptoms has reached the point of diminishing returns.

Rebuild goal: **seamless usage for ~20 internal users (5 power users) on a persistent runtime, with the same 4-tool concept**, eliminating the serverless-specific bug class at the architecture level rather than continuing to mitigate it.

Evidence from the current production branch:
- Local smoke test on 2026-04-20 showed AFRC Individual capture timing out at `page.goto` after 30 s against the live site — this alone exceeds Vercel's 60 s budget after accounting for cold start. Reliability is already at the edge.
- HKEX capture ran in 28 s locally; with Vercel's 5–8 s cold start, margin to the 60 s limit is seconds.

## 2. Decisions

| Dimension | Choice |
|---|---|
| Host | Oracle Cloud Always Free, Ampere ARM VM (4 vCPU / 24 GB RAM), region ap-tokyo-1 |
| Runtime model | One long-lived Chromium, fresh `BrowserContext` per request, concurrency semaphore cap 12, watchdog with nightly recycle |
| HTTPS + public URL | Cloudflare Tunnel (free) |
| Stack | Next.js 15 + React 19 + Tailwind v4 (unchanged from current code) |
| API style | Next.js Route Handlers (not Server Actions) |
| Auth | None — open URL, no sensitive data |
| Concurrency target | Up to 20 simultaneous captures (5 power users × 4 tools); semaphore cap 12, queue the rest |
| History retention | 24 hours, disk-backed under `/data/captures/`, 15-min cleanup interval in-process |
| Feature additions | Bulk capture (SFC/AFRC), ZIP download (JSZip), copy-to-clipboard, recent-captures strip, SFC EN/中文 language toggle, read-only `/logs` viewer |
| Mock mode | **Deleted** (not used in practice; was a Vercel-host workaround) |
| Retry policy | Silent retry once on navigation/browser failures; no retry on selector failures |
| Monitoring | Local JSON log at `/data/logs/captures.log`, `/logs` viewer page in-app, no external services |
| Self-ping | Hourly health-ping to keep Oracle free-tier VM from idle reclaim |

## 3. Scope

### In scope

- The 4 existing tools, behavior-preserved: HKEX (equities capture), SFC (CIES fund list), AFRC Individual (CPA register), AFRC Firm (CPA firm register).
- All existing selectors and site-specific logic (HKEX 代號 placeholder, SFC `.accordin_expand`, AFRC ASP.NET control IDs, AFRC Firm GeneXus visibility bypass).
- Keep-alive panel switching on the frontend (all 4 panels always mounted).
- Screenshot fallback for Chrome GPU texture limit on tall AFRC pages (retry with height-clip).
- New features listed in the Decisions table.

### Out of scope

- Any form of auth, user accounts, or per-user audit trails.
- Gemini AI summaries (was in Zod schema, never implemented; schema dependency removed).
- JSZip download was previously installed but unwired — now wired up as part of bulk-capture.
- Unit tests. The only meaningful test is a real capture against a real regulatory site; we rely on real-world smoke testing in rollout instead.
- SMTP / Slack notifications for site breakages. Logs suffice.

## 4. Deployment & Runtime

### Infrastructure

- Oracle Cloud Always Free, Ampere ARM64, Ubuntu 22.04 LTS.
- `systemd` unit manages a single Docker container; auto-restart on crash.
- Public access via Cloudflare Tunnel (no firewall ports opened on the VM). Stable HTTPS URL, TLS handled by Cloudflare.
- Volume mount: host `/data/` → container `/data/` (captures + logs).

### Container

- Base image: `mcr.microsoft.com/playwright:v1.57.0-jammy-arm64`. Ships a known-good Chromium matched to Playwright. **No `@sparticuz/chromium` dependency.**
- Noto Sans CJK installed once via `apt-get` at image-build time. No runtime font download.
- Image size target: < 2 GB. Build time: ~5 min cold, < 1 min warm.

### Runtime model

- **Single `chromium.launch()` at server startup**, stored on a module-level singleton (`getBrowser()` returns the same instance).
- Per capture: `browser.newContext()` → `newPage()` → run capture logic → `context.close()`. Fresh cookies/storage isolation per request; ~100 ms to open/close a context.
- **Semaphore** (p-queue or hand-rolled) caps in-flight captures at 12. Requests beyond the cap queue in the Node event loop. At 20-capture worst case, queue wait is well under 2 s.
- **Watchdog:** every 30 s, ping `browser.isConnected()`. On failure, drain in-flight requests and respawn. Also forces respawn after 24 h uptime to avoid Chromium memory creep.
- **No `pkill -f chromium` hack.** It was a workaround for warm-container zombies that no longer exist.

### Budget

- No function timeout. Playwright timeouts return to generous defaults: 30 s `page.goto`, 15 s element waits, 2 s screenshot.
- 24 GB RAM vs. ~2 GB in use at peak (20 concurrent pages × ~100 MB). ~12× headroom.

## 5. Frontend & UX

### What stays the same

- Next.js 15 App Router, React 19, Tailwind v4.
- Keep-alive panel switching (`ToolWorkspace.tsx`): all 4 panels mounted with `display:block/none` so state persists across tab switches.
- Per-panel inputs (HKEX stock code, SFC fund name, AFRC name/regNo, AFRC Firm name).
- Error surface: `{ success: false, error, errorType }` → small red card in the panel with retry + copy-details buttons.

### What changes

**Parallel captures across tools.** Capturing on one panel does not block captures on another. Each panel has its own in-flight state.

**SFC language toggle.**
- `EN | 中文` pill at the top of the SFC panel. Default EN. Persists for the session.
- Single fund-name input regardless of toggle (unchanged regex). SFC rows typically show both English and Chinese names, so cross-language text matches work in practice.
- Server action receives new `language: 'en' | 'tc'` field. Swaps URL path between `.../en/Regulatory-functions/...` and `.../tc/Regulatory-functions/...`. No in-page language click — direct URL is simpler and less fragile.

**Bulk capture** (SFC + AFRC Individual + AFRC Firm).
- Input becomes a multiline textarea: one name per line, max 10.
- HKEX remains single-input (matches existing behavior).
- Backend processes the batch inside a single browser page where possible (notably SFC, which filters in-place), returns all results in a single response.
- Partial failures don't abort the batch; failures are reported per-item.

**Results area.**
- Thumbnail grid, timestamp per thumb.
- Actions per thumb: **Download** (single PNG), **Copy** (`navigator.clipboard.write` with `ClipboardItem`, download fallback on unsupported browsers), **View full-size** (modal).
- Multi-result captures: top-of-grid **Download all (ZIP)** via JSZip.

**Recent captures strip (bottom of each panel).**
- Pulls from 24 h disk-backed history: `GET /api/history?tool=sfc&limit=5`.
- Shows last 5 captures for the current tool with input + timestamp + re-download link. Re-download serves the stored PNG; no Playwright invocation.

### UX principles to apply during implementation

(Captured in the spec so the user can review before code is written; implementation should apply these verbatim, plus any further refinements that a dedicated UI/UX skill surfaces during the build.)

- **Loading state:** per-panel spinner with a tool-specific label (e.g., "Capturing HKEX 0005…"). No layout shift — spinner occupies the space the thumbnails will eventually fill.
- **Empty state:** clear "no captures yet — type a stock code and click Capture" prompt when the panel is fresh.
- **Error state:** inline red card below the capture button. Retry + copy-details buttons. Never blocks interaction with other panels.
- **Success micro-interaction:** thumbnail fade-in on arrival; brief "Copied!" toast on clipboard success.
- **Keyboard:** Enter submits capture; tabs cycle in logical order; Esc closes any open full-size modal.
- **Contrast & spacing:** Tailwind defaults are fine; preserve existing dark theme (`#131b2e` background).
- **Focus management:** after capture completes, move focus to the first new thumbnail's Download button so keyboard users can act immediately.

### What does NOT change

- HKEX panel shape (single stock in, one screenshot out).
- Selector strategies (HKEX Chinese placeholder, SFC accordion, AFRC ASP.NET IDs, AFRC Firm GeneXus bypass).

## 6. Data Flow & APIs

### Endpoints (Next.js Route Handlers)

```
POST  /api/capture/hkex        body: { stockCode }
POST  /api/capture/sfc         body: { fundNames: string[], language: 'en' | 'tc' }
POST  /api/capture/afrc        body: { searchType: 'name' | 'regNo', searchValue }
POST  /api/capture/afrc-firm   body: { englishName?, chineseName?, regNo? }

GET   /api/history             ?tool=hkex&limit=5  →  [{ id, query, language?, timestamp, url }, ...]
GET   /api/history/:id/image   → streams the stored PNG

GET   /api/health              → { ok: true, chromium: 'connected', inFlight: N, queued: M, uptimeSec }
GET   /logs                    → HTML page rendering last 200 log entries as a table (read-only)
```

### Response shape

```ts
// success — single capture
{ success: true, results: [{ id, query, image: 'data:image/png;base64,…', timestamp }] }

// success — bulk capture (SFC with multiple funds)
{ success: true, results: [ {id, query, image, timestamp}, ... ] }  // partial failures reported per-item

// failure
{ success: false, error: 'page.goto: Timeout 30000ms exceeded', errorType: 'NAV_FAIL' }
```

- First response inlines base64 PNG → user sees image immediately, no extra round-trip.
- Same image persisted to `/data/captures/<tool>/<YYYY-MM-DD>/<uuid>.png` with `.json` sidecar. History endpoint returns file URLs, not base64, so reloads are cheap.
- No SSE / streaming for bulk captures — simple POST + response. For batches of ≤10, total time is 40–60 s; the UX penalty of a single spinner is acceptable and eliminates connection-drop failure modes.

### Storage layout

```
/data/
  captures/
    hkex/2026-04-20/<uuid>.png + <uuid>.json
    sfc/2026-04-20/<uuid>.png + <uuid>.json     (json includes language)
    afrc/2026-04-20/...
    afrc-firm/2026-04-20/...
  logs/
    captures.log                                (JSON-per-line)
```

### Cleanup

In-process `setInterval(cleanup, 15 * 60 * 1000)`. Each tick: walk `/data/captures/*/` and `/data/logs/`, delete anything >24 h old. No cron, no external scheduler.

### Volume estimate

~200 KB per PNG × 5 power users × ~20 captures/day ≈ 20 MB/day of captures. 24 h retention → ~20 MB resident. Trivial.

### Concurrency implementation

Module-level semaphore, hand-rolled or `p-limit`. Acquire before capture, release in `finally`. No per-browser pool.

**Bulk captures occupy one semaphore slot for the whole batch, not one per item.** For SFC (which filters in place inside a single page load) this is natural. For AFRC bulk, items are processed sequentially inside the same held slot, preventing a 10-item bulk submission from saturating the semaphore and blocking other users.

## 7. Error Handling & Retry

### Four stages, each fails differently

1. **Browser opens a fresh context.** Almost never fails on VM. On failure, watchdog respawns browser and handler retries once.
2. **Page navigates to the regulatory site.** Can fail if the site is down, slow, or drops connection. → **Silently retry once.** If the retry also fails, show user-facing error.
3. **Page finds the search box and clicks submit.** Can fail if the site redesigned. → **No retry.** Show user-facing error that signals "please report" because a selector change needs human fix.
4. **Screenshot.** Almost always succeeds after stage 3. Existing clip-to-4096px fallback for the GPU texture limit stays.

### User-facing error examples

- Stage 2 final fail: *"HKEX didn't respond. It may be temporarily down. Try again in a minute."*
- Stage 3 fail: *"HKEX search box couldn't be located. The site may have been updated — please report to Marco."*
- Stage 1 fail after watchdog respawn: *"The screenshot service is restarting. Try again in 30 seconds."*

Each error card includes **[Retry]** (re-submits same capture) and **[Copy error details]** (puts stage + message on clipboard for forwarding).

### Logging

One JSON line per capture to `/data/logs/captures.log`:

```
{"t":"2026-04-20T03:14:00Z","tool":"hkex","query":"0005","ok":true,"ms":18200}
{"t":"2026-04-20T03:14:45Z","tool":"afrc","query":"Chan","ok":false,"ms":31100,"stage":"navigate","err":"goto timeout"}
```

`/logs` page in-app renders the last 200 entries as a sortable table. Copy-paste any failures to Claude for diagnosis.

### Watchdog (summary)

Every 30 s: `browser.isConnected()`. On false OR on 24 h uptime: drain in-flight → close → relaunch. Captures during the ~3 s swap wait in the semaphore queue.

## 8. Testing, Deployment & Rollout

### Stage 1 — Build alongside the old app

Rebuild lives on the Oracle VM. Vercel deployment remains live and untouched. Users continue using the Vercel URL during construction. No cutover pressure.

### Stage 2 — Private testing (2–3 days)

Temporary Cloudflare tunnel URL, shared only with Marco + one colleague power-user. Run normal workflow captures daily: a few stock codes, fund names in both EN and 中文, a few CPA names, at least one bulk 10-item SFC capture. Review `/data/logs/captures.log` each day; `grep ok:false` should be empty or only reflect genuine site downtime.

### Stage 3 — Cutover

Announce new URL to team. Keep Vercel live for 1 week as fallback. After 1 week clean on new URL, decommission Vercel.

### VM setup

One deployment script the user runs on a fresh Oracle VM. Installs Docker, clones repo, builds image, creates `systemd` service, installs `cloudflared` + registers tunnel, prints public URL. Hands-on time: ~15 min plus ~5 min Docker download. No Docker expertise required.

### Self-ping for Oracle free-tier

Node `setInterval` hits own `/api/health` every 60 min to prevent 7-day idle reclaim.

### Day 1 monitoring

For 48 h after cutover: (a) Marco runs one normal capture daily to confirm success, (b) shares the log file on any oddity. `tail /data/logs/captures.log` gives Claude everything needed to diagnose.

### Testing philosophy

Unit tests would not catch the bug classes historically hitting this project (all infra-level). The meaningful test is end-to-end against real regulatory sites. Stage 2's 2–3 days of real-world smoke testing is the test suite.

## 9. Open items / explicit non-goals

- **Domain name.** Default is the Cloudflare-tunnel-provided hostname. If Marco has a domain he wants to attach, easy to swap later. Not required for v1.
- **Backup of 24 h captures.** Captures are disposable (can be re-run). No offsite backup.
- **Rate limiting on the open URL.** Not needed at 20 internal users. If the URL leaks publicly, we'd revisit — simplest mitigation would be a random URL-prefix token checked by middleware.
- **Request-id correlation.** Logs include enough (timestamp, tool, query) for manual correlation. No full request-id tracing.
- **Auto-notification on selector breakage.** User chose "no" — rely on logs + manual reporting.

## 10. Risks

1. **Oracle Cloud free-tier reclaim.** Mitigated by self-ping. Worst case: VM is reclaimed, ~15 min to rebuild.
2. **Cloudflare Tunnel hiccup.** Rare. Connection drops are transparent to the app — captures continue; users may see one failed page-load that they refresh.
3. **Chromium memory creep.** Mitigated by nightly watchdog recycle.
4. **Regulatory site redesigns.** Same risk as today; same fix (update selectors). Logging gives fast diagnosis.
5. **~250 ms Tokyo-to-HK latency.** Now absorbed by the 30 s `page.goto` budget; not a concern.

## 11. Reference — current code to replace vs preserve

### Replace
- `src/lib/playwright-utils.ts` → mostly gone. `launchBrowserWithHealing()` replaced by module-level browser singleton + watchdog. `pkill -f chromium` deleted. Font-download dance deleted. `@sparticuz/chromium` dependency deleted.
- `src/app/**` Server Actions → convert to Route Handlers under `src/app/api/...`.
- `src/env.ts` → drop `GEMINI_API_KEY` requirement (unused).
- `src/lib/mock-data.ts` → deleted. `isMockMode` field removed from all action input schemas.
- `vercel.json` → deleted.

### Preserve
- All 4 panel React components + `ToolWorkspace.tsx` keep-alive switcher.
- Site-specific logic inside each action (HKEX 代號 search, SFC accordion filter, AFRC `robustClick`, AFRC Firm `waitFor('attached')` + `fill({force:true})`).
- Screenshot texture-limit clip fallback.
- Zod input validation patterns.

## 12. Next steps

1. User reviews this spec and approves or requests changes.
2. Write implementation plan via `superpowers:writing-plans`.
3. Run adversarial review (`/codex:adversarial-review`) against the committed spec before implementation.
4. Execute plan.

## 13. Accepted risks

The 2026-04-20 adversarial review of this spec (Codex) raised two concerns. After discussion with Marco, both are **accepted as known risks rather than blocking items**. Reasoning and reversal triggers below.

### 13.1 No authentication on the public URL

**Accepted because:** the 20 users are all trusted colleagues on an internal team; the tool performs routine compliance lookups against public regulatory sites; the data captured (CPA names, fund names, stock codes) is not commercially sensitive; adding even shared-password auth adds friction for the 5 power users who use this daily. The Cloudflare Tunnel URL is not published anywhere and is only shared directly with teammates.

**Reversal trigger — add auth if ANY of these become true:**
- The URL is found in a public search result, screenshot, or shared document.
- The team starts using the tool for lookups that could reveal business intent (e.g., due-diligence targets before an announcement).
- Team grows beyond ~30 users.
- The log file shows requests from unfamiliar IPs or from outside normal working hours.

**Lowest-friction remediation if triggered:** add a random high-entropy path prefix (e.g., `/x7k3m9p2q/…`) checked by Next.js middleware. Invalidating it = change the prefix. No passwords, no sign-in flow.

### 13.2 No per-IP rate limiting

**Accepted because:** the concurrency semaphore already caps in-flight captures at 12; queue wait is bounded and brief under legitimate internal load; adding rate-limit code is new complexity and new failure modes (false positives blocking a legitimate power user mid-workflow) for a risk that only materializes if the URL is abused, which is mitigated by 13.1's controls.

**Reversal trigger — add rate limiting if ANY of these become true:**
- The `/logs` page shows a single IP submitting >20 captures/hour.
- Legitimate users report queue waits exceeding 10 seconds.
- Bulk submissions start coming from outside the team.

**Lowest-friction remediation if triggered:** per-IP token bucket in middleware (e.g., 20/min, 3 concurrent, stricter cap on bulk endpoints). ~30 lines using an existing library.
