/**
 * Writer round-trip tests (T-3): fixture → apply fix → read the output back →
 * the issue is gone.
 *
 * Reading the output back with the real reader is the whole point. A writer
 * test that only grepped the XML would pass on markup PowerPoint refuses to
 * open; this proves the package still parses as a deck and that the rules
 * engine agrees the problem is fixed.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { runAccessibilityChecks } from "@accessibility-docs/core";
import type { AccessibilityIssue, DocumentModel } from "@accessibility-docs/core";
import { describe, expect, it } from "vitest";
import { applyPptxFixes, pptxToModel, type PptxFix } from "../src/index.js";
import { FIXTURES } from "./helpers.js";

async function fixtureBytes(
  code: string,
  outcome: "fail" | "pass",
  name: string
): Promise<Uint8Array> {
  return new Uint8Array(
    await readFile(join(FIXTURES, code, outcome, `${name}.pptx`))
  );
}

async function check(bytes: Uint8Array, fileName: string) {
  const model = await pptxToModel(bytes, { fileName });
  return { model, report: runAccessibilityChecks(model) };
}

function codesOf(issues: AccessibilityIssue[]): string[] {
  return [...new Set(issues.map((issue) => issue.code))].sort();
}

function issueOf(
  report: { issues: AccessibilityIssue[] },
  code: string
): AccessibilityIssue {
  const issue = report.issues.find((candidate) => candidate.code === code);
  if (!issue) {
    throw new Error(`Expected the fixture to report ${code}`);
  }
  return issue;
}

function figureOf(model: DocumentModel) {
  const figure = model.nodes.find((node) => node.type === "figure");
  if (!figure || figure.type !== "figure") {
    throw new Error("Expected the fixture to contain a picture");
  }
  return figure;
}

describe("applyPptxFixes — alt text (FR-5.1)", () => {
  it("writes an alt description, and the issue is gone", async () => {
    const original = await fixtureBytes(
      "A004",
      "fail",
      "image-without-alt-description"
    );
    const before = await check(original, "deck.pptx");
    const issue = issueOf(before.report, "A004");

    const result = await applyPptxFixes(original, [
      {
        kind: "alt-text",
        sourceRef: issue.sourceRef!,
        description: "The four phases of the cell cycle, in order.",
      },
    ]);

    expect(result.skipped).toEqual([]);
    const after = await check(result.bytes, "deck.pptx");

    expect(codesOf(after.report.issues)).toEqual([]);
    expect(figureOf(after.model).altDescription).toBe(
      "The four phases of the cell cycle, in order."
    );
    // The legacy title field is left exactly as it was.
    expect(figureOf(after.model).altTitle).toBe(
      figureOf(before.model).altTitle
    );
  });

  it("escapes text that would otherwise break the XML", async () => {
    const original = await fixtureBytes(
      "A004",
      "fail",
      "image-without-alt-description"
    );
    const issue = issueOf((await check(original, "d.pptx")).report, "A004");
    const nasty = 'Growth > 50% & "falling" <see slide 4>';

    const result = await applyPptxFixes(original, [
      { kind: "alt-text", sourceRef: issue.sourceRef!, description: nasty },
    ]);
    const after = await check(result.bytes, "d.pptx");

    expect(figureOf(after.model).altDescription).toBe(nasty);
  });

  it("refuses an empty description instead of writing one", async () => {
    const original = await fixtureBytes(
      "A004",
      "fail",
      "image-without-alt-description"
    );
    const issue = issueOf((await check(original, "d.pptx")).report, "A004");

    const result = await applyPptxFixes(original, [
      { kind: "alt-text", sourceRef: issue.sourceRef!, description: "   " },
    ]);

    expect(result.applied).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/cannot be empty/);
    // The file still comes back, unchanged, rather than being lost.
    expect(codesOf((await check(result.bytes, "d.pptx")).report.issues)).toEqual(
      ["A004"]
    );
  });

  it("reports a fix whose shape is no longer there", async () => {
    const original = await fixtureBytes(
      "A004",
      "fail",
      "image-without-alt-description"
    );

    const result = await applyPptxFixes(original, [
      {
        kind: "alt-text",
        sourceRef: "ppt/slides/slide1.xml#9999",
        description: "Anything.",
      },
    ]);

    expect(result.applied).toEqual([]);
    expect(result.skipped[0].reason).toMatch(/no longer on the slide/);
  });
});

describe("applyPptxFixes — slide titles (FR-5.2, FR-5.5)", () => {
  it("fills a title placeholder that was left empty", async () => {
    const original = await fixtureBytes("A013", "fail", "slides-without-titles");
    const before = await check(original, "deck.pptx");

    // Slide 3 is the one with an empty title placeholder.
    const issue = before.report.issues.find(
      (candidate) => candidate.code === "A013" && candidate.location?.page === 3
    )!;

    const result = await applyPptxFixes(original, [
      {
        kind: "slide-title",
        sourceRef: issue.sourceRef!,
        title: "Week 4: Crossing over",
      },
    ]);

    expect(result.skipped).toEqual([]);
    expect(result.notes).toEqual([]);

    const after = await check(result.bytes, "deck.pptx");
    const slides = after.model.nodes.filter((node) => node.type === "section");

    expect(slides[2].type === "section" && slides[2].title).toBe(
      "Week 4: Crossing over"
    );
    expect(
      after.report.issues.filter(
        (candidate) =>
          candidate.code === "A013" && candidate.location?.page === 3
      )
    ).toEqual([]);
  });

  it("adds a title placeholder to a slide that has none", async () => {
    const original = await fixtureBytes("A013", "fail", "slides-without-titles");
    const before = await check(original, "deck.pptx");

    // Slide 2 is a blank layout: there is no title shape at all.
    const issue = before.report.issues.find(
      (candidate) => candidate.code === "A013" && candidate.location?.page === 2
    )!;

    const result = await applyPptxFixes(original, [
      {
        kind: "slide-title",
        sourceRef: issue.sourceRef!,
        title: "Week 4: Meiosis in detail",
      },
    ]);

    expect(result.skipped).toEqual([]);
    // The user is told the placeholder is off the visible slide (FR-5.5).
    expect(result.notes[0]).toMatch(/off the edge of the slide/);

    const after = await check(result.bytes, "deck.pptx");
    const slides = after.model.nodes.filter((node) => node.type === "section");

    expect(slides[1].type === "section" && slides[1].title).toBe(
      "Week 4: Meiosis in detail"
    );
    expect(
      after.report.issues.filter(
        (candidate) =>
          candidate.code === "A013" && candidate.location?.page === 2
      )
    ).toEqual([]);
    // The slide keeps the content it already had.
    expect(
      after.model.nodes.some(
        (node) =>
          node.type === "paragraph" &&
          node.text === "No title placeholder on this slide at all."
      )
    ).toBe(true);
  });

  it("gives the inserted placeholder an id nothing else is using", async () => {
    const original = await fixtureBytes("A013", "fail", "slides-without-titles");
    const before = await check(original, "deck.pptx");
    const issue = before.report.issues.find(
      (candidate) => candidate.code === "A013" && candidate.location?.page === 2
    )!;

    const result = await applyPptxFixes(original, [
      { kind: "slide-title", sourceRef: issue.sourceRef!, title: "A title" },
    ]);
    const after = await check(result.bytes, "deck.pptx");

    const refs = after.model.nodes
      .filter((node) => node.location?.page === 2 && node.sourceRef)
      .map((node) => node.sourceRef);

    expect(new Set(refs).size).toBe(refs.length);
  });

  it("fixes every untitled slide in one pass", async () => {
    const original = await fixtureBytes("A013", "fail", "slides-without-titles");
    const before = await check(original, "deck.pptx");

    const fixes: PptxFix[] = before.report.issues
      .filter((issue) => issue.code === "A013")
      .map((issue, index) => ({
        kind: "slide-title",
        sourceRef: issue.sourceRef!,
        title: `Generated title ${index + 1}`,
      }));

    const result = await applyPptxFixes(original, fixes);
    const after = await check(result.bytes, "deck.pptx");

    expect(result.applied).toHaveLength(2);
    expect(codesOf(after.report.issues)).toEqual([]);
  });
});

describe("applyPptxFixes — tables and document title (FR-5.3, FR-5.4)", () => {
  it("marks the first row as the header row", async () => {
    const original = await fixtureBytes(
      "A011",
      "fail",
      "table-without-header-row"
    );
    const before = await check(original, "deck.pptx");
    const issue = issueOf(before.report, "A011");

    const result = await applyPptxFixes(original, [
      { kind: "table-header", sourceRef: issue.sourceRef! },
    ]);

    expect(result.skipped).toEqual([]);
    const after = await check(result.bytes, "deck.pptx");
    const table = after.model.nodes.find((node) => node.type === "table");

    expect(codesOf(after.report.issues)).toEqual([]);
    expect(table?.type === "table" && table.rows[0].cells.every((c) => c.header))
      .toBe(true);
    // The cells themselves are untouched.
    expect(table?.type === "table" && table.rows[1].cells[1].text).toBe(
      "Cell structure"
    );
  });

  it("writes the presentation's document title", async () => {
    const original = await fixtureBytes(
      "A001",
      "fail",
      "no-presentation-title"
    );

    const result = await applyPptxFixes(original, [
      { kind: "document-title", title: "BIO 101: Week 1" },
    ]);

    expect(result.skipped).toEqual([]);
    const after = await check(result.bytes, "whatever.pptx");

    expect(after.model.documentName).toBe("BIO 101: Week 1");
    expect(codesOf(after.report.issues)).toEqual([]);
  });
});

describe("applyPptxFixes — the original file", () => {
  it("never modifies the upload", async () => {
    const original = await fixtureBytes(
      "A011",
      "fail",
      "table-without-header-row"
    );
    const copy = original.slice();
    const issue = issueOf((await check(original, "d.pptx")).report, "A011");

    const result = await applyPptxFixes(original, [
      { kind: "table-header", sourceRef: issue.sourceRef! },
    ]);

    expect(original).toEqual(copy);
    expect(result.bytes).not.toEqual(copy);
  });

  it("refuses a file that is not a deck", async () => {
    await expect(
      applyPptxFixes(new TextEncoder().encode("%PDF-1.7\n"), [])
    ).rejects.toThrow(/not a PowerPoint/);
  });

  it("returns the file unchanged when there is nothing to do", async () => {
    const original = await fixtureBytes("A013", "pass", "every-slide-titled");
    const result = await applyPptxFixes(original, []);
    const after = await check(result.bytes, "deck.pptx");

    expect(result.applied).toEqual([]);
    expect(after.report.issues).toEqual([]);
  });
});
