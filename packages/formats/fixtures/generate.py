#!/usr/bin/env python3
"""
Regenerates the PPTX fixtures under packages/formats/fixtures (T-1).

The fixtures are committed, so this only needs to run when a fixture changes:

    python3 -m pip install --user python-pptx
    python3 packages/formats/fixtures/generate.py

python-pptx writes genuine PowerPoint packages — real slide masters, layouts
and placeholders — so the reader is tested against the same structure a faculty
member's deck has, not against hand-written XML that only looks close enough.

Layout indexes in the default template: 0 title slide, 1 title and content,
5 title only, 6 blank.
"""
from pathlib import Path
from typing import Optional

from pptx import Presentation
from pptx.util import Inches, Pt

FIXTURES = Path(__file__).resolve().parent

def bar_chart_png(width=320, height=200):
    """
    Draws a small bar chart as a PNG, with no third-party imaging library.

    The fixtures used to carry a 1x1 pixel, which is enough for the reader but
    useless in the Workbench viewer: a picture you cannot see tells you nothing
    about whether the preview works. This is a real image of a real size.
    """
    import struct
    import zlib

    background = (244, 242, 240)
    axis = (84, 88, 90)
    bar = (186, 12, 47)
    bars = [0.35, 0.55, 0.45, 0.8, 0.65]

    rows = []
    margin = 20
    plot_height = height - 2 * margin
    slot = (width - 2 * margin) // len(bars)

    for y in range(height):
        row = bytearray()
        for x in range(width):
            pixel = background
            if x == margin - 1 or y == height - margin:
                pixel = axis
            elif margin <= x < width - margin and margin <= y < height - margin:
                index = (x - margin) // slot
                if index < len(bars) and (x - margin) % slot < slot - 6:
                    top = height - margin - int(bars[index] * plot_height)
                    if y >= top:
                        pixel = bar
            row += bytes(pixel)
        rows.append(bytes(row))

    raw = b"".join(b"\x00" + row for row in rows)

    def chunk(kind, data):
        return (
            struct.pack(">I", len(data))
            + kind
            + data
            + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
        )

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )


PNG_PATH = FIXTURES / ".chart.png"


def deck(title: Optional[str] = None) -> Presentation:
    presentation = Presentation()
    presentation.core_properties.title = title or ""
    return presentation


def titled_slide(presentation, title_text: str, body_text: Optional[str] = None):
    """A 'Title and Content' slide with a filled title placeholder."""
    slide = presentation.slides.add_slide(presentation.slide_layouts[1])
    slide.shapes.title.text_frame.text = title_text
    body = slide.placeholders[1]
    body.text_frame.text = body_text or "Supporting detail for this slide."
    return slide


def untitled_slide(presentation, body_text: str):
    """A blank slide: no title placeholder at all, so A013 has nothing to read."""
    slide = presentation.slides.add_slide(presentation.slide_layouts[6])
    box = slide.shapes.add_textbox(Inches(1), Inches(1.5), Inches(8), Inches(2))
    box.text_frame.text = body_text
    return slide


def empty_title_slide(presentation, body_text: str):
    """A 'Title Only' slide whose title placeholder was never filled in."""
    slide = presentation.slides.add_slide(presentation.slide_layouts[5])
    slide.shapes.title.text_frame.text = ""
    box = slide.shapes.add_textbox(Inches(1), Inches(2.5), Inches(8), Inches(2))
    box.text_frame.text = body_text
    return slide


def set_alt(shape, alt_title: Optional[str], alt_description: Optional[str]):
    """
    Writes the alt fields the reader maps to A003 / A004 (FR-4.3).

    python-pptx has no API for either, so this sets the attributes on the
    picture's <p:cNvPr> directly — the same element PowerPoint's Alt Text pane
    writes to.
    """
    properties = shape._element._nvXxPr.cNvPr
    if alt_title is None:
        properties.attrib.pop("title", None)
    else:
        properties.set("title", alt_title)
    if alt_description is None:
        properties.attrib.pop("descr", None)
    else:
        properties.set("descr", alt_description)


