export type DocumentNode =
  | TitleNode
  | HeadingNode
  | ParagraphNode
  | FigureNode;

export interface TitleNode {
  type: "title";
  text: string;
}

export interface HeadingNode {
  type: "heading";
  level: number;
  text: string;
}

export interface ParagraphNode {
  type: "paragraph";
  text: string;
  formatting: {
    bold: boolean;
    fontSize: number | null;
  };
}

export interface FigureNode {
  type: "figure";
  altDescription: string;
  altTitle: string;
}

export interface DocumentModel {
  documentName: string;
  nodes: DocumentNode[];
}

export type IssueSeverity = "error" | "warning" | "manual";

export interface AccessibilityIssue {
  code: string;
  severity: IssueSeverity;
  message: string;
  help?: string;
  /** Index into DocumentModel.nodes when the issue belongs to one block. */
  nodeIndex?: number;
}

export interface AccessibilityReport {
  issues: AccessibilityIssue[];
  errorCount: number;
  warningCount: number;
  manualCheckCount: number;
}
