#!/usr/bin/env python3
"""Build the validated 6x13 retiarius atlas at one canonical scale."""

from pathlib import Path
from build_unified_swordsman_atlas import build_atlas


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ROW_SOURCES = [
    ("idle.normal", ASSETS / "unified-retiarius-row-0-idle-normal-source-v1.png"),
    ("idle.tired", ASSETS / "unified-retiarius-row-1-idle-tired-source-v1.png"),
    ("idle.injured", ASSETS / "unified-retiarius-row-2-idle-injured-source-v1.png"),
    ("attack", ASSETS / "unified-retiarius-row-3-attack-source-v1.png"),
    ("defense.block", ASSETS / "unified-retiarius-row-4-block-source-v1.png"),
    ("defense.dodge", ASSETS / "unified-retiarius-row-5-dodge-source-v1.png"),
    ("reaction.defeat", ASSETS / "unified-retiarius-row-6-hit-defeat-source-v1.png"),
    ("movement", ASSETS / "unified-retiarius-row-7-movement-source-v1.png"),
    ("greeting", ASSETS / "unified-retiarius-row-8-greeting-source-v2.png"),
    ("victory", ASSETS / "unified-retiarius-row-9-victory-source-v2.png"),
    ("special", ASSETS / "unified-retiarius-row-10-special-source-v1.png"),
    ("special.enhanced", ASSETS / "unified-retiarius-row-11-enhanced-special-source-v2.png"),
    ("reaction.stunned", ASSETS / "unified-retiarius-row-12-stunned-source-v1.png"),
]
TARGET = ASSETS / "unified-retiarius-grid-v11.png"
CELL = 384
SAFE_FRAME = 368
TARGET_BODY_HEIGHT = 196
if __name__ == "__main__":
    build_atlas(
        ROW_SOURCES,
        TARGET,
        cell=CELL,
        safe_frame=SAFE_FRAME,
        target_body_height=TARGET_BODY_HEIGHT,
    )
