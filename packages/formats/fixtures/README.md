# Fixtures

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
| A015 to A017 | PDF-only rules (`appliesTo: "pdf"`). They have PDF fixtures instead; see below. |

## PDF fixtures

Layout: `fixtures/pdf/pass/tagged-handout.pdf` is the file every check should
pass, and `fixtures/pdf/<ruleCode>/<fail|pass>/` holds the pair for one rule,
the same way the PPTX fixtures are laid out.

They are written by pdf-lib's low-level object access
(`fixtures/generate-pdf.mjs`) rather than by a PDF library's layout engine.
There is no python-pptx for tagged PDFs: the tools that write PDFs either do
not tag at all, or tag only what they drew themselves. So each fixture
assembles the real machinery the reader and writer have to handle — a structure
tree, a parent tree, marked-content sequences on the page, `/Alt` on a figure,
`/TH` against `/TD`, `/Lang` on the catalog — as the PDF specification defines
them. Committed, so this only needs running when a fixture changes:

```bash
node packages/formats/fixtures/generate-pdf.mjs
```

| File | What it is for |
| --- | --- |
| `pass/tagged-handout.pdf` | A one-page handout with a title, a language, an `H1`, a `P`, a `Figure` with `/Alt` and a table with a `/TH` header row. Reports nothing. |
| `A001`, `A004`, `A011`, `A015` | One pair each: the same handout with its `/Title`, its figure's `/Alt`, its header row or its `/Lang` taken away. |
| `A016/fail/untagged.pdf` | The same content with no structure tree and no `/MarkInfo`. Everything else is in order, so A016 is the only finding. |
| `A017/fail/scanned-pages.pdf` | A tagged page whose only content is a figure: structure, but no text a screen reader can read. |

A016 and A017 have no `pass` half of their own: `pass/tagged-handout.pdf` is
it, and the paired rules above already cover a tagged file that reports
nothing. A005, A006, A010 and A012 have no PDF `fail` fixture — an empty
heading, a level skip and a ragged table all need a PDF tagged by hand to be
wrong in one specific way, and the reader paths they exercise are shared with
the PPTX side.
