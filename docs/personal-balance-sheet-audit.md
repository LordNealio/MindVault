# Personal Balance Sheet — Implementation Audit

**Repository:** `mindvault-app` (MindVault)
**Module:** The Personal Balance Sheet — `src/lib/balanceSheet.js`, `src/features/balance/*`
**Audit date:** 2026-08-30
**Auditor:** Claude Code (audit phase only — no application code, schema, or copy was modified)

---

## Remediation status — updated after implementation

The full prioritized plan was implemented (commits `84ac119` and following) under
**Open Decision #1, option (b)**: the product's financial identity was kept and the specified
measurement design was retrofitted inside it. The audit body below is preserved **as written at
audit time** — it is the record of what was found, not a description of the current code.

| Item | Status now | Evidence |
|---|---|---|
| **P0-1** silent data loss | **Closed** | `saveSheet` rejects when both stores fail; shell shows a `role="alert"` banner with a download escape hatch. 4 unit tests + 1 component test. |
| **P0-2** monitoring statement | **Closed** | Orientation states it; asserted in `balanceSheet.safety.test.jsx`. |
| **P0-3** persistent help | **Closed** | `src/features/safety/CrisisHelp.jsx` rendered by the shell; a test walks all 10 steps and fails if it is absent — or duplicated. |
| **P0-4** explicit consent | **Closed** | Affirmative control gates entry; consent recorded with statement + version. |
| **P0-5** AI governance | **Mitigated in code, still open as a decision** | `AI_GOVERNANCE_APPROVED = false` disables external processing entirely. Authorization remains yours. |
| **P1** measurement foundation (D1/D3/D4/D5/D7) | **Closed** | `balanceAnswers.js`: versioned answers, anchor sets, `0` as a real value, distinct missing states. |
| **P1** interference + influence, priority step, action plan, L1–L7 | **Closed** | Verified firing in-browser and in unit tests. |
| **P1** weekly composite score | **Closed** | Replaced with per-item within-person series that refuse to mix anchor sets. |
| **P1/T1/T2/T3** tests | **Closed** | 75 tests across 6 files: logic, storage failure, migration, journeys, safety, and axe (zero violations on every screen). |
| **P2** reduced motion, focus-within, prototype framing, export note, response classification | **Closed** | — |
| **F26** baseline length (10–15 min target) | **Open** | Still 10 sections / 20–30 min. Shortening means cutting content — your call. |
| **S1** crisis resource ownership | **Open** | Component exists with ownership documented in-file; the list is not localised. |
| **T4** visual regression | **Deferred** | Low value without a baseline pipeline. |

Two issues were found *during* remediation and fixed:
- the storage layer never closed IndexedDB connections, which deadlocked `deleteDatabase` (and would
  have blocked any future migration needing a version change);
- the Risks section and Results each rendered their own help button on top of the shell's, so three
  screens showed two. Help is now rendered in exactly one place.

---

## 0. Executive verdict

**Not ready for pilot testing.** The module is a well-built, privacy-respecting, locally-persisted
reflection tool that already does several things this specification demands — it never fabricates a
risk score, never infers crisis from ordinary answers, keeps every answer on-device, gates AI behind
explicit reviewed consent, and keeps free text out of URLs, analytics, and logs. But it fails on
five release blockers, one of which is a proven silent-data-loss bug, and it implements a
**materially different instrument** from the one specified. In particular the specification's core
measurement design — separating interference, urgency, and influence; 0–4 anchors where `0` is a
real answer; per-question versioning; importance and confidence ratings; implementation intentions —
is largely absent, and the decision-support rules that depend on those inputs cannot function. The
module should not be described as research-informed until those constructs exist.

A second, structural finding: this module was built to an **earlier, approved product specification**
using a financial metaphor (Assets / Liabilities / Personal Equity / Command Center / 30-90-365). The
specification in this audit prescribes a different flow (Resources / Drains & Pressures / Current
Capacity / What Still Belongs to You / Choose a Priority / Build an Action Plan). These are not the
same instrument. **This conflict requires a product decision before implementation work begins** —
see §10, Open decisions. Roughly 60% of the P1 work depends on which way that decision goes.

---

## 1. Release blockers (P0)

