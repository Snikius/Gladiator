#!/usr/bin/env python3
"""Build and validate the 6x14 runtime atlas at one canonical scale."""

from pathlib import Path
from math import sqrt
from statistics import median

from PIL import Image, ImageChops, ImageDraw, ImageFilter


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
    ("special", ASSETS / "unified-swordsman-row-10-special-source-v1.png"),
    ("special.enhanced", ASSETS / "unified-swordsman-row-11-enhanced-special-source-v1.png"),
    ("reaction.stunned", ASSETS / "unified-swordsman-row-12-stunned-source-v1.png"),
    ("attack.spinning", ASSETS / "unified-swordsman-row-13-spinning-strike-source-v2.png"),
]
TARGET = ASSETS / "unified-swordsman-grid-v20.png"

COLUMNS = 6
ROWS = len(ROW_SOURCES)
CELL = 384
SAFE_FRAME = 368
PADDING = (CELL - SAFE_FRAME) // 2
ALPHA_THRESHOLD = 64
SIGNIFICANT_COMPONENT_PIXELS = 80
DETACHED_COMPONENT_PIXELS = 600
TARGET_BODY_HEIGHT = 196
CHECKER_DIFFERENCE_THRESHOLD = 20
ENCLOSED_BACKGROUND_PIXELS = 150


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


def contact_root_x(frame: Image.Image, bounds: tuple[int, int, int, int]) -> int:
    """Anchor a stationary reaction by the actual ground-contact pixels of both feet."""
    alpha = frame.getchannel("A")
    band_top = bounds[3] - min(12, bounds[3] - bounds[1])
    xs = [
        x
        for y in range(band_top, bounds[3])
        for x in range(bounds[0], bounds[2])
        if alpha.getpixel((x, y)) >= ALPHA_THRESHOLD
    ]
    return round((min(xs) + max(xs)) / 2) if xs else grounded_root_x(frame, bounds)


def dense_body_height(frame: Image.Image) -> int:
    """Measure the body without counting thin weapons as character height."""
    alpha = frame.getchannel("A")
    minimum_run = max(12, round(frame.width * 0.06))
    dense_rows = []
    for y in range(frame.height):
        longest_run = current_run = 0
        for x in range(frame.width):
            if alpha.getpixel((x, y)) >= ALPHA_THRESHOLD:
                current_run += 1
                longest_run = max(longest_run, current_run)
            else:
                current_run = 0
        if longest_run >= minimum_run:
            dense_rows.append(y)
    if not dense_rows:
        bounds = alpha.getbbox()
        if bounds is None:
            raise ValueError("Cannot measure an empty sprite frame")
        return bounds[3] - bounds[1]
    return max(dense_rows) - min(dense_rows) + 1


def visual_body_mass(frame: Image.Image) -> int:
    """Measure perceived body size while discarding thin weapon strokes."""
    alpha = frame.getchannel("A").filter(ImageFilter.MinFilter(7))
    mass = sum(1 for value in alpha.getdata() if value >= ALPHA_THRESHOLD)
    if mass <= 0:
        raise ValueError("Cannot measure visual mass of an empty sprite frame")
    return mass


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

    border = (
        [image.getpixel((x, 0))[:3] for x in range(image.width)]
        + [image.getpixel((x, image.height - 1))[:3] for x in range(image.width)]
        + [image.getpixel((0, y))[:3] for y in range(image.height)]
        + [image.getpixel((image.width - 1, y))[:3] for y in range(image.height)]
    )
    if median(max(pixel) for pixel in border) <= 12:
        # Some generated rows return a nearly black matte instead of actual
        # alpha. Remove only dark pixels connected to the outer canvas: black
        # hair, folds and weapon details enclosed by the silhouette survive.
        background_candidates = Image.new("L", image.size)
        candidate_pixels = background_candidates.load()
        pixels = image.load()
        for y in range(image.height):
            for x in range(image.width):
                candidate_pixels[x, y] = 255 if max(pixels[x, y][:3]) <= 15 else 0
        ImageDraw.floodfill(background_candidates, (0, 0), 128, thresh=0)
        mask = background_candidates.point(lambda value: 0 if value == 128 else 255)
        interior = mask.filter(ImageFilter.MinFilter(3))
        boundary = ImageChops.subtract(mask, interior)
        image.paste((24, 20, 24, 255), mask=boundary)
        image.putalpha(mask)
        return image

    checker_size, first_color, second_color = checkerboard_profile(image)
    pixels = image.load()
    background_candidates = Image.new("L", image.size)
    candidate_pixels = background_candidates.load()
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
            candidate_pixels[x, y] = 255 if difference < CHECKER_DIFFERENCE_THRESHOLD else 0

    # Remove only checker-colored pixels connected to the outer background.
    # Bright metal highlights inside the silhouette can match a checker color,
    # but they are enclosed by foreground and therefore must remain opaque.
    ImageDraw.floodfill(background_candidates, (0, 0), 128, thresh=0)
    enclosed_candidates = background_candidates.point(lambda value: 255 if value == 255 else 0)
    for size, _, points in connected_components(enclosed_candidates):
        if size < ENCLOSED_BACKGROUND_PIXELS:
            continue
        for x, y in points:
            candidate_pixels[x, y] = 128
    mask = background_candidates.point(lambda value: 0 if value == 128 else 255)

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


