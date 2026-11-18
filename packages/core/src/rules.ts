import { RULES } from "./ruleCatalog.js";
import type {
  AccessibilityIssue,
  AccessibilityReport,
  DocumentModel,
  DocumentNode,
  SectionNode,
} from "./types.js";

/** Heuristic: documents at or above this block count should offer heading navigation. */
const LONG_DOCUMENT_NODE_THRESHOLD = 6;

/**
 * Builds an issue from the rule catalog.
 *
 * Severity and fix strategy always come from the catalog so they cannot drift
 * between the rule and the UI, and `location` / `sourceRef` are copied off the
 * node so the Workbench can jump to the element and a writer can find it
 * again (FR-2.2).
 */
function issue(
  code: keyof typeof RULES | string,
  message: string,
  options: {
    help?: string;
    nodeIndex?: number;
    node?: DocumentNode;
  } = {}
): AccessibilityIssue {
  const rule = RULES[code];
  if (!rule) {
    throw new Error(`Unknown rule code: ${code}`);
  }

  const built: AccessibilityIssue = {
    code: rule.code,
    severity: rule.severity,
    message,
    fixable: rule.fixable,
  };

  if (options.help !== undefined) {
    built.help = options.help;
  }
  if (options.nodeIndex !== undefined) {
    built.nodeIndex = options.nodeIndex;
  }
  if (options.node?.location !== undefined) {
    built.location = options.node.location;
  }
  if (options.node?.sourceRef !== undefined) {
    built.sourceRef = options.node.sourceRef;
  }

  return built;
}

/**
 * Runs all accessibility checks against a DocumentModel.
 *
 * Format-scoped rules (PPTX, PDF) only run when `document.source` says so, so a
 * Google Doc or TipTap document is checked exactly as it was before.
 */
export function runAccessibilityChecks(
  document: DocumentModel
): AccessibilityReport {
  const issues: AccessibilityIssue[] = [
    ...checkDocumentTitle(document),
    ...checkDocumentName(document),
    ...checkEmptyHeadings(document),
    ...checkHeadingLevelOrder(document),
    ...checkImagesHaveAltText(document),
    ...checkFiguresHaveSource(document),
    ...checkLongDocumentHasHeadings(document),
    ...checkTables(document),
    ...checkSlideTitles(document),
    ...checkDuplicateSlideTitles(document),
    ...checkDocumentLanguage(document),
    ...checkPdfIsTagged(document),
    ...checkPdfHasText(document),
  ];

  return {
    issues,
    errorCount: issues.filter((issue) => issue.severity === "error").length,
    warningCount: issues.filter((issue) => issue.severity === "warning")
      .length,
    manualCheckCount: issues.filter((issue) => issue.severity === "manual")
      .length,
  };
}

/**
 * Compile/save gate: ok only when there are no error-severity issues.
 * Warnings do not block save.
 */
export function assertAccessible(
  document: DocumentModel
):
  | { ok: true; report: AccessibilityReport }
  | { ok: false; report: AccessibilityReport } {
  const report = runAccessibilityChecks(document);

  if (report.errorCount > 0) {
    return { ok: false, report };
  }

  return { ok: true, report };
}

/** A001 — Document must contain a semantic title. */
function checkDocumentTitle(
  document: DocumentModel
): AccessibilityIssue[] {
  const hasTitle = document.nodes.some(
    (node) => node.type === "title" && node.text.trim().length > 0
  );

  if (hasTitle) {
    return [];
  }

  return [
    // `nodeIndex` stays 0 because that is where a title belongs, and the Author
    // editor marks that block. No `node` is passed: the first block is whatever
    // happens to be first — in a deck, slide 1 — and borrowing its location
    // would file a document-level finding against that slide.
    issue("A001", "Document does not contain a semantic title.", {
      help: "Apply a Title style to the document title.",
      nodeIndex: document.nodes.length > 0 ? 0 : undefined,
    }),
  ];
}

/** A008 — Document name/metadata title should be present (PDF18). */
function checkDocumentName(document: DocumentModel): AccessibilityIssue[] {
  if (document.documentName.trim().length > 0) {
    return [];
  }

  return [
    issue("A008", "Document name is empty.", {
      help: "Set a descriptive document name; it becomes the PDF Title metadata.",
    }),
  ];
}