| # | Blocker | Why it blocks | Evidence |
|---|---|---|---|
| **P0-1** | **Silent data loss with false confirmation.** When IndexedDB is unavailable *and* localStorage write fails, `saveSheet()` swallows both errors and resolves as if successful. The UI then sets `savedAt` and displays "Saved 1:40 AM". | Destructive data behavior. A user in a private window, with storage blocked, or at quota completes a 20–30 minute inventory of the hardest parts of their life and is actively told it is safe. It is not. | Runtime proof: stubbed `indexedDB.open` to throw and `Storage.prototype.setItem` to throw `QuotaExceededError`; `saveSheet()` **resolved** with a sheet object; `loadSheet()` afterwards returned **no data**. |
| **P0-2** | **No statement of whether responses are monitored.** The orientation screen covers time, autosave, privacy, and optionality, but never says whether a human or system reviews answers. | Explicitly required by the release-blocking safety section. A distressed user disclosing a liability may assume someone is watching and will respond. Nobody is. | Runtime: orientation text captured verbatim; `/monitor/i` → no match. |
| **P0-3** | **Crisis/immediate-help access is not persistent.** `SafetyNotice` renders only inside the Risks section (step 6 of 9) and on the Results screen. A user in steps 1–5, 7–9, or on the landing screen has no route to help. | Safety requirement is a *persistent, discreet* path. Distress is most likely to surface while writing liabilities (step 2), which has none. | Code + runtime: `SafetyNotice` imported by `BalanceSections.jsx` and `BalanceResults.jsx` only; zero references in `BalanceSheetScreen.jsx` (the shell that renders every step). |
| **P0-4** | **No explicit consent to continue.** Orientation informs, then offers "Start". There is no affirmative consent control and no consent record in the data model. | Specification requires clear consent obtained before proceeding; nothing in `PersonalBalanceSheet` records that it was given. | Runtime: `/consent\|i agree\|i understand/i` → no match on the orientation screen. `emptySheet()` has no consent field (only `aiConsent`, which covers the AI step only). |
| **P0-5** | **AI free-text processing lacks documented governance.** The *implementation* is strong — disclosure, editable payload, automatic identifier scrubbing, explicit per-use consent, recorded in `aiConsent`. What is missing is organizational authorization: named owner, approved purpose, data-processing terms with the provider, and retention position. | Specification forbids sending free-text answers to an external AI service without "explicit disclosure, authorization, safeguards, and product governance". Three of four are present; authorization/governance is not a code artifact and cannot be self-certified. | `BalanceResults.jsx` consent flow reviewed; `buildAIPayload`/`scrubText` verified. No governance document in repo. |

---

## 2. What is already working — preserve this

These are verified strengths. Do not regress them during remediation.

- **Local-first persistence with an honest disclosure.** Answers live in a per-module IndexedDB
  database (`mindvault_balance_v1`); the orientation screen names the actual store in use
  (`storageLocation()` probes IndexedDB and reports the fallback if it is unavailable).
- **No sensitive data in observable surfaces.** Runtime-verified: analytics received only
  `{eventType:"feature_use", feature:"balance_sheet", metadata:{}}` — three events, no free text.
  The app has no router and no query string, so nothing is exposed in a URL. No notifications carry
  answers.
- **AI is genuinely optional and genuinely reviewable.** The module is fully functional with the AI
  switched off; the payload is shown verbatim, pre-scrubbed for emails, phones, ID/account numbers
  and clinician names, and is editable before sending.
- **No invented risk scoring, no crisis inference, no clinical instruments.** Verified by inspection:
  nothing in `deriveSummary` produces a risk label, and no PHQ-9/GAD-7/C-SSRS/AUDIT items exist.
- **Summary descriptors are evidence-gated.** Labels appear only when the user's own numbers meet a
  threshold. Runtime check with 2 assets / 1 urgent liability / low capacity produced exactly one
  label; a second scenario with 3 urgent liabilities produced two. No flattery, no universal score.
- **Command-center ordering is defensible.** Sorting uses an urgency bucket combining deadline
  proximity *and* priority, so a low-priority item three months out cannot outrank an urgent one.
- **Accessibility foundations are real**: labels bound by `id`, scales as radio groups inside
  `fieldset`/`legend`, `aria-live` progress announcements, 46px targets, text always accompanying
  colour, and text equivalents beside every weekly-trend bar.
- **Data control**: export (JSON), print, edit, and a two-step delete that verifiably empties the
  object store.

---

## 3. User-flow map — implemented vs. required

