# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Is This?

**CIES Internal Check — Regulatory Auditor** is an internal compliance tool for the Hong Kong financial market. It automates screenshot capture from four live regulatory websites using server-side Playwright. Staff use it to verify equity listings, fund eligibility, and CPA registrations.

---

## Commands

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit
npx playwright install chromium   # Required for local live captures
```

No test runner is configured. `test-playwright.ts` exists for manual Playwright testing via `npx ts-node test-playwright.ts`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5.8 |
| UI | React 19, Tailwind CSS v4 |
| Browser Automation | Playwright — server-side only, Node.js runtime |
| Serverless Chromium | `@sparticuz/chromium@143` + `playwright-core@1.57` |
| Env Validation | Zod in `src/env.ts` |

---

## Architecture

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout, fonts, security headers
│   └── page.tsx            # Home — renders ToolWorkspace
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Tool navigation
│   │   └── ToolWorkspace.tsx  # Keep-alive panel switcher (see below)
│   ├── panels/                # One panel per tool
│   └── shared/                # CaptureButton, ScreenshotGallery, etc.
├── actions/                # Next.js Server Actions — all Playwright code lives here
│   ├── hkex.ts
│   ├── sfc.ts
│   ├── afrc.ts
│   └── afrc-firm.ts
└── lib/
    ├── playwright-utils.ts  # Browser launch, stealth context, robustClick, FAIL_PLACEHOLDER
    └── mock-data.ts
```

### Keep-Alive Panel Switching
All 4 tool panels are **always mounted**. Only the active one has `display:block`. This preserves state (inputs, results, loading) across tab switches. **Do not convert to conditional rendering.**

### Server Action Pattern
Each action follows: validate with Zod → mock-mode shortcut → `launchBrowserWithHealing()` → `createStealthContext()` → navigate → interact → screenshot → `browser.close()` in `finally`. Errors surface as `{ success: false, error, errorType }` — never throw to the client.

### Screenshot Strategy (AFRC tools)
Primary: `page.screenshot({ fullPage: true })`. If that throws (Chrome texture limit exceeded on tall pages), fall back to measuring `document.body.scrollHeight` and using `clip: { x:0, y:0, width, height: min(scrollHeight, 4096) }`. Only use bare `fullPage: false` as last resort.

---

## The Four Tools

### 1. HKEX — Equities Capture
- **URL:** `https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK`
- **Input:** Stock code (`0005`, `0700`, etc.)
- **Flow:** Navigate → dismiss cookie/notice banners → find search input by Chinese placeholder `代號 / 關鍵字` → type → Enter → screenshot viewport (`fullPage: false`)

### 2. SFC — CIES Fund List
- **URL:** `https://www.sfc.hk/en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES`
- **Input:** Fund names (up to 10)
- **Flow:** Navigate → expand accordion (`.accordin_expand`) → filter `<tr>` rows by keyword → screenshot each matching row element

### 3. AFRC Individual — CPA Register
- **URL:** `https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx`
- **Selectors:** `#vNAME` (name search), `#vREGNO` (practising number), `#BTNUA_SEARCH` (submit), `#GridContainerDiv` (results)
- **Flow:** Navigate → fill input → `robustClick` → screenshot full page

### 4. AFRC Firm — CPA Firm Register
- **URL:** `https://armies.afrc.org.hk/registration/ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx`
- **Important:** This is a **different ASP.NET application** from AFRC Individual. Element IDs differ. Do not assume Individual selectors work here — verify against live HTML before adding/changing selectors.
- **Selectors:** `#vNAME` (English name), `#vCHINESENAME` (Chinese name), `#vREGNO` (registration number) — **confirm these against the live page if they fail**
- **Flow:** Same pattern as Individual

---

## Serverless / Vercel Constraints

This is the most important section for avoiding the recurring bug loop.

### Hard limits (Vercel Hobby plan)
- **60s function timeout** — total execution including cold start must stay under ~50s
- **2048 MB memory** — Chromium alone uses ~400 MB; sparticuz extraction adds more on cold start

