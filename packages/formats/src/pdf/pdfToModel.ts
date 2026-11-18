/**
 * PDF reader (FR-4.7, FR-4.8): a .pdf file in, a DocumentModel out.
 *
 * A tagged PDF already carries the structure the rules ask about — headings,
 * figures with `/Alt`, tables with `/TH` — in its structure tree, so this
 * reader takes that tree as the document's semantics rather than guessing from
 * how the page looks. What a sighted reader sees (font sizes, bold lines that
 * read like headings) is deliberately ignored: assistive technology reads the
 * tree, so the tree is what gets checked.
 *
 * An untagged PDF has no tree at all. It still produces a model, so the file
 * ranks alongside the rest of a batch and reports A016, but no structure is
 * invented for it (FR-4.8).
 */
import type {
  DocumentFlags,
  DocumentModel,
  DocumentNode,
  FigureNode,
  NodeLocation,
  TableCell,
  TableRow,
} from "@accessibility-docs/core";
import { defaultTextFormatting } from "@accessibility-docs/core";
import type { FileLike } from "../zip.js";
import { toBytes } from "../zip.js";
import {
  assertPdfSignature,
  configureWorker,
  openPdf,
  type PdfOpenOptions,
} from "./pdfjs.js";
import type { StructNode } from "./structTree.js";
import {
  figureSourceRef,
  isStructNode,
  mcidsOf,
  tableSourceRef,
} from "./structTree.js";

export interface PdfReadOptions extends PdfOpenOptions {
  /**
   * Name to fall back on when the file has no `/Title`. The Workbench passes
   * the uploaded file's name; a `File` supplies it on its own.
   */
  fileName?: string;
}

/** Heading roles in a PDF structure tree, mapped to a model heading level. */
const NUMBERED_HEADING = /^H([1-6])$/;

/** Roles whose nesting deepens an unnumbered `H` (PDF 1.7, 14.8.4.3.1). */
const SECTION_ROLES = new Set(["Sect", "Part", "Art", "Div"]);

export async function pdfToModel(
  file: FileLike | { name?: string },
  options: PdfReadOptions = {}
): Promise<DocumentModel> {
  const fileName =
    options.fileName ??
    (typeof (file as { name?: string }).name === "string"
      ? (file as { name: string }).name
      : undefined);

  const bytes = await toBytes(file as FileLike);
  assertPdfSignature(bytes);
  configureWorker(options);

  const { document: pdf, close } = await openPdf(bytes, options);

  try {
    const { title, language } = await readMetadata(pdf);
    const nodes: DocumentNode[] = [];

    // `/Title` is the document title a screen reader announces, so it is the
    // node A001 looks at. When it is missing, A001 fires and the writer's auto
    // fix (FR-5.6) is exactly "write /Title".
    if (title) {
      nodes.push({
        type: "title",
        text: title,
        formatting: defaultTextFormatting(),
        sourceRef: "pdf:info#Title",
      });
    }

    let tagged = false;
    let hasText = false;

    for (let page = 1; page <= pdf.numPages; page++) {
      const pageProxy = await pdf.getPage(page);
      const [structTree, text] = await Promise.all([
        readStructTree(pageProxy),
        readPageText(pageProxy),
      ]);

      if (text.hasText) {
        hasText = true;
      }

      const section: DocumentNode = {
        type: "section",
        role: "page",
        location: { page },
        sourceRef: `pdf:page#${page}`,
      };
      nodes.push(section);

      if (!structTree) {
        continue;
      }
      tagged = true;

      const reader = new PageStructureReader(page, text.byMcid, text.bboxByMcid);
      const pageNodes = reader.read(structTree);

      // The first heading on a page is that page's own title, which is what
      // the viewer's page map and the outline navigate by (FR-8.4).
      const firstHeading = pageNodes.find((node) => node.type === "heading");
      if (firstHeading && firstHeading.type === "heading" && firstHeading.text) {
        section.title = firstHeading.text;
      }

      nodes.push(...pageNodes);
    }

    const flags: DocumentFlags = { tagged, hasText };
    if (language) {
      flags.language = language;
    }

    return {
      documentName: title || stripExtension(fileName) || "Untitled PDF",
      nodes,
      source: "pdf",
      flags,
    };
  } finally {
    await close();
  }
}

