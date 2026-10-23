/**
 * Ambient types for Apps Script global scripts.
 * Keep in sync with @accessibility-docs/core (packages/core/src/types.ts).
 */
type DocumentNode = TitleNode | HeadingNode | ParagraphNode | FigureNode;

interface TitleNode {
  type: "title";
  text: string;
}

interface HeadingNode {
  type: "heading";
  level: number;
  text: string;
}

interface ParagraphNode {
  type: "paragraph";
  text: string;
  formatting: {
    bold: boolean;
    fontSize: number | null;
  };
}

interface FigureNode {
  type: "figure";
  altDescription: string;
  altTitle: string;
}

interface DocumentModel {
  documentName: string;
  nodes: DocumentNode[];
}

type IssueSeverity = "error" | "warning" | "manual";

interface AccessibilityIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  help?: string;
  nodeIndex?: number;
}

interface AccessibilityReport {
  issues: AccessibilityIssue[];
  errorCount: number;
  warningCount: number;
  manualCheckCount: number;
}

/** Provided at runtime by dist/Rules.js (bundled from @accessibility-docs/core). */
declare function runAccessibilityChecks(
  document: DocumentModel
): AccessibilityReport;

declare function assertAccessible(
  document: DocumentModel
):
  | { ok: true; report: AccessibilityReport }
  | { ok: false; report: AccessibilityReport };
