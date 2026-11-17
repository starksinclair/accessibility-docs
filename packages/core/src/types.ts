export type DocumentNode =
  | TitleNode
  | HeadingNode
  | ParagraphNode
  | FigureNode
  | TableNode
  | SectionNode;

/** Which reader produced this model (FR-2.1). */
export type DocumentSource =
  | "gdoc"
  | "tiptap"
  | "a11ydoc"
  | "pptx"
  | "pdf";

/**
 * Where a node sits in the original file, so the UI can jump to it (FR-2.2).
 * `page` is the 1-based slide or page number; `bbox` is [x, y, w, h] in points.
 */
export interface NodeLocation {
  page: number;
  bbox?: [number, number, number, number];
}

/**
 * Optional provenance carried by every node. Readers fill these in; the
 * authoring adapters may leave them undefined, so nothing existing breaks.
 */
export interface NodeMetadata {
  location?: NodeLocation;
  /**
   * Opaque pointer the writer uses to find the element again — for example a
   * slide XML path plus shape id, or a PDF struct element object number.
   * Core never interprets it.
   */
  sourceRef?: string;
}

/** Shared text formats carried from the authoring editor into export. */
export interface TextFormatting {
  bold: boolean;
  fontSize: number | null;
  fontFamily: string | null;
  color: string | null;
  lineHeight: string | null;
  textAlign: "left" | "center" | "right" | "justify" | null;
}

export interface TitleNode extends NodeMetadata {
  type: "title";
  text: string;
  formatting: TextFormatting;
}

export interface HeadingNode extends NodeMetadata {
  type: "heading";
  level: number;
  text: string;
  formatting: TextFormatting;
}

export interface ParagraphNode extends NodeMetadata {
  type: "paragraph";
  text: string;
  formatting: TextFormatting;
}

export interface FigureNode extends NodeMetadata {
  type: "figure";
  altDescription: string;
  altTitle: string;
  /** Image source: data URL or absolute URL from the authoring editor. */
  src: string;
  width: number | null;
  height: number | null;
}

export interface TableCell {
  text: string;
  /** True when this cell is a column/row header (PDF TH). */
  header: boolean;
  colspan: number;
  rowspan: number;
}

export interface TableRow {
  cells: TableCell[];
}

export interface TableNode extends NodeMetadata {
  type: "table";
  rows: TableRow[];
}

/**
 * Marks the start of a slide or page (FR-2.1).
 *
 * This is a flat marker rather than a container: the nodes that belong to it
 * are the ones that follow, up to the next section. Keeping `nodes` flat means
 * `nodeIndex` still addresses a node directly, so every existing rule, adapter
 * and UI that walks the array is unaffected.
 */
export interface SectionNode extends NodeMetadata {
  type: "section";
  /** "slide" for PPTX decks, "page" for paged formats. */
  role: "slide" | "page";
  /** The slide or page title, when the source file has one. */
  title?: string;
}

/** Document-level facts a reader can establish (FR-2.1). */
export interface DocumentFlags {
  /** PDF only: does the file carry a structure tree? */
  tagged?: boolean;
  /** PDF only: is there extractable text (false suggests a scan)? */
  hasText?: boolean;
  /** BCP 47 language tag, for example "en-US". */
  language?: string;
}

export interface DocumentModel {
  documentName: string;
  nodes: DocumentNode[];
  /** Which reader produced this model. Undefined for older files. */
  source?: DocumentSource;
  flags?: DocumentFlags;
}

export type IssueSeverity = "error" | "warning" | "manual";

/** How much of the fix the tool can take on (FR-3.1). */
export type FixStrategy = "auto" | "ai-assisted" | "manual-only";

export interface AccessibilityIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  help?: string;
  /** Index into DocumentModel.nodes when the issue belongs to one block. */
  nodeIndex?: number;
  /** How the Workbench can fix this (FR-3.1). */
  fixable: FixStrategy;
  /** Copied from the node so the UI can jump to it (FR-2.2). */
  location?: NodeLocation;
  /** Copied from the node so a writer can find the element again (FR-2.2). */
  sourceRef?: string;
}

export interface AccessibilityReport {
  issues: AccessibilityIssue[];
  errorCount: number;
  warningCount: number;
  manualCheckCount: number;
}

export function defaultTextFormatting(
  overrides: Partial<TextFormatting> = {}
): TextFormatting {
  return {
    bold: false,
    fontSize: null,
    fontFamily: null,
    color: null,
    lineHeight: null,
    textAlign: null,
    ...overrides,
  };
}
