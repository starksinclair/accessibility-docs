#!/usr/bin/env node
/**
 * Regenerates the PDF fixtures under packages/formats/fixtures/pdf (T-1).
 *
 * The fixtures are committed, so this only needs to run when a fixture
 * changes:
 *
 *     node packages/formats/fixtures/generate-pdf.mjs
 *
 * The PPTX fixtures are written by python-pptx, which produces a genuine
 * PowerPoint package. There is no equivalent for tagged PDFs: the libraries
 * that write PDFs either do not tag at all, or tag only what their own layout
 * engine drew. So these are built with pdf-lib's low-level object access —
 * real structure trees, parent trees and marked content, assembled the way the
 * PDF specification defines them, because that is exactly the machinery the
 * reader (FR-4.7) and the writer (FR-5.8) have to handle.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFOperator,
  PDFOperatorNames as Ops,
  PDFString,
  StandardFonts,
} from "pdf-lib";

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "pdf");

/**
 * Builds one tagged page, and the structure tree that describes it.
 *
 * `content` is a list of what to put on the page, in reading order. Each entry
 * becomes a marked-content sequence on the page and a structure element that
 * points at it, which is the pairing a screen reader follows.
 */
async function buildPdf({ title, language, tagged = true, content }) {
  const doc = await PDFDocument.create();
  doc.setProducer("accessibility-docs fixtures");
  doc.setCreator("accessibility-docs fixtures");
  if (title !== undefined) {
    doc.setTitle(title);
  }

  const font = await doc.embedFont(StandardFonts.Helvetica);
  const page = doc.addPage([612, 792]);
  const context = doc.context;

  let mcid = 0;
  let y = 720;
  /** One entry per marked-content id: how to tag it, and its structure. */
  const tags = [];

  const draw = (entry) => {
    const id = mcid++;

    if (tagged) {
      page.pushOperators(
        PDFOperator.of(Ops.BeginMarkedContentSequence, [
          PDFName.of(entry.tag),
          `<</MCID ${id}>>`,
        ])
      );
    }

    if (entry.kind === "image") {
      // A figure does not have to be an image XObject to be tagged as one; a
      // drawn shape is a figure as far as the structure tree is concerned,
      // and it keeps the fixture to a few hundred bytes.
      page.drawRectangle({
        x: 72,
        y: y - 120,
        width: 200,
        height: 120,
        borderWidth: 1,
      });
      y -= 150;
    } else {
      page.drawText(entry.text, {
        x: 72,
        y,
        size: entry.size ?? 12,
        font,
      });
      y -= (entry.size ?? 12) + 12;
    }

    if (tagged) {
      page.pushOperators(PDFOperator.of(Ops.EndMarkedContent));
    }

    return id;
  };

  /** Walks the fixture's description, drawing as it goes. */
  const render = (entries) =>
    entries.map((entry) => {
      if (entry.kind === "table") {
        return {
          ...entry,
          rows: entry.rows.map((row) =>
            row.map((cell) => ({
              ...cell,
              mcid: draw({ tag: cell.header ? "TH" : "TD", text: cell.text }),
            }))
          ),
        };
      }
      return { ...entry, mcid: draw(entry) };
    });

  const rendered = render(content);

  const catalog = doc.catalog;
  if (language !== undefined) {
    catalog.set(PDFName.of("Lang"), PDFString.of(language));
  }
  // FR-5.6 — without this a reader announces the file name instead of the
  // title, so a fixture that is meant to pass has to set it.
  catalog.set(
    PDFName.of("ViewerPreferences"),
    context.obj({ DisplayDocTitle: true })
  );

  if (!tagged) {
    // FR-4.8 — no structure tree and no /MarkInfo: this is the "re-export it
    // with tagging on" case (A016). Everything else about the file is in
    // order, so A016 is the only finding it should produce.
    return doc.save();
  }

  const structTreeRef = context.nextRef();
  const parentTreeRef = context.nextRef();
  const documentRef = context.nextRef();

  /** Structure elements in marked-content order, for the parent tree. */
  const byMcid = [];

  const elementFor = (entry, parentRef) => {
    const ref = context.nextRef();

    if (entry.kind === "table") {
      const rowRefs = entry.rows.map((row) => {
        const rowRef = context.nextRef();
        const cellRefs = row.map((cell) => {
          const cellRef = context.nextRef();
          const dict = {
            Type: PDFName.of("StructElem"),
            S: PDFName.of(cell.header ? "TH" : "TD"),
            P: rowRef,
            Pg: page.ref,
            K: PDFNumber.of(cell.mcid),
          };
          if (cell.header) {
            dict.A = context.obj({
              O: PDFName.of("Table"),
              Scope: PDFName.of("Column"),
            });
          }
          context.assign(cellRef, context.obj(dict));
          byMcid[cell.mcid] = cellRef;
          return cellRef;
        });

        context.assign(
          rowRef,
          context.obj({
            Type: PDFName.of("StructElem"),
            S: PDFName.of("TR"),
            P: ref,
            K: cellRefs,
          })
        );
        return rowRef;
      });

      context.assign(
        ref,
        context.obj({
          Type: PDFName.of("StructElem"),
          S: PDFName.of("Table"),
          P: parentRef,
          K: rowRefs,
        })
      );
      return ref;
    }

    const dict = {
      Type: PDFName.of("StructElem"),
      S: PDFName.of(entry.role),
      P: parentRef,
      Pg: page.ref,
      K: PDFNumber.of(entry.mcid),
    };

    if (entry.alt !== undefined) {
      dict.Alt = PDFHexString.fromText(entry.alt);
    }

    context.assign(ref, context.obj(dict));
    byMcid[entry.mcid] = ref;
    return ref;
  };

  const childRefs = rendered.map((entry) => elementFor(entry, documentRef));

  context.assign(
    documentRef,
    context.obj({
      Type: PDFName.of("StructElem"),
      S: PDFName.of("Document"),
      P: structTreeRef,
      K: childRefs,
    })
  );

  // The parent tree maps a page's marked-content ids back to the structure
  // elements that own them. This is the lookup the writer uses to find a
  // figure from its MCID (FR-5.8), so the fixtures have to carry a real one.
  context.assign(
    parentTreeRef,
    context.obj({
      Nums: [PDFNumber.of(0), byMcid.map((ref) => ref ?? PDFName.of("Null"))],
    })
  );

  context.assign(
    structTreeRef,
    context.obj({
      Type: PDFName.of("StructTreeRoot"),
      K: [documentRef],
      ParentTree: parentTreeRef,
      ParentTreeNextKey: PDFNumber.of(1),
    })
  );

  page.node.set(PDFName.of("StructParents"), PDFNumber.of(0));

  catalog.set(PDFName.of("StructTreeRoot"), structTreeRef);
  catalog.set(PDFName.of("MarkInfo"), context.obj({ Marked: true }));

  return doc.save();
}

