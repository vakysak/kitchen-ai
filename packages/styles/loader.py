"""M6 styles + design references + Pegas example kitchens."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

STYLES_DIR = Path(__file__).resolve().parent
REF_DIR = Path(__file__).resolve().parents[1] / "references"


@lru_cache(maxsize=1)
def load_styles() -> dict[str, Any]:
    return json.loads((STYLES_DIR / "styles_seed.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_design_references() -> dict[str, Any]:
    return json.loads((STYLES_DIR / "design_references.json").read_text(encoding="utf-8"))


@lru_cache(maxsize=1)
def load_example_kitchens() -> dict[str, Any]:
    path = REF_DIR / "example_kitchens.json"
    return json.loads(path.read_text(encoding="utf-8"))


def list_styles() -> dict[str, Any]:
    doc = load_styles()
    return {
        "count": len(doc.get("styles", [])),
        "corpus_base_mm": doc.get("corpus_base_mm", 730),
        "items": doc.get("styles", []),
    }


def get_style(style_id: str) -> dict[str, Any] | None:
    for s in load_styles().get("styles", []):
        if s.get("id") == style_id:
            return s
    return None


def list_examples(brand: str | None = None) -> dict[str, Any]:
    doc = load_example_kitchens()
    items = doc.get("examples", [])
    if brand:
        items = [e for e in items if (e.get("brand") or "").casefold() == brand.casefold()]
    return {
        "count": len(items),
        "manufacturing_override": doc.get("manufacturing_override"),
        "items": [
            {
                "id": e["id"],
                "name": e["name"],
                "brand": e["brand"],
                "palette": e.get("palette"),
                "finish": e.get("finish"),
                "url": e.get("url"),
                "module_count": e.get("module_count"),
                "module_widths_mm": e.get("module_widths_mm"),
            }
            for e in items
        ],
    }


def get_example(example_id: str) -> dict[str, Any] | None:
    for e in load_example_kitchens().get("examples", []):
        if e.get("id") == example_id:
            return e
    return None