def validate_atlas(
    atlas: Image.Image,
    row_sources: list[tuple[str, Path]] = ROW_SOURCES,
    cell: int = CELL,
    safe_frame: int = SAFE_FRAME,
) -> None:
    padding = (cell - safe_frame) // 2
    expected_size = (COLUMNS * cell, len(row_sources) * cell)
    if atlas.size != expected_size:
        raise ValueError(f"Atlas size {atlas.size} does not match {expected_size}")

    for row, (name, _) in enumerate(row_sources):
        grounded_roots = []
        for column in range(COLUMNS):
            frame = atlas.crop(
                (column * cell, row * cell, (column + 1) * cell, (row + 1) * cell)
            )
            bounds = frame.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"Empty runtime cell: {name} frame {column}")
            if (
                bounds[0] < padding
                or bounds[1] < padding
                or bounds[2] > cell - padding
                or bounds[3] > cell - padding
            ):
                raise ValueError(f"Unsafe bounds in {name} frame {column}: {bounds}")
            validate_runtime_frame(frame, row, column, name)
            if name == "reaction.stunned":
                grounded_roots.append(contact_root_x(frame, bounds))
            elif row in (0, 7) or (row == 6 and column < 3):
                grounded_roots.append(grounded_root_x(frame, bounds))
        if grounded_roots and max(grounded_roots) - min(grounded_roots) > 1:
            raise ValueError(f"Unstable grounded root in {name}: {grounded_roots}")


def build_atlas(
    row_sources: list[tuple[str, Path]],
    target: Path,
    *,
    cell: int = CELL,
    safe_frame: int = SAFE_FRAME,
    target_body_height: int = TARGET_BODY_HEIGHT,
) -> None:
    prepared_rows: list[tuple[str, list[Image.Image]]] = []
    for name, source_path in row_sources:
        source = remove_generated_background(Image.open(source_path))
        prepared_rows.append((name, extract_primary_frames(source, name)))

    reference_frames = next(
        frames for name, frames in prepared_rows if name == "idle.normal"
    )
    reference_body_height = median(dense_body_height(frame) for frame in reference_frames)
    reference_visual_mass = median(visual_body_mass(frame) for frame in reference_frames)
    canonical_scale = target_body_height / reference_body_height
    padding = (cell - safe_frame) // 2
    atlas = Image.new("RGBA", (COLUMNS * cell, len(row_sources) * cell))
    for row, (name, frames) in enumerate(prepared_rows):
        scaled_frames = []
        for column, frame in enumerate(frames):
            source_normalization = sqrt(reference_visual_mass / visual_body_mass(frame))
            normalized_scale = canonical_scale * source_normalization
            scaled = frame.resize(
                (round(frame.width * normalized_scale), round(frame.height * normalized_scale)),
                Image.Resampling.NEAREST,
            )
            bounds = scaled.getchannel("A").getbbox()
            if bounds is None:
                raise ValueError(f"Empty source frame: {name} frame {column}")
            grounded_pose = row in (0, 7) or (row == 6 and column < 3)
            center_pose = row == 3 or (row == 6 and column >= 3)
            anchor_x = (
                contact_root_x(scaled, bounds)
                if name == "reaction.stunned"
                else grounded_root_x(scaled, bounds)
                if grounded_pose
                else root_x(scaled, bounds, falling=center_pose)
            )
            scaled_frames.append((scaled, bounds, anchor_x))

        max_left = max(anchor_x - bounds[0] for _, bounds, anchor_x in scaled_frames)
        max_right = max(bounds[2] - anchor_x for _, bounds, anchor_x in scaled_frames)
        if max_left + max_right > safe_frame:
            raise ValueError(
                f"{name}: normalized frames do not fit the safe frame; "
                f"required width={max_left + max_right}, available={safe_frame}"
            )

        anchor_min = padding + max_left
        anchor_max = cell - padding - max_right
        if anchor_min > anchor_max:
            raise ValueError(f"{name}: frames cannot share one horizontal anchor")
        shared_anchor_x = round(max(anchor_min, min(cell // 2, anchor_max)))

        for column, (frame, bounds, anchor_x) in enumerate(scaled_frames):
            target_x = column * cell + shared_anchor_x - anchor_x
            target_y = row * cell + cell - padding - bounds[3]
            atlas.alpha_composite(frame, (target_x, target_y))

    validate_atlas(atlas, row_sources, cell, safe_frame)
    atlas.save(target)
    print(
        f"Built and validated {target.name}: {atlas.width}x{atlas.height}, "
        f"{COLUMNS}x{len(row_sources)} cells of {cell}x{cell}, "
        f"canonical scale={canonical_scale:.4f}, "
        f"normalized {COLUMNS * len(row_sources)} source frames"
    )


def main() -> None:
    build_atlas(
        ROW_SOURCES,
        TARGET,
    )


if __name__ == "__main__":
    main()