def add_picture(slide, alt_title=None, alt_description=None):
    picture = slide.shapes.add_picture(
        str(PNG_PATH), Inches(1), Inches(2), Inches(3), Inches(2)
    )
    set_alt(picture, alt_title, alt_description)
    return picture


def add_table(slide, header: bool):
    rows, columns = 3, 2
    frame = slide.shapes.add_table(
        rows, columns, Inches(1), Inches(2), Inches(6), Inches(2)
    )
    table = frame.table
    table.first_row = header
    table.horz_banding = False
    data = [
        ["Week", "Topic"],
        ["1", "Cell structure"],
        ["2", "Mitosis"],
    ]
    for r, row in enumerate(data):
        for c, text in enumerate(row):
            table.cell(r, c).text_frame.text = text
    return frame


def bold_pseudo_heading(slide, text: str):
    box = slide.shapes.add_textbox(Inches(1), Inches(2), Inches(8), Inches(1))
    run = box.text_frame.paragraphs[0].add_run()
    run.text = text
    run.font.bold = True
    run.font.size = Pt(20)
    return box


def save(presentation, code: str, outcome: str, name: str):
    target = FIXTURES / code / outcome
    target.mkdir(parents=True, exist_ok=True)
    path = target / f"{name}.pptx"
    presentation.save(str(path))
    print(f"  {path.relative_to(FIXTURES.parent)}")


# --------------------------------------------------------------------------
# A001 — presentation has no document title (dc:title)
# --------------------------------------------------------------------------
def a001():
    fail = deck(title=None)
    titled_slide(fail, "Week 1: Cell structure")
    save(fail, "A001", "fail", "no-presentation-title")

    ok = deck(title="BIO 101 Week 1")
    titled_slide(ok, "Week 1: Cell structure")
    save(ok, "A001", "pass", "presentation-title")


# --------------------------------------------------------------------------
# A002 — bold, large body text standing in for a heading
# --------------------------------------------------------------------------
def a002():
    fail = deck(title="BIO 101 Week 2")
    slide = fail.slides.add_slide(fail.slide_layouts[5])
    slide.shapes.title.text_frame.text = "Week 2: Mitosis"
    bold_pseudo_heading(slide, "Phases of mitosis")
    save(fail, "A002", "fail", "bold-text-as-heading")

    ok = deck(title="BIO 101 Week 2")
    titled_slide(ok, "Week 2: Mitosis", "Prophase, metaphase, anaphase, telophase.")
    save(ok, "A002", "pass", "plain-body-text")


# --------------------------------------------------------------------------
# A004 — picture alt description
#
# There is deliberately no A003 fixture: that rule was withdrawn, because no
# WCAG success criterion asks for a second, shorter "alt title".
# --------------------------------------------------------------------------
def a004():
    fail = deck(title="BIO 101 Week 3")
    slide = titled_slide(fail, "Week 3: The cell cycle", "See the diagram below.")
    add_picture(slide, alt_title="Cell cycle diagram", alt_description=None)
    save(fail, "A004", "fail", "image-without-alt-description")

    ok = deck(title="BIO 101 Week 3")
    slide = titled_slide(ok, "Week 3: The cell cycle", "See the diagram below.")
    add_picture(
        slide,
        alt_title="Cell cycle diagram",
        alt_description="The four phases of the cell cycle, in order.",
    )
    save(ok, "A004", "pass", "image-with-alt-description")


# --------------------------------------------------------------------------
# A009 — a long deck with nothing to navigate by
# --------------------------------------------------------------------------
def a009():
    fail = deck(title="BIO 101 Review")
    for n in range(1, 8):
        untitled_slide(fail, f"Review point {n}: definitions and examples.")
    save(fail, "A009", "fail", "long-deck-without-titles")

    ok = deck(title="BIO 101 Review")
    for n in range(1, 8):
        titled_slide(ok, f"Review {n}: key terms", f"Review point {n}.")
    save(ok, "A009", "pass", "long-deck-with-titles")


