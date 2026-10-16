-- ENIGMA initial schema
-- Invariant map:
--   (1) provenance   -> source / source_version / source_excerpt / claim / claim_evidence
--   (2) rule version -> transformation_rule / transformation_rule_version / transformation_run
--   (3) rights       -> license_contract / content_asset / rights_policy
--   (4) discovery<>verified -> candidate_finding / finding_evidence / finding_review
--   (5) interpretation not causal -> relationship_class + interpretation_status on findings
--
-- Postgres 14+. pgvector is OPTIONAL and gated at the bottom.

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- trigram similarity for name matching

-- ---------------------------------------------------------------------------
-- Research framing
-- ---------------------------------------------------------------------------
CREATE TABLE research_project (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    description TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Canonical identity  (ENIGMA assigns its own UUID; vendor IDs are attached)
-- ---------------------------------------------------------------------------
CREATE TABLE entity (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id      UUID REFERENCES research_project(id) ON DELETE SET NULL,
    type            TEXT NOT NULL,              -- person | music_artist | work | place | event | organization | ...
    canonical_label TEXT NOT NULL,
    merged_into     UUID REFERENCES entity(id), -- entity resolution: survivor points elsewhere
    metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX entity_label_trgm ON entity USING gin (canonical_label gin_trgm_ops);
CREATE INDEX entity_type_idx   ON entity (type);

CREATE TABLE entity_alias (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    value     TEXT NOT NULL,
    language  TEXT,
    kind      TEXT                              -- full_name | stage_name | transliteration | ...
);
CREATE INDEX entity_alias_value_trgm ON entity_alias USING gin (value gin_trgm_ops);

CREATE TABLE external_identifier (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id   UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    authority   TEXT NOT NULL,                  -- wikidata | viaf | musicbrainz | orcid | crossref | openalex | discogs
    external_id TEXT NOT NULL,
    captured_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (authority, external_id, entity_id)
);

-- ---------------------------------------------------------------------------
-- Sources & evidence  (invariant 1)
-- ---------------------------------------------------------------------------
CREATE TABLE source (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title       TEXT NOT NULL,
    authority   TEXT,                           -- nobelprize.org | musicbrainz | interscope | wikidata | ...
    url         TEXT,
    source_kind TEXT,                           -- primary | secondary | reference | user_supplied
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE source_version (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id     UUID NOT NULL REFERENCES source(id) ON DELETE CASCADE,
    retrieved_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    content_hash  TEXT NOT NULL,                -- freshness + reproducibility
    freshness_note TEXT
);

CREATE TABLE source_excerpt (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_version_id UUID NOT NULL REFERENCES source_version(id) ON DELETE CASCADE,
    excerpt          TEXT NOT NULL,
    locator          TEXT                       -- page / paragraph / timestamp / JSON path
);

-- ---------------------------------------------------------------------------
-- Claims vs relationships  (a claim is attributable; a relationship is structured)
-- ---------------------------------------------------------------------------
CREATE TABLE claim (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subject_id  UUID REFERENCES entity(id) ON DELETE SET NULL,
    statement   TEXT NOT NULL,                  -- "Niels Bohr escaped occupied Denmark in 1943."
    -- first-class date uncertainty for date-bearing claims:
    date_value        DATE,
    date_precision    TEXT,                     -- day | month | year | decade
    date_calendar     TEXT DEFAULT 'gregorian',
    date_certainty    TEXT,                     -- reported | inferred | circa
    date_earliest     DATE,
    date_latest       DATE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE claim_evidence (
    claim_id          UUID NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
    source_excerpt_id UUID NOT NULL REFERENCES source_excerpt(id) ON DELETE CASCADE,
    PRIMARY KEY (claim_id, source_excerpt_id)
);

CREATE TABLE relationship (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_entity   UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    to_entity     UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
    predicate     TEXT NOT NULL,                -- participated_in | parent_of | artist_of | released_on
    relationship_class TEXT NOT NULL DEFAULT 'documented',  -- documented | computed | statistical | semantic | phonetic | interpretive | causal
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- a structured relationship is backed by the claims that support it
CREATE TABLE relationship_claim (
    relationship_id UUID NOT NULL REFERENCES relationship(id) ON DELETE CASCADE,
    claim_id        UUID NOT NULL REFERENCES claim(id) ON DELETE CASCADE,
    PRIMARY KEY (relationship_id, claim_id)
);

-- ---------------------------------------------------------------------------
-- The Canon  (invariant 2) — versioned deterministic rules + execution ledger
-- ---------------------------------------------------------------------------
CREATE TABLE transformation_rule (
    id          TEXT PRIMARY KEY,               -- e.g. numeric.a1z26
    title       TEXT NOT NULL,
    description TEXT
);

CREATE TABLE transformation_rule_version (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id      TEXT NOT NULL REFERENCES transformation_rule(id) ON DELETE CASCADE,
    version      TEXT NOT NULL,                 -- semver, e.g. 1.0.0
    status       TEXT NOT NULL DEFAULT 'draft', -- draft | experimental | canonical | retired
    spec         JSONB NOT NULL,                -- the full declarative spec (mirror of the YAML)
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (rule_id, version)
);

CREATE TABLE transformation_run (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rule_id           TEXT NOT NULL,
    rule_version      TEXT NOT NULL,
    raw_input         JSONB NOT NULL,
    normalized_input  TEXT,
    result            JSONB NOT NULL,
    determinism_hash  TEXT NOT NULL,            -- sha256 over (rule_id, version, normalized_input, result)
    software_version  TEXT NOT NULL,
    executed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX transformation_run_hash_idx ON transformation_run (determinism_hash);

-- ---------------------------------------------------------------------------
-- Rights  (invariant 3) — no copyrighted body ever enters an unauthorized path
-- ---------------------------------------------------------------------------
CREATE TABLE license_contract (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider    TEXT NOT NULL,                  -- musixmatch | lyricfind | ...
    reference   TEXT,
    territory_scope TEXT,
    terms_note  TEXT,
    effective_at    TIMESTAMPTZ,
    expires_at      TIMESTAMPTZ
);

CREATE TABLE content_asset (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_id           UUID REFERENCES entity(id) ON DELETE SET NULL,
    provider            TEXT,
    provider_content_id TEXT,
    content_type        TEXT NOT NULL,          -- official_lyrics | synchronized_lyrics | translation | perceived_transcript | user_supplied_text
    territory           TEXT,
    license_contract_id UUID REFERENCES license_contract(id),
    -- per-operation permissions (default DENY):
    may_display              BOOLEAN NOT NULL DEFAULT FALSE,
    may_cache                BOOLEAN NOT NULL DEFAULT FALSE,
    may_store                BOOLEAN NOT NULL DEFAULT FALSE,
    may_fulltext_index       BOOLEAN NOT NULL DEFAULT FALSE,
    may_compute_features     BOOLEAN NOT NULL DEFAULT FALSE,
    may_create_embeddings    BOOLEAN NOT NULL DEFAULT FALSE,
    may_send_to_third_party_ai BOOLEAN NOT NULL DEFAULT FALSE,
    may_process_local        BOOLEAN NOT NULL DEFAULT FALSE,
    retention_expires_at     TIMESTAMPTZ,
    deletion_required        BOOLEAN NOT NULL DEFAULT FALSE,
    attribution_template     TEXT,
    source_hash              TEXT,
    encrypted_payload_pointer TEXT,             -- restricted bodies live OUTSIDE this row, encrypted
    created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- a named, versioned policy the rights engine evaluates per operation
CREATE TABLE rights_policy (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    version     TEXT NOT NULL,
    rules       JSONB NOT NULL,                 -- operation x territory x provider -> allow/deny + reason
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (name, version)
);

-- ---------------------------------------------------------------------------
-- Discovery vs verification  (invariant 4) — independent dimensions, no "truth score"
-- ---------------------------------------------------------------------------
CREATE TABLE candidate_finding (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id         UUID REFERENCES research_project(id) ON DELETE SET NULL,
    statement          TEXT NOT NULL,
    origin             TEXT NOT NULL,           -- discovery_engine | researcher | llm
    relationship_class TEXT NOT NULL,           -- documented | computed | statistical | semantic | phonetic | interpretive | causal
    subjects           JSONB NOT NULL DEFAULT '[]'::jsonb,   -- entity ids
    -- independent dimensions (NEVER collapse into one score):
    evidence_grade       TEXT,                  -- A | B | C
    factual_confidence   NUMERIC,               -- confidence in the underlying facts
    pattern_unusualness  NUMERIC,               -- percentile or permutation p
    multiplicity_scope   INTEGER,               -- how many comparisons were searched
    fdr_q                NUMERIC,               -- Benjamini-Hochberg adjusted q
    intentionality       TEXT NOT NULL DEFAULT 'unknown',     -- unknown | supported | contradicted
    interpretation_status TEXT NOT NULL DEFAULT 'unreviewed', -- unreviewed | plausible | speculative | rejected | canonical
    contains_restricted_content BOOLEAN NOT NULL DEFAULT FALSE,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE finding_evidence (
    finding_id          UUID NOT NULL REFERENCES candidate_finding(id) ON DELETE CASCADE,
    claim_id            UUID REFERENCES claim(id) ON DELETE SET NULL,
    transformation_run_id UUID REFERENCES transformation_run(id) ON DELETE SET NULL,
    note                TEXT
);

CREATE TABLE finding_review (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    finding_id  UUID NOT NULL REFERENCES candidate_finding(id) ON DELETE CASCADE,
    reviewer    TEXT,
    decision    TEXT NOT NULL,                  -- plausible | speculative | rejected | canonical
    rationale   TEXT,
    reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Research-run ledger  (every result can be replayed)
-- ---------------------------------------------------------------------------
CREATE TABLE research_run (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id     UUID REFERENCES research_project(id) ON DELETE SET NULL,
    query          TEXT NOT NULL,
    requested_modules JSONB NOT NULL DEFAULT '[]'::jsonb,
    canon_version  TEXT,
    status         TEXT NOT NULL DEFAULT 'queued',  -- queued | running | complete | failed
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE research_run_step (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id        UUID NOT NULL REFERENCES research_run(id) ON DELETE CASCADE,
    step_no       INTEGER NOT NULL,
    tool          TEXT NOT NULL,               -- resolve_entity | run_rule | search_sources | ...
    input         JSONB,
    output        JSONB,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_log (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor       TEXT NOT NULL,                  -- user | engine | llm:<provider>/<model>
    action      TEXT NOT NULL,
    target      TEXT,
    detail      JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Semantic search — pgvector, OPTIONAL. Enable only when discovery needs it.
-- ---------------------------------------------------------------------------
-- CREATE EXTENSION IF NOT EXISTS vector;
-- CREATE TABLE embedding (
--     id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     entity_id   UUID REFERENCES entity(id) ON DELETE CASCADE,
--     model       TEXT NOT NULL,
--     dim         INTEGER NOT NULL,
--     vec         vector,                      -- set dim at create time, e.g. vector(1536)
--     created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
-- );
-- CREATE INDEX embedding_hnsw ON embedding USING hnsw (vec vector_cosine_ops);
