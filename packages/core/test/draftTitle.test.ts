import { describe, expect, it } from "vitest";
import { buildOutline } from "../src/outline.js";
import { draftSlideTitle } from "../src/draftTitle.js";
import { runAccessibilityChecks } from "../src/rules.js";
import { doc, figure, paragraph, slide } from "./helpers.js";

function sectionFrom(nodes: Parameters<typeof doc>[0]) {
  const model = doc(nodes, { source: "pptx" });
  return buildOutline(model, runAccessibilityChecks(model)).sections[0];
}

describe("draftSlideTitle", () => {
  it("takes the slide's first sentence", () => {
    const section = sectionFrom([
      slide(undefined, 1),
      paragraph("Mitosis has four phases. Each one is examinable."),
    ]);

    expect(draftSlideTitle(section)).toBe("Mitosis has four phases");
  });

  it("keeps a short line whole", () => {
    const section = sectionFrom([
      slide(undefined, 1),
      paragraph("Lab safety rules"),
    ]);

    expect(draftSlideTitle(section)).toBe("Lab safety rules");
  });

  it("cuts a long line on a word boundary, not mid-word", () => {
    const section = sectionFrom([
      slide(undefined, 1),
      paragraph(
        "Photosynthesis converts light energy into chemical energy stored in glucose molecules"
      ),
    ]);

    const draft = draftSlideTitle(section);
    expect(draft.length).toBeLessThanOrEqual(60);
    expect(draft).toBe("Photosynthesis converts light energy into chemical energy");
    expect(draft.endsWith(" ")).toBe(false);
  });

  it("skips pictures and tables to find words", () => {
    const section = sectionFrom([
      slide(undefined, 1),
      figure({ altDescription: "A chart" }),
      paragraph("Weekly lab results"),
    ]);

    expect(draftSlideTitle(section)).toBe("Weekly lab results");
  });

  it("returns nothing when the slide has no words to use", () => {
    const section = sectionFrom([slide(undefined, 1), figure()]);

    // The panel then asks the user to type one rather than inventing text.
    expect(draftSlideTitle(section)).toBe("");
  });
});