function stripExtension(fileName: string | undefined): string {
  if (!fileName) {
    return "";
  }
  return fileName.replace(/\.pdf$/i, "").trim();
}

interface PdfMetadata {
  title: string;
  language: string;
}

/**
 * FR-4.7 — the document title and language.
 *
 * `info.Title` is the Info dictionary's `/Title`; `info.Language` is the
 * catalog's `/Lang`, which is the one assistive technology uses.
 */
async function readMetadata(pdf: {
  getMetadata: () => Promise<{ info?: Record<string, unknown> }>;
}): Promise<PdfMetadata> {
  try {
    const { info } = await pdf.getMetadata();
    return {
      title: asTrimmedString(info?.Title),
      language: asTrimmedString(info?.Language),
    };
  } catch {
    // A damaged or missing Info dictionary is not a reason to refuse the file:
    // it reads as "no title, no language", which is what A001 and A015 report.
    return { title: "", language: "" };
  }
}

function asTrimmedString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

async function readStructTree(page: {
  getStructTree: () => Promise<unknown>;
}): Promise<StructNode | null> {
  let tree: unknown;
  try {
    tree = await page.getStructTree();
  } catch {
    return null;
  }

  if (!isStructNode(tree)) {
    return null;
  }

  // pdf.js answers with an empty root for a page that has a structure tree
  // somewhere in the document but nothing tagged on this page. That page
  // carries no semantics, but the document is still tagged.
  return tree;
}

/** Axis-aligned box in PDF user space: [x0, y0, x1, y1]. */
type PdfBBox = [number, number, number, number];

interface PageText {
  hasText: boolean;
  /** Text of each marked-content id, including the text of its descendants. */
  byMcid: Map<number, string>;
  /**
   * Union of text-item boxes per marked-content id. Used when the structure
   * tree does not declare a bbox of its own (FR-8.6).
   */
  bboxByMcid: Map<number, PdfBBox>;
}

/**
 * FR-4.7 — the page's text, kept against the marked-content ids that the
 * structure tree points at.
 *
 * `includeMarkedContent` turns the text stream into a sequence with
 * begin/end markers, which is the only way to say which words belong to which
 * tagged element. Text is appended to every open id, so a heading that
 * contains a `Span` still reports its whole line.
 */
async function readPageText(page: {
  getTextContent: (options: {
    includeMarkedContent: boolean;
  }) => Promise<{ items: unknown[] }>;
}): Promise<PageText> {
  const byMcid = new Map<number, string>();
  const bboxByMcid = new Map<number, PdfBBox>();
  let hasText = false;

  let items: unknown[];
  try {
    ({ items } = await page.getTextContent({ includeMarkedContent: true }));
  } catch {
    return { hasText, byMcid, bboxByMcid };
  }

  const open: number[] = [];

  for (const item of items) {
    const entry = item as {
      type?: string;
      id?: string;
      str?: string;
      hasEOL?: boolean;
      transform?: number[];
      width?: number;
      height?: number;
    };

    if (entry.type === "beginMarkedContentProps" || entry.type === "beginMarkedContent") {
      open.push(mcidOf(entry.id));
      continue;
    }

    if (entry.type === "endMarkedContent") {
      open.pop();
      continue;
    }

    if (typeof entry.str !== "string") {
      continue;
    }

    if (entry.str.trim().length > 0) {
      hasText = true;
    }

    const itemBox = textItemBBox(entry);

    for (const mcid of open) {
      if (mcid < 0) {
        continue;
      }
      byMcid.set(mcid, (byMcid.get(mcid) ?? "") + entry.str);
      if (itemBox) {
        const prior = bboxByMcid.get(mcid);
        bboxByMcid.set(mcid, prior ? unionBBox(prior, itemBox) : itemBox);
      }
    }
  }

  return { hasText, byMcid, bboxByMcid };
}

