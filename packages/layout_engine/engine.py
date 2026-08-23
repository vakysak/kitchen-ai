"""
M8 — Layout Engine: rozmístění skříněk do MountZone ze RoomSurvey.

Použije min(widthBottom/Mid/Top) jako použitelnou šířku, při converging
rezervuje filler / atyp, skládá moduly po 50 mm (preference 600 → 300).
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Literal

from packages.catalog.cabinets.cabinet_system import (
    CABINET_SYSTEM,
    door_plan,
    snap_width_mm,
    standard_drawer_stack,
    worktop_height_mm,
)
from packages.catalog.library import list_materials, resolve_catalog_unit

PREFERRED_WIDTHS = [600, 500, 450, 400, 350, 300]  # primární sestava
# Širší jen když zbývá velký zbytek, který nejde složit z preferovaných
WIDE_WIDTHS = [800, 900, 700, 750, 650, 550]
Band = Literal["base", "wall", "tall"]


def _zone_band(zone_type: str | None) -> Band:
    t = (zone_type or "").casefold()
    if any(x in t for x in ("wall", "upper", "horn")):
        return "wall"
    if any(x in t for x in ("tall", "column", "sloup", "pantry")):
        return "tall"
    return "base"


def _usable_width(zone: dict[str, Any]) -> tuple[int, dict[str, Any]]:
    """Min šířka zóny + metadata pro filler / atyp."""
    widths = [
        w
        for w in (zone.get("widthBottom"), zone.get("widthMid"), zone.get("widthTop"))
        if isinstance(w, (int, float)) and w > 0
    ]
    if not widths:
        return 0, {"reason": "missing_widths"}

    usable = int(min(widths))
    max_w = int(max(widths))
    delta = max_w - usable
    converge = (zone.get("wallsConvergeDivergeType") or "unknown").casefold()

    filler_left = 0
    filler_right = 0
    notes: list[str] = []

    if converge == "converging" or zone.get("requiresFillerPanel") or zone.get("requiresAtypicalSide"):
        # Rezerva na seříznutí / filler — min 20 mm na stranu při Δ≥10, jinak 0
        side = max(20, min(50, (delta + 1) // 2)) if delta >= 10 else (20 if converge == "converging" else 0)
        filler_left = side
        filler_right = side
        notes.append(f"Svírání/atyp: rezervováno {side}+{side} mm na fillery (Δ šířky {delta} mm).")
    elif zone.get("requiresCoverStrip"):
        filler_left = 10
        filler_right = 10
        notes.append("Krycí lišta: 10+10 mm.")

    packable = max(0, usable - filler_left - filler_right)
    # zarovnat na 50 mm dolů
    packable = (packable // 50) * 50

    return packable, {
        "usable_raw_mm": usable,
        "width_delta_mm": delta,
        "filler_left_mm": filler_left,
        "filler_right_mm": filler_right,
        "packable_mm": packable,
        "converge": converge,
        "notes": notes,
    }


def _sku_for(band: Band, width: int, kind: str) -> tuple[str, str, str]:
    """Vrátí (sku, product_id, family)."""
    if band == "wall":
        return f"KA-WD-{width}-720", f"ka-wall-door-{width}-720", "wall_door"
    if band == "tall":
        w = width if width in (450, 500, 600) else snap_width_mm(min(max(width, 450), 600))
        if w not in (450, 500, 600):
            w = 600 if width >= 550 else (500 if width >= 475 else 450)
        return f"KA-T-{w}", f"ka-tall-{w}", "tall_pantry"
    if kind == "drawers":
        return f"KA-BZ-{width}", f"ka-base-drawer-{width}", "base_drawers"
    return f"KA-BD-{width}", f"ka-base-door-{width}", "base_door"


def _pack_widths(packable: int) -> list[int]:
    """
    Preferuj 600 mm (1 dvířko). Nejprve co nejvíce 600,
    zbytek dořeš 500…300; širší moduly (>600) jen když zbyde >600 a nelze ho složit.
    """
    if packable < 300:
        return []

    result: list[int] = []
    remaining = packable

    # maximální počet 600 mm
    while remaining >= 600:
        # pokud by po 600 zbyl zbytek 1–299, radši menší modul
        leftover = remaining - 600
        if leftover == 0 or leftover >= 300:
            result.append(600)
            remaining -= 600
            continue
        break

    while remaining >= 300:
        chosen = None
        for w in PREFERRED_WIDTHS:
            if w > remaining:
                continue
            left = remaining - w
            if left == 0 or left >= 300:
                chosen = w
                break
            if left < 50:
                chosen = w
                break
        if chosen is None:
            # zkus wide
            for w in WIDE_WIDTHS:
                if 300 <= w <= remaining:
                    left = remaining - w
                    if left == 0 or left >= 300 or left < 50:
                        chosen = w
                        break
            if chosen is None:
                # největší preferovaná ≤ remaining (i se zbytkem jako gap)
                cands = [w for w in PREFERRED_WIDTHS if w <= remaining]
                if not cands:
                    break
                chosen = cands[0]
        result.append(chosen)
        remaining -= chosen
        if remaining < 50:
            break

    return result

def _module_kinds(band: Band, count: int) -> list[str]:
    """
    Realističtější linka: šuplíky jen 1–2× (příbory/hrnce), zbytek dvířka.
    Horní zóny jsou vždy dvířkové (ne šuplíky nad deskou).
    """
    if band != "base":
        return ["door"] * count
    if count <= 0:
        return []
    kinds = ["door"] * count
    # jedna šuplíková u začátku (ne přes celou linku)
    kinds[0] = "drawers"
    if count >= 5:
        kinds[min(3, count - 1)] = "drawers"
    return kinds


def _build_unit(
    *,
    band: Band,
    width: int,
    offset: int,
    kind: str,
    zone_id: str,
    plinth: int,
    top_th: int,
    wall_gap: int,
) -> dict[str, Any]:
    """Jednotka = SKU z katalogu + pozice. 3D bere mesh z product.mesh."""
    product = resolve_catalog_unit(
        width_mm=width,
        zone=band,
        kind=kind,
        family="base_drawers" if kind == "drawers" else None,
    )
    if not product:
        sku, product_id, family = _sku_for(band, width, kind)
        product = {
            "id": product_id,
            "sku": sku,
            "name": sku,
            "family": family,
            "zone": band,
            "width_mm": width,
            "height_mm": 730 if band == "base" else (720 if band == "wall" else 2100),
            "depth_mm": 560 if band != "wall" else 320,
            "mesh": {"template": "box", "front": "doors", "doors": 1 if width <= 600 else 2},
            "missing_from_catalog": True,
        }

    width = int(product.get("width_mm") or width)
    height = int(product.get("height_mm") or (730 if band == "base" else 720))
    depth = int(product.get("depth_mm") or CABINET_SYSTEM["base_cabinet"]["corpus_depth"])
    mesh = product.get("mesh") or {}
    wings = int(product.get("doors") or mesh.get("doors") or (1 if width <= 600 else 2))
    doors = {
        "width_mm": width,
        "wings": wings,
        "type": "single" if wings == 1 else "double",
        "label": "1 dvířka" if wings == 1 else "2 křídla",
    }

    unit: dict[str, Any] = {
        "id": str(uuid.uuid4()),
        "zoneId": zone_id,
        "band": band,
        "offset_mm": offset,
        "width_mm": width,
        "height_mm": height,
        "depth_mm": depth,
        "sku": product["sku"],
        "productId": product["id"],
        "family": product.get("family"),
        "kind": kind,
        "name": product.get("name"),
        "source": product.get("source", "kitchen_ai"),
        "doors": doors,
        "mesh": mesh,
        "product": {
            "id": product["id"],
            "sku": product["sku"],
            "name": product.get("name"),
            "family": product.get("family"),
            "zone": product.get("zone"),
            "width_mm": width,
            "height_mm": height,
            "depth_mm": depth,
            "doors": wings,
            "drawer_fronts_mm": product.get("drawer_fronts_mm") or mesh.get("drawer_fronts_mm"),
            "hand": product.get("hand"),
            "mesh": mesh,
        },
    }
    if band == "base":
        unit["corpus_height_mm"] = height
        unit["plinth_height_mm"] = plinth
        unit["countertop_thickness_mm"] = top_th
        unit["worktop_height_mm"] = worktop_height_mm(plinth, top_th, height)
        if mesh.get("front") == "drawers" or kind == "drawers":
            fronts = product.get("drawer_fronts_mm") or mesh.get("drawer_fronts_mm")
            unit["drawers"] = (
                {
                    "front_heights_mm": list(fronts),
                    "count": len(fronts),
                    "sum_mm": sum(fronts),
                }
                if fronts
                else standard_drawer_stack()
            )
    elif band == "wall":
        unit["corpus_height_mm"] = height
        wt = worktop_height_mm(plinth, top_th)
        unit["bottom_from_floor_mm"] = wt + wall_gap
        unit["top_from_floor_mm"] = wt + wall_gap + height
    else:
        unit["corpus_height_mm"] = height
        unit["plinth_height_mm"] = plinth
    if product.get("missing_from_catalog"):
        unit["catalogWarning"] = "SKU není v katalogu"
    return unit


def _zones_from_survey(survey: dict[str, Any]) -> list[tuple[dict[str, Any], dict[str, Any]]]:
    """(room, zone) páry. Když chybí mountZones, syntetizuj ze stěn."""
    out: list[tuple[dict[str, Any], dict[str, Any]]] = []
    for room in survey.get("rooms") or []:
        zones = list(room.get("mountZones") or [])
        if not zones:
            for wall in room.get("walls") or []:
                length = wall.get("lengthBottom") or wall.get("lengthMid") or wall.get("lengthTop")
                if not length:
                    continue
                zones.append(
                    {
                        "id": str(uuid.uuid4()),
                        "label": f"Linka {wall.get('label') or '?'}",
                        "zoneType": "lowerCabinets",
                        "widthBottom": length,
                        "widthMid": length,
                        "widthTop": length,
                        "wallsConvergeDivergeType": wall.get("convergeDiverge") or "unknown",
                        "synthetic": True,
                    }
                )
        for z in zones:
            out.append((room, z))
    return out


def generate_layout(
    survey: dict[str, Any],
    *,
    survey_id: str | None = None,
    style_id: str | None = None,
    plinth_height: int = 100,
    countertop_thickness: int = 40,
    wall_gap: int = 550,
    include_wall_above_base: bool = True,
    corpus_finish_id: str | None = None,
    front_finish_id: str | None = None,
    countertop_finish_id: str | None = None,
) -> dict[str, Any]:
    """
    Vygeneruje Layout JSON z RoomSurvey.

    Skříňky = SKU z katalogu (knihovna). Materiály korpus/front/PD jsou volitelné.
    """
    mats = list_materials()
    defaults = mats.get("defaults") or {}
    materials = {
        "corpusId": corpus_finish_id or defaults.get("corpusId") or "corpus-white",
        "frontId": front_finish_id or defaults.get("frontId") or "front-white-matt",
        "countertopId": countertop_finish_id or defaults.get("countertopId") or "top-oak",
    }
    units: list[dict[str, Any]] = []
    zone_summaries: list[dict[str, Any]] = []
    warnings: list[str] = []
    room_ids: list[str] = []

    pairs = _zones_from_survey(survey)
    if not pairs:
        warnings.append("Survey neobsahuje stěny ani MountZone — layout je prázdný.")

    has_explicit_wall = any(
        _zone_band(z.get("zoneType")) == "wall" for _, z in pairs
    )

    for room, zone in pairs:
        rid = room.get("id")
        if rid and rid not in room_ids:
            room_ids.append(rid)

        band = _zone_band(zone.get("zoneType"))
        packable, meta = _usable_width(zone)
        zid = zone.get("id") or str(uuid.uuid4())

        summary: dict[str, Any] = {
            "zoneId": zid,
            "label": zone.get("label"),
            "zoneType": zone.get("zoneType"),
            "band": band,
            "roomId": rid,
            **meta,
            "flags": {
                "requiresScribing": bool(zone.get("requiresScribing")),
                "requiresAtypicalSide": bool(zone.get("requiresAtypicalSide")),
                "requiresLeveling": bool(zone.get("requiresLeveling")),
                "requiresFillerPanel": bool(zone.get("requiresFillerPanel")),
                "requiresCoverStrip": bool(zone.get("requiresCoverStrip")),
                "hasPipes": bool(zone.get("hasPipes")),
                "hasSillCollision": bool(zone.get("hasSillCollision")),
            },
            "installationRiskNote": zone.get("installationRiskNote"),
        }
        warnings.extend(meta.get("notes") or [])

        if packable < 300:
            summary["unit_count"] = 0
            summary["gap_mm"] = packable
            warnings.append(f"Zóna {zone.get('label')}: použitelná šířka {packable} mm — nelze umístit modul.")
            zone_summaries.append(summary)
            continue

        widths = _pack_widths(packable)
        kinds = _module_kinds(band, len(widths))
        offset = meta["filler_left_mm"]
        zone_units: list[dict[str, Any]] = []

        for w, kind in zip(widths, kinds):
            unit = _build_unit(
                band=band,
                width=w,
                offset=offset,
                kind=kind if band == "base" else "door",
                zone_id=zid,
                plinth=plinth_height,
                top_th=countertop_thickness,
                wall_gap=wall_gap,
            )
            unit["roomId"] = rid
            units.append(unit)
            zone_units.append(unit)
            offset += w

        used = sum(widths)
        gap = packable - used
        summary["unit_count"] = len(widths)
        summary["widths_mm"] = widths
        if gap > 0:
            warnings.append(
                f"Zóna {zone.get('label')}: po modulech zbývá {gap} mm v packable — doplnit filler."
            )
        floor_rem = meta["usable_raw_mm"] - meta["filler_left_mm"] - meta["filler_right_mm"] - packable
        if floor_rem > 0:
            warnings.append(
                f"Zóna {zone.get('label')}: {floor_rem} mm mimo krok 50 mm (zarovnání dolů)."
            )
        summary["gap_mm"] = gap + floor_rem
        zone_summaries.append(summary)

        # Automatické horní skříňky nad base (pokud survey nemá wall zóny)
        if (
            include_wall_above_base
            and band == "base"
            and not has_explicit_wall
            and widths
        ):
            wall_zone_id = f"{zid}-wall-auto"
            w_offset = meta["filler_left_mm"]
            for w in widths:
                # horní max 900
                ww = min(w, 900)
                ww = snap_width_mm(ww)
                if ww < 300:
                    continue
                unit = _build_unit(
                    band="wall",
                    width=ww,
                    offset=w_offset,
                    kind="door",
                    zone_id=wall_zone_id,
                    plinth=plinth_height,
                    top_th=countertop_thickness,
                    wall_gap=wall_gap,
                )
                unit["roomId"] = rid
                unit["pairedBaseZoneId"] = zid
                units.append(unit)
                w_offset += w
            zone_summaries.append(
                {
                    "zoneId": wall_zone_id,
                    "label": f"{zone.get('label') or 'Linka'} — horní (auto)",
                    "zoneType": "upperCabinets",
                    "band": "wall",
                    "roomId": rid,
                    "unit_count": len(widths),
                    "widths_mm": [min(w, 900) for w in widths],
                    "auto": True,
                    "pairedBaseZoneId": zid,
                }
            )

    project = survey.get("project") or {}
    layout_id = str(uuid.uuid4())
    return {
        "schemaVersion": "1.0.0",
        "layoutId": layout_id,
        "surveyId": survey_id,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "styleId": style_id,
        "source": "catalog_library",
        "project": {
            "customerName": project.get("customerName"),
            "address": project.get("address"),
            "projectId": project.get("id"),
        },
        "materials": materials,
        "params": {
            "plinth_height": plinth_height,
            "countertop_thickness": countertop_thickness,
            "wall_gap": wall_gap,
            "corpus_base_mm": 730,
            "include_wall_above_base": include_wall_above_base,
        },
        "roomIds": room_ids,
        "zones": zone_summaries,
        "units": units,
        "bom": _bom(units),
        "warnings": warnings,
        "stats": {
            "unit_count": len(units),
            "base_count": sum(1 for u in units if u["band"] == "base"),
            "wall_count": sum(1 for u in units if u["band"] == "wall"),
            "tall_count": sum(1 for u in units if u["band"] == "tall"),
            "total_width_base_mm": sum(u["width_mm"] for u in units if u["band"] == "base"),
        },
    }


def _bom(units: list[dict[str, Any]]) -> list[dict[str, Any]]:
    counts: dict[str, dict[str, Any]] = {}
    for u in units:
        key = u["sku"]
        if key not in counts:
            counts[key] = {
                "sku": u["sku"],
                "productId": u["productId"],
                "name": u.get("name"),
                "family": u["family"],
                "width_mm": u["width_mm"],
                "band": u["band"],
                "qty": 0,
            }
        counts[key]["qty"] += 1
    return sorted(counts.values(), key=lambda x: (x["band"], x["sku"]))
