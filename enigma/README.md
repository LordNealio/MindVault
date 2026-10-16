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
| FastAPI skeleton | `src/enigma/api/app.py` — Canon endpoints **live**, rest are honest `501` stubs |
| Golden + reproducibility tests | `tests/` — **working** |
| Wikidata / MusicBrainz adapters, discovery, pgvector, UI | **not built yet** (next phases) |

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
│   ├── models.py         # Finding / execution-record dataclasses
│   └── api/app.py        # FastAPI: Canon endpoints live, rest stubbed 501
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
