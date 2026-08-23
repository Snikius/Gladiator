#!/usr/bin/env python3
"""Build the validated 6x13 retiarius runtime atlas from generated rows."""

from pathlib import Path
from statistics import median

from PIL import Image

from build_unified_swordsman_atlas import build_atlas, dense_body_height


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
TARGET = ASSETS / "unified-retiarius-grid-v8.png"
CELL = 384
SAFE_FRAME = 368
TARGET_BODY_HEIGHT = 196


def validate_special_pose_proportions(target: Path) -> None:
    atlas = Image.open(target).convert("RGBA")
    row_heights = {}
    for row in (0, 8, 9, 10, 11, 12):
        row_heights[row] = [
            dense_body_height(atlas.crop((column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL)))
            for column in range(6)
        ]
    idle_height = median(row_heights[0])
    for name, row in (("greeting", 8), ("victory", 9), ("special", 10)):
        heights = row_heights[row]
        if median(heights) < idle_height * 0.94 or min(heights) < idle_height * 0.9:
            raise ValueError(
                f"{name}: retiarius body shrinks relative to idle; "
                f"idle={row_heights[0]}, {name}={heights}"
            )
    enhanced_heights = row_heights[11]
    enhanced_standing_heights = [enhanced_heights[0], enhanced_heights[5]]
    if any(
        height < idle_height * 0.94 or height > idle_height * 1.06
        for height in enhanced_standing_heights
    ):
        raise ValueError(
            "special.enhanced: standing retiarius scale differs from idle; "
            f"idle={row_heights[0]}, special.enhanced={enhanced_heights}"
        )
    stunned_heights = row_heights[12]
    stunned_standing_heights = [stunned_heights[0], stunned_heights[5]]
    if any(
        height < idle_height * 0.94 or height > idle_height * 1.06
        for height in stunned_standing_heights
    ):
        raise ValueError(
            "reaction.stunned: standing retiarius scale differs from idle; "
            f"idle={row_heights[0]}, reaction.stunned={stunned_heights}"
        )
    hit_heights = [
        dense_body_height(atlas.crop((column * CELL, 6 * CELL, (column + 1) * CELL, 7 * CELL)))
        for column in range(3)
    ]
    if any(height < idle_height * 0.94 or height > idle_height * 1.06 for height in hit_heights):
        raise ValueError(
            "reaction.hit: retiarius body scale differs from idle; "
            f"idle={row_heights[0]}, hit={hit_heights}"
        )


if __name__ == "__main__":
    build_atlas(
        ROW_SOURCES,
        TARGET,
        cell=CELL,
        safe_frame=SAFE_FRAME,
        target_body_height=TARGET_BODY_HEIGHT,
        buffered_equipment=True,
        row_scale_corrections={
            "special.enhanced": 0.91,
            "reaction.stunned": 0.805,
        },
    )
    validate_special_pose_proportions(TARGET)
