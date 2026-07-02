# MindVault: AI Operating System — Product Requirements Document

**Version:** 1.0 · July 2026
**Owner:** Justin Neal
**Status:** Approved direction — Phase 1 in progress

---

## 1. Vision

MindVault evolves from a private journaling app into an **AI Operating System for thinking, publishing, and growth** — the one app its user opens every day to capture ideas, reflect, build habits, create content, and run their ventures.

The lifecycle it serves:

**Capture → Reflect → Connect → Learn → Create → Publish → Measure → Improve → Grow**

### The governing tension (resolve deliberately, never by accident)

MindVault's existing soul is a **private sanctuary**: PIN lock, local IndexedDB, no accounts, data never leaves the device by default. The vision adds an **outbound publishing machine**. These must be architected as two layers:

| Layer | Data location | AI usage | Default |
|---|---|---|---|
| **Private core** (journal, vault, habits, mindfulness) | Local (IndexedDB/localStorage) | None, or explicit per-action opt-in | On |
| **Outbound layer** (Publish, campaigns, brand memory) | Local drafts; content leaves only when user publishes | Claude via server proxy, clearly labeled | Opt-in |

**Rule:** No feature may silently move private-core data through the outbound layer. Every AI call that transmits journal/goal content is labeled at the point of use.

---

## 2. What exists today (July 2026)

- **Private core:** daily journal (morning/evening, voice, photo scan), Vault search, habits with personalized Atomizer, Box Breathing, PIN lock, streaks, metrics (local).
- **AI plumbing (the critical asset):** `/api/automation/invoke` — a hardened Vercel serverless proxy. Server holds `ANTHROPIC_API_KEY`; clients authenticate with `AUTOMATION_ACCESS_TOKEN` (entered once in Settings). Model-allowlisted, size-bounded, audit-logged (metadata only). Used by Orpheus and Throne Talk.
- **Client helper:** `src/lib/ai.js → callProxy(messages, system, accessToken, maxTokens)`.

**Architectural decision:** every new AI feature rides this proxy. No new key handling, ever.

---

## 3. Roadmap

### Phase 1 — AI foundation proven end-to-end (NOW)
**Goal:** one small feature exercises the full private-idea → Claude → useful-output loop.

- **1a. Atomizer library depth** ("A") — ✅ shipped. Multiple approaches per goal, answer-driven re-ranking, safety gating.
- **1b. Atomizer "Enhance with AI"** ("B") — candidates screen gains an opt-in button that sends goal + qualification answers + top templates to Claude and returns a genuinely personalized starting plan. Gated on access token being configured; clearly labeled that data leaves the device.

**Success:** user taps Enhance, gets a plan that references their actual answers, creates the habit.

### Phase 2 — Publish MVP (the flagship)
**Goal:** private idea → public content in under a minute. No platform APIs yet.

- New top-level **Publish** tab.
- Input: pick a journal entry / vault item, or write a fresh idea.
- Output: 4–6 assets per run — Instagram caption, LinkedIn post, X thread, newsletter blurb, blog outline. Copy-to-clipboard each; save as drafts (new IndexedDB store `mindvault_publish_v1` — own DB, per the same-name-collision lesson).
- **Brand Memory v1:** a single editable profile (name, mission, audience, tone, voice notes, CTAs, links) stored locally, injected into every Publish prompt. This is the seed of the "AI team" — one persona done well before eighteen done poorly.
- Format recommendations: Claude suggests which formats fit the idea.

**Success metric:** the founder publishes real content for his own ventures (RapGod, K-Source, 7 Temples, WorkWrite) from MindVault weekly. Dogfooding is the KPI.

### Phase 3 — Campaigns & cadence
- Campaign builder: one idea → a week/month of scheduled drafts (planning artifacts, not API integrations — a calendar of ready-to-post content with reminders).
- Content calendar view (reuse habit-occurrence scheduling machinery — it's the same shape: recurring dated items).
- Smart repurposing: resurface old high-value entries/drafts ("this idea from March would make a strong thread").
- **"Built with MindVault"** monthly stats page: entries written, ideas captured, habits kept, content created. Data is already local; render + share as image.

### Phase 4 — Measure & learn
- Manual-first analytics: log performance per post (paste in likes/replies); Claude learns which topics/styles perform.
- Best-time/topic recommendations from local history.
- Platform API integrations **only if** manual logging proves the loop is valuable (OAuth + API maintenance is the single biggest cost trap in this roadmap — defer until earned).

### Deferred indefinitely (Year-2+ questions, revisit only with real users)
Agent marketplace, template marketplace, white-label, API product, pricing tiers, multi-workspace/teams, native mobile apps, real-time follower analytics. Building these before retention is proven is how this vision fails.

---

## 4. Architecture decisions

| Concern | Decision | Why |
|---|---|---|
| AI access | Existing `/api/automation/invoke` proxy | Hardened, audited, already deployed |
| New data stores | One IndexedDB database **per module** (`mindvault_habits_v1`, `mindvault_publish_v1`, …) | Same-name/same-version DBs silently lose stores (bit us twice) |
| Dates | Always local-midnight windows, never `toISOString()` day math | UTC day-boundary bug bit the habit system |
| Brand memory | Local JSON blob in its own store; injected into prompts server-side untouched | Privacy + simplicity; no backend DB until sync is truly needed |
| RAG / embeddings / vector DB | **Not yet.** Prompt-stuffing brand memory + selected entry is sufficient at current scale | A vector DB for one user's journal is resume-driven engineering |
| Auth / accounts | Stay single-user token-based until sync or sharing demands accounts | Every month without an auth system is a month of feature velocity |
| Scheduling / jobs | Client-side on-open checks (like habit occurrences); Vercel Cron only when something must run unattended | Keep ops surface near zero |

---

## 5. UX principles

1. Fewest taps from idea to asset — Publish MVP target: entry → assets in ≤3 taps.
2. Every AI action shows what data leaves the device, inline, at point of use.
3. Reuse the D design tokens and existing card/wizard patterns — Publish should feel native on day one.
4. Wizard over long form; progressive disclosure over settings pages.
5. Mobile-first always (this app lives on a phone).

---

## 6. KPIs (measured locally, shown on dashboard)

- **North star:** days per week the founder opens MindVault *and* takes one lifecycle action (entry, habit check-in, or publish).
- Journal streak · habit completion rate · ideas captured/week.
- Publish: assets generated/week, drafts → actually-posted ratio (self-reported at first).
- AI: enhance/publish invocations per week (proxy audit log already counts this).

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Scope drown (the vision is 2 years wide) | This document's phase gates; nothing from a later phase before the current phase's success metric is hit |
| Privacy trust erosion | Two-layer rule in §1; labels at point of use |
| API cost surprise | Proxy already caps tokens/sizes; Haiku default for routine calls |
| Founder stops dogfooding | Weekly self-check: "did I use Publish this week?" — if no for 3 weeks, Phase 2 was wrong, reassess before Phase 3 |
