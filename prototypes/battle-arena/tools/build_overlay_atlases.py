#!/usr/bin/env python3
"""Build exact 6×7 body/weapon atlases from registered body frames.

Image generation is used only for the clean single-weapon sources. This script
owns the grid, selects the configured hand in every body frame and rotates each
weapon around that detected grip, so an independently centered AI atlas can no
longer move between cells.
"""

from __future__ import annotations

from pathlib import Path
from statistics import median

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
SOURCE_CELL = 192
CELL = 256
PADDING = (CELL - SOURCE_CELL) // 2
COLUMNS = 6
ROWS = 7

BODY_SOURCES = {
    "murmillo": (ASSETS / "murmillo-body-overlay-grid-v2.png", 6),
    # v4 is a true six-column atlas. The rear hand is posed as an empty grip
    # for the separately rendered trident shaft.
    "retiarius": (ASSETS / "retiarius-body-grip-source-v4.png", 6),
}

WEAPON_SOURCES = {
    "gladius": ASSETS / "gladius-source-v3.png",
    "trident": ASSETS / "trident-source-v3.png",
}

ANGLES = {
    "gladius": [
        [-4, -2, 0, 2, 0, -3],
        [8, 10, 12, 10, 8, 6],
        [16, 18, 20, 18, 16, 14],
        [55, 28, 5, -18, -42, -12],
        [76, 68, 58, 48, 58, 68],
        [8, 12, 18, 15, 10, 6],
        [20, 32, 48, 65, 78, 88],
    ],
    "trident": [
        [-3, -2, 0, 2, 1, -2],
        [6, 8, 10, 8, 6, 4],
        [12, 14, 16, 14, 12, 10],
        [18, 9, 2, 0, -4, 0],
        [55, 46, 36, 28, 36, 46],
        [8, 12, 16, 14, 10, 6],
        [15, 25, 38, 55, 70, 82],
    ],
}

def keep_main_silhouette(frame: Image.Image) -> Image.Image:
    """Remove body fragments leaking in from neighbouring generated rows."""
    alpha = frame.getchannel("A")
    visible = {
        (x, y)
        for y in range(frame.height)
        for x in range(frame.width)
        if alpha.getpixel((x, y)) >= 32
    }
    components: list[set[tuple[int, int]]] = []
    while visible:
        seed = visible.pop()
        component = {seed}
        stack = [seed]
        while stack:
            x, y = stack.pop()
            for neighbor_y in range(max(0, y - 1), min(frame.height, y + 2)):
                for neighbor_x in range(max(0, x - 1), min(frame.width, x + 2)):
                    neighbor = (neighbor_x, neighbor_y)
                    if neighbor in visible:
                        visible.remove(neighbor)
                        component.add(neighbor)
                        stack.append(neighbor)
        components.append(component)

    if not components:
        return frame
    main = max(components, key=len)
    cleaned = frame.copy()
    cleaned_alpha = cleaned.getchannel("A")
    for y in range(frame.height):
        for x in range(frame.width):
            if (x, y) not in main:
                cleaned_alpha.putpixel((x, y), 0)
    cleaned.putalpha(cleaned_alpha)
    return cleaned


def repack_body(
    source_path: Path,
    source_columns: int,
) -> tuple[Image.Image, list[list[tuple[int, int]]]]:
    source = Image.open(source_path).convert("RGBA")
    target = Image.new("RGBA", (CELL * COLUMNS, CELL * ROWS))
    frame_offsets = [[(0, 0) for _ in range(COLUMNS)] for _ in range(ROWS)]
    for row in range(ROWS):
        for column in range(COLUMNS):
            source_column = min(column, source_columns - 1)
            box = (
                round(source_column * source.width / source_columns),
                round(row * source.height / ROWS),
                round((source_column + 1) * source.width / source_columns),
                round((row + 1) * source.height / ROWS),
            )
            frame = source.crop(box).resize((SOURCE_CELL, SOURCE_CELL), Image.Resampling.NEAREST)
            frame = keep_main_silhouette(frame)
            offset_x = 0
            offset_y = 0
            if row <= 2:
                bounds = frame.getchannel("A").getbbox()
                if bounds:
                    # Idle loops must not translate the whole fighter. Align
                    # the silhouette centre and feet while preserving pose
                    # changes inside the fixed cell.
                    center_x = (bounds[0] + bounds[2]) / 2
                    offset_x = round(SOURCE_CELL / 2 - center_x)
                    offset_y = SOURCE_CELL - bounds[3]
            frame_offsets[row][column] = (offset_x, offset_y)
            target.alpha_composite(
                frame,
                (
                    column * CELL + PADDING + offset_x,
                    row * CELL + PADDING + offset_y,
                ),
            )
    return target, frame_offsets


def is_skin(pixel: tuple[int, int, int, int]) -> bool:
    red, green, blue, alpha = pixel
    return (
        alpha > 80
        and red > 100
        and red > green * 1.16
        and green > blue * 1.05
        and green > 36
    )


