/**
 * Turning a checked DocumentModel into the shape a viewer renders (FR-8).
 *
 * The model is deliberately flat: a `section` marker followed by the nodes
 * that belong to it. That is right for the rules and wrong for a screen, so
 * this is the one place that folds it back into slides. It is pure and
 * dependency-free (C-1), and format-agnostic, so the PDF viewer can reuse it
 * unchanged.
 */
import type {
  AccessibilityIssue,
  AccessibilityReport,
  DocumentModel,
  DocumentNode,
  SectionNode,
} from "./types.js";

export interface OutlineNode {
  node: DocumentNode;
  /** Index into `DocumentModel.nodes`, as `AccessibilityIssue.nodeIndex` uses. */
  nodeIndex: number;
  /** Issues reported against this node. */
  issues: AccessibilityIssue[];
}

export interface OutlineSection {
  /** 1-based slide or page number. */
  page: number;
  role: SectionNode["role"];
  /** The slide's own title: undefined when there is no title placeholder. */
  title?: string;
  /** The section marker itself, so a fix can find it. */
  nodeIndex: number;
  sourceRef?: string;
  nodes: OutlineNode[];
  /** Every issue on this slide, including those on the marker (A013, A014). */
  issues: AccessibilityIssue[];
}

export interface DocumentOutline {
  sections: OutlineSection[];
  /** Nodes before the first section marker, such as the document title. */
  preamble: OutlineNode[];
  /** Issues about the file as a whole rather than one slide. */
  documentIssues: AccessibilityIssue[];
  /** Total issues, so a counter does not have to add the parts back up. */
  issueCount: number;
}

/**
 * Groups a model and its report by slide.
 *
 * Placement follows `location.page` alone, never `nodeIndex`. A document-level
 * finding like A001 ("no document title") points its `nodeIndex` at block 0
 * because that is where a title belongs — in a deck, block 0 is slide 1's
 * marker, so trusting the index would file a whole-file problem against one
 * slide. A model with no locations (the Author editor's) therefore reports
 * everything as a document issue, which is exactly right: it has no slides.
 */
export function buildOutline(
  model: DocumentModel,
  report: AccessibilityReport
): DocumentOutline {
  const issuesByNode = new Map<number, AccessibilityIssue[]>();
  for (const issue of report.issues) {
    if (issue.nodeIndex === undefined) {
      continue;
    }
    const group = issuesByNode.get(issue.nodeIndex) ?? [];
    group.push(issue);
    issuesByNode.set(issue.nodeIndex, group);
  }

  const outlineNode = (node: DocumentNode, nodeIndex: number): OutlineNode => ({
    node,
    nodeIndex,
    issues: issuesByNode.get(nodeIndex) ?? [],
  });

  const sections: OutlineSection[] = [];
  const preamble: OutlineNode[] = [];
  let current: OutlineSection | undefined;

  model.nodes.forEach((node, nodeIndex) => {
    if (node.type === "section") {
      current = {
        // A section with no location still needs a number to scroll to, so
        // fall back to its position in the deck.
        page: node.location?.page ?? sections.length + 1,
        role: node.role,
        nodeIndex,
        nodes: [],
        issues: [],
      };
      if (node.title !== undefined) {
        current.title = node.title;
      }
      if (node.sourceRef !== undefined) {
        current.sourceRef = node.sourceRef;
      }
      sections.push(current);
      return;
    }

    const entry = outlineNode(node, nodeIndex);
    if (current) {
      current.nodes.push(entry);
    } else {
      preamble.push(entry);
    }
  });

  const byPage = new Map<number, OutlineSection>();
  for (const section of sections) {
    byPage.set(section.page, section);
  }

  const documentIssues: AccessibilityIssue[] = [];
  for (const issue of report.issues) {
    const section =
      issue.location === undefined ? undefined : byPage.get(issue.location.page);

    if (section) {
      section.issues.push(issue);
    } else {
      documentIssues.push(issue);
    }
  }

  return {
    sections,
    preamble,
    documentIssues,
    issueCount: report.issues.length,
  };
}