| Required step | Implemented counterpart | Verdict |
|---|---|---|
| Orientation and consent | "Before you start / How this works" + optional name | Informs, does not obtain consent; no monitoring statement |
| Resources | **Section 01 — Assets Inventory** (7 categories, strength 1–5, access 1–5, note) | Closest match. Correctly separates *having* from *accessing* — a genuine strength. Wrong anchors, no 7-day window, no "what would make this easier to use" |
| Drains & Pressures | **Section 02 — Liabilities Inventory** (7 categories, urgency 1–3, first action, deadline, helper, status) | Only one of three required dimensions. No interference, no influence, no response classification |
| Current Capacity | **Section 03 — Capacity & Liquidity Check** (8 items, 1–5, plus affecting/replenishes/reduce) | Item set overlaps but is not the specified seven; no 7-day timeframe; wrong anchors; "recover after stress" absent |
| What Still Belongs to You | **Section 04 — Personal Equity** (5 narrative prompts + editable equity statement) | Narrative and non-scored, as required. Framing is financial rather than strengths-based |
| Choose a Priority | *(no counterpart)* | Missing. Users go straight to goal-setting; never asked why now, or the 30-day cost of no change |
| Build an Action Plan | **Section 07 — 30/90/365** (priority, why, measure of done, first action, target date, support, status, progress) | Missing importance, confidence, obstacle, if–then, when/where |
| Summary | **Results dashboard** | Present and evidence-gated, but grouped by the financial model |
| Optional research feedback | *(none)* | Missing entirely |
| Weekly Close | **Section 08 — Weekly Close** (9 ratings + 5 reflections) | Present and repeatable. Missing recovery, drain interference, action status; averages heterogeneous items into one number |
| *(not in spec)* | **Section 05 — Command Center**, **Section 06 — Risks**, **Section 09 — Focus Triage** | Additional product surface with no counterpart in this specification — see Open decisions |

---

## 4. Audit matrix

Status: PASS / PARTIAL / FAIL / NOT TESTABLE / N-A. Priority: P0–P3. Effort: S (<2h), M (半day–2d), L (>2d). Confidence: H/M/L.

### 4.1 Safety and clinical boundaries

| ID | Requirement | Status | Evidence | Test / result | Impact | Recommended change | Pri | Eff | Conf |
|---|---|---|---|---|---|---|---|---|---|
| S1 | Reuse the app's governed crisis/help system | N-A | No such system exists anywhere in `src/` (grep: crisis/988/suicide/hotline/emergency → 0 files before this module) | Code search | Module had to invent one | Establish an app-level crisis component with named ownership; have this module consume it | P0 | M | H |
| S2 | Persistent, discreet immediate-help access | **FAIL** | `SafetyNotice` only in Risks + Results | Runtime + code | No help route during steps 1–5 | Render help affordance in the shell, present on every step | P0 | S | H |
| S3 | Clearly state whether responses are monitored | **FAIL** | Orientation copy | `/monitor/i` no match | User may expect a response that never comes | Add explicit "No one reviews these answers" line to orientation | P0 | S | H |
| S4 | Never invent a self-harm/suicide risk score | PASS | `deriveSummary` produces counts + gated labels only | Code + runtime scenarios | — | Preserve | — | — | H |
| S5 | Do not infer crisis from ordinary answers | PASS | No inference logic exists | Code | — | Preserve | — | — | H |
| S6 | No unapproved clinical instruments | PASS | No PHQ-9/GAD-7/C-SSRS/AUDIT items | Code search | — | Preserve | — | — | H |
| S7 | No automatic contacting of anyone | PASS | No messaging/notification calls in module | Code | — | Preserve | — | — | H |
| S8 | Free text to external AI only with disclosure, authorization, safeguards, governance | PARTIAL | Disclosure/consent/scrub/edit all present; governance absent | Consent flow exercised | Unapproved external processing of sensitive text | Obtain documented authorization; record purpose + retention | P0 | M | H |
| S9 | No validation claims; frame as research-informed prototype | PARTIAL | Copy correctly says "not a test or diagnosis"; never claims validation. Also never frames itself as a prototype | Orientation text | Users may over-trust output | Add prototype framing to orientation + summary footer | P2 | S | H |

### 4.2 Data integrity and privacy

