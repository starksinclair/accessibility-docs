/**
 * The shape of a pdf.js structure tree, and the addresses the PDF writer uses
 * to find an element again.
 *
 * pdf.js hands back a plain tree of roles and marked-content ids, with no
 * object numbers, so a node's address has to be built from what the tree does
 * carry. A figure's marked-content id is the right one: the page's parent tree
 * maps that id straight back to the structure element, which is exactly the
 * lookup `/Alt` needs (FR-5.8).
 */

/** One element of a pdf.js structure tree. */
export interface StructNode {
  role?: string;
  children?: StructChild[];
  /** `/Alt`, or `/ActualText` when there is no `/Alt`. */
  alt?: string;
  lang?: string;
  /** [x0, y0, x1, y1] in PDF user space, when the element declares one. */
  bbox?: [number, number, number, number];
  colSpan?: number;
  rowSpan?: number;
}

/** A marked-content leaf: a span of the page's content stream. */
export interface StructContent {
  type: "content" | "annotation" | "object";
  /** "p<pageObjId>_mc<mcid>" for page content. */
  id?: string;
}

export type StructChild = StructNode | StructContent;

export function isStructNode(value: unknown): value is StructNode {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const candidate = value as StructContent & StructNode;
  // A content leaf has a `type`; an element has a `role` or children.
  return candidate.type === undefined;
}

/**
 * Every marked-content id under an element, in reading order.
 *
 * Descendants are included so a heading that wraps a `Span`, or a table cell
 * that wraps two `P`s, reports its whole text.
 */
export function mcidsOf(node: StructNode): number[] {
  const found: number[] = [];

  const visit = (current: StructNode): void => {
    for (const child of current.children ?? []) {
      if (isStructNode(child)) {
        visit(child);
        continue;
      }
      if (child.type !== "content") {
        continue;
      }
      const match = /_mc(\d+)$/.exec(child.id ?? "");
      if (match) {
        found.push(Number(match[1]));
      }
    }
  };

  visit(node);
  return found;
}

/** Where a figure sits, as an address the writer can resolve (FR-5.8). */
export function figureSourceRef(
  page: number,
  mcid: number | undefined,
  ordinal: number
): string {
  return mcid === undefined
    ? `pdf:figure#page=${page}&ordinal=${ordinal}`
    : `pdf:figure#page=${page}&mcid=${mcid}`;
}

export interface FigureRef {
  /** 1-based page number. */
  page: number;
  /** Marked-content id, when the figure has tagged content on the page. */
  mcid?: number;
  /** 1-based position among the page's figures, when it has no content. */
  ordinal?: number;
}

export function parseFigureRef(sourceRef: string): FigureRef | undefined {
  const match = /^pdf:figure#page=(\d+)&(mcid|ordinal)=(\d+)$/.exec(sourceRef);
  if (!match) {
    return undefined;
  }

  const page = Number(match[1]);
  const value = Number(match[3]);

  return match[2] === "mcid"
    ? { page, mcid: value }
    : { page, ordinal: value };
}
