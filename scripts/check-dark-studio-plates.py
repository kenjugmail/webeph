#!/usr/bin/env python3
"""Verify the authored dark-mode field plates without rewriting them.

The production dark plates are GPT Image photographs, not derivatives of
the light plates. Their quality gate therefore checks the properties that
matter for the page: exact responsive dimensions, bounded payloads, a dark
but readable exposure, restrained colour, and consistency between sizes.
"""

from pathlib import Path
import sys

import numpy as np
from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
PLATES = {
    "network": {1600: (1600, 900), 900: (900, 506)},
    "isolation": {1536: (1536, 864), 900: (900, 506)},
    "verification": {1536: (1536, 864), 900: (900, 506)},
}


def tone(path: Path):
    image = Image.open(path).convert("RGB")
    luminance = np.asarray(image.convert("L"), dtype=np.float32)
    lab = np.asarray(image.convert("LAB"))
    a = (((lab[..., 1].astype(np.int16) + 128) % 256) - 128).astype(np.float32)
    b = (((lab[..., 2].astype(np.int16) + 128) % 256) - 128).astype(np.float32)
    return {
        "mean": float(luminance.mean()),
        "p95": float(np.percentile(luminance, 95)),
        "chroma": float(np.sqrt(a * a + b * b).mean()),
    }


errors = []
large_tones = {}

print("dark studio plates:")
for family, sizes in PLATES.items():
    family_tones = {}
    for width, dimensions in sizes.items():
        stem = ASSETS / f"ephemerent-{family}-dark-studio-{width}"
        for extension, limit_kib in (("jpg", 500), ("avif", 120)):
            path = stem.with_suffix(f".{extension}")
            if not path.exists():
                errors.append(f"missing {path.name}")
                continue
            with Image.open(path) as image:
                if image.size != dimensions:
                    errors.append(f"{path.name}: {image.size} != {dimensions}")
            size_kib = path.stat().st_size / 1024
            if size_kib > limit_kib:
                errors.append(f"{path.name}: {size_kib:.0f} KiB > {limit_kib} KiB")

        jpeg = stem.with_suffix(".jpg")
        if jpeg.exists():
            family_tones[width] = tone(jpeg)

    if not family_tones:
        continue

    large_width = max(family_tones)
    large = family_tones[large_width]
    large_tones[family] = large
    print(
        f"  {family:14} mean {large['mean']:5.1f}  "
        f"p95 {large['p95']:5.1f}  chroma {large['chroma']:4.1f}"
    )
    if not 24 <= large["mean"] <= 60:
        errors.append(f"{family}: mean {large['mean']:.1f} outside 24..60")
    if not 55 <= large["p95"] <= 125:
        errors.append(f"{family}: p95 {large['p95']:.1f} outside 55..125")
    if large["chroma"] > 10:
        errors.append(f"{family}: chroma {large['chroma']:.1f} is too high")

    if 900 in family_tones:
        delta = abs(family_tones[900]["mean"] - large["mean"])
        if delta > 2.5:
            errors.append(f"{family}: responsive mean differs by {delta:.1f}")

if errors:
    print(f"\n{len(errors)} dark studio plate failure(s):")
    for error in errors:
        print(f"  {error}")
    sys.exit(1)

print("\nall dark studio plates are production-ready")