| ID | Requirement | Status | Evidence | Test / result | Impact | Recommended change | Pri | Eff | Conf |
|---|---|---|---|---|---|---|---|---|---|
| D1 | Every answer records stable `question_id` + `question_version` | **FAIL** | Only a sheet-level `version: 1` | Runtime: no `question_id` anywhere in the model | Trends silently break when wording changes | Introduce per-item question ids + versions | P1 | L | H |
| D2 | Baseline vs Weekly Close distinguishable | PASS | Separate collections (`goals`/`assets`… vs `weeklyCloses`) | Runtime | — | Preserve | — | — | H |
| D3 | Timeframe and anchors stored/recoverable by version | **FAIL** | Anchors exist only as JSX label props | Code | Cannot reinterpret historical answers | Store an anchor set id per answer | P1 | M | H |
| D4 | `0` / skipped / N-A / unanswered / prefer-not-to-answer are distinct | **FAIL** | Scales render 1..max; unrated = `0`/undefined; `capacityScores()` filters `rating > 0` | Runtime: `{sleep:{rating:0}}` was **dropped** from results | A genuine "Not able" answer is indistinguishable from no answer — and the spec's `0` anchor cannot be expressed at all | Move to 0–4 scales with an explicit unanswered sentinel + "Prefer not to answer" | P1 | M | H |
| D5 | Partial completion without fabricating zeros | PARTIAL | Nothing is invented, but `0` is overloaded | Runtime | Ambiguous data | Fixed by D4 | P1 | — | H |
| D6 | User-added free text protected as sensitive | PARTIAL | On-device only, never in analytics; but export is plain JSON with no sensitivity marking | Export inspected (4KB, plaintext) | Exported file is unlabelled sensitive data | Mark sensitive fields; warn on export | P2 | S | M |
| D7 | Repeated measures compare like with like | **FAIL** | Depends on D1/D3 | Code | Trend lines can silently mix instruments | Fixed by D1+D3 | P1 | — | H |
| D8 | Review, edit, delete, export | PASS | All four verified | Runtime: delete emptied the store | — | Preserve | — | — | H |
| D9 | No sensitive data in URLs, notifications, analytics, logs | PASS | 3 analytics events, `metadata:{}`; no query string; no console logging of answers | Runtime inspection of `mindvault_metrics_v1` | — | Preserve; add a regression test | — | — | H |
| D10 | Save failure never silently loses answers | **FAIL** | `saveSheet` catches and swallows both storage paths | Runtime proof (see P0-1) | Total loss with false "Saved" | Propagate failure; show a persistent unsaved-changes banner; offer export-to-file fallback | P0 | M | H |

### 4.3 Flow and question design

| ID | Requirement | Status | Evidence | Test / result | Impact | Recommended change | Pri | Eff | Conf |
|---|---|---|---|---|---|---|---|---|---|
| F1 | Orientation: purpose, time, privacy, optionality, limits | PASS | All four present and clear | Runtime capture | — | Preserve | — | — | H |
| F2 | Ask what would make the check-in useful today | **FAIL** | Not asked | Runtime | Loses personalisation + engagement signal | Add single optional prompt to orientation | P2 | S | H |
| F3 | Resources: selectable + user-added; access measured separately | PARTIAL | Categories + free text + separate strength/access | Runtime | Good construct, wrong scale | Re-anchor; add "what would make this easier to use" | P1 | M | H |
| F4 | Resource access: past 7 days, 0–4 named anchors | **FAIL** | 1–5, no timeframe stated | Runtime | Not the specified construct | Implement exact anchors + timeframe | P1 | S | H |
| F5 | Drains: what consumed time/energy/attention/money/health/peace | PARTIAL | Liabilities with 7 categories | Runtime | Framing differs (see §10) | Product decision | P1 | M | M |
| F6 | Interference 0–4 measured separately | **FAIL** | Not present | Runtime: no `interference` in lib | Blocks L2/L3 logic | Add dimension | P1 | M | H |
| F7 | Urgency 0–3 with specified anchors | PARTIAL | 1–3, anchors differ | Runtime | Near-miss construct | Re-anchor to 0–3 | P1 | S | H |
| F8 | Influence 0–3 measured separately | **FAIL** | Not present | Runtime: no `influence` in lib | Blocks the single most important support rule | Add dimension | P1 | M | H |
| F9 | User classifies response (act/ask/reduce/negotiate/cope/monitor/exit) | **FAIL** | Not offered | Code | User has no vocabulary for "cannot fix this" | Add a select on each drain | P2 | S | H |
| F10 | Capacity: the seven specified items | PARTIAL | 8 items, overlapping; "recover after stress" absent | Code | Different instrument | Align item set | P1 | S | H |
| F11 | Capacity: past 7 days, 0–4 anchors, ability-not-worth framing | **FAIL** | 1–5, no timeframe; framing is good | Runtime | Not the specified construct | Re-anchor + state timeframe | P1 | S | H |
| F12 | "What could restore even 10% of usable capacity?" | PARTIAL | Asks "What replenishes me?" per area | Runtime | Close but not the 10% framing | Adopt specified wording | P2 | S | H |
| F13 | What Still Belongs to You — narrative, not scored, no forced positivity | PARTIAL | Genuinely narrative and unscored | Runtime | Financial framing conflicts | Product decision (§10) | P2 | S | M |
| F14 | Choose a Priority — one area, why now, 30-day cost of no change | **FAIL** | No such step | Runtime flow walk | Users set goals with no stated stake | Add a short step before planning | P1 | M | H |
| F15–F20 | Action plan: importance 0–10, confidence 0–10, obstacle, if–then, when/where | **FAIL** | None of the five exist | Runtime: goal fields are `priority, why, measureOfDone, firstAction, targetDate, support, status, progress` | Implementation-intention design is the most evidence-backed part of the spec and is absent | Extend `GoalEntry`; add fields to the plan form | P1 | M | H |
| F21 | Summary separates the six required groupings | PARTIAL | Separates assets/urgency/capacity/equity/priorities/deadlines/focus | Runtime | Grouped by the financial model | Regroup per §10 decision | P2 | M | M |
| F22 | No universal life score, net-worth number, diagnosis, normative comparison | PASS | No composite in the summary | Runtime | — | Preserve | — | — | H |
| F23 | Weekly Close covers the ten specified items | PARTIAL | 9 ratings + 5 reflections; missing recovery, drain interference, action status | Code | Trend gaps | Add three items | P1 | S | H |
| F24 | Trends only for stable repeated questions, within-person | **FAIL** | Weekly history shows a bar of the **mean of 9 heterogeneous ratings** | Runtime | A composite index the spec explicitly discourages; mixes constructs | Show per-item sparklines, drop the composite | P1 | M | H |
| F25 | Optional research feedback, separable from analytics consent | **FAIL** | Absent | Code | No structured way to learn from pilot | Add optional post-summary block | P2 | M | H |
| F26 | Baseline ~10–15 minutes | **FAIL** | 9 sections; app states 20–30 minutes | Runtime | Drop-off risk; contradicts spec target | Shorten baseline or split advanced sections | P2 | M | H |
| F27 | Baseline and Weekly Close not conflated | PASS | Distinct stores and UI | Runtime | — | Preserve | — | — | H |

