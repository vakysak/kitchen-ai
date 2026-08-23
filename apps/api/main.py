"""
kitchen-ai API — MVP pro Hetzner / Coolify.
Persistent data → /data (bind na SSD hostu).
SmartMeasure import zatím přes JSON upload (zařízení později).
"""

from __future__ import annotations

import json
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

DATA_ROOT = Path(os.getenv("KITCHEN_AI_DATA", "/data"))
UPLOADS = DATA_ROOT / "uploads"
EXPORTS = DATA_ROOT / "exports"
SURVEYS = DATA_ROOT / "surveys"
REFERENCES = DATA_ROOT / "references"

for d in (UPLOADS, EXPORTS, SURVEYS, REFERENCES):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="kitchen-ai",
    version="0.1.0",
    description="Návrhář kuchyní — serverová část (SmartMeasure = pozdější vstup)",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HealthResponse(BaseModel):
    status: str
    service: str
    data_root: str
    ssd_paths: dict[str, str]
    timestamp: str


class SurveyImportResponse(BaseModel):
    surveyId: str
    projectHint: str | None = None
    path: str
    warnings: list[str] = Field(default_factory=list)


class CabinetWorktopRequest(BaseModel):
    plinth_height: int = 100
    countertop_thickness: int = 40


@app.get("/health", response_model=HealthResponse)
@app.get("/", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="kitchen-ai-api",
        data_root=str(DATA_ROOT),
        ssd_paths={
            "uploads": str(UPLOADS),
            "exports": str(EXPORTS),
            "surveys": str(SURVEYS),
            "references": str(REFERENCES),
        },
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/api/v1/modules")
def list_modules() -> dict[str, Any]:
    """Přehled modulů — SmartMeasure (M0) odložen do zařízení."""
    return {
        "deferred": ["M0-SmartMeasure"],
        "active": [
            "M1-project-hub",
            "M2-catalog-cabinets",
            "M13-api",
            "M15-sync-bridge",
        ],
        "planned": [
            "M3-appliances",
            "M4-fittings",
            "M5-lighting",
            "M6-styles",
            "M7-references",
            "M8-layout",
            "M9-validator",
            "M10-visualizer",
            "M11-pricing",
            "M12-pdf",
            "M14-web",
        ],
    }


@app.post("/api/v1/surveys/import", response_model=SurveyImportResponse)
async def import_survey(file: UploadFile = File(...)) -> SurveyImportResponse:
    """Přijme RoomSurvey JSON (ze SmartMeasure až bude, zatím ruční upload)."""
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(400, "Očekáván .json soubor (RoomSurvey)")

    raw = await file.read()
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as e:
        raise HTTPException(400, f"Neplatný JSON: {e}") from e

    warnings: list[str] = []
    schema = payload.get("schemaVersion")
    if schema != "1.0.0":
        warnings.append(f"Neočekávaná schemaVersion={schema!r}, očekáváno 1.0.0")

    survey_id = str(uuid.uuid4())
    project = payload.get("project") or {}
    hint = project.get("customerName")
    out = SURVEYS / f"{survey_id}.json"
    out.write_bytes(raw)
    meta = {
        "surveyId": survey_id,
        "importedAt": datetime.now(timezone.utc).isoformat(),
        "originalFilename": file.filename,
        "project": project,
    }
    (SURVEYS / f"{survey_id}.meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return SurveyImportResponse(
        surveyId=survey_id,
        projectHint=hint,
        path=str(out),
        warnings=warnings,
    )


@app.get("/api/v1/surveys")
def list_surveys() -> dict[str, Any]:
    items = []
    for meta_path in sorted(SURVEYS.glob("*.meta.json"), reverse=True):
        try:
            items.append(json.loads(meta_path.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            continue
    return {"count": len(items), "items": items}


@app.post("/api/v1/catalog/cabinets/worktop-height")
def worktop_height(body: CabinetWorktopRequest) -> dict[str, int]:
    """M2: výška PD = korpus 730 + sokl + deska."""
    corpus = 730
    height = corpus + body.plinth_height + body.countertop_thickness
    return {
        "corpus_height": corpus,
        "plinth_height": body.plinth_height,
        "countertop_thickness": body.countertop_thickness,
        "worktop_height_mm": height,
    }
