import {
  defaultTextFormatting,
  type DocumentModel,
  type DocumentNode,
  type TableCell,
  type TableNode,
  type TableRow,
  type TextFormatting,
} from "@accessibility-docs/core";
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

  return { documentName, nodes, source: "tiptap" };
}

function mapNode(node: JSONContent): DocumentNode | null {
  switch (node.type) {
    case "heading": {
      const level = Number(node.attrs?.level ?? 1);
      const text = textFromNode(node);
      const formatting = formattingFromNode(node);

      if (node.attrs?.asTitle === true || level === 0) {
        return { type: "title", text, formatting };
      }

      return {
        type: "heading",
        level: Math.min(6, Math.max(1, level)),
        text,
        formatting,
      };
    }
    case "title":
      return {
        type: "title",
        text: textFromNode(node),
        formatting: formattingFromNode(node),
      };
    case "paragraph":
    case "bulletList":
    case "orderedList":
    case "taskList":
    case "blockquote":
    case "codeBlock":
      return {
        type: "paragraph",
        text: textFromNode(node),
        formatting: formattingFromNode(node),
      };
    case "table":
      return mapTable(node);
    case "figure":
    case "image":
      return {
        type: "figure",
        altTitle: String(node.attrs?.altTitle ?? ""),
        altDescription: String(
          node.attrs?.altDescription ?? node.attrs?.alt ?? ""
        ),
        src: String(node.attrs?.src ?? ""),
        width: numberOrNull(node.attrs?.width),
        height: numberOrNull(node.attrs?.height),
      };
    default:
      return null;
  }
}

function mapTable(node: JSONContent): TableNode | null {
  const rows: TableRow[] = [];

  for (const child of node.content ?? []) {
    if (child.type !== "tableRow") {
      continue;
    }

    const cells: TableCell[] = [];
    for (const cell of child.content ?? []) {
      if (cell.type !== "tableHeader" && cell.type !== "tableCell") {
        continue;
      }

      cells.push({
        text: textFromNode(cell).trim(),
        header: cell.type === "tableHeader",
        colspan: Math.max(1, Number(cell.attrs?.colspan ?? 1) || 1),
        rowspan: Math.max(1, Number(cell.attrs?.rowspan ?? 1) || 1),
      });
    }

    rows.push({ cells });
  }

  if (rows.length === 0) {
    return null;
  }

  return { type: "table", rows };
}

function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formattingFromNode(node: JSONContent): TextFormatting {
  return defaultTextFormatting({
    bold: hasMark(node, "bold"),
    fontSize: fontSizeFromNode(node),
    fontFamily: styleAttrFromNode(node, "fontFamily"),
    color: styleAttrFromNode(node, "color"),
    lineHeight: styleAttrFromNode(node, "lineHeight"),
    textAlign: textAlignFromNode(node),
  });
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

function fontSizeFromNode(node: JSONContent): number | null {
  const raw = styleAttrFromNode(node, "fontSize");
  if (!raw) {
    return null;
  }

  const value = Number.parseFloat(raw);
  return Number.isFinite(value) ? value : null;
}

function styleAttrFromNode(
  node: JSONContent,
  attr: "fontFamily" | "fontSize" | "color" | "lineHeight"
): string | null {
  for (const mark of node.marks ?? []) {
    if (mark.type === "textStyle") {
      const value = mark.attrs?.[attr];
      if (typeof value === "string" && value.trim().length > 0) {
        return value;
      }
    }
  }

  for (const child of node.content ?? []) {
    const value = styleAttrFromNode(child, attr);
    if (value !== null) {
      return value;
    }
  }

  return null;
}

function textAlignFromNode(
  node: JSONContent
): TextFormatting["textAlign"] {
  const value = node.attrs?.textAlign;
  if (
    value === "left" ||
    value === "center" ||
    value === "right" ||
    value === "justify"
  ) {
    return value;
  }
  return null;
}

function hasMark(node: JSONContent, markName: string): boolean {
  if (node.marks?.some((mark) => mark.type === markName)) {
    return true;
  }

  return (node.content ?? []).some((child) => hasMark(child, markName));
}
