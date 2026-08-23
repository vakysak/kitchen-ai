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
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

DATA_ROOT = Path(os.getenv("KITCHEN_AI_DATA", "/data"))
UPLOADS = DATA_ROOT / "uploads"
EXPORTS = DATA_ROOT / "exports"
SURVEYS = DATA_ROOT / "surveys"
LAYOUTS = DATA_ROOT / "layouts"
REFERENCES = DATA_ROOT / "references"
WEB_ROOT = Path(os.getenv("KITCHEN_AI_WEB", "/app/web"))
SAMPLE_SURVEY = (
    Path(__file__).resolve().parent.parent
    / "packages"
    / "survey-contract"
    / "examples"
    / "sample-room-survey.json"
)
# V Docker image je main.py v /app/main.py → packages vedle
if not SAMPLE_SURVEY.is_file():
    SAMPLE_SURVEY = Path("/app/packages/survey-contract/examples/sample-room-survey.json")

for d in (UPLOADS, EXPORTS, SURVEYS, LAYOUTS, REFERENCES):
    d.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="kitchen-ai",
    version="0.3.0",
    description="Návrhář kuchyní — layout + validace + katalog",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if WEB_ROOT.is_dir():
    app.mount("/static", StaticFiles(directory=WEB_ROOT), name="static")


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
def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        service="kitchen-ai-api",
        data_root=str(DATA_ROOT),
        ssd_paths={
            "uploads": str(UPLOADS),
            "exports": str(EXPORTS),
            "surveys": str(SURVEYS),
            "layouts": str(LAYOUTS),
            "references": str(REFERENCES),
        },
        timestamp=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/")
def app_home() -> FileResponse:
    index = WEB_ROOT / "index.html"
    if not index.is_file():
        raise HTTPException(503, "Web UI není v kontejneru — zkontroluj image build.")
    return FileResponse(index)


