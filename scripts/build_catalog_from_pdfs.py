#!/usr/bin/env python3
"""Build unified_catalog.json from extracted Modena/BRW PDF text."""
from __future__ import annotations

import json
import re
import sys
from collections import Counter, OrderedDict
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

SRC = ROOT / "data" / "catalog-source"
OUT = ROOT / "packages" / "catalog" / "products"
OUT.mkdir(parents=True, exist_ok=True)

SKU_RE = re.compile(
    r"\b((?:MOD|MOS|LAM)\s+[A-Z0-9][A-Z0-9 /.\-]{0,40}?)\s*"
    r"(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)\s*[x×]\s*(\d+[.,]?\d*)\b",
    re.I,
)
FRONT_RE = re.compile(
    r"\b(MOD\s+DV\s+MYC\s+S)\s+(\d+[.,]\d+)\s*[x×]\s*(\d+[.,]\d+)\b",
    re.I,
)


def to_mm(a, b, c):
    vals = [float(str(x).replace(",", ".")) for x in (a, b, c)]
    if all(v < 250 for v in vals):
        vals = [v * 10 for v in vals]
    return [int(round(v)) for v in vals]


def infer_family(sku: str, w, h, d, name: str) -> str:
    s = sku.upper()
    n = (name or "").lower()
    if "ZAS" in s:
        return "base_drawers"
    if "DV MYC" in s:
        return "dishwasher_front"
    if "OD" in s and ("KO" in s or "OD2" in s or "OD3" in s or "V2K" in s):
        return "base_waste"
    if "VDP" in s or "MR" in s:
        return "base_wire"
    if "SPOT" in s and h < 1500:
        return "base_oven"
    if "VYS" in s or h >= 2000 or "NIZ SPOT" in s:
        if "SPOT" in s:
            return "tall_oven"
        if "VDP" in s:
            return "tall_wire"
        return "tall_pantry"
    if "ROH" in s or "ROVS" in s or "ROHS" in s or "HVROH" in s:
        if h >= 700 and h <= 900 and d >= 500:
            return "base_corner"
        return "wall_corner"
    if "DIG" in s:
        return "wall_hood"
    if "MIKR" in s:
        return "wall_microwave"
    if "SKL" in s or "prosklen" in n:
        return "wall_glass"
    if "HV " in s or "horizont" in n or "HPLN" in s:
        return "wall_horizontal"
    if "POL" in s or "ROPO" in s:
        return "open_shelf"
    if "HORPL" in s or "HOR" in s or (h in (720, 400, 580) and d <= 350):
        return "wall_door"
    if "SPO" in s or (h in (820,) and d in (500, 570)):
        return "base_door"
    return "other"


def infer_zone(family: str) -> str:
    if family.startswith("wall") or family == "open_shelf":
        return "wall"
    if family.startswith("tall"):
        return "tall"
    if family in ("dishwasher_front",):
        return "front"
    if family.startswith("base"):
        return "base"
    return "other"


def parse_modena(text: str) -> list[dict]:
    products: OrderedDict = OrderedDict()
    pending_name = None
    page = 1
    for line in text.splitlines():
        if line.startswith("===== PAGE"):
            m = re.search(r"PAGE (\d+)", line)
            if m:
                page = int(m.group(1))
            continue
        stripped = line.strip()
        if (
            re.match(
                r"^(Skříňka|Horní|Spodní|Rohová|Police|Dvířka|Ostrůvek|Vysoká|Spodní skř)",
                stripped,
            )
            and "www." not in stripped
            and len(stripped) < 90
        ):
            pending_name = stripped
            continue

        for m in FRONT_RE.finditer(line):
            sku = re.sub(r"\s+", " ", m.group(1)).upper()
            h = int(round(float(m.group(2).replace(",", ".")) * 10))
            w = int(round(float(m.group(3).replace(",", ".")) * 10))
            key = f"{sku}|{w}x{h}"
            if key not in products:
                products[key] = {
                    "id": f"modena-{len(products)+1:03d}",
                    "sku": sku,
                    "name": pending_name or "Dvířka na myčku",
                    "source": "modena_2023",
                    "source_page": page,
                    "family": "dishwasher_front",
                    "zone": "front",
                    "width_mm": w,
                    "height_mm": h,
                    "depth_mm": None,
                    "hand": None,
                    "notes": "Rozměr dvířek + sokl dle katalogu Modena",
                }

        for m in SKU_RE.finditer(line):
            sku = re.sub(r"\s+", " ", m.group(1)).strip().upper()
            if sku.startswith("MOS "):
                sku = "MOD " + sku[4:]
            w, h, d = to_mm(m.group(2), m.group(3), m.group(4))
            name = pending_name or sku
            family = infer_family(sku, w, h, d, name)
            hand = None
            if re.search(r"\bL\b", sku) or "lev" in name.lower():
                hand = "L"
            if re.search(r"\bP\b", sku) or "prav" in name.lower():
                hand = "P"
            key = f"{sku}|{w}x{h}x{d}"
            if key in products:
                continue
            products[key] = {
                "id": f"modena-{len(products)+1:03d}",
                "sku": sku,
                "name": name,
                "source": "modena_2023",
                "source_page": page,
                "family": family,
                "zone": infer_zone(family),
                "width_mm": w,
                "height_mm": h,
                "depth_mm": d,
                "hand": hand,
                "notes": None,
            }
    return list(products.values())


