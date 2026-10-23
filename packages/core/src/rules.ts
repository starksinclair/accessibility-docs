import type {
  AccessibilityIssue,
  AccessibilityReport,
  DocumentModel,
} from "./types.js";

/**
 * Runs all accessibility checks against a DocumentModel.
 */
export function runAccessibilityChecks(
  document: DocumentModel
): AccessibilityReport {
  const issues: AccessibilityIssue[] = [
    ...checkDocumentTitle(document),
    ...checkPossibleVisualHeadings(document),
    ...checkImagesHaveAltText(document),
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
    {
      code: "A001",
      severity: "error",
      message: "Document does not contain a semantic title.",
      help: "Apply a Title style to the document title.",
      nodeIndex: document.nodes.length > 0 ? 0 : undefined,
    },
  ];
}

/** A002 — Bold/large paragraphs that look like headings. */
function checkPossibleVisualHeadings(
  document: DocumentModel
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type !== "paragraph") {
      continue;
    }

    const looksLikeHeading =
      node.formatting.bold &&
      node.formatting.fontSize !== null &&
      node.formatting.fontSize >= 16;

    if (looksLikeHeading) {
      issues.push({
        code: "A002",
        severity: "warning",
        message:
          `"${node.text}" visually resembles a heading ` +
          "but is not marked as a semantic heading.",
        help: "If this text is a section heading, apply an appropriate Heading style.",
        nodeIndex,
      });
    }
  }

  return issues;
}

/** A003 / A004 — Images must have alt text. */
function checkImagesHaveAltText(
  document: DocumentModel
): AccessibilityIssue[] {
  const issues: AccessibilityIssue[] = [];

  for (let nodeIndex = 0; nodeIndex < document.nodes.length; nodeIndex++) {
    const node = document.nodes[nodeIndex];
    if (node.type !== "figure") {
      continue;
    }

    if (node.altTitle.trim().length === 0) {
      issues.push({
        code: "A003",
        severity: "warning",
        message: "Image does not have an alt title.",
        help: "Add a short alt title that names the image.",
        nodeIndex,
      });
    }

    if (node.altDescription.trim().length === 0) {
      issues.push({
        code: "A004",
        severity: "error",
        message: "Image does not have an alt description.",
        help: "Add an alt description that conveys the image content.",
        nodeIndex,
      });
    }
  }

  return issues;
}
