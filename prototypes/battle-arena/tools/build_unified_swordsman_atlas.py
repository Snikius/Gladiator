#!/usr/bin/env python3
"""Build and validate the exact 6x10 runtime atlas from ten generated rows."""

from pathlib import Path
from statistics import median

from PIL import Image, ImageChops, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ROW_SOURCES = [
    ("idle.normal", ASSETS / "unified-swordsman-row-0-idle-normal-source-v6.png"),
    ("idle.tired", ASSETS / "unified-swordsman-row-1-idle-tired-source-v3.png"),
    ("idle.injured", ASSETS / "unified-swordsman-row-2-idle-injured-source-v3.png"),
    ("attack", ASSETS / "unified-swordsman-row-3-attack-source-v3.png"),
    ("defense.block", ASSETS / "unified-swordsman-row-4-block-source-v6.png"),
    ("defense.dodge", ASSETS / "unified-swordsman-row-5-dodge-source-v6.png"),
    ("reaction.defeat", ASSETS / "unified-swordsman-row-6-hit-defeat-source-v6.png"),
    ("movement", ASSETS / "unified-swordsman-row-7-movement-source-v6.png"),
    ("greeting", ASSETS / "unified-swordsman-row-8-greeting-source-v1.png"),
    ("victory", ASSETS / "unified-swordsman-row-9-victory-source-v1.png"),
]
TARGET = ASSETS / "unified-swordsman-grid-v8.png"

COLUMNS = 6
ROWS = len(ROW_SOURCES)
CELL = 256
SAFE_FRAME = 240
PADDING = (CELL - SAFE_FRAME) // 2
ALPHA_THRESHOLD = 64
SIGNIFICANT_COMPONENT_PIXELS = 80
DETACHED_COMPONENT_PIXELS = 600
TARGET_BODY_HEIGHT = 196
CHECKER_DIFFERENCE_THRESHOLD = 20


Component = tuple[int, tuple[int, int, int, int], list[tuple[int, int]]]


def connected_components(alpha: Image.Image) -> list[Component]:
    """Return 8-connected alpha components as (pixel count, bounds, points)."""
    pixels = alpha.load()
    visible = {
        (x, y)
        for y in range(alpha.height)
        for x in range(alpha.width)
        if pixels[x, y] >= ALPHA_THRESHOLD
    }
    components: list[Component] = []
    while visible:
        seed = visible.pop()
        stack = [seed]
        points: list[tuple[int, int]] = []
        min_x = max_x = seed[0]
        min_y = max_y = seed[1]
        while stack:
            x, y = stack.pop()
            points.append((x, y))
            min_x, max_x = min(min_x, x), max(max_x, x)
            min_y, max_y = min(min_y, y), max(max_y, y)
            for next_y in range(max(0, y - 1), min(alpha.height, y + 2)):
                for next_x in range(max(0, x - 1), min(alpha.width, x + 2)):
                    point = (next_x, next_y)
                    if point in visible:
                        visible.remove(point)
                        stack.append(point)
        components.append((len(points), (min_x, min_y, max_x + 1, max_y + 1), points))
    return sorted(components, reverse=True)


