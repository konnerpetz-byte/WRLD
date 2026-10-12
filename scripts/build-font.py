"""
Builds WRLD Sans: Outfit (SIL Open Font License 1.1) with WRLD's signature
detail — every round dot (i, j, . : ; ! ? and accent dots) is redrawn as a
diamond, echoing the diamond tile the compass logo sits on.

Run:  python3 scripts/build-font.py
Needs: pip install fonttools brotli
Output: src/app/fonts/wrld-sans-{400,500,600,700}.woff2 + OFL.txt
"""

from pathlib import Path

from fontTools.pens.recordingPen import RecordingPen
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "node_modules/@fontsource/outfit/files"
OUT = ROOT / "src/app/fonts"
WEIGHTS = {400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold"}

# Glyphs whose small round parts become diamonds.
DOTTED = [
    "i", "j", "period", "colon", "semicolon", "exclam", "question",
    "exclamdown", "questiondown", "ellipsis", "periodcentered",
    "fi", "f_j", "iogonek",
]
# Accented letters (ä, ö, ü, ï, ė…) reuse these combining marks, and the
# ellipsis reuses the period, so changing them covers those characters too.
MARK_PREFIXES = ("uni0307", "uni0308")


def contours_of(glyph_set, name):
    """Return the glyph outline as a list of contours (lists of pen ops)."""
    pen = RecordingPen()
    glyph_set[name].draw(pen)
    contours, current = [], []
    for op, args in pen.value:
        current.append((op, args))
        if op in ("closePath", "endPath"):
            contours.append(current)
            current = []
    return contours


def points(contour):
    return [pt for _, args in contour for pt in args]


def bbox(pts):
    xs, ys = [p[0] for p in pts], [p[1] for p in pts]
    return min(xs), min(ys), max(xs), max(ys)


def signed_area(pts):
    return sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1])) / 2


def is_dot(contour, upm):
    pts = points(contour)
    if len(pts) < 4:
        return False
    x0, y0, x1, y1 = bbox(pts)
    w, h = x1 - x0, y1 - y0
    small = w < upm * 0.2 and h < upm * 0.2
    roundish = 0.7 < (w / h if h else 0) < 1.4
    curved = any(op == "qCurveTo" or op == "curveTo" for op, _ in contour)
    return small and roundish and curved


def diamond(contour):
    pts = points(contour)
    x0, y0, x1, y1 = bbox(pts)
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    # A diamond covers less area than a circle of the same width;
    # grow it slightly so it carries the same visual weight.
    r = max(x1 - x0, y1 - y0) / 2 * 1.16
    ring = [(cx, cy + r), (cx + r, cy), (cx, cy - r), (cx - r, cy)]  # clockwise
    if (signed_area(pts) > 0) != (signed_area(ring) > 0):
        ring.reverse()
    return [(round(x), round(y)) for x, y in ring]


def rebuild(font, name):
    glyph_set = font.getGlyphSet()
    upm = font["head"].unitsPerEm
    contours = contours_of(glyph_set, name)
    if not any(is_dot(c, upm) for c in contours):
        return False
    pen = TTGlyphPen(glyph_set)
    for c in contours:
        if is_dot(c, upm):
            ring = diamond(c)
            pen.moveTo(ring[0])
            for p in ring[1:]:
                pen.lineTo(p)
            pen.closePath()
        else:
            for op, args in c:
                getattr(pen, op)(*args)
    glyph = pen.glyph()
    glyph.recalcBounds(font["glyf"])
    font["glyf"][name] = glyph
    return True


def rename(font, style):
    family, ps = "WRLD Sans", f"WRLDSans-{style}"
    names = {
        0: "Copyright 2021 The Outfit Project Authors. Modifications copyright 2026 WRLD.",
        1: family if style in ("Regular", "Bold") else f"{family} {style}",
        2: style if style in ("Regular", "Bold") else "Regular",
        3: f"2026;WRLD;{ps}",
        4: f"{family} {style}",
        6: ps,
        16: family,
        17: style,
    }
    table = font["name"]
    for rec in list(table.names):
        if rec.nameID in (1, 2, 3, 4, 6, 16, 17, 21, 22, 25):
            table.removeNames(nameID=rec.nameID)
    for name_id, value in names.items():
        table.setName(value, name_id, 3, 1, 0x409)
        table.setName(value, name_id, 1, 0, 0)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for weight, style in WEIGHTS.items():
        font = TTFont(SRC / f"outfit-latin-{weight}-normal.woff2")
        targets = DOTTED + [g for g in font.getGlyphOrder() if g.startswith(MARK_PREFIXES)]
        changed = [g for g in targets if g in font.getGlyphOrder() and rebuild(font, g)]
        rename(font, style)
        font.flavor = "woff2"
        target = OUT / f"wrld-sans-{weight}.woff2"
        font.save(target)
        print(f"{target.name}: diamond dots in {len(changed)} glyphs ({', '.join(changed)})")
    license_text = (ROOT / "node_modules/@fontsource/outfit/LICENSE").read_text()
    (OUT / "OFL.txt").write_text(
        "WRLD Sans is a modified version of Outfit, renamed as the license requires.\n"
        "Modifications: round dots redrawn as diamonds.\n\n" + license_text
    )


if __name__ == "__main__":
    main()
