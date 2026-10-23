export type {
  AccessibilityIssue,
  AccessibilityReport,
  DocumentModel,
  DocumentNode,
  FigureNode,
  HeadingNode,
  IssueSeverity,
  ParagraphNode,
  TitleNode,
} from "./types.js";

export { assertAccessible, runAccessibilityChecks } from "./rules.js";

export type { A11yDocFile } from "./serialize.js";
export { parseDocument, serializeDocument } from "./serialize.js";