def detect_forward_hand(frame: Image.Image) -> tuple[int, int]:
    candidates = []
    for y in range(PADDING + 46, PADDING + 151):
        for x in range(PADDING + 80, PADDING + 190):
            if is_skin(frame.getpixel((x, y))):
                candidates.append((x, y))
    if not candidates:
        return (138, 96)

    right_edge = max(x for x, _ in candidates)
    edge_pixels = [(x, y) for x, y in candidates if x >= right_edge - 9]
    # Move a few pixels inside the silhouette instead of attaching the weapon
    # to the brightest outer antialiasing pixel.
    return (round(median(x for x, _ in edge_pixels)) - 3, round(median(y for _, y in edge_pixels)))


def detect_rear_hand(frame: Image.Image) -> tuple[int, int]:
    """Find the rear/left fist while ignoring exposed legs below the belt."""
    candidates = []
    for y in range(PADDING + 42, PADDING + 132):
        for x in range(PADDING + 32, PADDING + 138):
            if is_skin(frame.getpixel((x, y))):
                candidates.append((x, y))
    if not candidates:
        return (PADDING + 68, PADDING + 96)

    left_edge = min(x for x, _ in candidates)
    edge_pixels = [(x, y) for x, y in candidates if x <= left_edge + 8]
    return (round(median(x for x, _ in edge_pixels)) + 3, round(median(y for _, y in edge_pixels)))


def clean_weapon_source(source_path: Path) -> Image.Image:
    source = Image.open(source_path).convert("RGBA")
    alpha = source.getchannel("A").point(lambda value: 0 if value < 24 else value)
    source.putalpha(alpha)
    bounds = alpha.getbbox()
    if bounds is None:
        raise ValueError(f"Weapon source has no visible pixels: {source_path}")
    return source.crop(bounds)


def resize_weapon(source: Image.Image, length: int) -> Image.Image:
    height = max(7, round(length * source.height / source.width))
    return source.resize((length, height), Image.Resampling.NEAREST)


def place_weapon(
    frame: Image.Image,
    weapon: Image.Image,
    grip_ratio: float,
    angle: float,
    row: int,
    column: int,
    anchor_override: tuple[int, int] | None = None,
    frame_offset: tuple[int, int] = (0, 0),
) -> Image.Image:
    layer = Image.new("RGBA", (CELL, CELL))
    if row == 6 and column >= 3:
        anchor = (PADDING + 106 + (column - 3) * 8, PADDING + 166)
        angle = 2 + (column - 3) * 3
    else:
        anchor = (
            (
                anchor_override[0] + PADDING + frame_offset[0],
                anchor_override[1] + PADDING + frame_offset[1],
            )
            if anchor_override
            else detect_forward_hand(frame)
        )

    grip_x = round(weapon.width * grip_ratio)
    grip_y = weapon.height // 2
    layer.alpha_composite(weapon, (anchor[0] - grip_x, anchor[1] - grip_y))
    return layer.rotate(angle, resample=Image.Resampling.NEAREST, center=anchor)


def build_weapon_atlas(
    body: Image.Image,
    weapon_id: str,
    length: int,
    grip_ratio: float,
    hand_anchors: list[list[tuple[int, int]]] | None = None,
    frame_offsets: list[list[tuple[int, int]]] | None = None,
    hand_detector=detect_forward_hand,
) -> Image.Image:
    weapon = resize_weapon(clean_weapon_source(WEAPON_SOURCES[weapon_id]), length)
    atlas = Image.new("RGBA", body.size)
    for row in range(ROWS):
        for column in range(COLUMNS):
            frame_box = (
                column * CELL,
                row * CELL,
                (column + 1) * CELL,
                (row + 1) * CELL,
            )
            frame = body.crop(frame_box)
            detected_anchor = None
            if not hand_anchors:
                detected = hand_detector(frame)
                detected_anchor = (detected[0] - PADDING, detected[1] - PADDING)
            layer = place_weapon(
                frame,
                weapon,
                grip_ratio,
                ANGLES[weapon_id][row][column],
                row,
                column,
                hand_anchors[row][column] if hand_anchors else detected_anchor,
                frame_offsets[row][column] if hand_anchors and frame_offsets else (0, 0),
            )
            atlas.alpha_composite(layer, (column * CELL, row * CELL))
    return atlas


def main() -> None:
    body_results = {
        fighter: repack_body(source, source_columns)
        for fighter, (source, source_columns) in BODY_SOURCES.items()
    }
    bodies = {fighter: result[0] for fighter, result in body_results.items()}
    frame_offsets = {fighter: result[1] for fighter, result in body_results.items()}
    bodies["murmillo"].save(ASSETS / "murmillo-body-overlay-grid-v3.png")
    bodies["retiarius"].save(ASSETS / "retiarius-body-overlay-grid-v4.png")

    build_weapon_atlas(
        bodies["murmillo"],
        "gladius",
        length=58,
        grip_ratio=0.23,
        frame_offsets=frame_offsets["murmillo"],
    ).save(
        ASSETS / "gladius-overlay-grid-v3.png"
    )
    build_weapon_atlas(
        bodies["retiarius"],
        "trident",
        length=142,
        grip_ratio=0.18,
        frame_offsets=frame_offsets["retiarius"],
        hand_detector=detect_rear_hand,
    ).save(
        ASSETS / "trident-overlay-grid-v4.png"
    )


if __name__ == "__main__":
    main()
