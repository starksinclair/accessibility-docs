import { describe, expect, it } from "vitest";
import { assertAccessible, runAccessibilityChecks } from "../src/rules.js";
import { RULES } from "../src/ruleCatalog.js";
import {
  cleanDoc,
  doc,
  figure,
  heading,
  paragraph,
  table,
  title,
} from "./helpers.js";
import { defaultTextFormatting } from "../src/types.js";

function only(
  model: Parameters<typeof runAccessibilityChecks>[0],
  code: string
) {
  return runAccessibilityChecks(model).issues.filter((i) => i.code === code);
}

/**
 * C-4: A001 to A012 keep their codes, severities and meaning. These are the
 * severities the Checker and the Author editor already depend on; a change
 * here would silently alter which documents are allowed to save.
 */
describe("C-4 — existing rule severities are frozen", () => {
  const frozen: Record<string, "error" | "warning"> = {
    A001: "error",
    A002: "warning",
    A003: "warning",
    A004: "error",
    A005: "error",
    A006: "warning",
    A007: "error",
    A008: "warning",
    A009: "warning",
    A010: "error",
    A011: "error",
    A012: "warning",
  };

  for (const [code, severity] of Object.entries(frozen)) {
    it(`${code} is ${severity}`, () => {
      expect(RULES[code].severity).toBe(severity);
    });
  }
});

describe("A001 — document title", () => {
  it("reports a document with no title node", () => {
    expect(only(doc([paragraph("Body")]), "A001")).toHaveLength(1);
  });

  it("reports a title that is only whitespace", () => {
    expect(only(doc([title("   ")]), "A001")).toHaveLength(1);
  });

  it("passes with a real title", () => {
    expect(only(doc([title("Week 1")]), "A001")).toHaveLength(0);
  });
});

describe("A002 — bold, large text that is not a heading", () => {
  it("reports bold text at 16pt or above", () => {
    const model = doc([
      title("Week 1"),
      paragraph("Key terms", {
        formatting: defaultTextFormatting({ bold: true, fontSize: 18 }),
      }),
    ]);
    expect(only(model, "A002")).toHaveLength(1);
  });

  it("ignores bold text below the size threshold", () => {
    const model = doc([
      title("Week 1"),
      paragraph("Key terms", {
        formatting: defaultTextFormatting({ bold: true, fontSize: 12 }),
      }),
    ]);
    expect(only(model, "A002")).toHaveLength(0);
  });
});

describe("A003 / A004 — image alt text", () => {
  it("reports a missing alt title as a warning", () => {
    const model = doc([title("W"), figure({ altTitle: "" })]);
    const issues = only(model, "A003");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("warning");
  });

  it("reports a missing alt description as an error", () => {
    const model = doc([title("W"), figure({ altDescription: "" })]);
    const issues = only(model, "A004");
    expect(issues).toHaveLength(1);
    expect(issues[0].severity).toBe("error");
  });

  it("passes a fully described image", () => {
    const model = doc([title("W"), figure()]);
    expect(only(model, "A003")).toHaveLength(0);
    expect(only(model, "A004")).toHaveLength(0);
  });
});

describe("A005 / A006 — heading text and order", () => {
  it("reports an empty heading", () => {
    expect(only(doc([title("W"), heading(2, "")]), "A005")).toHaveLength(1);
  });

  it("reports a skipped heading level", () => {
    const model = doc([title("W"), heading(1, "One"), heading(3, "Three")]);
    expect(only(model, "A006")).toHaveLength(1);
  });

  it("allows descending back to a shallower level", () => {
    const model = doc([
      title("W"),
      heading(1, "One"),
      heading(2, "Two"),
      heading(1, "Another"),
    ]);
    expect(only(model, "A006")).toHaveLength(0);
  });
});

describe("A007 — figure source", () => {
  it("reports a figure with no source", () => {
    expect(only(doc([title("W"), figure({ src: "" })]), "A007")).toHaveLength(
      1
    );
  });
});

describe("A008 — document name", () => {
  it("reports an empty document name", () => {
    const model = doc([title("W")], { documentName: "" });
    expect(only(model, "A008")).toHaveLength(1);
  });
});

describe("A009 — long document without headings", () => {
  it("reports once the content threshold is crossed", () => {
    const model = doc([
      title("W"),
      paragraph("1"),
      paragraph("2"),
      paragraph("3"),
      paragraph("4"),
      paragraph("5"),
    ]);
    expect(only(model, "A009")).toHaveLength(1);
  });

  it("passes when the document has a heading", () => {
    const model = doc([
      title("W"),
      heading(1, "Section"),
      paragraph("1"),
      paragraph("2"),
      paragraph("3"),
      paragraph("4"),
    ]);
    expect(only(model, "A009")).toHaveLength(0);
  });

  it("does not count slide markers as content", () => {
    // Five slide markers plus a title is below the content threshold, so a
    // short deck is not told to add headings.
    const model = doc(
      [
        title("W"),
        { type: "section", role: "slide", title: "A", location: { page: 1 } },
        { type: "section", role: "slide", title: "B", location: { page: 2 } },
        { type: "section", role: "slide", title: "C", location: { page: 3 } },
        { type: "section", role: "slide", title: "D", location: { page: 4 } },
        { type: "section", role: "slide", title: "E", location: { page: 5 } },
      ],
      { source: "pptx" }
    );
    expect(only(model, "A009")).toHaveLength(0);
  });
});

describe("A010 / A011 / A012 — tables", () => {
  it("reports a table with no rows", () => {
    expect(
      only(doc([title("W"), table({ rows: [] })]), "A010")
    ).toHaveLength(1);
  });

  it("reports a table with no header cells", () => {
    const model = doc([
      title("W"),
      table({
        rows: [
          {
            cells: [
              { text: "2024", header: false, colspan: 1, rowspan: 1 },
              { text: "120", header: false, colspan: 1, rowspan: 1 },
            ],
          },
        ],
      }),
    ]);
    expect(only(model, "A011")).toHaveLength(1);
  });

  it("reports inconsistent column counts", () => {
    const model = doc([
      title("W"),
      table({
        rows: [
          {
            cells: [
              { text: "Year", header: true, colspan: 1, rowspan: 1 },
              { text: "Count", header: true, colspan: 1, rowspan: 1 },
            ],
          },
          {
            cells: [{ text: "2024", header: false, colspan: 1, rowspan: 1 }],
          },
        ],
      }),
    ]);
    expect(only(model, "A012")).toHaveLength(1);
  });

  it("passes a well-formed table", () => {
    const model = doc([title("W"), table()]);
    expect(only(model, "A010")).toHaveLength(0);
    expect(only(model, "A011")).toHaveLength(0);
    expect(only(model, "A012")).toHaveLength(0);
  });
});

describe("assertAccessible", () => {
  it("blocks only on errors", () => {
    const warningOnly = doc([title("W"), figure({ altTitle: "" })]);
    const result = assertAccessible(warningOnly);

    expect(result.ok).toBe(true);
    expect(result.report.warningCount).toBeGreaterThan(0);
  });

  it("blocks when an error is present", () => {
    const withError = doc([title("W"), figure({ altDescription: "" })]);
    expect(assertAccessible(withError).ok).toBe(false);
  });

  it("passes a clean document", () => {
    const report = runAccessibilityChecks(cleanDoc());
    expect(report.issues).toEqual([]);
    expect(report.errorCount).toBe(0);
  });
});
