import { describe, expect, it } from "vitest";
import { runAccessibilityChecks } from "../src/rules.js";
import {
  getRuleMetadata,
  listRules,
  RETIRED_RULES,
  RULES,
} from "../src/ruleCatalog.js";
import { parseDocument, serializeDocument } from "../src/serialize.js";
import { doc, figure, slide, table, title } from "./helpers.js";

describe("FR-2.2 — issues carry location and sourceRef", () => {
  it("copies both off the offending node", () => {
    const model = doc([
      title("W"),
      figure({
        altDescription: "",
        location: { page: 3, bbox: [10, 20, 100, 80] },
        sourceRef: "ppt/slides/slide3.xml#shape-7",
      }),
    ]);

    const issue = runAccessibilityChecks(model).issues.find(
      (i) => i.code === "A004"
    );

    expect(issue?.location).toEqual({ page: 3, bbox: [10, 20, 100, 80] });
    expect(issue?.sourceRef).toBe("ppt/slides/slide3.xml#shape-7");
    expect(issue?.nodeIndex).toBe(1);
  });

  it("leaves them undefined when the node has none", () => {
    const model = doc([title("W"), figure({ altDescription: "" })]);
    const issue = runAccessibilityChecks(model).issues.find(
      (i) => i.code === "A004"
    );

    expect(issue?.location).toBeUndefined();
    expect(issue?.sourceRef).toBeUndefined();
  });

  it("carries them through table rules too", () => {
    const model = doc([
      title("W"),
      table({
        rows: [
          {
            cells: [{ text: "2024", header: false, colspan: 1, rowspan: 1 }],
          },
        ],
        location: { page: 2 },
        sourceRef: "pdf:struct:412",
      }),
    ]);

    const issue = runAccessibilityChecks(model).issues.find(
      (i) => i.code === "A011"
    );

    expect(issue?.location).toEqual({ page: 2 });
    expect(issue?.sourceRef).toBe("pdf:struct:412");
  });

  it("carries them through slide rules", () => {
    const model = doc([slide(undefined, 4)], { source: "pptx" });
    const issue = runAccessibilityChecks(model).issues.find(
      (i) => i.code === "A013"
    );

    expect(issue?.location).toEqual({ page: 4 });
    expect(issue?.sourceRef).toBe("ppt/slides/slide4.xml");
  });
});

describe("FR-3.1 / FR-3.2 — the rule catalog", () => {
  it("gives every rule a fix strategy and manual instructions", () => {
    for (const rule of listRules()) {
      expect(rule.fixable).toMatch(/^(auto|ai-assisted|manual-only)$/);
      expect(rule.manualFix.trim().length).toBeGreaterThan(0);
      expect(rule.title.trim().length).toBeGreaterThan(0);
    }
  });

  it("matches the FR-3.2 mapping", () => {
    expect(RULES.A001.fixable).toBe("auto");
    expect(RULES.A004.fixable).toBe("ai-assisted");
    expect(RULES.A011.fixable).toBe("auto");
    // A013 is "auto" rather than FR-3.2's original "ai-assisted": the tool
    // writes the title itself, and AI only improves the wording.
    expect(RULES.A013.fixable).toBe("auto");
    expect(RULES.A016.fixable).toBe("manual-only");
    expect(RULES.A017.fixable).toBe("manual-only");
  });

  it("keys every entry by its own code", () => {
    for (const [key, rule] of Object.entries(RULES)) {
      expect(rule.code).toBe(key);
    }
  });

  it("covers A001 through A017, less the codes that were withdrawn", () => {
    const expected = Array.from({ length: 17 }, (_, i) =>
      `A${String(i + 1).padStart(3, "0")}`
    ).filter((code) => !(code in RETIRED_RULES));

    expect(listRules().map((r) => r.code)).toEqual(expected);
  });

  it("keeps a withdrawn code out of the catalog and explains it", () => {
    // A retired code is never reissued: a report saved before the change
    // still names it, so it has to stay findable.
    expect(RETIRED_RULES.A002).toMatch(/Withdrawn/);
    expect(RETIRED_RULES.A003).toMatch(/Withdrawn/);
    expect(RULES.A002).toBeUndefined();
    expect(RULES.A003).toBeUndefined();
    expect(getRuleMetadata("A002")).toBeUndefined();
    expect(getRuleMetadata("A003")).toBeUndefined();
  });

  it("fixes a missing slide title in the file, not by hand", () => {
    // The point of the Workbench: Panorama can only print instructions.
    expect(RULES.A013.fixable).toBe("auto");
  });

  it("scopes the new rules to their formats", () => {
    expect(RULES.A013.appliesTo).toBe("pptx");
    expect(RULES.A014.appliesTo).toBe("pptx");
    expect(RULES.A015.appliesTo).toBe("pdf");
    expect(RULES.A016.appliesTo).toBe("pdf");
    expect(RULES.A017.appliesTo).toBe("pdf");
  });

  it("looks a rule up by code", () => {
    expect(getRuleMetadata("A013")?.title).toBe("Slide has no title");
    expect(getRuleMetadata("A999")).toBeUndefined();
  });

  it("stamps every issue with the catalog's fix strategy", () => {
    const model = doc([figure({ altDescription: "" })]);
    for (const issue of runAccessibilityChecks(model).issues) {
      expect(issue.fixable).toBe(RULES[issue.code].fixable);
      expect(issue.severity).toBe(RULES[issue.code].severity);
    }
  });
});

describe("FR-2.3 — the .a11ydoc.json v1 format still round-trips", () => {
  it("reads back a document written without the new fields", () => {
    const model = doc([title("Week 1"), figure()]);
    expect(parseDocument(serializeDocument(model))).toEqual(model);
  });

  it("preserves the new optional fields through a round trip", () => {
    const model = doc(
      [
        slide("Intro", 1),
        figure({ location: { page: 1 }, sourceRef: "shape-3" }),
      ],
      { source: "pptx", flags: { language: "en-US" } }
    );
    expect(parseDocument(serializeDocument(model))).toEqual(model);
  });

  it("still reads a v1 file that predates the new fields", () => {
    const legacy = JSON.stringify({
      version: 1,
      document: {
        documentName: "Old file",
        nodes: [
          {
            type: "title",
            text: "Week 1",
            formatting: {
              bold: false,
              fontSize: null,
              fontFamily: null,
              color: null,
              lineHeight: null,
              textAlign: null,
            },
          },
        ],
      },
    });

    const parsed = parseDocument(legacy);
    expect(parsed.documentName).toBe("Old file");
    expect(parsed.nodes).toHaveLength(1);
    expect(parsed.source).toBeUndefined();
    expect(parsed.flags).toBeUndefined();
  });

  it("still writes version 1", () => {
    expect(JSON.parse(serializeDocument(doc([]))).version).toBe(1);
  });
});