/** pdf.js text item → [x0, y0, x1, y1] in PDF user space. */
function textItemBBox(entry: {
  transform?: number[];
  width?: number;
  height?: number;
}): PdfBBox | undefined {
  const transform = entry.transform;
  if (!transform || transform.length < 6) {
    return undefined;
  }
  const x = transform[4];
  const y = transform[5];
  const width = typeof entry.width === "number" ? entry.width : 0;
  const height = typeof entry.height === "number" ? entry.height : 0;
  if (width <= 0 && height <= 0) {
    return undefined;
  }
  return [x, y, x + Math.max(width, 0), y + Math.max(height, 0)];
}

function unionBBox(a: PdfBBox, b: PdfBBox): PdfBBox {
  return [
    Math.min(a[0], b[0]),
    Math.min(a[1], b[1]),
    Math.max(a[2], b[2]),
    Math.max(a[3], b[3]),
  ];
}

/** "p12_mc3" is marked-content id 3; a marker without an id is not one. */
function mcidOf(id: string | undefined): number {
  const match = /_mc(\d+)$/.exec(id ?? "");
  return match ? Number(match[1]) : -1;
}

/**
 * Turns one page's structure tree into model nodes, in reading order.
 *
 * Only the roles the rules can act on become nodes. A `Span`, `Link` or
 * `Sect` is walked through rather than represented: it carries no finding of
 * its own, and inventing a node for it would pad the model that A009 counts.
 */
class PageStructureReader {
  private readonly nodes: DocumentNode[] = [];
  private figureIndex = 0;
  private tableIndex = 0;

  constructor(
    private readonly page: number,
    private readonly text: Map<number, string>,
    private readonly bboxByMcid: Map<number, PdfBBox>
  ) {}

  read(root: StructNode): DocumentNode[] {
    this.walk(root, 0);
    return this.nodes;
  }

  private walk(node: StructNode, sectionDepth: number): void {
    const role = node.role ?? "";

    const numbered = NUMBERED_HEADING.exec(role);
    if (numbered) {
      this.pushHeading(node, Number(numbered[1]));
      return;
    }

    // An unnumbered `H` takes its level from how deeply it is nested, which is
    // how the PDF specification defines it.
    if (role === "H") {
      this.pushHeading(node, Math.min(Math.max(sectionDepth, 1), 6));
      return;
    }

    if (role === "P") {
      this.pushParagraph(node);
      return;
    }

    if (role === "Figure") {
      this.pushFigure(node);
      return;
    }

    if (role === "Table") {
      this.pushTable(node);
      return;
    }

    const deeper = SECTION_ROLES.has(role) ? sectionDepth + 1 : sectionDepth;
    for (const child of node.children ?? []) {
      if (isStructNode(child)) {
        this.walk(child, deeper);
      }
    }
  }

  private pushHeading(node: StructNode, level: number): void {
    this.nodes.push({
      type: "heading",
      level,
      text: this.textOf(node),
      formatting: defaultTextFormatting(),
      location: this.locationOf(node),
      sourceRef: this.structRef(node),
    });
  }

  private pushParagraph(node: StructNode): void {
    const text = this.textOf(node);
    if (text.length === 0) {
      // An empty `P` is page furniture — a spacer, or a tagged blank line. It
      // is not a finding, and a paragraph node for it would only inflate the
      // block count A009 measures.
      return;
    }

    this.nodes.push({
      type: "paragraph",
      text,
      formatting: defaultTextFormatting(),
      location: this.locationOf(node),
      sourceRef: this.structRef(node),
    });
  }

