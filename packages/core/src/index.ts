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
export {
  getRuleMetadata,
  listRules,
  RETIRED_RULES,
  RULES,
} from "./ruleCatalog.js";

export { draftSlideTitle } from "./draftTitle.js";

export type {
  DocumentOutline,
  OutlineNode,
  OutlineSection,
} from "./outline.js";
export { buildOutline } from "./outline.js";

export type {
  EffortEstimate,
  PriorityScore,
  RankableDocument,
  RankedDocument,
  RankingWeights,
} from "./ranking.js";
export {
  DEFAULT_RANKING_WEIGHTS,
  rankDocuments,
  scoreReport,
} from "./ranking.js";

export type { A11yDocFile } from "./serialize.js";
export { parseDocument, serializeDocument } from "./serialize.js";
