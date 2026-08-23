"""
M2 — Modulový systém skříněk (závazná výrobní pravidla).

- Korpus spodní 730 mm FIXNÍ; výška PD = 730 + sokl + deska
- Šířky standardně po 50 mm (5 cm)
- Dvířka: šířka ≤ 600 mm → 1 křídlo; > 600 mm → 2 křídla
- Šuplíky: výška čela standardně 142 mm a 286 mm;
  typická sestava ve spodní skříňce: 2×142 + 2×286
"""

from __future__ import annotations

from typing import Any, Literal


DoorWings = Literal["single", "double"]

CABINET_SYSTEM: dict[str, Any] = {
    "base_cabinet": {
        "corpus_height": 730,
        "corpus_depth": 560,
        "countertop_thickness_options": [20, 30, 40, 60],
        "countertop_overhang_front": 40,
        "plinth": {
            "standard_height": 100,
            "adjustable_range": [80, 150],
            "recess_depth": 50,
        },
        # Standardní šířky po 50 mm (5 cm)
        "width_step_mm": 50,
        "modules_mm": list(range(300, 1200 + 1, 50)),  # 300…1200
        "custom_width": {"min": 300, "max": 1200, "step": 50},
        "doors": {
            "single_max_width_mm": 600,
            "rule": "width <= 600 → 1 dvířka; width > 600 → 2 křídla",
        },
        "drawers": {
            "front_heights_mm": [142, 286],
            "standard_stack": [142, 142, 286, 286],
            "standard_stack_sum_mm": 142 * 2 + 286 * 2,  # 856
            "note": "Standardní výšky čel šuplíků; typicky 2×142 + 2×286 mm",
        },
    },
    "wall_cabinet": {
        "corpus_depth": 320,
        "depth_options": [280, 320, 350],
        "height_options": [360, 576, 720, 900],
        "gap_above_countertop": {"min": 450, "standard": 550, "max": 650},
        "width_step_mm": 50,
        "modules_mm": list(range(300, 900 + 1, 50)),
        "custom_width": {"min": 300, "max": 900, "step": 50},
        "doors": {
            "single_max_width_mm": 600,
            "rule": "width <= 600 → 1 dvířka; width > 600 → 2 křídla",
        },
    },
    "tall_cabinet": {
        "corpus_depth": 560,
        "height_options": [2100, 2200, 2400],
        "width_step_mm": 50,
        "modules_mm": list(range(450, 600 + 1, 50)),
        "plinth": "same_as_base",
        "doors": {
            "single_max_width_mm": 600,
            "rule": "width <= 600 → 1 dvířka; width > 600 → 2 křídla",
        },
    },
}


def worktop_height_mm(
    plinth_height: int = 100,
    countertop_thickness: int = 40,
    corpus_height: int = 730,
) -> int:
    """Výška pracovní desky od čisté podlahy."""
    return corpus_height + plinth_height + countertop_thickness


def wall_cabinet_band(
    worktop: int,
    gap: int = 550,
    wall_height: int = 720,
) -> tuple[int, int]:
    """Vrátí (spodek, vršek) horní skříňky od podlahy v mm."""
    bottom = worktop + gap
    return bottom, bottom + wall_height


def snap_width_mm(width: int, step: int = 50) -> int:
    """Zaokrouhlí šířku na nejbližší násobek kroku (default 50 mm)."""
    if step <= 0:
        return width
    return int(round(width / step) * step)


def door_wings_for_width(width_mm: int, single_max_mm: int = 600) -> DoorWings:
    """Do 60 cm jedno dvířko; nad 60 cm dvě křídla."""
    return "single" if width_mm <= single_max_mm else "double"


def door_plan(width_mm: int) -> dict[str, Any]:
    wings = door_wings_for_width(width_mm)
    if wings == "single":
        return {
            "width_mm": width_mm,
            "wings": 1,
            "type": "single",
            "label": "1 dvířka",
        }
    # dvě křídla — přibližně půlka (výroba doladí spáru)
    half = width_mm // 2
    return {
        "width_mm": width_mm,
        "wings": 2,
        "type": "double",
        "label": "2 křídla",
        "wing_widths_mm": [half, width_mm - half],
    }


def standard_drawer_stack() -> dict[str, Any]:
    stack = list(CABINET_SYSTEM["base_cabinet"]["drawers"]["standard_stack"])
    return {
        "front_heights_mm": stack,
        "count": len(stack),
        "sum_mm": sum(stack),
        "composition": "2×142 + 2×286",
    }


def validate_width(width_mm: int, step: int = 50) -> list[str]:
    """Vrátí varování, pokud šířka není na kroku 50 mm."""
    warnings: list[str] = []
    if width_mm % step != 0:
        suggested = snap_width_mm(width_mm, step)
        warnings.append(
            f"Šířka {width_mm} mm není násobek {step} mm — doporučeno {suggested} mm"
        )
    return warnings
