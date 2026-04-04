# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## What Is This?

**CIES Internal Check — Regulatory Auditor** is an internal compliance intelligence tool for the Hong Kong financial market. It automates data capture and screenshot auditing from **four regulatory sources** using server-side Playwright browser automation.

This is an **internal tool** (not public-facing), built for CIES compliance staff to quickly verify equity listings, fund eligibility, and CPA registrations against live regulatory websites.

---

## Commands

```bash
npm run dev          # Start dev server → http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm run type-check   # tsc --noEmit (no emit, type errors only)
npx playwright install chromium   # Install Chromium for live captures
```

No test runner is configured. The only test script is `test-playwright.ts` (manual, run with `npx ts-node test-playwright.ts`).

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15.5 (App Router) |
| Language | TypeScript 5.8 |
| UI | React 19, Tailwind CSS v4 |
| Browser Automation | Playwright (headless Chromium, server-side only) |
| Env Validation | Zod schema in `src/env.ts` |

---

## Architecture Overview

```
src/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx          # Root layout (fonts, metadata, security headers)
│   ├── page.tsx            # Home — renders ToolWorkspace
│   └── globals.css         # Global styles + design tokens
│
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx        # Left sidebar with tool navigation + status
│   │   └── ToolWorkspace.tsx  # Main workspace — keep-alive panel switcher
│   ├── panels/                # Tool-specific panel components
│   │   ├── HkexPanel.tsx
│   │   ├── SfcPanel.tsx
│   │   ├── AfrcPanel.tsx
│   │   └── AfrcFirmPanel.tsx
│   └── shared/                # Reusable UI components
│
├── actions/                # Next.js Server Actions (Playwright automation)
│   ├── hkex.ts             # HKEX equities capture
│   ├── sfc.ts              # SFC CIES fund list
│   ├── afrc.ts             # AFRC individual CPA register
│   └── afrc-firm.ts        # AFRC firm CPA register
│
├── lib/
│   ├── playwright-utils.ts  # Browser launch, stealth context, anti-bot helpers
│   └── mock-data.ts         # Mock data for development without Playwright
│
└── env.ts                  # Zod-validated server environment variables
```

---

## The Four Tools

### 1. HKEX — Equities Capture
- **URL:** `https://www.hkex.com.hk/Market-Data/Securities-Prices/Equities?sc_lang=zh-HK`
- **Input:** Stock code (e.g. `0005`, `0700`)
- **Action:** `captureHkex()` in `src/actions/hkex.ts`
- **Flow:** Navigate → dismiss cookies → search stock code → screenshot viewport

### 2. SFC — CIES Fund List
- **URL:** `https://www.sfc.hk/en/Regulatory-functions/Products/List-of-Eligible-Collective-Investment-Schemes-under-new-CIES`
- **Input:** Fund names (up to 10, comma/space separated)
- **Action:** `captureSfc()` in `src/actions/sfc.ts`
- **Flow:** Navigate → expand all → search for matching rows → screenshot each match

### 3. AFRC (Individual) — CPA Individual Register
- **URL:** `https://armies.afrc.org.hk/registration/armiesweb.WWP_FE_PC_PublicRegisterList.aspx`
- **Action:** `captureAfrc()` in `src/actions/afrc.ts`

### 4. AFRC (Firm) — CPA Firm Register
- **URL:** `https://armies.afrc.org.hk/registration/ARMIESWeb.WWP_FE_FMCP_PublicRegisterList.aspx`
- **Action:** `captureAfrcFirm()` in `src/actions/afrc-firm.ts`

---

## Key Design Patterns

### Keep-Alive Panel Switching
All 4 tool panels are **always mounted** in the DOM. Only the active panel is visible (`display: block` vs `display: none`). This preserves search inputs, results, and loading states across tab switches without re-mounting. Do not refactor this to conditional rendering.

### Playwright Must Run in Node.js Runtime
`next.config.ts` sets `serverExternalPackages: ['playwright', 'playwright-core']`. Server Actions using Playwright must never be moved to the Edge runtime.

### Stealth Playwright Context
Anti-bot hardening is in `playwright-utils.ts`:
- Custom user agent mimicking Chrome 120 on macOS
- `webdriver` property masked
- Realistic HTTP headers (locale: `zh-HK`, timezone: `Asia/Hong_Kong`)
- Cookie/consent banner auto-dismissal
- Robust click with retry logic

### Mock Mode
Set `MOCK_MODE=true` in `.env.local` to skip Playwright and return placeholder data with a simulated delay. Use for UI development without Chromium.

### Fail Gracefully
Playwright failures return an SVG placeholder (`FAIL_PLACEHOLDER`) instead of throwing, so the UI always has something to display.

---

## Environment Variables

Required in `.env.local`:

```env
INTERNAL_API_SECRET=<min 32 chars>   # Server action auth secret
GEMINI_API_KEY=<your key>            # Reserved for future AI features
MOCK_MODE=true                       # Optional: skip Playwright
```

Validated at startup via Zod in `src/env.ts`. Missing/invalid vars crash fast with clear errors. If `GEMINI_API_KEY` is not needed, the Zod schema must be relaxed — it currently requires both vars.

---

## Known Limitations

- HKEX and SFC CSS selectors are fragile — they break if those sites redesign
- No auth, no database — results are ephemeral (in-memory only)
- Gemini AI integration is wired into env but not yet implemented
- JSZip is installed but ZIP download is not fully wired up
