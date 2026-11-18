/**
 * PDF writer tests (FR-5.6 to FR-5.10, T-3).
 *
 * Every test re-reads the written file with `pdfToModel` and re-runs the
 * rules, which is the only check that matters: a fix that does not change
 * what the reader sees has not been applied, whatever the writer reported.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runAccessibilityChecks } from "@accessibility-docs/core";
import type { AccessibilityReport, DocumentModel } from "@accessibility-docs/core";
import { describe, expect, it } from "vitest";
import { applyPdfFixes, pdfToModel, type PdfFix } from "../src/index.js";
import { codes, FIXTURES } from "./helpers.js";

async function fixture(path: string): Promise<Uint8Array> {
  return new Uint8Array(await readFile(join(FIXTURES, "pdf", path)));
}

interface Rewritten {
  model: DocumentModel;
  report: AccessibilityReport;
  applied: number;
  skipped: { reason: string }[];
}

/** Applies fixes, then reads the result back the way the Workbench does. */
async function rewrite(
  path: string,
  fixes: PdfFix[],
  fileName = "handout.pdf"
): Promise<Rewritten> {
  const original = await fixture(path);
  const result = await applyPdfFixes(original, fixes);
  const model = await pdfToModel(result.bytes, { fileName });

  return {
    model,
    report: runAccessibilityChecks(model),
    applied: result.applied.length,
    skipped: result.skipped,
  };
}

