import type { AccessibilityIssue } from "@accessibility-docs/core";
import type { Editor } from "@tiptap/react";
import type { Node as PmNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { accessibilityPluginKey } from "./AccessibilityDecorations";

/**
 * Positions of top-level blocks that map to DocumentModel nodes.
 * Index matches AccessibilityIssue.nodeIndex.
 */
export function editorNodePositions(doc: PmNode): number[] {
  const positions: number[] = [];

  doc.forEach((node, offset) => {
    if (isDocumentBlock(node)) {
      positions.push(offset);
    }
  });

  return positions;
}

function isDocumentBlock(node: PmNode): boolean {
  return (
    node.type.name === "heading" ||
    node.type.name === "title" ||
    node.type.name === "paragraph" ||
    node.type.name === "figure" ||
    node.type.name === "image"
  );
}

export function applyAccessibilityMarks(
  editor: Editor,
  issues: AccessibilityIssue[]
): void {
  const positions = editorNodePositions(editor.state.doc);
  const byNode = new Map<number, AccessibilityIssue[]>();

  for (const issue of issues) {
    if (issue.nodeIndex === undefined) {
      continue;
    }
    const group = byNode.get(issue.nodeIndex) ?? [];
    group.push(issue);
    byNode.set(issue.nodeIndex, group);
  }

  const decorations: Decoration[] = [];

  for (const [index, nodeIssues] of byNode) {
    const from = positions[index];
    if (from === undefined) {
      continue;
    }

    const node = editor.state.doc.nodeAt(from);
    if (!node) {
      continue;
    }

    const to = from + node.nodeSize;
    const severity = worstSeverity(nodeIssues);

    decorations.push(
      Decoration.node(from, to, {
        class: `a11y-block a11y-block-${severity}`,
      })
    );
    decorations.push(
      Decoration.widget(to, () => buildIssueWidget(nodeIssues), {
        side: -1,
        ignoreSelection: true,
      })
    );
  }

  const set = DecorationSet.create(editor.state.doc, decorations);
  editor.view.dispatch(
    editor.state.tr.setMeta(accessibilityPluginKey, set)
  );
}

function worstSeverity(issues: AccessibilityIssue[]): string {
  if (issues.some((issue) => issue.severity === "error")) {
    return "error";
  }
  if (issues.some((issue) => issue.severity === "warning")) {
    return "warning";
  }
  return "manual";
}

function buildIssueWidget(issues: AccessibilityIssue[]): HTMLElement {
  const wrap = document.createElement("div");
  wrap.className = "a11y-inline";
  wrap.setAttribute("role", "status");

  for (const issue of issues) {
    const line = document.createElement("p");
    line.className = `a11y-inline-line ${issue.severity}`;
    const code = document.createElement("strong");
    code.textContent = issue.code;
    line.append(code, document.createTextNode(` ${issue.message}`));
    wrap.append(line);
  }

  return wrap;
}
