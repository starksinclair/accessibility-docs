/**
 * Ranking test over real decks (T-4, FR-7).
 *
 * The companion test in packages/core pins the arithmetic against synthetic
 * reports. This one checks the whole path a faculty member walks: three real
 * .pptx files in, one ranked list out, with the file to open first at the top.
 */
import { rankDocuments, runAccessibilityChecks } from "@accessibility-docs/core";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { FIXTURES, readDeck } from "./helpers.js";

const DECKS = ["clean-syllabus", "lab-three", "legacy-lecture"] as const;

type Ranked = ReturnType<typeof rankDocuments<{ id: string; report: ReturnType<typeof runAccessibilityChecks> }>>;

let ranked: Ranked;

beforeAll(async () => {
  const documents = await Promise.all(
    DECKS.map(async (name) => ({
      id: name,
      report: runAccessibilityChecks(
        await readDeck(join(FIXTURES, "ranking", `${name}.pptx`))
      ),
    }))
  );

  ranked = rankDocuments(documents);
});

describe("ranking real decks", () => {
  it("has the counts the fixtures were built for", () => {
    const counts = Object.fromEntries(
      ranked.map((entry) => [
        entry.id,
        [entry.score.errorCount, entry.score.warningCount],
      ])
    );

    expect(counts).toEqual({
      "clean-syllabus": [0, 0],
      // One image with no alt description (A004) and one table with no header
      // row (A011).
      "lab-three": [2, 0],
      // Three untitled slides (A013 x3), three images with no alt
      // description (A004 x3) and no document title (A001) are the seven
      // errors; one duplicated slide title (A014) is the single warning.
      "legacy-lecture": [7, 1],
    });
  });

  it("orders by priority, worst first (FR-7.1, FR-7.2)", () => {
    expect(ranked.map((entry) => [entry.id, entry.score.priority])).toEqual([
      ["legacy-lecture", 73],
      ["lab-three", 20],
      ["clean-syllabus", 0],
    ]);
  });

  it("marks exactly one file as the place to start", () => {
    expect(ranked.filter((entry) => entry.startHere).map((e) => e.id)).toEqual([
      "legacy-lecture",
    ]);
    expect(ranked.map((entry) => entry.rank)).toEqual([1, 2, 3]);
  });

  it("estimates effort from the rule catalog (FR-7.3)", () => {
    const worst = ranked[0];

    // A001 and the three A013s are fixes the tool applies itself; the three
    // A004 alt descriptions and the duplicated title need wording, so they
    // are AI-assisted.
    expect(worst.score.effort).toEqual({
      auto: 4,
      "ai-assisted": 4,
      "manual-only": 0,
    });
  });
});
