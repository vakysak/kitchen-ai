"""Load unified product catalog (Modena + kitchen-ai templates + BRW types)."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any

CATALOG_DIR = Path(__file__).resolve().parent
CATALOG_PATH = CATALOG_DIR / "unified_catalog.json"
INDEX_PATH = CATALOG_DIR / "catalog_index.json"


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, Any]:
    if not CATALOG_PATH.is_file():
        raise FileNotFoundError(f"Missing catalog: {CATALOG_PATH}")
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def load_index() -> dict[str, Any]:
    if INDEX_PATH.is_file():
        return json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    cat = load_catalog()
    return {"schemaVersion": cat["schemaVersion"], "stats": cat["stats"], "families": cat["families"]}


def list_products(
    *,
    zone: str | None = None,
    family: str | None = None,
    source: str | None = None,
    q: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> dict[str, Any]:
    products = load_catalog()["products"]
    if zone:
        products = [p for p in products if p.get("zone") == zone]
    if family:
        products = [p for p in products if p.get("family") == family]
    if source:
        products = [p for p in products if p.get("source") == source]
    if q:
        needle = q.casefold()
        products = [
            p
            for p in products
            if needle in (p.get("name") or "").casefold()
            or needle in (p.get("sku") or "").casefold()
            or needle in (p.get("id") or "").casefold()
        ]
    total = len(products)
    page = products[offset : offset + max(1, min(limit, 500))]
    return {"total": total, "offset": offset, "limit": limit, "items": page}


def get_product(product_id: str) -> dict[str, Any] | None:
    for p in load_catalog()["products"]:
        if p.get("id") == product_id or p.get("sku") == product_id:
            return p
    return None
