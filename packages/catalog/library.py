"""Knihovna skříněk + materiály pro 3D návrh (z unified_catalog)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

from packages.catalog.cabinets.cabinet_system import (
    STANDARD_DRAWER_STACK,
    door_plan,
)
from packages.catalog.products.loader import get_product, list_products, load_catalog

MATERIALS_PATH = Path(__file__).resolve().parent / "materials" / "finishes.json"

# Šablona 3D meshe podle family — žádné AI, jen katalogové typy
MESH_BY_FAMILY: dict[str, dict[str, Any]] = {
    "base_door": {
        "template": "base_door",
        "has_plinth": True,
        "has_worktop": True,
        "front": "doors",
    },
    "base_drawers": {
        "template": "base_drawers",
        "has_plinth": True,
        "has_worktop": True,
        "front": "drawers",
    },
    "base_oven": {
        "template": "base_oven",
        "has_plinth": True,
        "has_worktop": True,
        "front": "oven",
    },
    "base_waste": {
        "template": "base_door",
        "has_plinth": True,
        "has_worktop": True,
        "front": "doors",
    },
    "base_corner": {
        "template": "base_corner",
        "has_plinth": True,
        "has_worktop": True,
        "front": "doors",
    },
    "wall_door": {
        "template": "wall_door",
        "has_plinth": False,
        "has_worktop": False,
        "front": "doors",
    },
    "wall_corner": {
        "template": "wall_door",
        "has_plinth": False,
        "has_worktop": False,
        "front": "doors",
    },
    "wall_glass": {
        "template": "wall_glass",
        "has_plinth": False,
        "has_worktop": False,
        "front": "glass",
    },
    "tall_pantry": {
        "template": "tall_door",
        "has_plinth": True,
        "has_worktop": False,
        "front": "doors",
    },
}


def _mesh_for(product: dict[str, Any]) -> dict[str, Any]:
    family = product.get("family") or "other"
    base = dict(MESH_BY_FAMILY.get(family, {"template": "box", "front": "doors"}))
    width = int(product.get("width_mm") or 600)
    doors = product.get("doors")
    if doors is None:
        doors = door_plan(width)["wings"]
    base["doors"] = int(doors)
    if product.get("drawer_fronts_mm"):
        fronts = list(product["drawer_fronts_mm"])
        if sum(fronts) > 730:
            fronts = list(STANDARD_DRAWER_STACK)
        base["drawer_fronts_mm"] = fronts
    elif base.get("front") == "drawers":
        base["drawer_fronts_mm"] = list(STANDARD_DRAWER_STACK)
    base["hand"] = product.get("hand") or "L"
    return base


def enrich_product(product: dict[str, Any]) -> dict[str, Any]:
    """Přidá mesh šablonu — skříňka zůstává záznamem z katalogu."""
    out = dict(product)
    out["mesh"] = _mesh_for(product)
    out["library"] = True
    return out


@lru_cache(maxsize=1)
def load_materials() -> dict[str, Any]:
    return json.loads(MATERIALS_PATH.read_text(encoding="utf-8"))


def list_materials() -> dict[str, Any]:
    doc = load_materials()
    return {
        "schemaVersion": doc.get("schemaVersion"),
        "defaults": doc.get("defaults"),
        "corpus": doc.get("corpus", []),
        "front": doc.get("front", []),
        "countertop": doc.get("countertop", []),
    }


def get_finish(slot: str, finish_id: str) -> dict[str, Any] | None:
    doc = load_materials()
    for item in doc.get(slot) or []:
        if item.get("id") == finish_id:
            return item
    return None


def list_library(
    *,
    zone: str | None = None,
    family: str | None = None,
    source: str = "kitchen_ai",
    q: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> dict[str, Any]:
    """Knihovna skříněk pro návrh — primárně výrobní šablony KA."""
    raw = list_products(zone=zone, family=family, source=source, q=q, limit=limit, offset=offset)
    items = [enrich_product(p) for p in raw["items"]]
    cat = load_catalog()
    return {
        **raw,
        "items": items,
        "title": "Knihovna skříněk",
        "systems": cat.get("systems"),
        "note": "Každá skříňka = SKU z katalogu. 3D mesh podle family (ne AI).",
    }


def resolve_catalog_unit(
    *,
    sku: str | None = None,
    product_id: str | None = None,
    width_mm: int | None = None,
    family: str | None = None,
    zone: str = "base",
    kind: str | None = None,
) -> dict[str, Any] | None:
    """Najde produkt v katalogu. Preferuje přesné SKU / id."""
    if sku or product_id:
        p = get_product(sku or product_id or "")
        if p:
            return enrich_product(p)

    # Sestavení KA SKU z šířky + kind
    if width_mm and zone == "base":
        if kind == "drawers" or family == "base_drawers":
            p = get_product(f"KA-BZ-{width_mm}")
            if p:
                return enrich_product(p)
        p = get_product(f"KA-BD-{width_mm}")
        if p:
            return enrich_product(p)
    if width_mm and zone == "wall":
        p = get_product(f"KA-WD-{width_mm}-720")
        if p:
            return enrich_product(p)
    if width_mm and zone == "tall":
        for w in (width_mm, 600, 500, 450):
            p = get_product(f"KA-T-{w}")
            if p:
                return enrich_product(p)
    return None
