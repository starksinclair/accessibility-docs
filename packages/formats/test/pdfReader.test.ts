/**
 * PDF reader tests (FR-4.7, FR-4.8, T-1, T-2).
 *
 * The fixtures are tagged PDFs with real structure trees and parent trees
 * (see fixtures/generate-pdf.mjs), so what is tested here is the machinery a
 * faculty member's exported PDF actually carries.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { pdfToModel } from "../src/index.js";
import {
  checkPdfFixture,
  codes,
  FIXTURES,
  readPdf,
  readPdfFixture,
} from "./helpers.js";

const PASS = join(FIXTURES, "pdf", "pass", "tagged-handout.pdf");

describe("pdfToModel", () => {
  it("reads the title, the language and one section per page", async () => {
    const model = await readPdf(PASS);

    expect(model.source).toBe("pdf");
    expect(model.documentName).toBe("Photosynthesis handout");
    expect(model.flags).toEqual({
      tagged: true,
      hasText: true,
      language: "en-US",
    });

    const sections = model.nodes.filter((node) => node.type === "section");
    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({
      role: "page",
      title: "Photosynthesis",
      location: { page: 1 },
    });
  });

  it("maps the structure tree to headings, paragraphs, figures and tables", async () => {
    const model = await readPdf(PASS);

    expect(model.nodes.map((node) => node.type)).toEqual([
      "title",
      "section",
      "heading",
      "paragraph",
      "figure",
      "table",
    ]);

    const heading = model.nodes.find((node) => node.type === "heading");
    expect(heading).toMatchObject({ level: 1, text: "Photosynthesis" });

    const paragraph = model.nodes.find((node) => node.type === "paragraph");
    expect(paragraph).toMatchObject({
      text: "Light reactions happen in the thylakoid membrane.",
    });
  });

  it("reads /Alt as the figure's alt description", async () => {
    const model = await readPdf(PASS);
    const figure = model.nodes.find((node) => node.type === "figure");

    expect(figure).toMatchObject({
      altDescription: "Bar chart of light absorption by wavelength.",
      location: { page: 1 },
    });
  });

  it("addresses a figure by its marked-content id, so the writer can find it", async () => {
    const model = await readPdf(PASS);
    const figure = model.nodes.find((node) => node.type === "figure");

    expect(figure?.sourceRef).toBe("pdf:figure#page=1&mcid=2");
    // The address is also the figure's source: a PDF figure is a region of a
    // page, not a separate file, so there is nothing else to point at.
    expect(figure?.type === "figure" && figure.src).toBe(
      "pdf:figure#page=1&mcid=2"
    );
  });

  it("reads TH cells as headers and TD cells as data", async () => {
    const model = await readPdf(PASS);
    const table = model.nodes.find((node) => node.type === "table");

    expect(table?.type === "table" && table.rows).toEqual([
      {
        cells: [
          { text: "Stage", header: true, colspan: 1, rowspan: 1 },
          { text: "Location", header: true, colspan: 1, rowspan: 1 },
        ],
      },
      {
        cells: [
          { text: "Light reactions", header: false, colspan: 1, rowspan: 1 },
          { text: "Thylakoid", header: false, colspan: 1, rowspan: 1 },
        ],
      },
    ]);
  });

  it("falls back to the file name when the PDF has no /Title", async () => {
    const model = await readPdfFixture("A001", "fail", "no-document-title");

    expect(model.documentName).toBe("no-document-title");
    expect(model.nodes.some((node) => node.type === "title")).toBe(false);
  });

  /**
   * FR-4.8 — an untagged file still has to rank alongside the rest of a
   * batch, so it produces a model. What it must not do is invent structure
   * that is not in the file.
   */
  it("reads an untagged PDF as pages with no structure", async () => {
    const model = await readPdfFixture("A016", "fail", "untagged");

    expect(model.flags).toMatchObject({ tagged: false, hasText: true });
    expect(model.nodes.map((node) => node.type)).toEqual(["title", "section"]);
  });

  it("reports a scan as having no extractable text", async () => {
    const model = await readPdfFixture("A017", "fail", "scanned-pages");

    expect(model.flags).toMatchObject({ tagged: true, hasText: false });
  });

  it("refuses a file that is not a PDF", async () => {
    await expect(
      pdfToModel(new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00]))
    ).rejects.toThrow(/not a PDF/);
  });
});

/** T-1 / T-2: the fail file reports exactly its rule, the pass file nothing. */
interface FixturePair {
  code: string;
  fail: string;
  pass?: string;
  /** Codes the fail file reports besides `code`, with why. */
  alsoReports?: string[];
}

const FIXTURE_PAIRS: FixturePair[] = [
  { code: "A001", fail: "no-document-title", pass: "document-title" },
  { code: "A004", fail: "figure-without-alt", pass: "figure-with-alt" },
  {
    code: "A011",
    fail: "table-without-header-row",
    pass: "table-with-header-row",
  },
  { code: "A015", fail: "no-language", pass: "language-set" },
  {
    code: "A016",
    fail: "untagged",
    // An untagged file has no tagged figures, headings or tables to check, so
    // A016 is the whole report: everything else is unknowable until it is
    // tagged. A009 does not fire because the file has no blocks to navigate.
  },
  {
    code: "A017",
    fail: "scanned-pages",
    // A scan's one tagged figure does carry alt text, so the only other
    // finding is the one that matters: none of the text can be read.
  },
];

describe.each(FIXTURE_PAIRS)("$code", ({ code, fail, pass, alsoReports }) => {
  it(`reports ${code} on ${fail}`, async () => {
    const report = await checkPdfFixture(code, "fail", fail);

    expect(codes(report)).toEqual([code, ...(alsoReports ?? [])].sort());
  });

  if (pass) {
    it(`reports nothing on ${pass}`, async () => {
      const report = await checkPdfFixture(code, "pass", pass);

      expect(report.issues).toEqual([]);
    });
  }
});