### 4.4 Decision-support logic

| ID | Requirement | Status | Evidence | Test / result | Impact | Recommended change | Pri | Eff | Conf |
|---|---|---|---|---|---|---|---|---|---|
| L1 | Urgency 3 surfaced prominently, not labelled crisis | PARTIAL | Counted in a stat tile and a gated label; correctly never called a crisis | Runtime scenario (3 urgent) → count shown, **no next-step prompt** | User sees a number, not a route forward | Add a next-step prompt | P1 | S | H |
| L2 | High interference + low influence → support/reduce/negotiate/cope/exit | **FAIL** | Inputs do not exist | Runtime | The most important anti-"try harder" rule is absent | Depends on F6+F8 | P1 | M | H |
| L3 | High interference + high influence → smallest feasible action | **FAIL** | Inputs do not exist | Runtime | — | Depends on F6+F8 | P1 | S | H |
| L4 | ≥3 capacity items at 0/1 → offer "restore capacity first" | **FAIL** | Scenario with 4 items at lowest produced labels but **no restore-first prompt**, and no interaction with the demanding 30-day goal | Runtime scenario | App may encourage an ambitious goal to a depleted user | Add rule + prompt before goal-setting | P1 | M | H |
| L5 | Resource access 0/1 → step that improves access | **FAIL** | Not implemented | Runtime | Resource identification without access is inert | Add rule | P1 | S | H |
| L6 | Importance < 7 → invite revision/deferral | **FAIL** | Field does not exist | Runtime | — | Depends on F16 | P1 | S | H |
| L7 | Confidence < 7 → shrink/support/change context, without shaming | **FAIL** | Field does not exist | Runtime | Highest-yield planning rule absent | Depends on F17 | P1 | S | H |
| L8 | Thresholds implemented once, testable | PARTIAL | Existing thresholds are centralised in `deriveSummary`/`sortedCommandCenter` — the right pattern — but none are unit-tested | Code | Good structure, unverified | Keep pattern; add tests | P2 | S | H |

### 4.5 Accessibility

| ID | Requirement | Status | Evidence | Test / result | Impact | Recommended change | Pri | Eff | Conf |
|---|---|---|---|---|---|---|---|---|---|
| A1 | Full keyboard operation | PARTIAL | All controls reachable; no negative-tabindex traps (8/8 focusable on sampled screen) | Runtime | Likely usable | Full keyboard pass with a real AT | P1 | S | M |
| A2 | Visible focus on every control | **PARTIAL/at-risk** | Text controls have an explicit focus ring. Scale radios are `opacity:0` 1×1px inputs with the visual state on the `<label>` — **the styled label does not change appearance on `:focus-visible`** | Code inspection; could not confirm rendered ring (pane not compositing) | Keyboard users may not see which scale step is focused | Add `:focus-within` styling to the scale label | P1 | S | M |
| A3 | Semantic labels, fieldsets, instructions, error association | PASS | `label htmlFor`, `fieldset`/`legend`, hint text | Code + runtime | — | Preserve | — | — | H |
| A4 | Screen-reader progress + save state without over-interruption | PASS | One polite live region announcing "Section N of 9: …" | Runtime observed | — | Preserve | — | — | M |
| A5 | Touch targets and readable mobile text | PASS | 46px scale steps, 44–46px buttons | Computed styles | — | Preserve | — | — | H |
| A6 | No meaning by colour alone | PASS | Every accent paired with text | Runtime | — | Preserve | — | — | H |
| A7 | Charts have text equivalents | PASS | Weekly bars show "x.x / 5" | Runtime | — | Preserve | — | — | H |
| A8 | Reduced-motion support | **FAIL** | 3 unconditional `transition:` declarations; smooth `scrollIntoView`; no `prefers-reduced-motion` anywhere | Code | Vestibular discomfort | Wrap motion in a media query | P2 | S | H |
| A9 | Plain-language validation preserving entered data | N-A | No blocking validation exists — nothing is required, so no error states occur | Runtime | — | Revisit if required fields are ever added | — | — | H |
| A10 | Can skip optional free text and take a break | PASS | Everything skippable; Save-and-exit on every step | Runtime | — | Preserve | — | — | H |
| A11 | Honest progress, no unexpected length trap | PARTIAL | "Step N of 9" is accurate | Runtime | Stated 20–30 min vs 10–15 target (F26) | Address with F26 | P2 | S | H |