### Timeout budget (AFRC actions)
| Stage | Budget |
|---|---|
| `pkill` + settle | ~0.5s |
| Browser launch + font load | ~5–8s cold / ~1s warm |
| `page.goto()` | 25–30s max |
| `waitForPageReady()` | 6–15s |
| Input wait + fill | 10–15s |
| `robustClick` | 8s |
| Screenshot | ~2s |

Total must sum to < 50s. When adding timeouts, always check the budget.

### Warm-container zombie Chromium
`@sparticuz/chromium` uses `--single-process`. After `browser.close()`, the OS process takes 1–3s to fully die. A rapid second request on the same warm Lambda container launches a second Chromium before the first exits → OOM → `"browserContext.newPage: Target page, context or browser has been closed"`.

**Fix already in place:** `launchBrowserWithHealing()` runs `pkill -f chromium` + 500ms settle before every launch on serverless.

### fullPage screenshot texture limit
`page.screenshot({ fullPage: true })` throws `Protocol error (Page.captureScreenshot)` when the page exceeds Chrome's GPU texture size (~16384px). AFRC result pages can be very tall.

**Fix already in place:** try `fullPage:true` → catch → measure `scrollHeight` → `clip` to `min(scrollHeight, 4096px)` → fallback to `fullPage:false`.

### ERR_INSUFFICIENT_RESOURCES
Caused by too many simultaneous TCP connections (images, fonts, scripts) from a Lambda. If this occurs on AFRC Firm, add `page.route()` before `page.goto()` to block `image`, `font`, `stylesheet`, `media` resource types while keeping `document`, `script`, `xhr`, `fetch`.

### ASP.NET WebForms postback (AFRC sites)
Both AFRC pages are classic `.aspx` WebForms. Clicking the search button triggers a **full-page POST** — the entire DOM is destroyed and recreated. After `robustClick`, the `#GridContainerDiv` is a fresh element in the new DOM. If `waitFor({state:'visible'})` keeps seeing it as hidden after 21 retries, the navigation has not completed — use `Promise.all([page.waitForNavigation(...), btn.click()])` instead.

---

## `playwright-utils.ts` API

| Export | Purpose |
|---|---|
| `launchBrowserWithHealing()` | Launch browser (sparticuz on Vercel, local playwright in dev). Includes zombie-kill on serverless. |
| `createStealthContext(browser)` | Returns a context with stealth UA, zh-HK locale, masked `navigator.webdriver` |
| `createStandardContext` | Alias for `createStealthContext` |
| `waitForPageReady(page, timeout)` | Best-effort `networkidle` then `domcontentloaded`, then 800ms buffer |
| `ensureUIReady(page)` | Dismisses cookie/consent banners |
| `robustClick(page, clickSel, waitSel, stage)` | Click + wait for result element, retry once. Throws `AutomationException` on failure. |
| `FAIL_PLACEHOLDER` | SVG data-URI used in mock-mode responses only; live action failures return `{ success: false, error, errorType }` instead |
| `AutomationException` | Typed error with `{ errorType, message, stage }` — catch and return `{ success: false }` |

---

## Environment Variables

```env
INTERNAL_API_SECRET=<min 32 chars>   # Required
GEMINI_API_KEY=<your key>            # Required by Zod schema even though unused — relax schema if not needed
MOCK_MODE=true                       # Optional — skips Playwright, returns placeholder data
```

`MOCK_MODE` is read directly from `process.env` in each action (not via the Zod schema), so it can be set without `GEMINI_API_KEY` being valid.

---

## Known Fragilities

- **HKEX/SFC selectors** break if those sites redesign — the Chinese-language placeholder `代號 / 關鍵字` and `.accordin_expand` are especially fragile
- **AFRC selectors** are ASP.NET control IDs — stable within a version but must be verified against live HTML before assuming they're correct (the Firm and Individual pages have separate control hierarchies)
- **Gemini AI** is in the Zod schema but not implemented
- **JSZip** is installed but ZIP download is not wired up