def make_templates() -> list[dict]:
    from packages.catalog.cabinets.cabinet_system import (
        CABINET_SYSTEM,
        door_wings_for_width,
    )

    base = CABINET_SYSTEM["base_cabinet"]
    wall = CABINET_SYSTEM["wall_cabinet"]
    items: list[dict] = []
    for w in base["modules_mm"]:
        wings = 1 if door_wings_for_width(w) == "single" else 2
        items.append(
            {
                "id": f"ka-base-door-{w}",
                "sku": f"KA-BD-{w}",
                "name": f"Spodní skříňka dvířková {w} mm",
                "source": "kitchen_ai",
                "family": "base_door",
                "zone": "base",
                "width_mm": w,
                "height_mm": 730,
                "depth_mm": 560,
                "doors": wings,
                "hand": "L" if wings == 1 else None,
                "notes": "Korpus 730; PD = 730+sokl+deska.",
            }
        )
        items.append(
            {
                "id": f"ka-base-drawer-{w}",
                "sku": f"KA-BZ-{w}",
                "name": f"Spodní skříňka šuplíková {w} mm",
                "source": "kitchen_ai",
                "family": "base_drawers",
                "zone": "base",
                "width_mm": w,
                "height_mm": 730,
                "depth_mm": 560,
                "drawer_fronts_mm": [142, 142, 142, 286],
                "notes": "Naše čela 3×142 + 286 (Modena ~140/284 — nepoužíváme).",
            }
        )
    for w in wall["modules_mm"]:
        wings = 1 if door_wings_for_width(w) == "single" else 2
        items.append(
            {
                "id": f"ka-wall-door-{w}-720",
                "sku": f"KA-WD-{w}-720",
                "name": f"Horní skříňka {w}×720 mm",
                "source": "kitchen_ai",
                "family": "wall_door",
                "zone": "wall",
                "width_mm": w,
                "height_mm": 720,
                "depth_mm": 320,
                "doors": wings,
                "hand": "L" if wings == 1 else None,
            }
        )
    for w in (450, 500, 600):
        items.append(
            {
                "id": f"ka-tall-{w}",
                "sku": f"KA-T-{w}",
                "name": f"Vysoká skříňka {w} mm",
                "source": "kitchen_ai",
                "family": "tall_pantry",
                "zone": "tall",
                "width_mm": w,
                "height_mm": 2100,
                "depth_mm": 560,
                "doors": 1 if w <= 600 else 2,
            }
        )
    items.append(
        {
            "id": "ka-base-oven-600",
            "sku": "KA-BO-600",
            "name": "Spodní skříňka na troubu 600 mm",
            "source": "kitchen_ai",
            "family": "base_oven",
            "zone": "base",
            "width_mm": 600,
            "height_mm": 730,
            "depth_mm": 560,
        }
    )
    items.append(
        {
            "id": "ka-base-waste-600",
            "sku": "KA-BW-600",
            "name": "Spodní skříňka s výsuvem na odpad 600 mm",
            "source": "kitchen_ai",
            "family": "base_waste",
            "zone": "base",
            "width_mm": 600,
            "height_mm": 730,
            "depth_mm": 560,
        }
    )
    for side in ("L", "P"):
        items.append(
            {
                "id": f"ka-base-corner-860-{side}",
                "sku": f"KA-BC-860-{side}",
                "name": f"Spodní rohová skříňka 860 {side}",
                "source": "kitchen_ai",
                "family": "base_corner",
                "zone": "base",
                "width_mm": 860,
                "height_mm": 730,
                "depth_mm": 860,
                "hand": side,
            }
        )
        items.append(
            {
                "id": f"ka-wall-corner-560-{side}",
                "sku": f"KA-WC-560-{side}",
                "name": f"Horní rohová skříňka 560 {side}",
                "source": "kitchen_ai",
                "family": "wall_corner",
                "zone": "wall",
                "width_mm": 560,
                "height_mm": 720,
                "depth_mm": 560,
                "hand": side,
            }
        )
    return items