### 4.6 Tests

| ID | Requirement | Status | Evidence | Impact | Recommended change | Pri | Eff | Conf |
|---|---|---|---|---|---|---|---|---|
| T1 | Unit tests for scoring/threshold logic | **FAIL** | No test framework in `package.json`; zero `*.test.*`/`*.spec.*` files | All logic unverified by CI | Add Vitest; test `deriveSummary`, `sortedCommandCenter`, `scrubText`, `sectionProgress` | P1 | M | H |
| T2 | Integration/E2E for the journeys | **FAIL** | None | Regressions ship silently | Add Playwright for resume, delete, save-failure, AI-consent | P1 | L | H |
| T3 | Automated accessibility tests | **FAIL** | None | A11y regressions | axe-core in the E2E run | P2 | M | H |
| T4 | Visual regression | **FAIL** | None | Cosmetic drift | Optional | P3 | M | H |

**Tally — 51 requirements:** PASS **18** · PARTIAL **14** · FAIL **17** · N-A **2** · NOT TESTABLE **0**

---

## 5. Prioritized change plan

**Gate 0 — decide before building** (see §10): confirm whether the module keeps the financial
metaphor or adopts the specified research flow. Items marked ⚠ change shape depending on the answer.

### P0 — release blockers (do first, in this order)
1. **D10 / P0-1 — make save failure loud.** `saveSheet` must reject on total failure; `persist()` must
   not set `savedAt` unless a write succeeded; surface a persistent "Not saved" banner with an
   export-to-file escape hatch. *Files:* `src/lib/balanceSheet.js`, `BalanceSheetScreen.jsx`.
   *Acceptance:* with both stores stubbed to throw, the UI shows an unsaved warning, never "Saved",
   and offers a download; automated test asserts the rejection.
2. **S3 — monitoring statement.** One sentence in orientation. *Acceptance:* text present and
   asserted in a test.
3. **S2 / S1 — persistent help access.** Lift a help affordance into the module shell so it renders on
   every step; ideally as a shared app-level component with named ownership. *Acceptance:* the
   affordance is present on all 9 steps, landing, intro, and results.
4. **P0-4 — explicit consent.** Add an affirmative control before step 1 and record
   `consent:{granted, grantedAt, version}`. *Acceptance:* cannot reach step 1 without it; stored.
5. **S8 — AI governance.** Not code. Requires an owner, approved purpose, provider terms, retention
   position. Until then, consider defaulting AI off.

### P1 — core construct, logic, persistence, tests
6. **D1 + D3 + D4 + D5 + D7 — the measurement foundation.** Per-question `question_id` +
   `question_version`, stored anchor-set ids, 0–4 scales where `0` is a real answer, an explicit
   unanswered sentinel, and "Prefer not to answer". **Everything else in P1 depends on this** — do it
   before adding questions. Needs a migration (§7).
7. ⚠ **F6 + F8 — add interference and influence** to drains as separate dimensions.
8. **L1–L7 — decision-support rules**, implemented once in `balanceSheet.js` beside the existing
   thresholds and unit-tested. L2/L3 unblock once step 7 lands; L6/L7 once step 9 lands.
9. ⚠ **F14–F20 — Choose a Priority + full action plan** (importance, confidence, obstacle, if–then,
   when/where), including the non-shaming confidence<7 branch.
10. ⚠ **F4 + F7 + F10 + F11 — re-anchor resources, urgency, and capacity** to the specified
    timeframes and scales.
11. **F23 + F24 — Weekly Close**: add recovery, drain interference, action status; replace the
    composite mean with per-item within-person trends.
12. **T1 + T2 — Vitest + Playwright**, starting with the P0 regressions.
13. **A1 + A2 — keyboard/focus pass**, including `:focus-within` on scale steps.

