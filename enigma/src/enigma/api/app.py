"""ENIGMA API skeleton.

The Canon endpoints are fully functional against the deterministic engine. Every
other endpoint in the blueprint is declared here as an honest `501 Not Implemented`
stub so the contract exists and future work drops into a known shape — rather than
faking behavior that isn't built.

Run:  uvicorn enigma.api.app:app --reload   (requires the `api` extra)
"""

from __future__ import annotations

from typing import Any, Optional

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

from enigma import __version__
from enigma.adapters import ResolutionQuery, WikidataAdapter
from enigma.canon import ENGINE_VERSION, get_rule, run_rule
from enigma.canon.registry import list_rules

app = FastAPI(
    title="ENIGMA",
    version=__version__,
    description="Provenance-first research engine. Canon endpoints are live; "
    "identity/sources/discovery endpoints are stubs pending later phases.",
)


# --------------------------------------------------------------------------
# Health
# --------------------------------------------------------------------------
@app.get("/healthz")
def healthz() -> dict:
    return {"status": "ok", "version": __version__, "engine": ENGINE_VERSION}


# --------------------------------------------------------------------------
# Canon — LIVE
# --------------------------------------------------------------------------
@app.get("/v1/rules")
def get_rules() -> dict:
    return {
        "canon_engine": ENGINE_VERSION,
        "rules": [
            {
                "id": r.id,
                "version": r.version,
                "status": r.status,
                "title": r.title,
                "input_types": list(r.input_types),
            }
            for r in list_rules()
        ],
    }


@app.get("/v1/rules/{rule_id}")
def get_rule_def(rule_id: str, version: Optional[str] = None) -> dict:
    try:
        return get_rule(rule_id, version).spec
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/v1/rules/{rule_id}/test")
def test_rule(rule_id: str, version: Optional[str] = None) -> dict:
    """Replay every fixture embedded in the rule and report pass/fail."""
    try:
        rule = get_rule(rule_id, version)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc

    cases = []
    for case in rule.tests:
        record = run_rule(rule, case["input"])
        ok = record["result"] == case["result"]
        cases.append(
            {
                "input": case["input"],
                "expected": case["result"],
                "actual": record["result"],
                "passed": ok,
            }
        )
    return {
        "rule_id": rule.id,
        "version": rule.version,
        "passed": all(c["passed"] for c in cases),
        "cases": cases,
    }


class TransformRequest(BaseModel):
    rule_id: str
    input: Any
    version: Optional[str] = None


@app.post("/v1/transforms/run")
def transforms_run(req: TransformRequest) -> dict:
    try:
        rule = get_rule(req.rule_id, req.version)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc
    try:
        return run_rule(rule, req.input)
    except (TypeError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


# --------------------------------------------------------------------------
# Not yet implemented — contract declared, behavior pending
# --------------------------------------------------------------------------
_PENDING = {
    "POST /v1/research-runs": "research-run ledger — phase: Research MVP",
    "GET /v1/entities/{id}/graph": "relationship graph — phase: Research MVP",
    "POST /v1/discovery": "candidate-finding engine — phase: Discovery",
    "POST /v1/findings/{id}/review": "verification workflow — phase: Verification",
    "POST /v1/music/resolve": "MusicBrainz adapter — phase: Music intelligence",
    "POST /v1/reports": "publication studio — phase: Publication",
}


def _not_implemented(key: str):
    raise HTTPException(status_code=501, detail={"not_implemented": key, "plan": _PENDING[key]})


class ResolveRequest(BaseModel):
    name: str
    entity_type: Optional[str] = None
    birth_year: Optional[int] = None
    death_year: Optional[int] = None
    external_ids: dict[str, str] = {}
    limit: int = 7


@app.post("/v1/entities/resolve")
def entities_resolve(req: ResolveRequest) -> dict:
    """Resolve a query to ranked Wikidata candidates (LIVE — calls Wikidata).

    Returns the full per-dimension signal breakdown for each candidate; the
    composite confidence is only a ranking key, never a verdict.
    """
    adapter = WikidataAdapter()
    query = ResolutionQuery(
        name=req.name,
        entity_type=req.entity_type,
        birth_year=req.birth_year,
        death_year=req.death_year,
        external_ids=req.external_ids,
    )
    try:
        results = adapter.resolve(query, limit=req.limit)
    except Exception as exc:  # noqa: BLE001 — surface upstream failure as 502
        raise HTTPException(status_code=502, detail=f"Wikidata unavailable: {exc}") from exc

    return {
        "authority": adapter.authority,
        "rights": adapter.get_rights().__dict__,
        "candidates": [
            {
                "external_id": r.candidate.external_id,
                "label": r.candidate.label,
                "type": r.candidate.type,
                "description": r.candidate.description,
                "external_ids": r.candidate.external_ids,
                "birth_year": r.candidate.birth_year,
                "death_year": r.candidate.death_year,
                "confidence": r.confidence,
                "signals": r.signals,
                "authoritative_id_match": r.authoritative_id_match,
            }
            for r in results
        ],
    }


@app.post("/v1/research-runs")
def research_runs() -> dict:
    _not_implemented("POST /v1/research-runs")


@app.post("/v1/discovery")
def discovery() -> dict:
    _not_implemented("POST /v1/discovery")


@app.post("/v1/music/resolve")
def music_resolve() -> dict:
    _not_implemented("POST /v1/music/resolve")