# --------------------------------------------------------------------------
# A011 — table has no header row
# --------------------------------------------------------------------------
def a011():
    fail = deck(title="BIO 101 Schedule")
    slide = fail.slides.add_slide(fail.slide_layouts[5])
    slide.shapes.title.text_frame.text = "Semester schedule"
    add_table(slide, header=False)
    save(fail, "A011", "fail", "table-without-header-row")

    ok = deck(title="BIO 101 Schedule")
    slide = ok.slides.add_slide(ok.slide_layouts[5])
    slide.shapes.title.text_frame.text = "Semester schedule"
    add_table(slide, header=True)
    save(ok, "A011", "pass", "table-with-header-row")


# --------------------------------------------------------------------------
# A013 — slide has no title
# --------------------------------------------------------------------------
def a013():
    fail = deck(title="BIO 101 Week 4")
    titled_slide(fail, "Week 4: Meiosis")
    untitled_slide(fail, "No title placeholder on this slide at all.")
    empty_title_slide(fail, "Title placeholder present but never filled in.")
    save(fail, "A013", "fail", "slides-without-titles")

    ok = deck(title="BIO 101 Week 4")
    titled_slide(ok, "Week 4: Meiosis")
    titled_slide(ok, "Week 4: Crossing over")
    titled_slide(ok, "Week 4: Summary")
    save(ok, "A013", "pass", "every-slide-titled")


# --------------------------------------------------------------------------
# A014 — repeated slide titles
# --------------------------------------------------------------------------
def a014():
    fail = deck(title="BIO 101 Week 5")
    for _ in range(3):
        titled_slide(fail, "Agenda")
    titled_slide(fail, "Week 5: Genetics")
    save(fail, "A014", "fail", "duplicate-slide-titles")

    ok = deck(title="BIO 101 Week 5")
    titled_slide(ok, "Agenda")
    titled_slide(ok, "Week 5: Genetics")
    titled_slide(ok, "Week 5: Punnett squares")
    save(ok, "A014", "pass", "distinct-slide-titles")


# --------------------------------------------------------------------------
# Ranking decks with known counts (T-4)
# --------------------------------------------------------------------------
def ranking():
    target = FIXTURES / "ranking"
    target.mkdir(parents=True, exist_ok=True)

    # Clean: a titled, described, header-rowed deck with a document title.
    clean = deck(title="BIO 101 Syllabus")
    slide = titled_slide(clean, "Course overview", "Goals, grading and contact.")
    add_picture(
        slide,
        alt_title="Course map",
        alt_description="A map of the four course units and their due dates.",
    )
    slide = clean.slides.add_slide(clean.slide_layouts[5])
    slide.shapes.title.text_frame.text = "Semester schedule"
    add_table(slide, header=True)
    clean.save(str(target / "clean-syllabus.pptx"))
    print(f"  {(target / 'clean-syllabus.pptx').relative_to(FIXTURES.parent)}")

    # Middling: one image missing its description, one unheadered table.
    middling = deck(title="BIO 101 Lab 3")
    slide = titled_slide(middling, "Lab 3: Microscopy", "Follow the steps in order.")
    add_picture(slide, alt_title="Microscope", alt_description=None)
    slide = middling.slides.add_slide(middling.slide_layouts[5])
    slide.shapes.title.text_frame.text = "Lab 3: Results table"
    add_table(slide, header=False)
    middling.save(str(target / "lab-three.pptx"))
    print(f"  {(target / 'lab-three.pptx').relative_to(FIXTURES.parent)}")

    # Worst: no document title, untitled slides, repeated titles, bare images.
    worst = deck(title=None)
    for n in range(1, 4):
        slide = untitled_slide(worst, f"Lecture point {n}.")
        add_picture(slide, alt_title=None, alt_description=None)
    titled_slide(worst, "Summary")
    titled_slide(worst, "Summary")
    worst.save(str(target / "legacy-lecture.pptx"))
    print(f"  {(target / 'legacy-lecture.pptx').relative_to(FIXTURES.parent)}")


def main():
    PNG_PATH.write_bytes(bar_chart_png())
    try:
        print("Writing fixtures:")
        a001()
        a002()
        a004()
        a009()
        a011()
        a013()
        a014()
        ranking()
    finally:
        PNG_PATH.unlink(missing_ok=True)


if __name__ == "__main__":
    main()