### P2 — clarity, instrumentation, maintainability
F2 (useful today), F9 (response classification), F12 (10% wording), F21 (summary regrouping),
F25 (research feedback), F26 (shorten baseline), S9 (prototype framing), D6 (export sensitivity),
A8 (reduced motion), L8 (threshold tests), T3 (axe).

### P3 — polish
T4 (visual regression); future validation work once the instrument stabilises.

---

## 6. Exact proposed content changes

Only where copy differs materially. Wording is a proposal, not a mandate — product voice governs.

| Location | Current | Proposed |
|---|---|---|
| Orientation, privacy block | "Your answers stay on IndexedDB on this device. Nothing is uploaded unless you explicitly ask for AI help later, and you review the exact text first." | Keep, then add: **"No one reviews these answers. Nothing here is monitored, and no one is alerted by anything you write. If you need someone to respond, use the help link at the top of any screen."** |
| Orientation, new consent control | *(none — "Start" button only)* | **"I understand this is a private self-reflection tool, not a test, diagnosis, or monitored service."** + affirmative control, then Start. |
| Orientation, new prompt | *(none)* | **"What would make this check-in useful to you today?"** (optional) |
| Orientation, framing | "This is not a test or diagnosis." | Keep, and add to the summary footer: **"A research-informed prototype. It has not been validated as an assessment."** |
| Capacity intro | "Potential is not the same as the time, energy, attention, or emotional capacity you can reliably access today." | Add timeframe: **"Thinking about the past 7 days…"** and re-anchor 0–4: *0 Not able · 1 Able with great difficulty · 2 Able with some difficulty · 3 Mostly able · 4 Fully able without unusual extra effort.* |
| Capacity follow-up | "What replenishes me?" | **"What could restore even 10% of your usable capacity?"** |
| Resource access scale | "Access right now" (1–5, "Hard to reach" → "Fully available") | **"In the past 7 days, how available was this?"** — *0 Not available · 1 Rarely · 2 Sometimes · 3 Usually · 4 Reliably available.* |
| Drains, new dimensions | urgency only | Add **Interference** (*0 Not at all → 4 Extremely*) and **Influence** (*0 None right now → 3 A great deal*); re-anchor urgency to *0 No action now · 1 This month · 2 This week · 3 Today*. |
| Action plan, new fields | — | **"How important is this to you?"** 0–10 (*Not important* → *Extremely important*); **"How confident are you that you'll do it?"** 0–10 (*Not at all confident* → *Completely confident*); **"What's most likely to get in the way?"**; **"If [obstacle], then I will [response]."**; **"When and where will this happen?"** |
| Confidence < 7 branch | *(none)* | **"That's useful information, not a problem. Plans usually work better when they're smaller. Would you like to shrink the step, add support, or change when and where it happens?"** |
| Every scale | 1–5 only | Add **"Prefer not to answer"** as a distinct, recorded option. |

---

## 7. Data / schema migration needs

No server database exists — persistence is IndexedDB `mindvault_balance_v1`, store `sheets`, single
record `primary`, current `version: 1`. Migration is client-side in `migrate()`.

**Required for D1/D3/D4 (breaking, needs care):**

