# ENIGMA invariants

These are not guidelines. They are properties the system must never violate. Every schema table,
every engine function, and every endpoint exists to protect one of them.

### 1. Nothing factual exists without provenance.
A `claim` is an assertion attributable to evidence. It links to one or more `source_excerpt`s via
`claim_evidence`. A `relationship` links back to the claims that support it. The UI must be able to
answer "why does this edge exist?" for every edge.

### 2. Nothing calculated exists without a rule version.
Every computed value is produced by a `transformation_rule_version` and recorded as a
`transformation_run` carrying the rule id, the exact version, the normalized input, and a
`determinism_hash`. An LLM may *draft* a rule; it may never silently compute or mutate one.

### 3. Nothing copyrighted enters a processing path without a rights decision.
Restricted content is a `content_asset` with explicit per-operation permissions
(`may_display`, `may_cache`, `may_fulltext_index`, `may_compute_features`, `may_create_embeddings`,
`may_send_to_third_party_ai`, …) scoped by `territory` and `license_contract`. Every outbound AI
request authorizes against `rights_policy` first. There is no `lyrics TEXT` column anywhere.

### 4. Nothing discovered automatically becomes verified.
Discovery produces `candidate_finding`s. A finding carries independent dimensions —
`evidence_grade`, `relationship_class`, `pattern_unusualness`, `multiplicity_status`,
`interpretation_status`, `intentionality` — that must never collapse into one "truth score."
Promotion to verified requires a `finding_review`.

### 5. Nothing interpretive is presented as causal evidence without documentary support.
"These two names both reduce to 102" is a computed fact with `intentionality: unknown`. Claiming it
*means* something is a separate, human-authored interpretation with its own status.

## Division of labor

| Deterministic code establishes | The LLM may only interpret |
|---|---|
| Date intervals, numeric transforms, string equality | Suggest queries, summarize evidence, propose entity matches |
| Source provenance, citations (rendered from evidence IDs) | Draft candidate rules (then sandboxed + reviewed) |
| Promotion of findings | Propose alternative explanations, draft narratives |

LLM citations are never free-form strings. The model emits `{claim_id, evidence_ids}`; the report
renderer turns IDs into citations. This removes an entire class of fabricated-citation failures.