  /**
   * FR-4.7 — a `Figure` with `/Alt` (or `/ActualText`) has a text
   * alternative; one without is what A004 reports.
   *
   * `src` is the figure's own address in the file rather than image bytes.
   * A PDF figure is a region of a page's content stream, not a separate file
   * the way a PPTX picture is, so the honest source is where it sits — and it
   * is what the writer uses to find the element again (FR-5.8).
   */
  private pushFigure(node: StructNode): void {
    this.figureIndex += 1;
    const sourceRef = figureSourceRef(
      this.page,
      mcidsOf(node)[0],
      this.figureIndex
    );

    const figure: FigureNode = {
      type: "figure",
      altDescription: asTrimmedString(node.alt),
      altTitle: "",
      src: sourceRef,
      width: null,
      height: null,
      location: this.locationOf(node),
      sourceRef,
    };

    const bbox = node.bbox;
    if (bbox) {
      figure.width = round(bbox[2] - bbox[0]);
      figure.height = round(bbox[3] - bbox[1]);
    }

    this.nodes.push(figure);
  }

  /**
   * FR-4.7 — `TH` cells are headers, `TD` cells are not, which is the
   * distinction A011 and A012 are about.
   */
  private pushTable(node: StructNode): void {
    this.tableIndex += 1;
    const rows: TableRow[] = [];

    const collectRows = (current: StructNode): void => {
      for (const child of current.children ?? []) {
        if (!isStructNode(child)) {
          continue;
        }
        if (child.role === "TR") {
          rows.push({ cells: this.readCells(child) });
          continue;
        }
        // THead, TBody and TFoot group rows rather than being rows.
        collectRows(child);
      }
    };

    collectRows(node);

    this.nodes.push({
      type: "table",
      rows,
      location: this.locationOf(node),
      // FR-5.9 — the writer finds this table again by the same address.
      sourceRef: tableSourceRef(
        this.page,
        mcidsOf(node)[0],
        this.tableIndex
      ),
    });
  }

  private readCells(row: StructNode): TableCell[] {
    const cells: TableCell[] = [];

    for (const child of row.children ?? []) {
      if (!isStructNode(child)) {
        continue;
      }
      if (child.role !== "TH" && child.role !== "TD") {
        continue;
      }

      cells.push({
        text: this.textOf(child),
        header: child.role === "TH",
        colspan: spanOf(child.colSpan),
        rowspan: spanOf(child.rowSpan),
      });
    }

    return cells;
  }

  /** The text of an element, including everything tagged inside it. */
  private textOf(node: StructNode): string {
    const parts: string[] = [];

    for (const mcid of mcidsOf(node)) {
      const text = this.text.get(mcid);
      if (text) {
        parts.push(text);
      }
    }

    return parts.join(" ").replace(/\s+/g, " ").trim();
  }

  private locationOf(node: StructNode): NodeLocation {
    const location: NodeLocation = { page: this.page };
    // Prefer a bbox the structure tree declared; otherwise union the text
    // items tagged under this element so FR-8.6 still has something to draw.
    const bbox = node.bbox ?? this.bboxFromContent(node);

    if (bbox) {
      // PDF user space, measured from the bottom-left of the page, unlike the
      // top-left points a PPTX shape reports. The viewer's highlight box
      // (FR-8.6) flips it against the page height.
      location.bbox = [
        round(bbox[0]),
        round(bbox[1]),
        round(bbox[2] - bbox[0]),
        round(bbox[3] - bbox[1]),
      ];
    }

    return location;
  }

  private bboxFromContent(node: StructNode): PdfBBox | undefined {
    let union: PdfBBox | undefined;
    for (const mcid of mcidsOf(node)) {
      const box = this.bboxByMcid.get(mcid);
      if (!box) {
        continue;
      }
      union = union ? unionBBox(union, box) : box;
    }
    return union;
  }

  /**
   * A pointer the UI can use to jump to the element. Only figures are
   * writable today (FR-5.8), so only they need an address the writer can
   * resolve; for everything else the page is enough.
   */
  private structRef(node: StructNode): string {
    const mcid = mcidsOf(node)[0];
    return mcid === undefined
      ? `pdf:page#${this.page}`
      : `pdf:page#${this.page}&mcid=${mcid}`;
  }
}

function spanOf(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value > 1
    ? value
    : 1;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