BRW_TYPES = [
    {"code": "D", "name": "Base cabinet with door", "zone": "base", "family": "base_door"},
    {"code": "D3S", "name": "Base 3 drawers", "zone": "base", "family": "base_drawers"},
    {"code": "D1S", "name": "Base 1 drawer + door", "zone": "base", "family": "base_drawer_door"},
    {"code": "DK", "name": "Base sink cabinet", "zone": "base", "family": "base_sink"},
    {"code": "DKS", "name": "Base sink with drawers", "zone": "base", "family": "base_sink"},
    {"code": "DNW", "name": "Base corner / blind corner", "zone": "base", "family": "base_corner"},
    {"code": "DP", "name": "Base waste pull-out", "zone": "base", "family": "base_waste"},
    {"code": "DM", "name": "Dishwasher panel module", "zone": "front", "family": "dishwasher_front"},
    {"code": "DL", "name": "Tall fridge / pantry", "zone": "tall", "family": "tall_pantry"},
    {"code": "DPS", "name": "Tall oven column", "zone": "tall", "family": "tall_oven"},
    {"code": "D4STW", "name": "Tall multi-drawer / oven", "zone": "tall", "family": "tall_oven"},
    {"code": "G", "name": "Wall cabinet door", "zone": "wall", "family": "wall_door"},
    {"code": "GO", "name": "Wall open / short", "zone": "wall", "family": "wall_hood"},
    {"code": "GOO", "name": "Wall open shelf unit", "zone": "wall", "family": "open_shelf"},
    {"code": "GC", "name": "Wall glass / display", "zone": "wall", "family": "wall_glass"},
    {"code": "NO", "name": "Wall niche / open box", "zone": "wall", "family": "open_shelf"},
    {"code": "PA-D", "name": "End panel base", "zone": "panel", "family": "end_panel"},
    {"code": "PA-G", "name": "End panel wall", "zone": "panel", "family": "end_panel"},
    {"code": "DC", "name": "Filler / end column", "zone": "base", "family": "filler"},
]


def main() -> None:
    modena_txt = SRC / "modena_2023.txt"
    if not modena_txt.is_file():
        raise SystemExit(f"Missing {modena_txt} — extract PDF text first.")

    modena_list = parse_modena(modena_txt.read_text(encoding="utf-8"))
    templates = make_templates()
    families = sorted({p["family"] for p in modena_list + templates})

    catalog = {
        "schemaVersion": "1.0.0",
        "generated": str(date.today()),
        "title": "Ucelený katalog produktů kitchen-ai",
        "description": (
            "Sjednocený katalog: (1) naše výrobní šablony KA-* se závaznými pravidly, "
            "(2) referenční produkty Modena 2023 z PDF, (3) typologie BRW pro pojmenování modulů. "
            "Čela šuplíků vždy 142/286 mm."
        ),
        "systems": {
            "modena": {
                "name": "MODENA",
                "vendor": "Nábytek Morava",
                "year": 2023,
                "typical_base_outer_height_mm": 820,
                "typical_wall_height_mm": 720,
                "typical_base_depth_mm": 500,
                "typical_wall_depth_mm": 300,
                "drawer_fronts_in_catalog_mm": [140, 284],
                "note": "Výšky čel šuplíků z katalogu (~140/284) NEPOUŽÍVÁME — naše standard 142/286.",
                "source_pdf": "data/catalog-source/modena_2023.pdf",
            },
            "brw": {
                "name": "Black Red White — Family / Semi / Junona Line",
                "year": "2022–2025",
                "role": "typologie modulů (kódy), ne výrobní standard",
                "source_pdf": [
                    "data/catalog-source/brw_2022.pdf",
                    "data/catalog-source/brw_2025.pdf",
                ],
            },
            "kitchen_ai": {
                "name": "kitchen-ai výrobní standard",
                "corpus_base_mm": 730,
                "width_step_mm": 50,
                "drawer_fronts_mm": [142, 286],
                "drawer_stack": [142, 142, 142, 286],
                "doors": "≤600 → 1 křídlo; >600 → 2 křídla",
            },
        },
        "families": families,
        "stats": {
            "kitchen_ai_templates": len(templates),
            "modena_products": len(modena_list),
            "brw_type_codes": len(BRW_TYPES),
            "total_products": len(templates) + len(modena_list),
        },
        "brw_module_types": BRW_TYPES,
        "products": templates + modena_list,
    }

    (OUT / "unified_catalog.json").write_text(
        json.dumps(catalog, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    index = {
        "schemaVersion": catalog["schemaVersion"],
        "stats": catalog["stats"],
        "families": [
            {
                "id": f,
                "count": sum(1 for p in catalog["products"] if p["family"] == f),
                "zones": sorted(
                    {p["zone"] for p in catalog["products"] if p["family"] == f}
                ),
            }
            for f in families
        ],
        "zones": dict(Counter(p["zone"] for p in catalog["products"])),
    }
    (OUT / "catalog_index.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(json.dumps(catalog["stats"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