describe("applyPdfFixes", () => {
  it("never modifies the file it was given", async () => {
    const original = await fixture("A001/fail/no-document-title.pdf");
    const before = original.slice();

    await applyPdfFixes(original, [
      { kind: "document-title", title: "Photosynthesis handout" },
    ]);

    expect(original).toEqual(before);
  });

  /** FR-5.6 — A001 is gone, and the title is the one that was written. */
  it("writes the document title", async () => {
    const { model, report, applied } = await rewrite(
      "A001/fail/no-document-title.pdf",
      [{ kind: "document-title", title: "Photosynthesis handout" }]
    );

    expect(applied).toBe(1);
    expect(codes(report)).toEqual([]);
    expect(model.documentName).toBe("Photosynthesis handout");
    expect(model.nodes[0]).toMatchObject({
      type: "title",
      text: "Photosynthesis handout",
    });
  });

  it("refuses an empty document title", async () => {
    const { applied, skipped } = await rewrite(
      "A001/fail/no-document-title.pdf",
      [{ kind: "document-title", title: "   " }]
    );

    expect(applied).toBe(0);
    expect(skipped[0].reason).toMatch(/cannot be empty/);
  });

  /** FR-5.7 — A015 is gone and the language reads back off the catalog. */
  it("writes the document language", async () => {
    const { model, report, applied } = await rewrite("A015/fail/no-language.pdf", [
      { kind: "document-language", language: "en-US" },
    ]);

    expect(applied).toBe(1);
    expect(codes(report)).toEqual([]);
    expect(model.flags?.language).toBe("en-US");
  });

  it("refuses something that is not a language tag", async () => {
    const { applied, skipped } = await rewrite("A015/fail/no-language.pdf", [
      { kind: "document-language", language: "English please" },
    ]);

    expect(applied).toBe(0);
    expect(skipped[0].reason).toMatch(/not a language tag/);
  });

  /** FR-5.8 — the description lands on the figure the finding pointed at. */
  it("writes alt text onto the figure the reader addressed", async () => {
    const original = await fixture("A004/fail/figure-without-alt.pdf");
    const before = await pdfToModel(original, { fileName: "handout.pdf" });
    const figure = before.nodes.find((node) => node.type === "figure");

    expect(figure?.sourceRef).toBeDefined();

    const { model, report, applied } = await rewrite(
      "A004/fail/figure-without-alt.pdf",
      [
        {
          kind: "alt-text",
          sourceRef: figure?.sourceRef ?? "",
          description: "Bar chart of light absorption by wavelength.",
        },
      ]
    );

    expect(applied).toBe(1);
    expect(codes(report)).toEqual([]);
    expect(model.nodes.find((node) => node.type === "figure")).toMatchObject({
      altDescription: "Bar chart of light absorption by wavelength.",
    });
  });

  it("keeps the rest of the document intact when it writes alt text", async () => {
    const { model } = await rewrite("A004/fail/figure-without-alt.pdf", [
      {
        kind: "alt-text",
        sourceRef: "pdf:figure#page=1&mcid=2",
        description: "Bar chart of light absorption by wavelength.",
      },
    ]);

    expect(model.nodes.map((node) => node.type)).toEqual([
      "title",
      "section",
      "heading",
      "paragraph",
      "figure",
      "table",
    ]);
    expect(model.nodes.find((node) => node.type === "table")).toMatchObject({
      rows: [
        {
          cells: [
            { text: "Stage", header: true },
            { text: "Location", header: true },
          ],
        },
        {
          cells: [
            { text: "Light reactions", header: false },
            { text: "Thylakoid", header: false },
          ],
        },
      ],
    });
  });

  it("refuses empty alt text rather than writing a blank description", async () => {
    const { applied, skipped } = await rewrite(
      "A004/fail/figure-without-alt.pdf",
      [{ kind: "alt-text", sourceRef: "pdf:figure#page=1&mcid=2", description: " " }]
    );

    expect(applied).toBe(0);
    expect(skipped[0].reason).toMatch(/cannot be empty/);
  });

  it("will not put alt text on an element that is not a figure", async () => {
    const { applied, skipped } = await rewrite(
      "A004/fail/figure-without-alt.pdf",
      [
        {
          // mcid 0 is the page's H1.
          kind: "alt-text",
          sourceRef: "pdf:figure#page=1&mcid=0",
          description: "Not a figure.",
        },
      ]
    );

    expect(applied).toBe(0);
    expect(skipped[0].reason).toMatch(/not tagged as a figure/);
  });

  /**
   * FR-5.10 — an untagged PDF has nowhere to put a description, so the writer
   * says what the file needs instead of reporting a fix that changed nothing.
   */
  it("refuses alt text on an untagged PDF and says what it needs", async () => {
    const { applied, skipped } = await rewrite("A016/fail/untagged.pdf", [
      {
        kind: "alt-text",
        sourceRef: "pdf:figure#page=1&mcid=2",
        description: "Bar chart.",
      },
    ]);

    expect(applied).toBe(0);
    expect(skipped[0].reason).toMatch(/needs full tagging/);
  });

  /**
   * FR-5.10a — the title and the language are document properties, not
   * structure, so they are still written on an untagged file. A016 stays:
   * nothing here claims the file is now tagged.
   */
  it("still writes the title and language of an untagged PDF", async () => {
    const { model, report, applied } = await rewrite("A016/fail/untagged.pdf", [
      { kind: "document-title", title: "Scanned lecture notes" },
      { kind: "document-language", language: "en-US" },
    ]);

    expect(applied).toBe(2);
    expect(model.documentName).toBe("Scanned lecture notes");
    expect(model.flags?.language).toBe("en-US");
    expect(codes(report)).toEqual(["A016"]);
  });

  it("applies what it can and reports what it could not", async () => {
    const { applied, skipped, report } = await rewrite(
      "A004/fail/figure-without-alt.pdf",
      [
        { kind: "document-title", title: "Photosynthesis handout" },
        {
          kind: "alt-text",
          sourceRef: "pdf:figure#page=9&mcid=2",
          description: "A figure on a page that does not exist.",
        },
      ]
    );

    expect(applied).toBe(1);
    expect(skipped).toHaveLength(1);
    expect(skipped[0].reason).toMatch(/not in this PDF/);
    expect(codes(report)).toEqual(["A004"]);
  });

  it("refuses a file that is not a PDF", async () => {
    await expect(
      applyPdfFixes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), [])
    ).rejects.toThrow(/not a PDF/);
  });

  /**
   * FR-5.9 — the first row's `/TD` cells become `/TH`, which clears A011 when
   * the file is read back.
   */
  it("promotes the first row of a table to header cells", async () => {
    const original = await fixture("A011/fail/table-without-header-row.pdf");
    const before = await pdfToModel(original, { fileName: "handout.pdf" });
    const table = before.nodes.find((node) => node.type === "table");

    expect(table?.sourceRef).toMatch(/^pdf:table#/);
    expect(codes(runAccessibilityChecks(before))).toContain("A011");

    const { model, report, applied } = await rewrite(
      "A011/fail/table-without-header-row.pdf",
      [{ kind: "table-header", sourceRef: table?.sourceRef ?? "" }]
    );

    expect(applied).toBe(1);
    expect(codes(report)).not.toContain("A011");
    expect(model.nodes.find((node) => node.type === "table")).toMatchObject({
      rows: [
        {
          cells: [
            { text: "Stage", header: true },
            { text: "Location", header: true },
          ],
        },
        {
          cells: [
            { text: "Light reactions", header: false },
            { text: "Thylakoid", header: false },
          ],
        },
      ],
    });
  });

  it("refuses a table-header fix on an untagged PDF", async () => {
    const { applied, skipped } = await rewrite("A016/fail/untagged.pdf", [
      { kind: "table-header", sourceRef: "pdf:table#page=1&ordinal=1" },
    ]);

    expect(applied).toBe(0);
    expect(skipped[0].reason).toMatch(/needs full tagging/);
  });
});
