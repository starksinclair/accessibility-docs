import type { DocumentModel, DocumentNode } from "@accessibility-docs/core";
import type { JSONContent } from "@tiptap/react";

/**
 * Maps TipTap editor JSON to the shared DocumentModel IR.
 * Node order in the editor is reading order.
 */
export function tiptapToModel(
  doc: JSONContent,
  documentName: string
): DocumentModel {
  const nodes: DocumentNode[] = [];

  for (const child of doc.content ?? []) {
    const mapped = mapNode(child);
    if (mapped) {
      nodes.push(mapped);
    }
  }

  return { documentName, nodes };
}

function mapNode(node: JSONContent): DocumentNode | null {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const text = textFromNode(node);

      // TipTap has no Title node; level 1 can be used as title via toolbar "Title".
      // We map heading level 0 (custom) or a dedicated mark — Title command sets level to "title".
      if (node.attrs?.asTitle === true || level === 0) {
        return { type: "title", text };
      }

      return {
        type: "heading",
        level: Math.min(6, Math.max(1, level)),
        text,
      };
    }
    case "title":
      return { type: "title", text: textFromNode(node) };
    case "paragraph":
      return {
        type: "paragraph",
        text: textFromNode(node),
        formatting: {
          bold: hasMark(node, "bold"),
          fontSize: null,
        },
      };
    case "figure":
    case "image":
      return {
        type: "figure",
        altTitle: String(node.attrs?.altTitle ?? ""),
        altDescription: String(
          node.attrs?.altDescription ?? node.attrs?.alt ?? ""
        ),
      };
    default:
      return null;
  }
}

function textFromNode(node: JSONContent): string {
  if (!node.content) {
    return "";
  }

  return node.content
    .map((child) => {
      if (child.type === "text") {
        return child.text ?? "";
      }
      return textFromNode(child);
    })
    .join("");
}

function hasMark(node: JSONContent, markName: string): boolean {
  if (node.marks?.some((mark) => mark.type === markName)) {
    return true;
  }

  return (node.content ?? []).some((child) => hasMark(child, markName));
}