def root_x(frame: Image.Image, bounds: tuple[int, int, int, int], falling: bool) -> int:
    """Anchor standing frames by their feet so idle frames cannot slide sideways."""
    if falling:
        return round((bounds[0] + bounds[2]) / 2)
    alpha = frame.getchannel("A")
    band_top = bounds[3] - max(12, (bounds[3] - bounds[1]) // 8)
    xs = [
        x
        for y in range(band_top, bounds[3])
        for x in range(bounds[0], bounds[2])
        if alpha.getpixel((x, y)) >= ALPHA_THRESHOLD
    ]
    return round(median(xs)) if xs else round((bounds[0] + bounds[2]) / 2)


def grounded_root_x(frame: Image.Image, bounds: tuple[int, int, int, int]) -> int:
    """Use both legs as one stable root for idle and locomotion rows."""
    alpha = frame.getchannel("A")
    band_top = bounds[3] - max(16, (bounds[3] - bounds[1]) // 4)
    xs = [
        x
        for y in range(band_top, bounds[3])
        for x in range(bounds[0], bounds[2])
        if alpha.getpixel((x, y)) >= ALPHA_THRESHOLD
    ]
    return round((min(xs) + max(xs)) / 2) if xs else round((bounds[0] + bounds[2]) / 2)


def checkerboard_profile(image: Image.Image) -> tuple[int, tuple[int, int, int], tuple[int, int, int]]:
    """Detect ImageGen's checker size and both neutral colors from an empty top band."""
    sample_y = min(8, image.height - 1)
    brightness = [
        sum(image.getpixel((x, sample_y))[:3]) / 3
        for x in range(image.width)
    ]
    ordered = sorted(brightness)
    low = ordered[len(ordered) // 10]
    high = ordered[len(ordered) * 9 // 10]
    split = (low + high) / 2
    light = [value >= split for value in brightness]
    transitions = [
        x
        for x in range(1, len(light))
        if light[x] != light[x - 1]
    ]
    gaps = [
        right - left
        for left, right in zip(transitions, transitions[1:])
        if 10 <= right - left <= 80
    ]
    if not gaps:
        raise ValueError("Could not detect generated checkerboard cell size")
    checker_size = round(median(gaps))

    band_height = min(image.height // 4, checker_size * 3)
    groups = [[], []]
    for y in range(band_height):
        for x in range(image.width):
            parity = (x // checker_size + y // checker_size) % 2
            groups[parity].append(image.getpixel((x, y))[:3])
    colors = []
    for group in groups:
        colors.append(tuple(round(median(pixel[channel] for pixel in group)) for channel in range(3)))
    return checker_size, colors[0], colors[1]


def remove_generated_background(image: Image.Image) -> Image.Image:
    """Preserve real alpha or remove ImageGen's painted checkerboard and white matte."""
    image = image.convert("RGBA")
    alpha = image.getchannel("A")
    if alpha.getextrema()[0] < 255:
        return image

    checker_size, first_color, second_color = checkerboard_profile(image)
    pixels = image.load()
    mask = Image.new("L", image.size)
    mask_pixels = mask.load()
    for y in range(image.height):
        for x in range(image.width):
            red, green, blue, _ = pixels[x, y]
            checker = (
                first_color
                if (x // checker_size + y // checker_size) % 2 == 0
                else second_color
            )
            difference = max(
                abs(red - checker[0]),
                abs(green - checker[1]),
                abs(blue - checker[2]),
            )
            mask_pixels[x, y] = 255 if difference >= CHECKER_DIFFERENCE_THRESHOLD else 0

    # A generated white matte is always on the outside of the silhouette.
    # Replace exactly that outer pixel ring with the dark pixel-art contour.
    interior = mask.filter(ImageFilter.MinFilter(3))
    boundary = ImageChops.subtract(mask, interior)
    image.paste((24, 20, 24, 255), mask=boundary)
    image.putalpha(mask)
    return image


def validate_runtime_frame(frame: Image.Image, row: int, column: int, name: str) -> None:
    components = [
        component
        for component in connected_components(frame.getchannel("A"))
        if component[0] >= SIGNIFICANT_COMPONENT_PIXELS
    ]
    if len(components) != 1:
        sizes = [component[0] for component in components]
        raise ValueError(
            f"{name} row {row}, frame {column}: expected one baked fighter+sword "
            f"silhouette, got {len(components)} significant components {sizes}"
        )


def extract_primary_frames(source: Image.Image, name: str) -> list[Image.Image]:
    """Extract the six generated poses by components, independent of loose spacing."""
    components = [
        component
        for component in connected_components(source.getchannel("A"))
        if component[0] >= SIGNIFICANT_COMPONENT_PIXELS
    ]
    if len(components) < COLUMNS:
        raise ValueError(f"{name}: found {len(components)} poses instead of {COLUMNS}")

    extras = [component[0] for component in components[COLUMNS:] if component[0] >= DETACHED_COMPONENT_PIXELS]
    if extras:
        raise ValueError(f"{name}: detached large components detected: {extras}")

    primary = sorted(
        components[:COLUMNS],
        key=lambda component: (component[1][0] + component[1][2]) / 2,
    )
    centers = [(component[1][0] + component[1][2]) / 2 for component in primary]
    gaps = [right - left for left, right in zip(centers, centers[1:])]
    typical_gap = median(gaps)
    if any(gap < typical_gap * 0.65 or gap > typical_gap * 1.35 for gap in gaps):
        raise ValueError(f"{name}: irregular frame spacing {gaps}")

    source_pixels = source.load()
    frames: list[Image.Image] = []
    for _, bounds, points in primary:
        frame = Image.new("RGBA", (bounds[2] - bounds[0], bounds[3] - bounds[1]))
        frame_pixels = frame.load()
        for x, y in points:
            frame_pixels[x - bounds[0], y - bounds[1]] = source_pixels[x, y]
        frames.append(frame)
    return frames


def validate_atlas(atlas: Image.Image) -> None:
    expected_size = (COLUMNS * CELL, ROWS * CELL)
    if atlas.size != expected_size:
        raise ValueError(f"Atlas size {atlas.size} does not match {expected_size}")

    for row, (name, _) in enumerate(ROW_SOURCES):
        for column in range(COLUMNS):
            frame = atlas.crop(
                (column * CELL, row * CELL, (column + 1) * CELL, (row + 1) * CELL)
            )
            bounds = frame.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"Empty runtime cell: {name} frame {column}")
            if (
                bounds[0] < PADDING
                or bounds[1] < PADDING
                or bounds[2] > CELL - PADDING
                or bounds[3] > CELL - PADDING
            ):
                raise ValueError(f"Unsafe bounds in {name} frame {column}: {bounds}")
            validate_runtime_frame(frame, row, column, name)


def main() -> None:
    prepared_rows: list[tuple[str, list[Image.Image]]] = []
    for row, (name, source_path) in enumerate(ROW_SOURCES):
        source = remove_generated_background(Image.open(source_path))
        prepared_rows.append((name, extract_primary_frames(source, name)))

    atlas = Image.new("RGBA", (COLUMNS * CELL, ROWS * CELL))
    for row, (name, frames) in enumerate(prepared_rows):
        heights = [frame.height for frame in frames]
        widths = [frame.width for frame in frames]
        base_scale = min(
            TARGET_BODY_HEIGHT / median(heights),
            SAFE_FRAME / max(heights),
            SAFE_FRAME / max(widths),
        )
        if row == 6:
            # Falling poses are naturally short and must not influence the scale
            # of the standing hit reaction. Use one scale for the entire row so
            # the fighter does not grow at impact or shrink during the fall.
            base_scale = min(
                TARGET_BODY_HEIGHT / max(heights[:3]),
                SAFE_FRAME / max(heights),
                SAFE_FRAME / max(widths),
            )
        if row == 9:
            # The raised sword makes the final victory poses much taller than
            # the fighter. Keep one scale across the whole row and constrain it
            # by the tallest pose so the blade remains inside its 256px cell.
            base_scale = min(
                TARGET_BODY_HEIGHT / median(heights[:2]),
                SAFE_FRAME / max(heights),
                SAFE_FRAME / max(widths),
            )
        if row in (0, 7):
            frame_scales = [
                min(TARGET_BODY_HEIGHT / height, SAFE_FRAME / width)
                for height, width in zip(heights, widths)
            ]
        else:
            frame_scales = [base_scale] * COLUMNS

        scaled_frames = []
        for _ in range(3):
            scaled_frames = []
            for column, (frame, frame_scale) in enumerate(zip(frames, frame_scales)):
                scaled = frame.resize(
                    (round(frame.width * frame_scale), round(frame.height * frame_scale)),
                    Image.Resampling.NEAREST,
                )
                bounds = scaled.getchannel("A").getbbox()
                if bounds is None:
                    raise ValueError(f"Empty source frame: {name} frame {column}")
                center_pose = row == 3 or (row == 6 and column >= 3)
                anchor_x = (
                    grounded_root_x(scaled, bounds)
                    if row in (0, 7)
                    else root_x(scaled, bounds, falling=center_pose)
                )
                scaled_frames.append((scaled, bounds, anchor_x))
            max_left = max(anchor_x - bounds[0] for _, bounds, anchor_x in scaled_frames)
            max_right = max(bounds[2] - anchor_x for _, bounds, anchor_x in scaled_frames)
            if max_left + max_right <= SAFE_FRAME:
                break
            shrink = SAFE_FRAME / (max_left + max_right) * 0.98
            frame_scales = [frame_scale * shrink for frame_scale in frame_scales]

        anchor_min = PADDING + max_left
        anchor_max = CELL - PADDING - max_right
        if anchor_min > anchor_max:
            raise ValueError(f"{name}: frames cannot share one horizontal anchor")
        shared_anchor_x = round(max(anchor_min, min(CELL // 2, anchor_max)))

        for column, (frame, bounds, anchor_x) in enumerate(scaled_frames):
            target_x = column * CELL + shared_anchor_x - anchor_x
            target_y = row * CELL + CELL - PADDING - bounds[3]
            atlas.alpha_composite(frame, (target_x, target_y))

    validate_atlas(atlas)
    atlas.save(TARGET)
    print(
        f"Built and validated {TARGET.name}: {atlas.width}x{atlas.height}, "
        f"{COLUMNS}x{ROWS} cells of {CELL}x{CELL}"
    )


if __name__ == "__main__":
    main()
