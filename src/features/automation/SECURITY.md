# MindVault Automation — Security Model

---

## ✅ Slice 2 Phase 1 — Complete

**What changed in Phase 1:**

Browser-direct Anthropic API calls for automation are no longer the active code path.

| Property | Before Phase 1 (Slice 1) | After Phase 1 |
|---|---|---|
| Anthropic API key location | Browser `localStorage` | Vercel env var (`process.env`) only |
| Who calls Anthropic | Browser → `api.anthropic.com` | Server → `api.anthropic.com` |
| `dangerous-direct-browser-access` header | Present in `callAnthropic()` | Absent from all active paths |
| API key visible in DevTools | Yes | No |
| XSS can exfiltrate Anthropic key | Yes | No |
| Automation access credential in browser | API key (high value) | Session token (limited blast radius) |
| Session token persisted | N/A | **Memory only** (see below) |

The deprecated `callAnthropic()` function is retained in `apiClient.js` for reference
only. It is not called by any agent. It will be removed in Phase 2.

---

## Automation access token — storage decision

**Where it is stored:** React component state (`useState`) only.
**Persisted to disk:** No. Not written to `localStorage`, `sessionStorage`, `IndexedDB`,
or any other persistent store.
**Lifetime:** Current browser tab session only. Cleared on tab close or page reload.

**Why memory-only is the correct default:**

The automation access token grants the ability to invoke the server-side Anthropic
proxy on behalf of the user. Persisting it in `localStorage` or `IndexedDB` would
expose it to the same XSS theft risk as the API key it replaced. The token is less
catastrophic to lose than the Anthropic key (a compromised token cannot call Anthropic
directly — it can only invoke the proxy for automation runs), but the storage discipline
should be the same.

The user pastes the token once per session. This is an acceptable UX cost for the
current single-user scope.

**If persistence is needed in the future:**

A "remember this device" option can be added later with explicit user consent, using
one of these approaches (in increasing security order):

1. `sessionStorage` — survives page reload, cleared on tab close
2. Encrypted `localStorage` with a device-derived key — survives tab close, not
   easily readable by XSS (but introduces key derivation complexity)
3. `httpOnly` cookie set by the server — not accessible to JavaScript at all; the
   correct production approach once Phase 2 Postgres + proper auth is in place

None of these are implemented in Phase 1. The default is non-persistent.

---

## Active security properties (Phase 1 + Slice 1 properties that carry forward)

| Property | How enforced |
|---|---|
| Anthropic key never in browser | `ANTHROPIC_API_KEY` read only in `api/automation/invoke.js` via `process.env` |
| `dangerous-direct-browser-access` absent | Not present in `callAgentProxy()` or `invoke.js` |
| Proxy is not a generic AI passthrough | `invoke.js` validates: session token, runId format, model allowlist, token/char limits |
| Session token in memory only | `useState("")` with no persistence — cleared on tab close |
| Prompt injection screening | Haiku screen before every Sonnet call (`screenPrompt()`) |
| Fail-closed on parse errors | Both validators return `blocked/tier3` on any schema failure |
| Policy gate in code, not model | `isExecutionAllowed()` and `requiresApproval()` are deterministic |
| Audit on every state transition | `logStateTransition()` in every `transition()` call |
| Secret sanitiser on audit logs | `sanitiseMetadata()` redacts keys matching credential patterns |
| No MCP in Slice 1/Phase 1 | Zero MCP connections. Phase 3 per Zero-Trust addendum. |
| No automatic deploy or publish | All production actions stubbed with BLOCKER errors |
| Approval required for tier3 | `requiresApproval()` enforced in orchestrator — not defeatable by model |

---

## Required environment variables

These must be set in Vercel dashboard → Settings → Environment Variables
before any connected (non-demo) automation run will work.

```
ANTHROPIC_API_KEY        Server only. Never visible to client.
                         The Anthropic API key that pays for model calls.

AUTOMATION_ACCESS_TOKEN  Server only. Shared with authorized users out-of-band.
                         Validates that incoming proxy requests are from known users.
                         Rotate this when a user's access should be revoked.
```

