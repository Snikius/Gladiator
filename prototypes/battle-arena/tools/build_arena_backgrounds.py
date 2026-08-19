#!/usr/bin/env python3
"""Crop and scale generated arena art to the mobile Canvas contract."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
TARGET_SIZE = (360, 560)
BACKGROUNDS = (
    (
        ASSETS / "arena-normal-background-source-v1.png",
        ASSETS / "arena-normal-background-v1.png",
    ),
    (
        ASSETS / "arena-sand-background-source-v1.png",
        ASSETS / "arena-sand-background-v1.png",
    ),
)


def cover_crop(image: Image.Image, target_size: tuple[int, int]) -> Image.Image:
    """Center-crop to target aspect ratio, then resize without soft pixels."""
    target_width, target_height = target_size
    target_ratio = target_width / target_height
    source_ratio = image.width / image.height
    if source_ratio > target_ratio:
        crop_width = round(image.height * target_ratio)
        left = (image.width - crop_width) // 2
        image = image.crop((left, 0, left + crop_width, image.height))
    else:
        crop_height = round(image.width / target_ratio)
        top = (image.height - crop_height) // 2
        image = image.crop((0, top, image.width, top + crop_height))
    return image.resize(target_size, Image.Resampling.NEAREST)


def main() -> None:
    for source_path, target_path in BACKGROUNDS:
        source = Image.open(source_path).convert("RGB")
        target = cover_crop(source, TARGET_SIZE)
        target.save(target_path, optimize=True)
        print(f"Built {target_path.name}: {target.width}x{target.height}")


if __name__ == "__main__":
    main()
