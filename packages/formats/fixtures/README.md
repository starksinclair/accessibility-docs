# PPTX fixtures

Layout (T-1): `fixtures/<ruleCode>/fail/` holds decks that must report that
rule, `fixtures/<ruleCode>/pass/` decks that must report nothing at all. The
`pass` half is what keeps the reader honest — a reader that dropped alt text or
invented an empty paragraph would fail there.

`fixtures/ranking/` holds three decks with known issue counts for the ranking
test (T-4): a clean syllabus, a middling lab handout, and a legacy lecture with
untitled slides and bare images.

Every file is a real PowerPoint package written by
[python-pptx](https://python-pptx.readthedocs.io), so the reader is tested
against the slide masters, layouts and placeholders a faculty member's deck
actually has. They are committed, so you only need to regenerate them when a
fixture changes:

```bash
python3 -m pip install --user python-pptx
python3 packages/formats/fixtures/generate.py
```

## Rules without a PPTX fixture yet

| Rule | Why |
| --- | --- |
| A003 | Withdrawn; see `RETIRED_RULES` in core. |
| A005, A006 | Headings in a deck come from slide titles, which the reader emits at one level and never empty, so neither an empty heading nor a level skip can occur. |
| A007 | Needs a picture whose image relationship is broken. It lands with the PPTX writer round-trip tests (T-3). |
| A008 | Only fires when the deck has no `dc:title` *and* no file name; the Workbench always passes the uploaded file's name. |
| A010, A012 | Need a table with no rows or ragged rows, which PowerPoint itself will not author. They land with the writer tests. |
| A015 to A017 | PDF-only rules (`appliesTo: "pdf"`). Their fixtures arrive with the PDF reader. |
