/**
 * Ranking arithmetic (T-4, FR-7.1).
 *
 * These are synthetic reports with counts chosen by hand, so the formula is
 * pinned independently of any reader. packages/formats has the companion test
 * over real decks.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_RANKING_WEIGHTS,
  rankDocuments,
  scoreReport,
} from "../src/ranking.js";
import type { AccessibilityIssue, AccessibilityReport } from "../src/types.js";
import { RULES } from "../src/ruleCatalog.js";

/** Builds a report from a list of rule codes, using the catalog's severities. */
function reportOf(...codes: string[]): AccessibilityReport {
  const issues: AccessibilityIssue[] = codes.map((code) => {
    const rule = RULES[code];
    return {
      code: rule.code,
      severity: rule.severity,
      message: rule.title,
      fixable: rule.fixable,
    };
  });

  return {
    issues,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning").length,
    manualCheckCount: issues.filter((issue) => issue.severity === "manual")
      .length,
  };
}

describe("scoreReport", () => {
  it("uses the weights FR-7.1 specifies", () => {
    expect(DEFAULT_RANKING_WEIGHTS).toMatchObject({
      errorWeight: 10,
      warningWeight: 3,
      blockerBonus: 50,
      blockerCodes: ["A016", "A017"],
    });
  });

  it("scores 10 per error and 3 per warning", () => {
    // A004 and A013 are errors; A003 and A014 are warnings.
    const score = scoreReport(reportOf("A004", "A013", "A003", "A014"));

    expect(score.errorCount).toBe(2);
    expect(score.warningCount).toBe(2);
    expect(score.issueScore).toBe(26);
    expect(score.blockerBonus).toBe(0);
    expect(score.priority).toBe(26);
  });

  it("scores a clean report at zero", () => {
    const score = scoreReport(reportOf());

    expect(score.priority).toBe(0);
    expect(score.blockers).toEqual([]);
  });

  it("adds the blocker bonus once, for either blocker code", () => {
    // A016 is an untagged PDF: one error, so 10 + 50.
    expect(scoreReport(reportOf("A016")).priority).toBe(60);
    expect(scoreReport(reportOf("A017")).priority).toBe(60);

    // Both blockers together: two errors, and still a single bonus.
    const both = scoreReport(reportOf("A016", "A017"));
    expect(both.blockers).toEqual(["A016", "A017"]);
    expect(both.blockerBonus).toBe(50);
    expect(both.priority).toBe(70);
  });

  it("honours overridden weights (FR-7.4)", () => {
    const score = scoreReport(reportOf("A004", "A003"), {
      errorWeight: 1,
      warningWeight: 1,
      blockerBonus: 0,
      blockerCodes: [],
    });

    expect(score.priority).toBe(2);
  });

  it("counts effort by fix strategy (FR-7.3)", () => {
    // A001 auto, A004 ai-assisted, A005 manual-only.
    const score = scoreReport(reportOf("A001", "A004", "A005", "A005"));

    expect(score.effort).toEqual({
      auto: 1,
      "ai-assisted": 1,
      "manual-only": 2,
    });
  });
});

describe("rankDocuments", () => {
  it("sorts highest priority first and numbers the ranks", () => {
    const ranked = rankDocuments([
      { id: "syllabus.pptx", report: reportOf("A003") },
      { id: "scan.pdf", report: reportOf("A017") },
      { id: "lab.pptx", report: reportOf("A004", "A013") },
      { id: "clean.pptx", report: reportOf() },
    ]);

    expect(ranked.map((entry) => [entry.id, entry.score.priority])).toEqual([
      ["scan.pdf", 60],
      ["lab.pptx", 20],
      ["syllabus.pptx", 3],
      ["clean.pptx", 0],
    ]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3, 4]);
  });

  it("marks only the top file as the place to start (FR-7.2)", () => {
    const ranked = rankDocuments([
      { id: "a.pptx", report: reportOf("A004") },
      { id: "b.pptx", report: reportOf("A003") },
    ]);

    expect(ranked.map((entry) => entry.startHere)).toEqual([true, false]);
  });

  it("does not tell the user to start on a file with nothing to fix", () => {
    const ranked = rankDocuments([
      { id: "a.pptx", report: reportOf() },
      { id: "b.pptx", report: reportOf() },
    ]);

    expect(ranked.every((entry) => !entry.startHere)).toBe(true);
  });

  it("breaks ties deterministically, whatever order files arrive in", () => {
    const documents = [
      { id: "zebra.pptx", report: reportOf("A004") },
      { id: "apple.pptx", report: reportOf("A004") },
      { id: "mango.pptx", report: reportOf("A004") },
    ];

    const forward = rankDocuments(documents).map((entry) => entry.id);
    const reversed = rankDocuments([...documents].reverse()).map(
      (entry) => entry.id
    );

    expect(forward).toEqual(["apple.pptx", "mango.pptx", "zebra.pptx"]);
    expect(reversed).toEqual(forward);
  });

  it("prefers more errors over more warnings at equal priority", () => {
    // Both files score 30, so the tie-break decides: ten warnings are less
    // urgent than three errors.
    const ranked = rankDocuments([
      // 0 errors, 10 warnings = 30
      { id: "warnings.pptx", report: reportOf(...Array(10).fill("A003")) },
      // 3 errors, 0 warnings = 30
      { id: "errors.pptx", report: reportOf("A004", "A004", "A004") },
    ]);

    expect(ranked.map((entry) => entry.score.priority)).toEqual([30, 30]);
    expect(ranked.map((entry) => entry.id)).toEqual([
      "errors.pptx",
      "warnings.pptx",
    ]);
  });

  it("returns an empty list for an empty batch", () => {
    expect(rankDocuments([])).toEqual([]);
  });
});
