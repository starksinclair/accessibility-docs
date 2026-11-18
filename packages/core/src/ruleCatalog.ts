import type { FixStrategy, IssueSeverity } from "./types.js";

/**
 * Which formats a rule is meaningful for. "all" rules run against every model;
 * format-scoped rules only run when `DocumentModel.source` matches, so a Google
 * Doc or TipTap document never collects PDF or PowerPoint findings.
 */
export type RuleScope = "all" | "pptx" | "pdf";

export interface RuleMetadata {
  code: string;
  severity: IssueSeverity;
  /** Short label for lists and filters. */
  title: string;
  /** How much of the fix the tool can take on (FR-3.1). */
  fixable: FixStrategy;
  /**
   * What a person does to fix this by hand, in plain language (FR-3.1).
   * Shown for every rule, not only the manual-only ones, because the user may
   * decline a suggested fix and still need to know what to do.
   */
  manualFix: string;
  appliesTo: RuleScope;
}

/**
 * The single source of truth for rule severity, fix strategy and manual
 * instructions.
 *
 * Severities for A001 to A012 are fixed by C-4 and must not drift; a unit test
 * pins them. New rules get new codes (A013 onward).
 */
/**
 * Codes that existed and were withdrawn. They are never reissued: a report
 * saved before the change still names them, and a reader should be able to
 * look one up and find out what happened to it.
 */
export const RETIRED_RULES: Record<string, string> = {
  A003:
    "Withdrawn. It asked for an image \"alt title\", which no WCAG success criterion requires — SC 1.1.1 asks for one text alternative, which is A004. PowerPoint 365 no longer exposes the field at all, so the instruction could not be followed.",
};

export const RULES: Record<string, RuleMetadata> = {
  A001: {
    code: "A001",
    severity: "error",
    title: "Document has no semantic title",
    fixable: "auto",
    manualFix:
      "Select the title line and apply the Title style, so assistive technology announces it as the document title.",
    appliesTo: "all",
  },
  A002: {
    code: "A002",
    severity: "warning",
    title: "Bold, large text is not a heading",
    fixable: "manual-only",
    manualFix:
      "Decide whether this line really is a section heading. If it is, apply the matching Heading style instead of bold text. If it is not, leave it as it is.",
    appliesTo: "all",
  },
  A004: {
    code: "A004",
    severity: "error",
    title: "Image has no alt description",
    fixable: "ai-assisted",
    manualFix:
      "Open the image's alt text settings and describe what the image shows and why it is in the material. If it is purely decorative, mark it as decorative instead.",
    appliesTo: "all",
  },
  A005: {
    code: "A005",
    severity: "error",
    title: "Heading has no text",
    fixable: "manual-only",
    manualFix:
      "Type the heading text, or delete the empty heading so it does not appear in the navigation pane.",
    appliesTo: "all",
  },
  A006: {
    code: "A006",
    severity: "warning",
    title: "Heading levels skip",
    fixable: "manual-only",
    manualFix:
      "Change the heading so it is one level below the heading above it, for example H2 under H1. Do not pick a level for its size.",
    appliesTo: "all",
  },
  A007: {
    code: "A007",
    severity: "error",
    title: "Image has no source file",
    fixable: "manual-only",
    manualFix:
      "Delete the broken image and insert it again from the original file.",
    appliesTo: "all",
  },
  A008: {
    code: "A008",
    severity: "warning",
    title: "Document name is empty",
    fixable: "auto",
    manualFix:
      "Give the file a descriptive name. It becomes the document's Title property, which is what a screen reader announces first.",
    appliesTo: "all",
  },
  A009: {
    code: "A009",
    severity: "warning",
    title: "Longer document has no headings",
    fixable: "manual-only",
    manualFix:
      "Add headings to the main sections so readers can skim the document and jump between parts.",
    appliesTo: "all",
  },
  A010: {
    code: "A010",
    severity: "error",
    title: "Table has no rows or cells",
    fixable: "manual-only",
    manualFix:
      "Add the table's content, or delete the empty table so it is not announced as a table.",
    appliesTo: "all",
  },
  A011: {
    code: "A011",
    severity: "error",
    title: "Table has no header cells",
    fixable: "auto",
    manualFix:
      "Mark the row (or column) that labels the data as a header row, so each cell is announced with its label.",
    appliesTo: "all",
  },
  A012: {
    code: "A012",
    severity: "warning",
    title: "Table rows have inconsistent column counts",
    fixable: "manual-only",
    manualFix:
      "Give every row the same number of columns. Add the missing cells, or merge cells deliberately using colspan.",
    appliesTo: "all",
  },

  // --- FR-3: new rules for PPTX and PDF --------------------------------
  A013: {
    code: "A013",
    severity: "error",
    // The tool writes the title into the deck, including adding a title
    // placeholder to a slide that has none (FR-5.2, FR-5.5). This is the
    // capability the project exists to add: Panorama can only tell a lecturer
    // to do it by hand. AI proposes better wording, but a fix never waits on
    // it — the slide's own text gives a first draft.
    fixable: "auto",
    title: "Slide has no title",
    manualFix:
      "In PowerPoint, open the Outline view or the slide layout and put text in the slide's title placeholder. Titles are how a screen reader user moves between slides.",
    appliesTo: "pptx",
  },
  A014: {
    code: "A014",
    severity: "warning",
    title: "Slides share the same title",
    fixable: "ai-assisted",
    manualFix:
      "Give each slide a distinct title. If slides continue a topic, number them, for example \"Photosynthesis (2 of 3)\".",
    appliesTo: "pptx",
  },
  A015: {
    code: "A015",
    severity: "error",
    title: "Document language is not set",
    fixable: "auto",
    manualFix:
      "Set the document language in the file's properties so a screen reader reads the text with the right pronunciation.",
    appliesTo: "pdf",
  },
  A016: {
    code: "A016",
    severity: "error",
    title: "PDF is untagged",
    fixable: "manual-only",
    manualFix:
      "This PDF has no structure tree, so there is nothing to describe its headings, lists or tables. Re-export it from the original Word or PowerPoint file with accessibility tagging turned on. Tagging an existing PDF needs Acrobat Pro and is not something this tool can do.",
    appliesTo: "pdf",
  },
  A017: {
    code: "A017",
    severity: "error",
    title: "PDF has no extractable text",
    fixable: "manual-only",
    manualFix:
      "This looks like a scan: the pages are images, so none of the text can be read aloud, searched or selected. Replace it with the original digital file, or run OCR on it in Acrobat Pro and check the result.",
    appliesTo: "pdf",
  },
};

export function getRuleMetadata(code: string): RuleMetadata | undefined {
  return RULES[code];
}

/** Every rule, in code order — handy for documentation and settings UIs. */
export function listRules(): RuleMetadata[] {
  return Object.values(RULES).sort((a, b) => a.code.localeCompare(b.code));
}