Neither variable appears in source code, `.env` files committed to git, or
any client-side bundle. Both are read exclusively via `process.env` inside
`api/automation/invoke.js`.

---

## Local development

Automation proxy requires `vercel dev`, not `vite dev`:

```bash
npm install -g vercel     # one-time
vercel dev                # replaces npm run dev for automation features
# or:
npm run dev:full          # alias added to package.json
```

`vercel dev` runs both the Vite frontend and the serverless functions together,
with environment variables loaded from `.env.local` (never committed to git).

Create `.env.local` locally:
```
ANTHROPIC_API_KEY=sk-ant-...
AUTOMATION_ACCESS_TOKEN=<generate with: openssl rand -hex 32>
```

For frontend-only work (journaling, vault, settings — not automation proxy),
`npm run dev` / `vite dev` still works fine.

---

## Phase 1 blast radius analysis

| Compromised asset | What attacker can do | What they cannot do |
|---|---|---|
| `sessionToken` (memory only) | Create automation runs via proxy during the session | Access Anthropic key; call Anthropic directly; access journal data; persist access past tab close |
| `AUTOMATION_ACCESS_TOKEN` (server env) | Create unlimited automation runs (billed to key owner) | Access Anthropic key directly; access journal data; deploy code; perform any action not in the proxy allowlist |
| `ANTHROPIC_API_KEY` (server env) | Call Anthropic API directly (bypassing proxy) | Access journal data (stored only in user's browser); deploy code; access other Vercel env vars |

The most likely real risk at current scale: `AUTOMATION_ACCESS_TOKEN` is shared
informally and ends up in a chat log or email. Mitigation: rotate it immediately
via Vercel dashboard. No code change required.

---

## Remaining requirements for Phase 2

These are hard blockers — not improvements. Slice 2 Phase 2 must not be started
until Phase 1 is running correctly in production.

### Phase 2 — Persistent storage + full ownership validation

- Add Neon Postgres (free tier)
- Run `migrations/0001_automation.sql`
- `invoke.js` Phase 1 limitation: runId is format-checked but NOT validated against
  a database for ownership. Phase 2 adds: `SELECT * FROM automation_runs WHERE id=$1
  AND initiated_by_user_id=$2` before proxying. Until then, any valid token holder
  can invoke the proxy with any UUID.
- Add per-user tokens (KV or Postgres) to replace the single shared token
- Add SSE endpoint for live run state streaming
- Move IDB to read-cache role; Postgres becomes source of truth

### Phase 2 — Persistent job queue

- Add Upstash Redis job queue
- Runs survive tab close
- Server-side orchestrator worker (port of Slice 1 `orchestrator.js`)

### Phase 2 — Session token persistence (optional, gated)

- Add explicit "remember this device" checkbox to token UI
- On opt-in: encrypt token with a device-derived key before `localStorage` write
- On opt-out (default): memory only as today

### Phase 3 — GitHub integration + sandbox

- GitHub token in Vercel env vars (server only, never client)
- Branch creation + PR + webhook handler via server endpoints
- GitHub Actions as the CI sandbox (lint, typecheck, build)
- No container provisioning needed for MindVault's SPA scope

### Phase 3 — MCP gateway

- Per Zero-Trust addendum: all MCP behind an internal gateway layer
- No direct model-to-MCP access
- Gateway owns allowlists, per-tool rate limits, audit, per-user consent
- Not implemented until Phase 2 is stable

---

## What is intentionally out of scope (permanently for this project)

- Full OAuth / Clerk auth: only needed if the user base exceeds
  "people Justin knows personally." Add when that changes.
- Per-call billing split: all calls billed to one key. Acceptable for
  single-owner deployment.
- Sandbox container provisioning: GitHub Actions CI is sufficient for
  MindVault's SPA build validation. E2B added only if scope expands
  beyond the project's own build system.
