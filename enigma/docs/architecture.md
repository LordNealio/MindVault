# ENIGMA architecture (POC scope)

```
          Next.js / TS  (not in this scaffold)
                 │  typed API
          ┌──────▼───────┐
          │  FastAPI core │   src/enigma/api/app.py
          └──────┬───────┘
     ┌───────────┼─────────────────────────────┐
     ▼           ▼                               ▼
 Identity &   Canon / Rule Engine           Evidence
 Metadata     src/enigma/canon/             claims + sources
 (adapters:   A1Z26 · digit sum ·           + provenance
  Wikidata,   digital root · reverse ·       (schema only
  MusicBrainz date intervals                  in this scaffold)
  — later)    [WORKING]
                 │
                 ▼
          Discovery (later)  →  Candidate Findings  →  Verification (later)
                                       │
                                       ▼
                         PostgreSQL (+ pgvector later)
                         db/migrations/0001_init.sql
```

## Decisions locked for the POC

- **Primary DB: PostgreSQL.** Claims, entities, rules and provenance are highly relational; JSONB
  covers flexible metadata; FTS + trigram cover search. No Neo4j, no OpenSearch, no dedicated vector
  store on day one. `entity` + `relationship` tables are the knowledge graph.
- **Canon is a versioned declarative DSL, not prompts.** Rules live in `rules/canonical/*.yaml`.
  The engine is pure-stdlib + PyYAML so its reproducibility is provable with zero infrastructure.
- **Backend Python/FastAPI** (same language as the analysis ecosystem). **Frontend Next.js/TS** later.
- **LLM is a replaceable adapter** used for interpretation only. The Canon engine needs no model.
- **One orchestrator + typed tools**, not a swarm of agents. Independent verifier agents are a later
  experiment gated on measured error reduction.

## Why the engine has no database dependency

The single most important property — *the same input + same rule version always yields the same
result* — must be testable without Postgres, without a model, without a network. So `src/enigma/canon`
imports nothing but the standard library and PyYAML, and `tests/reproducibility/` proves replay
determinism in isolation. The DB stores execution records; it does not participate in computing them.

## What drops in next (in order)

1. Wikidata adapter → cross-domain entity resolution (CC0).
2. MusicBrainz adapter → artist / recording / release / work graph (1 req/s, real User-Agent).
3. Research-run ledger wired to Postgres.
4. Candidate-finding engine (lexical/phonetic/vector/graph) — generates, never promotes.
5. Statistical discipline: null models + Benjamini-Hochberg FDR within declared hypothesis families.
6. Rights-gated lyrics adapter (Musixmatch PoC) — only after the rights engine enforces permissions.
