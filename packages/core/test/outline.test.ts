/**
 * Outline grouping (FR-8.5): the flat model folded back into slides.
 */
import { describe, expect, it } from "vitest";
import { buildOutline } from "../src/outline.js";
import { runAccessibilityChecks } from "../src/rules.js";
import { doc, figure, paragraph, slide, title } from "./helpers.js";

function deck() {
  return doc(
    [
      title("BIO 101"),
      slide("Week 1", 1),
      paragraph("Cells are the unit of life.", {
        location: { page: 1 },
      }),
      slide(undefined, 2),
      figure({
        altTitle: "",
        altDescription: "",
        location: { page: 2 },
        sourceRef: "ppt/slides/slide2.xml#5",
      }),
    ],
    { source: "pptx", documentName: "BIO 101" }
  );
}

describe("buildOutline", () => {
  it("splits the flat node list at each section marker", () => {
    const model = deck();
    const outline = buildOutline(model, runAccessibilityChecks(model));

    expect(outline.sections).toHaveLength(2);
    expect(outline.sections.map((section) => section.page)).toEqual([1, 2]);
    expect(outline.sections[0].title).toBe("Week 1");
    expect(outline.sections[0].sourceRef).toBe("ppt/slides/slide1.xml");
    expect(
      outline.sections.map((section) => section.nodes.length)
    ).toEqual([1, 1]);
    expect(outline.sections[1].nodes[0].node.type).toBe("figure");
  });

  it("keeps a slide with no title distinguishable from an empty one", () => {
    const model = deck();
    const outline = buildOutline(model, runAccessibilityChecks(model));

    expect(outline.sections[1].title).toBeUndefined();

    const emptyTitled = doc([slide("", 1)], { source: "pptx" });
    expect(
      buildOutline(emptyTitled, runAccessibilityChecks(emptyTitled)).sections[0]
        .title
    ).toBe("");
  });

  it("puts nodes before the first slide in the preamble", () => {
    const model = deck();
    const outline = buildOutline(model, runAccessibilityChecks(model));

    expect(outline.preamble).toHaveLength(1);
    expect(outline.preamble[0].node.type).toBe("title");
    expect(outline.preamble[0].nodeIndex).toBe(0);
  });

  it("files each issue on the slide its location names", () => {
    const model = deck();
    const outline = buildOutline(model, runAccessibilityChecks(model));

    expect(outline.sections[0].issues).toEqual([]);
    // Slide 2: no title (A013) and an image with no alt description (A004).
    expect(outline.sections[1].issues.map((issue) => issue.code).sort()).toEqual(
      ["A004", "A013"]
    );
  });

  it("attaches issues to the node they were reported against", () => {
    const model = deck();
    const outline = buildOutline(model, runAccessibilityChecks(model));
    const image = outline.sections[1].nodes[0];

    expect(image.issues.map((issue) => issue.code)).toEqual(["A004"]);
    expect(image.nodeIndex).toBe(4);
  });

  it("keeps a whole-file finding off the first slide", () => {
    // No title node, so A001 fires with nodeIndex 0 — which in a deck is
    // slide 1's marker. It belongs to the file, not to slide 1.
    const model = doc([slide("Week 1", 1), paragraph("Body.")], {
      source: "pptx",
    });
    const outline = buildOutline(model, runAccessibilityChecks(model));

    expect(outline.documentIssues.map((issue) => issue.code)).toContain("A001");
    expect(outline.sections[0].issues.map((issue) => issue.code)).not.toContain(
      "A001"
    );
  });

  it("counts every issue exactly once across the outline", () => {
    const model = doc([slide(undefined, 1), slide(undefined, 2)], {
      source: "pptx",
    });
    const report = runAccessibilityChecks(model);
    const outline = buildOutline(model, report);

    const grouped =
      outline.documentIssues.length +
      outline.sections.reduce(
        (total, section) => total + section.issues.length,
        0
      );

    expect(grouped).toBe(report.issues.length);
    expect(outline.issueCount).toBe(report.issues.length);
  });

  it("reports an editor document, which has no slides, as document issues", () => {
    const model = doc([paragraph("Body text with no title.")]);
    const report = runAccessibilityChecks(model);
    const outline = buildOutline(model, report);

    expect(outline.sections).toEqual([]);
    expect(outline.documentIssues).toHaveLength(report.issues.length);
  });
});
