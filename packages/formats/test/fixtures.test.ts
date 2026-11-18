/**
 * Fixture sweep (T-1, T-2): every rule with a PPTX fixture reports exactly
 * that rule on its `fail` deck, and nothing at all on its `pass` deck.
 *
 * The `pass` half is what keeps the reader honest. A reader that quietly
 * dropped alt text, or invented an empty paragraph, would make a clean deck
 * fail here.
 */
import { describe, expect, it } from "vitest";
import { checkFixture, codes } from "./helpers.js";

interface FixturePair {
  code: string;
  fail: string;
  pass: string;
  /** Codes the fail deck reports besides `code`, with why. */
  alsoReports?: string[];
}

const FIXTURES: FixturePair[] = [
  { code: "A001", fail: "no-presentation-title", pass: "presentation-title" },
  {
    code: "A004",
    fail: "image-without-alt-description",
    pass: "image-with-alt-description",
  },
  {
    code: "A009",
    fail: "long-deck-without-titles",
    pass: "long-deck-with-titles",
    // A deck with no slide titles has no headings to navigate by *because*
    // every slide is untitled, so A013 is expected alongside A009.
    alsoReports: ["A013"],
  },
  {
    code: "A011",
    fail: "table-without-header-row",
    pass: "table-with-header-row",
  },
  { code: "A013", fail: "slides-without-titles", pass: "every-slide-titled" },
  {
    code: "A014",
    fail: "duplicate-slide-titles",
    pass: "distinct-slide-titles",
  },
];

describe.each(FIXTURES)("$code", ({ code, fail, pass, alsoReports }) => {
  it(`reports ${code} on ${fail}`, async () => {
    const report = await checkFixture(code, "fail", fail);

    expect(codes(report)).toEqual([code, ...(alsoReports ?? [])].sort());
  });

  it(`reports nothing on ${pass}`, async () => {
    const report = await checkFixture(code, "pass", pass);

    expect(report.issues).toEqual([]);
  });
});