1. **Bump to `SCHEMA_VERSION: 2`** and migrate on read, as the existing `migrate()` already does.
2. **Rating re-basing is the dangerous part.** Old scales are 1–5 with `0`/undefined meaning
   *unanswered*. New scales are 0–4 with `0` meaning *Not able / Not available / Not at all*.
   A naive `newValue = oldValue - 1` would convert an old `1` ("Fragile"/"Not able with great
   difficulty") into a new `0` ("Not able") — **changing what the user said**.
   **Recommendation: do not re-base.** Tag every v1 answer with `anchorSet: "v1-1to5"` and every v2
   answer with `anchorSet: "v2-0to4"`, and refuse to plot them on one trend line. This satisfies D7
   without rewriting history.
3. **Backfill `question_id`** from the existing stable category/area ids (`sleep`, `focus`,
   `relationships`, …) with `question_version: 1`. These ids are already stable in
   `CAPACITY_AREAS`/`ASSET_CATEGORIES`, so backfill is safe.
4. **Distinguish missing values:** map existing `0`/undefined ratings to an explicit
   `{ state: "unanswered" }` rather than a number.
5. **Export/import compatibility:** `doExport`/`doImport` in `App.jsx` carry the sheet verbatim; a v1
   backup restored into a v2 build must pass through `migrate()`. Add a test for that path.

**Flagged risk:** any migration that changes stored rating numbers reinterprets answers a user gave
about their own life. Prefer additive tagging over transformation.

---

## 8. Test gaps and proposed tests

No test framework exists. Proposed additions:

| File | Type | Covers |
|---|---|---|
| `src/lib/__tests__/balanceSheet.storage.test.js` | unit | **P0-1**: `saveSheet` rejects when both stores fail; resolves on IDB success; falls back to localStorage |
| `src/lib/__tests__/balanceSheet.derive.test.js` | unit | `deriveSummary` label gating (each threshold on/off), `capacityScores` missing-value handling, `equityStatement` |
| `src/lib/__tests__/balanceSheet.sort.test.js` | unit | `sortedCommandCenter` bucket order (overdue > high-priority-undated > this-month > medium > distant > done) |
| `src/lib/__tests__/balanceSheet.privacy.test.js` | unit | `scrubText` for emails/phones/IDs/accounts/clinicians; `buildAIPayload` includes nothing beyond declared fields |
| `src/lib/__tests__/balanceSheet.migrate.test.js` | unit | v1→v2 migration preserves answers; anchor sets tagged; no silent re-basing |
| `src/lib/__tests__/decisionSupport.test.js` | unit | L1–L7 thresholds once they exist |
| `e2e/balance-sheet.journey.spec.js` | E2E | baseline, skip/prefer-not-to-answer, save→exit→resume, weekly close, delete |
| `e2e/balance-sheet.safety.spec.js` | E2E | help affordance on every step; consent gate; monitoring statement; AI blocked without consent |
| `e2e/balance-sheet.persistence.spec.js` | E2E | storage-failure banner; no false "Saved" |
| `e2e/balance-sheet.a11y.spec.js` | a11y | axe-core per step; keyboard-only completion; visible focus on scale steps |

---

## 9. Evidence limits

**The two named sources of truth are absent from the repository.**
`Personal_Balance_Sheet_Claude_Code_Prompt.md` and
`Personal_Balance_Sheet_Evidence_and_Question_Design_Report.docx` were searched for by exact name and
by pattern; neither exists (nor does `Personal_Balance_Sheet_Toolkit.pdf`, referenced by an earlier
specification). **This audit is therefore conducted against the requirements embedded in the audit
prompt only.**

Consequences:
- I cannot verify which design choices the research report actually supports. The prompt states the
  constructs (0–4 anchors, separated interference/urgency/influence, implementation intentions,
  7-day recall) but I have not seen the citations behind them, so I have treated them as
  **specification requirements, not as independently verified evidence**.
- Claims about *why* a construct is superior are outside what I can confirm from this repository.
- Anything in this audit describing the module as "not research-informed" means **it does not match
  the specified design** — not that the specified design is proven and the current one is disproven.
- Runtime evidence in this audit is first-hand: I ran the app, exercised the journeys, stubbed the
  storage layer, and inspected IndexedDB and analytics directly. Two items (A2 visible focus, A4
  screen-reader interruption rate) are marked at reduced confidence because the browser pane was not
  compositing frames, so I could not visually confirm a rendered focus ring or hear announcement
  cadence; both need a pass with a real assistive technology.

---

## 10. Open decisions — require your ownership

1. **Product / design — which instrument is this?** ⚠ *Blocks ~60% of P1.*
   The module implements the earlier approved financial-metaphor design (Assets, Liabilities,
   Personal Equity, Command Center, 30-90-365, Focus Triage). This specification prescribes a
   different flow (Resources, Drains & Pressures, Current Capacity, What Still Belongs to You,
   Choose a Priority, Build an Action Plan). Options:
   **(a)** Adopt the specified flow, retiring Command Center / Risks / Focus Triage;
   **(b)** Keep the financial identity and retrofit only the measurement design (0–4 anchors,
   interference/influence, importance/confidence, if–then) inside the existing sections;
   **(c)** Keep both — specified flow as the baseline, current sections as optional depth.
   *My recommendation:* **(b)**. It captures every construct the spec cares about and every
   decision-support rule, at roughly half the cost of (a), and preserves a product identity you
   already approved. The residual risk is the financial framing itself, which the spec cautions
   against — resolvable with copy rather than architecture, provided no net-worth number is ever
   computed (none is today).

2. **Clinical / legal — crisis resource ownership.** The app has no governed crisis system; this
   module currently hardcodes a US-labelled line plus "your local emergency number". Who owns that
   list, how is it localised, and how is it reviewed?

3. **Privacy / legal — AI authorization.** Approve or decline external processing of free-text
   answers, with purpose, provider terms, and retention documented. Until then, consider shipping
   with AI defaulted off.

4. **Product — baseline length.** The spec targets 10–15 minutes; the current baseline is nine
   sections and states 20–30. Shorten the baseline, or split into baseline + optional depth?

5. **Research — is a feedback module in scope for the pilot?** (F25) It is absent, and it is the only
   mechanism proposed for learning whether any of this works.

---

*Audit complete. No application code, schema, migration, configuration, or product copy was modified.*
