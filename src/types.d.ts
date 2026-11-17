/**
 * Ambient types for Apps Script global scripts.
 * Keep in sync with @accessibility-docs/core (packages/core/src/types.ts).
 */
type DocumentNode =
  | TitleNode
  | HeadingNode
  | ParagraphNode
  | FigureNode
  | TableNode
  | SectionNode;

type DocumentSource = "gdoc" | "tiptap" | "a11ydoc" | "pptx" | "pdf";

interface NodeLocation {
  page: number;
  bbox?: [number, number, number, number];
}

interface NodeMetadata {
  location?: NodeLocation;
  sourceRef?: string;
}

interface TextFormatting {
  bold: boolean;
  fontSize: number | null;
  fontFamily: string | null;
  color: string | null;
  lineHeight: string | null;
  textAlign: "left" | "center" | "right" | "justify" | null;
}

interface TitleNode extends NodeMetadata {
  type: "title";
  text: string;
  formatting: TextFormatting;
}

interface HeadingNode extends NodeMetadata {
  type: "heading";
  level: number;
  text: string;
  formatting: TextFormatting;
}

interface ParagraphNode extends NodeMetadata {
  type: "paragraph";
  text: string;
  formatting: TextFormatting;
}

interface FigureNode extends NodeMetadata {
  type: "figure";
  altDescription: string;
  altTitle: string;
  src: string;
  width: number | null;
  height: number | null;
}

interface TableCell {
  text: string;
  header: boolean;
  colspan: number;
  rowspan: number;
}

interface TableRow {
  cells: TableCell[];
}

interface TableNode extends NodeMetadata {
  type: "table";
  rows: TableRow[];
}

interface SectionNode extends NodeMetadata {
  type: "section";
  role: "slide" | "page";
  title?: string;
}

interface DocumentFlags {
  tagged?: boolean;
  hasText?: boolean;
  language?: string;
}

interface DocumentModel {
  documentName: string;
  nodes: DocumentNode[];
  source?: DocumentSource;
  flags?: DocumentFlags;
}

type IssueSeverity = "error" | "warning" | "manual";

type FixStrategy = "auto" | "ai-assisted" | "manual-only";

interface AccessibilityIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  help?: string;
  nodeIndex?: number;
  fixable: FixStrategy;
  location?: NodeLocation;
  sourceRef?: string;
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