/** A lecture handout: a heading, a paragraph, a figure and a table. */
function handout({ alt, header }) {
  return [
    { kind: "text", role: "H1", tag: "H1", text: "Photosynthesis", size: 20 },
    {
      kind: "text",
      role: "P",
      tag: "P",
      text: "Light reactions happen in the thylakoid membrane.",
    },
    { kind: "image", role: "Figure", tag: "Figure", ...(alt ? { alt } : {}) },
    {
      kind: "table",
      rows: [
        [
          { text: "Stage", header },
          { text: "Location", header },
        ],
        [
          { text: "Light reactions", header: false },
          { text: "Thylakoid", header: false },
        ],
      ],
    },
  ];
}

const FILES = [
  {
    path: "pass/tagged-handout.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    path: "A001/fail/no-document-title.pdf",
    options: {
      language: "en-US",
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    path: "A001/pass/document-title.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    path: "A004/fail/figure-without-alt.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      content: handout({ header: true }),
    },
  },
  {
    path: "A004/pass/figure-with-alt.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    path: "A011/fail/table-without-header-row.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      content: handout({
        alt: "Bar chart of light absorption by wavelength.",
        header: false,
      }),
    },
  },
  {
    path: "A011/pass/table-with-header-row.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    path: "A015/fail/no-language.pdf",
    options: {
      title: "Photosynthesis handout",
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    path: "A015/pass/language-set.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    path: "A016/fail/untagged.pdf",
    options: {
      title: "Photosynthesis handout",
      language: "en-US",
      tagged: false,
      content: handout({ alt: "Bar chart of light absorption by wavelength.", header: true }),
    },
  },
  {
    // A scan: the page carries a picture of text, so there is structure but
    // nothing a screen reader can read (A017).
    path: "A017/fail/scanned-pages.pdf",
    options: {
      title: "Scanned handout",
      language: "en-US",
      content: [
        {
          kind: "image",
          role: "Figure",
          tag: "Figure",
          alt: "Scan of page 1 of the handout.",
        },
      ],
    },
  },
];

for (const { path, options } of FILES) {
  const target = join(FIXTURES, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, await buildPdf(options));
  console.log(`wrote ${path}`);
}