/** A005 — Headings must have text (PDF9). */
function checkEmptyHeadings(document: DocumentModel): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type !== "heading") {
      continue;
    }

    if (node.text.trim().length === 0) {
      issues.push(
        issue("A005", `Heading level ${node.level} has no text.`, {
          help: "Add heading text, or remove the empty heading.",
          nodeIndex,
          node,
        })
      );
    }
  }

  return issues;
}

/** A006 — Heading levels should not skip (PDF9). */
function checkHeadingLevelOrder(
  document: DocumentModel
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];
  let previousLevel: number | null = null;

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type !== "heading") {
      continue;
    }

    const level = node.level;
    if (previousLevel !== null && level > previousLevel + 1) {
      issues.push(
        issue(
          "A006",
          `Heading level jumps from H${previousLevel} to H${level}.`,
          {
            help: "Use heading levels in order (for example H1, then H2) so navigation stays predictable.",
            nodeIndex,
            node,
          }
        )
      );
    }

    previousLevel = level;
  }

  return issues;
}

/** A004 — Images must have a text alternative (SC 1.1.1, PDF1). */
function checkImagesHaveAltText(
  document: DocumentModel
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type !== "figure") {
      continue;
    }

    if (node.altDescription.trim().length === 0) {
      issues.push(
        issue("A004", "Image does not have an alt description.", {
          help: "Add an alt description that conveys the image content.",
          nodeIndex,
          node,
        })
      );
    }
  }

  return issues;
}

/** A007 — Figures need a source image for accessible PDF export (PDF1). */
function checkFiguresHaveSource(
  document: DocumentModel
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type !== "figure") {
      continue;
    }

    if (node.src.trim().length === 0) {
      issues.push(
        issue("A007", "Image is missing a source file.", {
          help: "Re-insert the image so it has a usable source for PDF export.",
          nodeIndex,
          node,
        })
      );
    }
  }

  return issues;
}

/** A009 — Longer documents should include headings for navigation (PDF2). */
function checkLongDocumentHasHeadings(
  document: DocumentModel
): AccessibilityIssue[] {
  const contentNodes = document.nodes.filter((node) => {
    if (node.type === "figure" || node.type === "table") {
      return true;
    }
    // Section markers are structure, not content, so they do not count
    // toward the "this document is long enough to need headings" threshold.
    if (node.type === "section") {
      return false;
    }
    if (node.type === "title" || node.type === "heading") {
      return node.text.trim().length > 0;
    }
    return node.text.trim().length > 0;
  });

  if (contentNodes.length < LONG_DOCUMENT_NODE_THRESHOLD) {
    return [];
  }

  const hasHeading = document.nodes.some(
    (node) => node.type === "heading" && node.text.trim().length > 0
  );

  if (hasHeading) {
    return [];
  }

  return [
    issue(
      "A009",
      "Longer document has no headings for section navigation.",
      {
        help: "Add semantic headings so readers can skim and jump (and so PDF bookmarks can be generated later).",
      }
    ),
  ];
}

/** A010–A012 — Table structure checks (PDF6). */
function checkTables(document: DocumentModel): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type !== "table") {
      continue;
    }

    if (node.rows.length === 0) {
      issues.push(
        issue("A010", "Table has no rows.", {
          help: "Add at least one row, or remove the empty table.",
          nodeIndex,
          node,
        })
      );
      continue;
    }

    const hasHeader = node.rows.some((row) =>
      row.cells.some((cell) => cell.header)
    );
    if (!hasHeader) {
      issues.push(
        issue("A011", "Table has no header cells.", {
          help: "Mark the first row (or row/column labels) as header cells so relationships are clear.",
          nodeIndex,
          node,
        })
      );
    }

    const columnCounts = node.rows.map((row) =>
      row.cells.reduce((sum, cell) => sum + Math.max(1, cell.colspan), 0)
    );
    const expected = columnCounts[0] ?? 0;
    const irregular = columnCounts.some((count) => count !== expected);
    if (expected === 0) {
      issues.push(
        issue("A010", "Table has no cells.", {
          help: "Add cells to the table, or remove it.",
          nodeIndex,
          node,
        })
      );
    } else if (irregular) {
      issues.push(
        issue("A012", "Table rows have inconsistent column counts.", {
          help: "Make each row cover the same number of columns (use colspan intentionally, or add missing cells).",
          nodeIndex,
          node,
        })
      );
    }
  }

  return issues;
}

