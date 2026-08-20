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

import numpy as np
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
GROUND = (0x1E, 0x1C, 0x17)   # above --paper (#14130f), so the plate has a floor to sit on
HIGHLIGHT = (0xC6, 0xC0, 0xB2)  # under --ink; the filaments carry without blazing

# How much tonal spread the finished plate may carry, as a fraction of
# its own mean.
#
# This is the number the plates were getting wrong, and it took two
# wrong answers to find it. Chroma was the obvious suspect: measured in
# HSV, saturation appeared to quadruple through the inversion, 26 to 96.
# That reading was an artefact -- HSV saturation is (max - min) / max,
# so it inflates without bound as pixels get darker, and every dark
# image scores high on it. Measured properly in LAB, chroma rises about
# 20%, from 7.2 to 8.7, and is very nearly innocent.
#
# What actually quadrupled is RELATIVE contrast. The source plates run a
# standard deviation of 30 against a mean of 205, or 0.15. Inverting
# holds the spread and cuts the mean to a quarter, landing at 0.66. The
# eye judges contrast against the local mean, so the same photograph
# came back four times as hard -- and then Contrast.enhance(1.3) made it
# harder still.
TARGET_SPREAD = 0.38


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


def fit_spread(img: Image.Image, target: float) -> Image.Image:
    """Scale the tonal range about its own mean until sd/mean hits target.

    Working on the ratio rather than on an absolute standard deviation is
    the whole point: a dark plate and a light one can carry identical
    spread and read completely differently, because contrast is judged
    against the surrounding brightness. Anchoring on the mean is what
    makes the dark variant feel like the same photograph rather than a
    harsher one.
    """
    arr = np.asarray(img).astype(np.float32)
    lum = np.asarray(img.convert("L")).astype(np.float32)
    mean, sd = lum.mean(), lum.std()
    if sd < 1e-3 or mean < 1e-3:
        return img
    factor = (target * mean) / sd
    if factor >= 1.0:                       # already softer than asked
        return img
    # Scale every channel about the luminance mean, so hue is untouched.
    out = mean + (arr - mean) * factor
    return Image.fromarray(np.clip(out, 0, 255).astype(np.uint8), "RGB")


def tone(path: Path):
    """Mean lightness, relative spread and LAB chroma for one image.

    Chroma is read from LAB with the a/b bytes decoded as SIGNED values.
    Pillow stores them wrapped -- 0 is neutral and negatives live above
    127, so teal comes back as a=223 meaning -33. Reading them as
    unsigned puts every neutral pixel 128 units from the origin and
    reports a chroma of 175 for a black-and-white photograph.
    """
    im = Image.open(path).convert("RGB")
    lab = np.asarray(im.convert("LAB"))
    lum = lab[..., 0].astype(np.float32)
    a = (((lab[..., 1].astype(np.int16) + 128) % 256) - 128).astype(np.float32)
    b = (((lab[..., 2].astype(np.int16) + 128) % 256) - 128).astype(np.float32)
    mean = float(lum.mean()) or 1.0
    return mean, float(lum.std()) / mean, float(np.sqrt(a * a + b * b).mean())


def verify(src: Path, out_stem: Path) -> str:
    """Report whether a shipped plate still matches the intended tone."""
    out = out_stem.with_suffix(".webp")
    if not out.exists():
        return f"  MISSING  {out.name}"
    s_mean, s_spread, s_chroma = tone(src)
    d_mean, d_spread, d_chroma = tone(out)
    notes = []
    # The fitter targets TARGET_SPREAD and only ever softens, so a plate
    # already gentler than the target is fine; harsher is the failure.
    if d_spread > TARGET_SPREAD + 0.06:
        notes.append(f"spread {d_spread:.3f} > {TARGET_SPREAD:.2f}")
    # Chroma should not gain much through the inversion. It was the
    # suspect that turned out innocent, and this keeps it that way.
    if d_chroma > s_chroma * 1.35:
        notes.append(f"chroma {d_chroma:.1f} vs source {s_chroma:.1f}")
    if d_mean > 110:
        notes.append(f"mean {d_mean:.0f} is too light for a dark plate")
    verdict = "FAIL " + "; ".join(notes) if notes else "ok"
    return (f"  {out_stem.name:38} mean {d_mean:5.1f}  spread {d_spread:.3f}  "
            f"chroma {d_chroma:4.1f}  {verdict}")


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
    # A nudge, not a rescue. Chroma survives the inversion nearly intact,
    # so the teal pin heads do not need 1.35x to read -- and at that
    # strength the paper's warm cast came up with them.
    toned = ImageEnhance.Color(toned).enhance(1.08)

    # Land the spread on TARGET_SPREAD instead of nudging it with a fixed
    # multiplier and hoping.
    toned = fit_spread(toned, TARGET_SPREAD)

    out_stem = ASSETS / f"{name}-dark-{width}"
    if CHECK:
        return verify(src, out_stem)

    toned.save(f"{out_stem}.webp", "WEBP", quality=82, method=6)
    toned.save(f"{out_stem}.avif", "AVIF", quality=62)
    w = (out_stem.with_suffix(".webp")).stat().st_size // 1024
    a = (out_stem.with_suffix(".avif")).stat().st_size // 1024
    return f"  {out_stem.name}  webp {w}K  avif {a}K"


print("dark plates:" if not CHECK else
      f"dark plates (checking tone against TARGET_SPREAD={TARGET_SPREAD}):")
lines = [build(name, width) for name, width in PLATES]
for line in lines:
    print(line)
if CHECK:
    bad = [l for l in lines if "FAIL" in l or "MISSING" in l]
    if bad:
        print(f"\n{len(bad)} plate(s) off tone. Re-run without --check to rebuild.")
        sys.exit(1)
    print("\nall dark plates within tone")
