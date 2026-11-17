export type {
  AccessibilityIssue,
  AccessibilityReport,
  DocumentFlags,
  DocumentModel,
  DocumentNode,
  DocumentSource,
  FigureNode,
  FixStrategy,
  HeadingNode,
  IssueSeverity,
  NodeLocation,
  NodeMetadata,
  ParagraphNode,
  SectionNode,
  TableCell,
  TableNode,
  TableRow,
  TextFormatting,
  TitleNode,
} from "./types.js";

export { defaultTextFormatting } from "./types.js";

export { assertAccessible, runAccessibilityChecks } from "./rules.js";

export type { RuleMetadata, RuleScope } from "./ruleCatalog.js";
export { getRuleMetadata, listRules, RULES } from "./ruleCatalog.js";

export type { A11yDocFile } from "./serialize.js";
export { parseDocument, serializeDocument } from "./serialize.js";