/** Every slide marker in the deck, with its index into `document.nodes`. */
function slideSections(
  document: DocumentModel
): { node: SectionNode; nodeIndex: number }[] {
  const slides: { node: SectionNode; nodeIndex: number }[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type === "section" && node.role === "slide") {
      slides.push({ node, nodeIndex });
    }
  }

  return slides;
}

/** Human-facing slide label: the location's page number, else deck order. */
function slideLabel(node: SectionNode, order: number): number {
  return node.location?.page ?? order;
}

/** A013 — Every slide needs a title (PPTX). */
function checkSlideTitles(document: DocumentModel): AccessibilityIssue[] {
  if (document.source !== "pptx") {
    return [];
  }

  const issues: AccessibilityIssue[] = [];
  const slides = slideSections(document);

  slides.forEach(({ node, nodeIndex }, order) => {
    if ((node.title ?? "").trim().length > 0) {
      return;
    }

    issues.push(
      issue(
        "A013",
        `Slide ${slideLabel(node, order + 1)} has no title.`,
        {
          help: "Add text to the slide's title placeholder. Screen reader users move through a deck by slide title.",
          nodeIndex,
          node,
        }
      )
    );
  });

  return issues;
}

/** A014 — Slide titles should be distinct (PPTX). */
function checkDuplicateSlideTitles(
  document: DocumentModel
): AccessibilityIssue[] {
  if (document.source !== "pptx") {
    return [];
  }

  const slides = slideSections(document);
  const seen = new Map<
    string,
    { title: string; labels: number[]; first: (typeof slides)[number] }
  >();

  slides.forEach((slide, order) => {
    const title = (slide.node.title ?? "").trim();
    if (title.length === 0) {
      // Already reported by A013; do not pile on.
      return;
    }

    const key = title.toLocaleLowerCase();
    const group = seen.get(key);
    const label = slideLabel(slide.node, order + 1);

    if (group) {
      group.labels.push(label);
    } else {
      seen.set(key, { title, labels: [label], first: slide });
    }
  });

  const issues: AccessibilityIssue[] = [];

  // Report once per duplicated title, on its first slide, rather than once per
  // slide — otherwise a deck of ten "Agenda" slides produces ten findings.
  for (const group of seen.values()) {
    if (group.labels.length < 2) {
      continue;
    }

    issues.push(
      issue(
        "A014",
        `${group.labels.length} slides share the title "${group.title}" ` +
          `(slides ${group.labels.join(", ")}).`,
        {
          help: "Give each slide a distinct title so the deck can be navigated by title.",
          nodeIndex: group.first.nodeIndex,
          node: group.first.node,
        }
      )
    );
  }

  return issues;
}

/** A015 — The document language must be declared (PDF). */
function checkDocumentLanguage(
  document: DocumentModel
): AccessibilityIssue[] {
  if (document.source !== "pdf") {
    return [];
  }

  if ((document.flags?.language ?? "").trim().length > 0) {
    return [];
  }

  return [
    issue("A015", "Document language is not set.", {
      help: "Set the document language so a screen reader uses the right pronunciation rules.",
    }),
  ];
}

/** A016 — A PDF without a structure tree carries no semantics (PDF). */
function checkPdfIsTagged(document: DocumentModel): AccessibilityIssue[] {
  if (document.source !== "pdf") {
    return [];
  }

  // Undefined means the reader could not tell; only report a definite "no".
  if (document.flags?.tagged !== false) {
    return [];
  }

  return [
    issue("A016", "PDF is untagged: it has no structure tree.", {
      help: "Re-export the PDF from its source file with tagging enabled. This tool cannot add tags to an existing PDF.",
    }),
  ];
}

/** A017 — A PDF with no extractable text is likely a scan (PDF). */
function checkPdfHasText(document: DocumentModel): AccessibilityIssue[] {
  if (document.source !== "pdf") {
    return [];
  }

  if (document.flags?.hasText !== false) {
    return [];
  }

  return [
    issue(
      "A017",
      "PDF pages have no extractable text; the file is likely a scan.",
      {
        help: "Replace the scan with the original digital file, or run OCR on it and check the result by hand.",
      }
    ),
  ];
}
