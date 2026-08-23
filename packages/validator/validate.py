"""
M9 Validator — tvrdá pravidla nad Layout + RoomSurvey.
CRITICAL blokuje vizualizaci / PDF (až budou).
"""

from __future__ import annotations

from typing import Any, Literal

Severity = Literal["CRITICAL", "WARNING", "INFO"]


def _issue(
    severity: Severity,
    code: str,
    message: str,
    *,
    zone_id: str | None = None,
    unit_id: str | None = None,
) -> dict[str, Any]:
    return {
        "severity": severity,
        "code": code,
        "message": message,
        "zoneId": zone_id,
        "unitId": unit_id,
    }


def validate_layout(
    layout: dict[str, Any],
    survey: dict[str, Any] | None = None,
) -> dict[str, Any]:
    issues: list[dict[str, Any]] = []
    units = layout.get("units") or []
    zones = {z["zoneId"]: z for z in (layout.get("zones") or []) if z.get("zoneId")}

    if not units:
        issues.append(_issue("CRITICAL", "EMPTY_LAYOUT", "Layout neobsahuje žádné skříňky."))

    # Šířky a dvířka
    for u in units:
        w = u.get("width_mm") or 0
        uid = u.get("id")
        zid = u.get("zoneId")
        if w % 50 != 0:
            issues.append(
                _issue(
                    "WARNING",
                    "WIDTH_STEP",
                    f"Šířka {w} mm není násobek 50 mm.",
                    zone_id=zid,
                    unit_id=uid,
                )
            )
        if w < 300 or w > 1200:
            issues.append(
                _issue(
                    "CRITICAL",
                    "WIDTH_RANGE",
                    f"Šířka {w} mm mimo povolený rozsah 300–1200 mm.",
                    zone_id=zid,
                    unit_id=uid,
                )
            )
        doors = u.get("doors") or {}
        wings = doors.get("wings")
        if wings == 1 and w > 600:
            issues.append(
                _issue(
                    "CRITICAL",
                    "DOOR_WINGS",
                    f"Šířka {w} mm vyžaduje 2 křídla, layout má 1.",
                    zone_id=zid,
                    unit_id=uid,
                )
            )
        if wings == 2 and w <= 600:
            issues.append(
                _issue(
                    "WARNING",
                    "DOOR_WINGS_SOFT",
                    f"Šířka {w} mm obvykle stačí 1 dvířko.",
                    zone_id=zid,
                    unit_id=uid,
                )
            )
        if u.get("band") == "base" and u.get("kind") == "drawers":
            stack = (u.get("drawers") or {}).get("front_heights_mm") or []
            if stack and list(stack) not in ([142, 142, 142, 286], [142, 286, 286]):
                issues.append(
                    _issue(
                        "WARNING",
                        "DRAWER_STACK",
                        f"Nestandardní šuplíková sestava {stack} (očekáváno 3×142+286 do korpusu 730).",
                        zone_id=zid,
                        unit_id=uid,
                    )
                )
            if stack and sum(stack) > 730:
                issues.append(
                    _issue(
                        "CRITICAL",
                        "DRAWER_OVER_CORPUS",
                        f"Šuplíková čela součet {sum(stack)} mm > korpus 730 mm — přesahují přes desku.",
                        zone_id=zid,
                        unit_id=uid,
                    )
                )
        if u.get("band") == "base" and u.get("corpus_height_mm") not in (None, 730):
            issues.append(
                _issue(
                    "CRITICAL",
                    "CORPUS_HEIGHT",
                    f"Korpus {u.get('corpus_height_mm')} mm — výrobní standard je 730 mm.",
                    zone_id=zid,
                    unit_id=uid,
                )
            )

    # Zóny: overflow / converging bez atyp
    for z in layout.get("zones") or []:
        zid = z.get("zoneId")
        packable = z.get("packable_mm")
        widths = z.get("widths_mm") or []
        if packable is not None and widths and sum(widths) > packable + 1:
            issues.append(
                _issue(
                    "CRITICAL",
                    "ZONE_OVERFLOW",
                    f"Zóna {z.get('label')}: součet modulů {sum(widths)} > packable {packable} mm.",
                    zone_id=zid,
                )
            )
        flags = z.get("flags") or {}
        converge = (z.get("converge") or "").casefold()
        if converge == "converging" or flags.get("requiresAtypicalSide"):
            has_filler = (z.get("filler_left_mm") or 0) > 0 or (z.get("filler_right_mm") or 0) > 0
            if not has_filler and not z.get("auto"):
                issues.append(
                    _issue(
                        "CRITICAL",
                        "CONVERGE_NO_ATYP",
                        f"Zóna {z.get('label')} se svírá / vyžaduje atyp, ale chybí filler rezerva.",
                        zone_id=zid,
                    )
                )
            else:
                issues.append(
                    _issue(
                        "INFO",
                        "ATYP_NOTED",
                        f"Zóna {z.get('label')}: atyp / filler započítán "
                        f"({z.get('filler_left_mm')}+{z.get('filler_right_mm')} mm).",
                        zone_id=zid,
                    )
                )
        if flags.get("requiresLeveling"):
            issues.append(
                _issue(
                    "WARNING",
                    "LEVELING",
                    f"Zóna {z.get('label')}: nutná nivelace (Δ podlahy).",
                    zone_id=zid,
                )
            )
        if flags.get("hasPipes"):
            issues.append(
                _issue(
                    "WARNING",
                    "PIPES",
                    f"Zóna {z.get('label')}: potrubí — zkontrolovat výřez / posun.",
                    zone_id=zid,
                )
            )
        if flags.get("hasSillCollision"):
            issues.append(
                _issue(
                    "CRITICAL",
                    "SILL_COLLISION",
                    f"Zóna {z.get('label')}: kolize s parapetem.",
                    zone_id=zid,
                )
            )

    # Survey: horní přes okno
    if survey:
        openings = []
        for room in survey.get("rooms") or []:
            openings.extend(room.get("openings") or [])
        windows = [o for o in openings if "window" in (o.get("type") or "").casefold() or "okno" in (o.get("label") or "").casefold()]
        if windows:
            wall_units = [u for u in units if u.get("band") == "wall"]
            for o in windows:
                sill = o.get("sillHeight")
                for u in wall_units:
                    bottom = u.get("bottom_from_floor_mm")
                    if sill is not None and bottom is not None and bottom < sill + 50:
                        issues.append(
                            _issue(
                                "CRITICAL",
                                "WALL_OVER_WINDOW",
                                f"Horní skříňka {u.get('sku')} zasahuje do oblasti okna (parapet {sill} mm).",
                                unit_id=u.get("id"),
                                zone_id=u.get("zoneId"),
                            )
                        )

    critical = sum(1 for i in issues if i["severity"] == "CRITICAL")
    warning = sum(1 for i in issues if i["severity"] == "WARNING")
    info = sum(1 for i in issues if i["severity"] == "INFO")
    ok = critical == 0

    return {
        "ok": ok,
        "canVisualize": ok,
        "counts": {"critical": critical, "warning": warning, "info": info, "total": len(issues)},
        "issues": issues,
        "layoutId": layout.get("layoutId"),
        "surveyId": layout.get("surveyId"),
    }
