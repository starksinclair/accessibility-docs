/**
 * Reader tests (T-2): fixture in, expected DocumentModel shape and issue codes
 * out.
 */
import { runAccessibilityChecks } from "@accessibility-docs/core";
import type { DocumentModel, SectionNode } from "@accessibility-docs/core";
import { describe, expect, it } from "vitest";
import { FormatReadError, pptxToModel } from "../src/index.js";
import { codes, readFixture } from "./helpers.js";

function slides(model: DocumentModel): SectionNode[] {
  return model.nodes.filter(
    (node): node is SectionNode => node.type === "section"
  );
}

describe("pptxToModel", () => {
  it("marks the model as a deck and names it from dc:title (FR-4.4)", async () => {
    const model = await readFixture("A013", "pass", "every-slide-titled");

    expect(model.source).toBe("pptx");
    expect(model.documentName).toBe("BIO 101 Week 4");
    expect(model.nodes[0]).toMatchObject({
      type: "title",
      text: "BIO 101 Week 4",
      sourceRef: "docProps/core.xml#dc:title",
    });
  });

  it("falls back to the file name when the deck has no dc:title", async () => {
    const model = await readFixture("A001", "fail", "no-presentation-title");

    expect(model.documentName).toBe("no-presentation-title");
    // No title node means A001 fires, which is the point of the fixture.
    expect(model.nodes.some((node) => node.type === "title")).toBe(false);
  });

  it("emits one slide section per slide, in deck order (FR-4.1)", async () => {
    const model = await readFixture("A013", "pass", "every-slide-titled");
    const sections = slides(model);

    expect(sections).toHaveLength(3);
    expect(sections.map((section) => section.role)).toEqual([
      "slide",
      "slide",
      "slide",
    ]);
    expect(sections.map((section) => section.location?.page)).toEqual([
      1, 2, 3,
    ]);
    expect(sections.map((section) => section.title)).toEqual([
      "Week 4: Meiosis",
      "Week 4: Crossing over",
      "Week 4: Summary",
    ]);
    expect(sections.map((section) => section.sourceRef)).toEqual([
      "ppt/slides/slide1.xml",
      "ppt/slides/slide2.xml",
      "ppt/slides/slide3.xml",
    ]);
  });

  it("distinguishes a missing title placeholder from an empty one", async () => {
    const model = await readFixture("A013", "fail", "slides-without-titles");
    const sections = slides(model);

    expect(sections).toHaveLength(3);
    expect(sections[0].title).toBe("Week 4: Meiosis");
    // Slide 2 is a blank layout: there is no title shape to read at all.
    expect(sections[1].title).toBeUndefined();
    // Slide 3 has a title placeholder that was never filled in.
    expect(sections[2].title).toBe("");

    const report = runAccessibilityChecks(model);
    expect(
      report.issues
        .filter((issue) => issue.code === "A013")
        .map((issue) => issue.location?.page)
    ).toEqual([2, 3]);
  });

  it("carries a slide title as a heading so the deck is navigable", async () => {
    const model = await readFixture("A013", "pass", "every-slide-titled");
    const headings = model.nodes.filter((node) => node.type === "heading");

    expect(headings.map((heading) => heading.text)).toEqual([
      "Week 4: Meiosis",
      "Week 4: Crossing over",
      "Week 4: Summary",
    ]);
    // Empty titles are left out: A013 already reports them, and an empty
    // heading node would report the same gap again as A005.
    const untitled = await readFixture("A013", "fail", "slides-without-titles");
    expect(
      untitled.nodes.filter((node) => node.type === "heading")
    ).toHaveLength(1);
  });

  it("maps picture alt fields onto the figure node (FR-4.3)", async () => {
    const model = await readFixture("A004", "pass", "image-with-alt-description");
    const figure = model.nodes.find((node) => node.type === "figure");

    expect(figure).toMatchObject({
      type: "figure",
      altTitle: "Cell cycle diagram",
      altDescription: "The four phases of the cell cycle, in order.",
      src: "ppt/media/image1.png",
    });
  });

  it("leaves a missing alt field empty so the rules can see it", async () => {
    const model = await readFixture("A003", "fail", "image-without-alt-title");
    const figure = model.nodes.find((node) => node.type === "figure");

    expect(figure).toMatchObject({
      altTitle: "",
      altDescription: "Diagram of the cell cycle.",
    });
    expect(codes(runAccessibilityChecks(model))).toEqual(["A003"]);
  });

  it("converts shape geometry from EMU to points (FR-4.5)", async () => {
    const model = await readFixture("A004", "pass", "image-with-alt-description");
    const figure = model.nodes.find((node) => node.type === "figure");

    // The fixture places a 3in x 2in picture at 1in, 2in. 1in = 72pt.
    expect(figure?.location).toEqual({ page: 1, bbox: [72, 144, 216, 144] });
    expect(figure?.width).toBe(216);
    expect(figure?.height).toBe(144);
  });

  it("points sourceRef at the slide part and shape id (FR-2.1)", async () => {
    const model = await readFixture("A003", "fail", "image-without-alt-title");
    const figure = model.nodes.find((node) => node.type === "figure");

    expect(figure?.sourceRef).toMatch(/^ppt\/slides\/slide1\.xml#\d+$/);

    const report = runAccessibilityChecks(model);
    // FR-2.2: the issue carries the node's pointers through.
    expect(report.issues[0].sourceRef).toBe(figure?.sourceRef);
    expect(report.issues[0].location).toEqual(figure?.location);
  });

  it("reads a table's cells and its header row (FR-4.2)", async () => {
    const model = await readFixture("A011", "pass", "table-with-header-row");
    const table = model.nodes.find((node) => node.type === "table");

    expect(table?.rows).toHaveLength(3);
    expect(table?.rows[0].cells.map((cell) => cell.text)).toEqual([
      "Week",
      "Topic",
    ]);
    expect(table?.rows[0].cells.every((cell) => cell.header)).toBe(true);
    expect(table?.rows[1].cells.some((cell) => cell.header)).toBe(false);
  });

  it("reports a table with no header row as A011", async () => {
    const model = await readFixture("A011", "fail", "table-without-header-row");
    const table = model.nodes.find((node) => node.type === "table");

    expect(table?.rows[0].cells.every((cell) => !cell.header)).toBe(true);
    expect(codes(runAccessibilityChecks(model))).toEqual(["A011"]);
  });

  it("keeps the run formatting a slide actually states", async () => {
    const model = await readFixture("A002", "fail", "bold-text-as-heading");
    const paragraph = model.nodes.find(
      (node) => node.type === "paragraph" && node.text === "Phases of mitosis"
    );

    expect(paragraph?.type).toBe("paragraph");
    expect(paragraph && "formatting" in paragraph && paragraph.formatting).
      toMatchObject({ bold: true, fontSize: 20 });
  });

  it("rejects a legacy binary .ppt with the fix to make (FR-4.6)", async () => {
    // The OLE2 compound-file signature every binary .ppt starts with.
    const ole = new Uint8Array([
      0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, 0x00, 0x00,
    ]);

    await expect(pptxToModel(ole, { fileName: "lecture.ppt" })).rejects.toThrow(
      /Save as \.pptx in PowerPoint/
    );
    await expect(pptxToModel(ole)).rejects.toBeInstanceOf(FormatReadError);
  });

  it("rejects a file that is not a ZIP container at all (FR-6.2)", async () => {
    const pdf = new TextEncoder().encode("%PDF-1.7\n");

    await expect(pptxToModel(pdf, { fileName: "syllabus.pdf" })).rejects
      .toThrow(/not a PowerPoint/);
  });
});

describe("sniffFormat", () => {
  const zip = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

  it("recognises a .pptx by its ZIP signature plus its extension", async () => {
    const { sniffFormat } = await import("../src/index.js");

    expect(sniffFormat(zip, "lecture.pptx")).toBe("pptx");
    // The same signature with another name is a ZIP, not a deck: .docx and
    // .xlsx look identical this far in.
    expect(sniffFormat(zip, "lecture.docx")).toBe("zip");
  });

  it("recognises a PDF and a legacy .ppt whatever they are named", async () => {
    const { sniffFormat } = await import("../src/index.js");

    expect(sniffFormat(new TextEncoder().encode("%PDF-1.7"), "deck.pptx")).toBe(
      "pdf"
    );
    expect(
      sniffFormat(
        new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]),
        "deck.pptx"
      )
    ).toBe("legacy-ppt");
    expect(sniffFormat(new Uint8Array([1, 2, 3, 4]), "deck.pptx")).toBe(
      "unknown"
    );
  });
});
