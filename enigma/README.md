# ENIGMA

A provenance-first research engine for pattern discovery across people, music, dates, and text.

ENIGMA deliberately keeps four things separate that ordinary research software blurs together:

1. **What a source actually says** — claims, with evidence.
2. **What ENIGMA deterministically computes** — versioned Canon rules.
3. **What an algorithm discovers** — candidate findings, not facts.
4. **What a human or AI interprets a finding to mean** — reviewed, never automatic.

> A connection is not a fact merely because ENIGMA can compute it.

## The five invariants

1. Nothing factual exists without provenance.
2. Nothing calculated exists without a rule version.
3. Nothing copyrighted enters a processing path without a rights decision.
4. Nothing discovered automatically becomes verified.
5. Nothing interpretive is presented as causal evidence without documentary support.

See [docs/invariants.md](docs/invariants.md).

## What is in this POC scaffold

This is the P0 foundation only — the part that proves the architecture. It is intentionally
**not** a full app yet.

| Area | Status in this scaffold |
|---|---|
| Postgres schema (entity / source / claim / relationship / rule / run / finding / rights) | `db/migrations/0001_init.sql` |
| Canon engine (deterministic, versioned, replayable) | `src/enigma/canon/` — **working** |
| Canonical rule specs (A1Z26, digit sum, digital root, reverse, date interval) | `rules/canonical/*.yaml` — **working** |
| FastAPI skeleton | `src/enigma/api/app.py` — Canon, `/v1/entities/resolve`, `/v1/music/resolve`, `/v1/research-runs` **live**, rest are honest `501` stubs |
| Golden + reproducibility tests | `tests/` — **working** |
| Wikidata + MusicBrainz adapters, multi-signal entity resolution | `src/enigma/adapters/` — **working** (offline-tested + live) |
| Research-run ledger (record + replay) | `src/enigma/ledger/` — **working** (in-memory + Postgres stores) |
| Discovery engine, pgvector, UI | **not built yet** (next phases) |

## Entity resolution (Wikidata + MusicBrainz)

`src/enigma/adapters/` holds source adapters behind a provider-neutral `SourceAdapter`
protocol (`search` / `fetch_entity` / `get_rights`). Both resolve a query to ranked candidates
scored on **independent dimensions** — name, alias, type, birth/death (or principal) year,
authoritative id match — that are never collapsed into a single number: each `ResolutionResult`
carries its full `signals` breakdown plus a `coverage` figure. A name-only hit scores lower than
one corroborated on type and dates, and a shared stable id (VIAF / MusicBrainz / ORCID) is
decisive — which is also how the two sources reconcile (Wikidata stores an entity's MusicBrainz
id, so the same artist resolves across both).

- **Wikidata** (`WikidataClient`, CC0) — cross-domain people/places/works/music.
- **MusicBrainz** (`MusicBrainzClient`, CC0 core) — one adapter instance per entity *kind*
  (`artist` / `recording` / `release` / `release-group` / `work`), e.g.
  `MusicBrainzAdapter(kind="release-group")` resolves albums.

HTTP lives only in the clients (descriptive User-Agent, ~1 req/s throttle, contact from
`ENIGMA_CONTACT` and never a personal address); parsing and scoring are pure, so the suite runs
offline against recorded fixtures (`tests/fixtures/`). Opt-in live tests: `ENIGMA_LIVE_TESTS=1`.

```
# Wikidata — "Niels Bohr"
1.000  Q7085      person         | name=1.0, type=1.0, birth_year=1.0
0.533  Q20652992  -              | name=1.0            (name only -> lower certainty)

# MusicBrainz — "Kendrick Lamar" (artist) and "untitled unmastered." (release-group)
1.000  381086ea   person         Kendrick Lamar       | name=1.0, type=1.0, birth_year=1.0
1.000  4e44335c   release_group  untitled unmastered. | name=1.0, type=1.0, birth_year=1.0
```

## Research-run ledger (record + replay)

`src/enigma/ledger/` records a research run as an ordered list of steps and can replay it.
A `RunRecorder` logs two kinds of step: `run_rule` (a deterministic Canon transformation,
persisted as a `transformation_run` with its `determinism_hash`) and `resolve_entity` (a live
adapter resolution, recorded for provenance). `replay()` re-executes every `run_rule` step and
asserts it reproduces the stored hash — **pinning the exact rule version that ran**, so replay
stays correct even after the Canon gains newer versions. A tampered ledger entry fails replay.

Storage is a port (`LedgerStore`) with two interchangeable implementations: `InMemoryLedgerStore`
(tests/dev, the API's default) and `PostgresLedgerStore` (psycopg; `pip install -e ".[db]"`,
set `ENIGMA_DATABASE_URL`) writing to the `research_run` / `research_run_step` / `transformation_run`
tables. So the ledger logic is provable offline.

```
run ...  status=complete
  1. run_rule numeric.a1z26@1.0.0 (Niels Bohr) -> {'values': [...], 'sum': 102}
  2. run_rule numeric.digital_root@1.1.0 (102)  -> {'root': 3}
  3. run_rule date.interval_days@1.0.0 (...)     -> {'days': 563}
replay ok = True   (1. matched  2. matched  3. matched)
```

## The Canon engine

Rules are declarative, versioned specs — not prompts, not ad-hoc Python. The engine normalizes
input per the rule, runs one deterministic operation, and returns an execution record carrying a
`determinism_hash` over `(rule_id, rule_version, normalized_input, result)`. Replaying the same
rule + input on the same engine version produces the same hash, forever.

Canonical benchmark results this scaffold reproduces byte-for-byte:

- `numeric.a1z26@1.0.0` on `"Niels Bohr"` → **102**
- `date.interval_days@1.0.0` on Kendrick's *untitled unmastered.* embedded dates → **563, 620, 1011, 568, 530, 978, 545** days to release

## Quick start

```bash
cd enigma
python -m venv .venv
# Windows:  .venv\Scripts\activate
# POSIX:    source .venv/bin/activate
pip install -e ".[dev]"
pytest              # golden + reproducibility suites
uvicorn enigma.api.app:app --reload   # http://127.0.0.1:8000/docs
```

Try the engine without the API:

```bash
python -c "from enigma.canon import run; print(run('numeric.a1z26','Niels Bohr')['result'])"
```

## Layout

```
enigma/
├── db/migrations/        # PostgreSQL schema (the canonical record)
├── rules/canonical/      # versioned deterministic rule specs (the Canon)
├── src/enigma/
│   ├── canon/            # normalize + registry + engine + operations
│   ├── adapters/         # SourceAdapter protocol + Wikidata + MusicBrainz + resolution
│   ├── ledger/           # research-run store (in-memory + Postgres) + recorder + replay
│   ├── models.py         # Finding / execution-record dataclasses
│   └── api/app.py        # FastAPI: Canon/resolve/music/research-runs live, rest stubbed 501
├── tests/
│   ├── golden/           # known-answer tests (incl. every rule's own fixtures)
│   └── reproducibility/  # replay produces identical deterministic output
└── docs/
```

## Deliberately not here yet

Lyrics are **not** in this scaffold and must never land in a `lyrics TEXT` column. The schema models
rights as a first-class `content_asset` + `rights_policy` so a licensed provider (Musixmatch /
LyricFind) can drop in behind a gate later. Do not add a lyrics adapter before the rights engine
enforces `may_send_to_third_party_ai` et al.
