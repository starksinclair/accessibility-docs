import { describe, expect, it } from "vitest";
import { runAccessibilityChecks } from "../src/rules.js";
import { cleanDoc, codes, doc, figure, slide, title } from "./helpers.js";

/** Issues for one rule code. */
function only(model: Parameters<typeof runAccessibilityChecks>[0], code: string) {
  return runAccessibilityChecks(model).issues.filter((i) => i.code === code);
}

describe("A013 — slide has no title", () => {
  it("reports a slide whose title is missing", () => {
    const model = doc([slide(undefined, 1), slide("Mitosis", 2)], {
      source: "pptx",
    });
    const issues = only(model, "A013");

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].message).toContain("Slide 1");
  });

  it("reports a slide whose title is only whitespace", () => {
    const model = doc([slide("   ", 1)], { source: "pptx" });
    expect(only(model, "A013")).toHaveLength(1);
  });

  it("passes when every slide has a title", () => {
    const model = doc([slide("Intro", 1), slide("Mitosis", 2)], {
      source: "pptx",
    });
    expect(only(model, "A013")).toHaveLength(0);
  });

  it("uses the location page number in the message", () => {
    const model = doc([slide(undefined, 7)], { source: "pptx" });
    expect(only(model, "A013")[0].message).toContain("Slide 7");
  });

  it("does not run for non-PPTX documents", () => {
    const model = doc([slide(undefined, 1)], { source: "gdoc" });
    expect(only(model, "A013")).toHaveLength(0);
  });
});

describe("A014 — slides share the same title", () => {
  it("reports one issue per duplicated title, not one per slide", () => {
    const model = doc(
      [slide("Agenda", 1), slide("Agenda", 2), slide("Agenda", 3)],
      { source: "pptx" }
    );
    const issues = only(model, "A014");

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
    expect(issues[0].message).toContain("3 slides");
    expect(issues[0].message).toContain("slides 1, 2, 3");
  });

  it("matches titles case-insensitively and ignores surrounding space", () => {
    const model = doc([slide("Agenda", 1), slide("  agenda ", 2)], {
      source: "pptx",
    });
    expect(only(model, "A014")).toHaveLength(1);
  });

  it("reports each duplicated title separately", () => {
    const model = doc(
      [
        slide("Agenda", 1),
        slide("Agenda", 2),
        slide("Summary", 3),
        slide("Summary", 4),
      ],
      { source: "pptx" }
    );
    expect(only(model, "A014")).toHaveLength(2);
  });

  it("passes when titles are distinct", () => {
    const model = doc([slide("Intro", 1), slide("Mitosis", 2)], {
      source: "pptx",
    });
    expect(only(model, "A014")).toHaveLength(0);
  });

  it("ignores untitled slides so it does not pile onto A013", () => {
    const model = doc([slide(undefined, 1), slide("", 2)], {
      source: "pptx",
    });
    expect(only(model, "A014")).toHaveLength(0);
    expect(only(model, "A013")).toHaveLength(2);
  });
});

describe("A015 — document language is not set", () => {
  it("reports a PDF with no language", () => {
    const model = doc([title("Reading")], { source: "pdf" });
    const issues = only(model, "A015");

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("reports a PDF whose language is blank", () => {
    const model = doc([title("Reading")], {
      source: "pdf",
      flags: { language: "  " },
    });
    expect(only(model, "A015")).toHaveLength(1);
  });

  it("passes when a language is declared", () => {
    const model = doc([title("Reading")], {
      source: "pdf",
      flags: { language: "en-US" },
    });
    expect(only(model, "A015")).toHaveLength(0);
  });

  it("does not run for non-PDF documents", () => {
    const model = doc([title("Reading")], { source: "tiptap" });
    expect(only(model, "A015")).toHaveLength(0);
  });
});

describe("A016 — PDF is untagged", () => {
  it("reports a PDF with no structure tree", () => {
    const model = doc([title("Scan")], {
      source: "pdf",
      flags: { tagged: false },
    });
    const issues = only(model, "A016");

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].fixable).toBe("manual-only");
  });

  it("passes when the PDF is tagged", () => {
    const model = doc([title("Reading")], {
      source: "pdf",
      flags: { tagged: true },
    });
    expect(only(model, "A016")).toHaveLength(0);
  });

  it("stays silent when the reader could not determine tagging", () => {
    const model = doc([title("Reading")], { source: "pdf", flags: {} });
    expect(only(model, "A016")).toHaveLength(0);
  });
});

describe("A017 — PDF has no extractable text", () => {
  it("reports a PDF with no text layer", () => {
    const model = doc([title("Scan")], {
      source: "pdf",
      flags: { hasText: false },
    });
    const issues = only(model, "A017");

    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
    expect(issues[0].fixable).toBe("manual-only");
  });

  it("passes when text is extractable", () => {
    const model = doc([title("Reading")], {
      source: "pdf",
      flags: { hasText: true },
    });
    expect(only(model, "A017")).toHaveLength(0);
  });

  it("stays silent when the reader could not determine it", () => {
    const model = doc([title("Reading")], { source: "pdf", flags: {} });
    expect(only(model, "A017")).toHaveLength(0);
  });
});

describe("format scoping", () => {
  it("raises no new-rule findings for a document with no source", () => {
    const report = runAccessibilityChecks(cleanDoc());
    const newCodes = report.issues
      .map((i) => i.code)
      .filter((c) => ["A013", "A014", "A015", "A016", "A017"].includes(c));

    expect(newCodes).toEqual([]);
  });

  it("still applies the shared rules to a PPTX model", () => {
    const model = doc(
      [slide("Intro", 1), figure({ altTitle: "", altDescription: "" })],
      { source: "pptx" }
    );
    expect(codes(runAccessibilityChecks(model).issues)).toContain("A004");
  });
});
