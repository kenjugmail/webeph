#!/usr/bin/env python3
"""
Derive dark-face variants of the hero photography.

The plates are pins and graphite thread on lit paper. On a dark ground an
untouched one glows like a lightbox, and simply dimming it does not help:
the threads are already the darkest thing in the frame, so exposing down
takes subject and ground toward each other and the picture turns to mud.

Inverting luminance does the opposite. The paper becomes the ground and
the threads become bright filaments drawn across it, which is much closer
to what the pictures are actually about. Hue is carried through the
inversion rather than flipped, so the teal pin heads stay teal instead of
turning magenta the way a naive RGB invert would leave them.

After inverting, the range is remapped so black lands on the lab theme's
own ground rather than on 0,0,0 -- a photograph that goes fully black on
a #14130f page reads as a hole rather than as a plate.

    python3 scripts/make-dark-plates.py            # write the variants
    python3 scripts/make-dark-plates.py --check    # report without writing
"""

import sys
from pathlib import Path

from PIL import Image, ImageEnhance, ImageOps

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "assets"
CHECK = "--check" in sys.argv

# The three plates, at both widths the markup asks for.
PLATES = [
    ("ephemerent-network", 900), ("ephemerent-network", 1600),
    ("ephemerent-isolation", 900), ("ephemerent-isolation", 1536),
    ("ephemerent-verification", 900), ("ephemerent-verification", 1536),
]

# The lab theme's dark ground and ink. The remapped range sits between
# them so the plate belongs to the page instead of punching a hole in it.
GROUND = (0x11, 0x10, 0x0C)   # just under --paper (#14130f); the plate is a window, not a card
HIGHLIGHT = (0xF6, 0xF2, 0xE8)  # a shade above --ink, so the filaments carry


def invert_luminance(img: Image.Image) -> Image.Image:
    """Flip lightness, keep hue and saturation.

    A plain ImageOps.invert() rotates every hue by 180 degrees, which would
    turn the green pin heads magenta. Working in LAB and inverting only L
    leaves the colour where the photographer put it.
    """
    lab = img.convert("LAB")
    l, a, b = lab.split()
    return Image.merge("LAB", (ImageOps.invert(l), a, b)).convert("RGB")


def remap(img: Image.Image, low, high) -> Image.Image:
    """Compress the full range into the theme's own black and white points."""
    return ImageOps.colorize(
        ImageOps.grayscale(img), black=low, white=high, blackpoint=0, whitepoint=255
    )


def build(name: str, width: int) -> str:
    src = ASSETS / f"{name}-{width}.webp"
    if not src.exists():
        return f"  MISSING {src.name}"

    img = Image.open(src).convert("RGB")
    inverted = invert_luminance(img)

    # Blend the hue-carrying inversion with a tinted monochrome version
    # of itself. Full colour after inversion is too lively for a plate
    # that sits behind type, but pulling all the way to monochrome loses
    # the teal pin heads, which are the one piece of colour worth
    # keeping -- they are the accent, and they mark the result.
    toned = Image.blend(remap(inverted, GROUND, HIGHLIGHT), inverted, 0.42)
    # The accent pin heads are the only colour that should survive, so
    # give saturation a push before the range gets compressed further.
    toned = ImageEnhance.Color(toned).enhance(1.35)

    # The threads are one or two pixels wide. Without real separation the
    # compressed range turns the whole plate to grey-green mud, which is
    # the failure mode of any inversion done by halves.
    toned = ImageEnhance.Contrast(toned).enhance(1.3)
    toned = ImageEnhance.Brightness(toned).enhance(0.97)

    out_stem = ASSETS / f"{name}-dark-{width}"
    if CHECK:
        return f"  would write {out_stem.name}.webp / .avif  ({img.size[0]}x{img.size[1]})"

    toned.save(f"{out_stem}.webp", "WEBP", quality=82, method=6)
    toned.save(f"{out_stem}.avif", "AVIF", quality=62)
    w = (out_stem.with_suffix(".webp")).stat().st_size // 1024
    a = (out_stem.with_suffix(".avif")).stat().st_size // 1024
    return f"  {out_stem.name}  webp {w}K  avif {a}K"


print("dark plates:" if not CHECK else "dark plates (check only):")
for name, width in PLATES:
    print(build(name, width))
