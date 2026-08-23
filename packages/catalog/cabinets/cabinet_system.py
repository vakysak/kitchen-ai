"""
M2 — Modulový systém skříněk (závazná výrobní pravidla).
Korpus spodní 730 mm je FIXNÍ; výška PD se mění soklem + deskou.
"""

from __future__ import annotations

from typing import Any


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
        "modules_mm": [150, 200, 300, 350, 400, 450, 500, 600, 800, 900, 1000],
        "custom_width": {"min": 150, "max": 1200, "step": 1},
    },
    "wall_cabinet": {
        "corpus_depth": 320,
        "depth_options": [280, 320, 350],
        "height_options": [360, 576, 720, 900],
        "gap_above_countertop": {"min": 450, "standard": 550, "max": 650},
        "modules_mm": [300, 400, 450, 500, 600, 800, 900],
        "custom_width": {"min": 200, "max": 1200, "step": 1},
    },
    "tall_cabinet": {
        "corpus_depth": 560,
        "height_options": [2100, 2200, 2400],
        "modules_mm": [450, 500, 600],
        "plinth": "same_as_base",
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