@app.get("/api/v1/modules")
def list_modules() -> dict[str, Any]:
    """Přehled modulů — SmartMeasure (M0) odložen do zařízení."""
    return {
        "deferred": ["M0-SmartMeasure"],
        "active": [
            "M1-project-hub",
            "M2-catalog-cabinets",
            "M2-catalog-products",
            "M6-styles",
            "M7-references",
            "M8-layout",
            "M9-validator",
            "M13-api",
            "M14-web",
            "M15-sync-bridge",
        ],
        "planned": [
            "M3-appliances",
            "M4-fittings",
            "M5-lighting",
            "M10-visualizer",
            "M11-pricing",
            "M12-pdf",
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


def _load_survey(survey_id: str) -> dict[str, Any]:
    path = SURVEYS / f"{survey_id}.json"
    if not path.is_file():
        raise HTTPException(404, f"Survey {survey_id!r} nenalezen")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Poškozený survey JSON: {e}") from e


@app.get("/api/v1/surveys/{survey_id}")
def get_survey(survey_id: str) -> dict[str, Any]:
    meta_path = SURVEYS / f"{survey_id}.meta.json"
    meta = {}
    if meta_path.is_file():
        try:
            meta = json.loads(meta_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            meta = {}
    return {"meta": meta, "survey": _load_survey(survey_id)}


def _delete_survey_files(survey_id: str) -> bool:
    removed = False
    for suffix in (".json", ".meta.json"):
        path = SURVEYS / f"{survey_id}{suffix}"
        if path.is_file():
            path.unlink()
            removed = True
    return removed


@app.delete("/api/v1/surveys/{survey_id}")
def delete_survey(survey_id: str) -> dict[str, Any]:
    if not _delete_survey_files(survey_id):
        raise HTTPException(404, f"Survey {survey_id!r} nenalezen")
    return {"deleted": True, "surveyId": survey_id}


@app.post("/api/v1/surveys/sample", response_model=SurveyImportResponse)
def import_sample_survey() -> SurveyImportResponse:
    """Nahraje ukázkový RoomSurvey (pro vyzkoušení layoutu)."""
    if not SAMPLE_SURVEY.is_file():
        raise HTTPException(503, f"Sample survey chybí: {SAMPLE_SURVEY}")
    raw = SAMPLE_SURVEY.read_bytes()
    payload = json.loads(raw)
    survey_id = str(uuid.uuid4())
    project = payload.get("project") or {}
    out = SURVEYS / f"{survey_id}.json"
    out.write_bytes(raw)
    meta = {
        "surveyId": survey_id,
        "importedAt": datetime.now(timezone.utc).isoformat(),
        "originalFilename": "sample-room-survey.json",
        "project": project,
        "sample": True,
    }
    (SURVEYS / f"{survey_id}.meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return SurveyImportResponse(
        surveyId=survey_id,
        projectHint=project.get("customerName"),
        path=str(out),
        warnings=[],
    )


class LayoutGenerateRequest(BaseModel):
    surveyId: str
    styleId: str | None = None
    plinth_height: int = 100
    countertop_thickness: int = 40
    wall_gap: int = 550
    include_wall_above_base: bool = True
    corpusId: str | None = None
    frontId: str | None = None
    countertopId: str | None = None


@app.post("/api/v1/layouts/generate")
def layouts_generate(body: LayoutGenerateRequest) -> dict[str, Any]:
    """M8: skříňky z katalogu do MountZone + M9 validace."""
    from packages.layout_engine import generate_layout
    from packages.validator import validate_layout

    survey = _load_survey(body.surveyId)
    layout = generate_layout(
        survey,
        survey_id=body.surveyId,
        style_id=body.styleId,
        plinth_height=body.plinth_height,
        countertop_thickness=body.countertop_thickness,
        wall_gap=body.wall_gap,
        include_wall_above_base=body.include_wall_above_base,
        corpus_finish_id=body.corpusId,
        front_finish_id=body.frontId,
        countertop_finish_id=body.countertopId,
    )
    validation = validate_layout(layout, survey)
    layout["validation"] = validation

    out = LAYOUTS / f"{layout['layoutId']}.json"
    out.write_text(json.dumps(layout, ensure_ascii=False, indent=2), encoding="utf-8")
    meta = {
        "layoutId": layout["layoutId"],
        "surveyId": body.surveyId,
        "generatedAt": layout["generatedAt"],
        "customerName": (layout.get("project") or {}).get("customerName"),
        "unit_count": layout["stats"]["unit_count"],
        "ok": validation["ok"],
        "path": str(out),
    }
    (LAYOUTS / f"{layout['layoutId']}.meta.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return layout


class LayoutMaterialsRequest(BaseModel):
    corpusId: str | None = None
    frontId: str | None = None
    countertopId: str | None = None


@app.patch("/api/v1/layouts/{layout_id}/materials")
def layouts_set_materials(layout_id: str, body: LayoutMaterialsRequest) -> dict[str, Any]:
    """Změní barvu/vzor korpusu a frontů u uloženého layoutu."""
    path = LAYOUTS / f"{layout_id}.json"
    if not path.is_file():
        raise HTTPException(404, f"Layout {layout_id!r} nenalezen")
    layout = json.loads(path.read_text(encoding="utf-8"))
    mats = layout.get("materials") or {}
    if body.corpusId:
        mats["corpusId"] = body.corpusId
    if body.frontId:
        mats["frontId"] = body.frontId
    if body.countertopId:
        mats["countertopId"] = body.countertopId
    layout["materials"] = mats
    path.write_text(json.dumps(layout, ensure_ascii=False, indent=2), encoding="utf-8")
    return layout


@app.get("/api/v1/layouts")
def list_layouts() -> dict[str, Any]:
    items = []
    for meta_path in sorted(LAYOUTS.glob("*.meta.json"), reverse=True):
        try:
            items.append(json.loads(meta_path.read_text(encoding="utf-8")))
        except json.JSONDecodeError:
            continue
    return {"count": len(items), "items": items}


@app.get("/api/v1/layouts/{layout_id}")
def get_layout(layout_id: str) -> dict[str, Any]:
    path = LAYOUTS / f"{layout_id}.json"
    if not path.is_file():
        raise HTTPException(404, f"Layout {layout_id!r} nenalezen")
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Poškozený layout JSON: {e}") from e


def _delete_layout_files(layout_id: str) -> bool:
    removed = False
    for suffix in (".json", ".meta.json"):
        path = LAYOUTS / f"{layout_id}{suffix}"
        if path.is_file():
            path.unlink()
            removed = True
    return removed


@app.delete("/api/v1/layouts/{layout_id}")
def delete_layout(layout_id: str) -> dict[str, Any]:
    if not _delete_layout_files(layout_id):
        raise HTTPException(404, f"Layout {layout_id!r} nenalezen")
    return {"deleted": True, "layoutId": layout_id}


class PurgeHistoryRequest(BaseModel):
    keepLayoutId: str


@app.post("/api/v1/admin/purge-history")
def purge_history(body: PurgeHistoryRequest) -> dict[str, Any]:
    """Smaže všechny layouty/surveys kromě keepLayoutId a jeho survey."""
    keep_path = LAYOUTS / f"{body.keepLayoutId}.json"
    if not keep_path.is_file():
        raise HTTPException(404, f"Layout ke zachování {body.keepLayoutId!r} nenalezen")
    keep = json.loads(keep_path.read_text(encoding="utf-8"))
    keep_survey = keep.get("surveyId")

    deleted_layouts: list[str] = []
    for meta_path in list(LAYOUTS.glob("*.meta.json")):
        lid = meta_path.name.replace(".meta.json", "")
        if lid == body.keepLayoutId:
            continue
        if _delete_layout_files(lid):
            deleted_layouts.append(lid)

    deleted_surveys: list[str] = []
    for meta_path in list(SURVEYS.glob("*.meta.json")):
        sid = meta_path.name.replace(".meta.json", "")
        if keep_survey and sid == keep_survey:
            continue
        if _delete_survey_files(sid):
            deleted_surveys.append(sid)

    return {
        "kept": {"layoutId": body.keepLayoutId, "surveyId": keep_survey},
        "deletedLayouts": deleted_layouts,
        "deletedSurveys": deleted_surveys,
        "layoutsRemaining": len(list(LAYOUTS.glob("*.meta.json"))),
        "surveysRemaining": len(list(SURVEYS.glob("*.meta.json"))),
    }


@app.post("/api/v1/layouts/{layout_id}/validate")
def layouts_revalidate(layout_id: str) -> dict[str, Any]:
    layout = get_layout(layout_id)
    survey = None
    sid = layout.get("surveyId")
    if sid:
        try:
            survey = _load_survey(sid)
        except HTTPException:
            survey = None
    from packages.validator import validate_layout

    validation = validate_layout(layout, survey)
    layout["validation"] = validation
    (LAYOUTS / f"{layout_id}.json").write_text(
        json.dumps(layout, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    return validation


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


@app.get("/api/v1/catalog/cabinets/rules")
def cabinet_rules() -> dict[str, Any]:
    """Závazná pravidla šířek, dvířek a šuplíků."""
    from packages.catalog.cabinets.cabinet_system import (
        CABINET_SYSTEM,
        standard_drawer_stack,
    )

    base = CABINET_SYSTEM["base_cabinet"]
    return {
        "width_step_mm": base["width_step_mm"],
        "modules_mm": base["modules_mm"],
        "doors": base["doors"],
        "drawers": {
            **base["drawers"],
            "standard_stack_detail": standard_drawer_stack(),
        },
        "corpus_height": base["corpus_height"],
    }


class CabinetWidthRequest(BaseModel):
    width_mm: int


@app.post("/api/v1/catalog/cabinets/front-plan")
def cabinet_front_plan(body: CabinetWidthRequest) -> dict[str, Any]:
    """Pro šířku vrátí dvířka (1/2) + standardní šuplíková čela."""
    from packages.catalog.cabinets.cabinet_system import (
        door_plan,
        snap_width_mm,
        standard_drawer_stack,
        validate_width,
    )

    warnings = validate_width(body.width_mm)
    snapped = snap_width_mm(body.width_mm)
    return {
        "input_width_mm": body.width_mm,
        "snapped_width_mm": snapped,
        "doors": door_plan(snapped),
        "drawers": standard_drawer_stack(),
        "warnings": warnings,
    }


@app.get("/api/v1/catalog/products")
def catalog_products(
    zone: str | None = None,
    family: str | None = None,
    source: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Ucelený katalog: KA šablony + Modena + typologie BRW."""
    from packages.catalog.products.loader import list_products

    return list_products(
        zone=zone, family=family, source=source, q=q, limit=limit, offset=offset
    )


@app.get("/api/v1/catalog/library")
def catalog_library(
    zone: str | None = None,
    family: str | None = None,
    q: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> dict[str, Any]:
    """Knihovna skříněk pro 3D návrh (SKU + mesh šablona)."""
    from packages.catalog.library import list_library

    return list_library(zone=zone, family=family, q=q, limit=limit, offset=offset)


@app.get("/api/v1/catalog/materials")
def catalog_materials() -> dict[str, Any]:
    """Barvy a vzory korpusů, frontů a pracovní desky."""
    from packages.catalog.library import list_materials

    return list_materials()


@app.get("/api/v1/catalog/products/index")
def catalog_index() -> dict[str, Any]:
    from packages.catalog.products.loader import load_catalog, load_index

    idx = load_index()
    cat = load_catalog()
    return {
        **idx,
        "systems": cat.get("systems"),
        "brw_module_types": cat.get("brw_module_types"),
        "title": cat.get("title"),
        "description": cat.get("description"),
    }


@app.get("/api/v1/catalog/products/{product_id}")
def catalog_product(product_id: str) -> dict[str, Any]:
    from packages.catalog.products.loader import get_product

    item = get_product(product_id)
    if not item:
        raise HTTPException(404, f"Produkt {product_id!r} nenalezen")
    return item


@app.get("/api/v1/styles")
def styles_list() -> dict[str, Any]:
    """M6 — styly inspirace (Oresi / Hanák / Extom / BRW / Pegas). Korpus vždy 730."""
    from packages.styles.loader import list_styles

    return list_styles()


@app.get("/api/v1/styles/references")
def styles_references() -> dict[str, Any]:
    """Design & vzhled referenčních značek (ne výrobní rozměry)."""
    from packages.styles.loader import load_design_references

    return load_design_references()


@app.get("/api/v1/styles/{style_id}")
def styles_one(style_id: str) -> dict[str, Any]:
    from packages.styles.loader import get_style

    item = get_style(style_id)
    if not item:
        raise HTTPException(404, f"Styl {style_id!r} nenalezen")
    return item


@app.get("/api/v1/references/examples")
def reference_examples(brand: str | None = None) -> dict[str, Any]:
    """Příkladové sestavy (Pegas) — šířky modulů; výšky mapovat na 730."""
    from packages.styles.loader import list_examples

    return list_examples(brand=brand)


@app.get("/api/v1/references/examples/{example_id}")
def reference_example(example_id: str) -> dict[str, Any]:
    from packages.styles.loader import get_example

    item = get_example(example_id)
    if not item:
        raise HTTPException(404, f"Příklad {example_id!r} nenalezen")
    return item
