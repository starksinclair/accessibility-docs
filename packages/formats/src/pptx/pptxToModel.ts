/**
 * PPTX reader (FR-4.1 to FR-4.6): a .pptx file in, a DocumentModel out.
 *
 * The model is the only thing the rules engine ever sees, so everything a rule
 * or a writer needs has to be carried here: `source: "pptx"`, one flat
 * `section` marker per slide, and `location` plus `sourceRef` on every node so
 * the Workbench can jump to an element (FR-2.2) and the PPTX writer can find it
 * again (FR-5).
 */
import type JSZip from "jszip";
import type {
  DocumentModel,
  DocumentNode,
  FigureNode,
  TableCell,
  TableRow,
  TextFormatting,
} from "@accessibility-docs/core";
import { defaultTextFormatting } from "@accessibility-docs/core";
import { FormatReadError } from "../errors.js";
import type { Relationship } from "../opc.js";
import { readRelationships } from "../opc.js";
import type { XmlNode } from "../xml.js";
import {
  attr,
  child,
  children,
  childrenOf,
  descend,
  descendChildren,
  findFirst,
  parseXml,
  tagOf,
  textOf,
} from "../xml.js";
import type { FileLike } from "../zip.js";
import { assertZipContainer, openZip, readPart, toBytes } from "../zip.js";

/** 1 pt = 12700 EMU (FR-4.5). */
const EMU_PER_POINT = 12700;

/** Placeholder types that make a shape the slide's title (FR-4.2). */
const TITLE_PLACEHOLDERS = new Set(["title", "ctrTitle"]);

export interface PptxReadOptions {
  /**
   * Name to fall back on when the deck has no `dc:title`. The Workbench passes
   * the uploaded file's name; a `File` supplies it on its own.
   */
  fileName?: string;
}

export async function pptxToModel(
  file: FileLike | { name?: string },
  options: PptxReadOptions = {}
): Promise<DocumentModel> {
  const source = file as FileLike;
  const fileName =
    options.fileName ??
    (typeof (file as { name?: string }).name === "string"
      ? (file as { name: string }).name
      : undefined);

  const bytes = await toBytes(source);
  assertZipContainer(bytes);
  const zip = await openZip(bytes);

  const presentationXml = await readPart(zip, "ppt/presentation.xml");
  if (!presentationXml) {
    throw new FormatReadError(
      "not-a-presentation",
      "This file is a ZIP archive but not a PowerPoint presentation. Save as .pptx in PowerPoint, then upload again."
    );
  }

  const documentTitle = await readDocumentTitle(zip);
  const slidePaths = await readSlideOrder(zip, presentationXml);

  const nodes: DocumentNode[] = [];

  // A deck's `dc:title` is its document title. Emitting it as a `title` node
  // is what satisfies A001; when it is missing, A001 fires and the writer's
  // auto fix (FR-5.4) is exactly "write dc:title".
  if (documentTitle) {
    nodes.push({
      type: "title",
      text: documentTitle,
      formatting: defaultTextFormatting(),
      sourceRef: "docProps/core.xml#dc:title",
    });
  }

  for (let index = 0; index < slidePaths.length; index++) {
    const slidePath = slidePaths[index];
    const page = index + 1;
    const xml = await readPart(zip, slidePath);
    if (xml === undefined) {
      continue;
    }

    const relationships = await readRelationships(zip, slidePath);
    nodes.push(...readSlide(xml, { slidePath, page, relationships }));
  }

  const model: DocumentModel = {
    documentName: documentTitle || stripExtension(fileName) || "Untitled deck",
    nodes,
    source: "pptx",
  };

  return model;
}

function stripExtension(fileName: string | undefined): string {
  if (!fileName) {
    return "";
  }
  return fileName.replace(/\.pptx$/i, "").trim();
}

/** FR-4.4 — document title from docProps/core.xml. */
async function readDocumentTitle(zip: JSZip): Promise<string> {
  const xml = await readPart(zip, "docProps/core.xml");
  if (!xml) {
    return "";
  }

  const titleElement = findFirst(parseXml(xml), "dc:title");
  return titleElement ? textOf(childrenOf(titleElement)).trim() : "";
}

/**
 * FR-4.1 — slide order from `ppt/presentation.xml`, resolved through the
 * presentation's relationships. The order in `p:sldIdLst` is the deck's order;
 * the file names in `ppt/slides/` are not.
 */
async function readSlideOrder(
  zip: JSZip,
  presentationXml: string
): Promise<string[]> {
  const relationships = await readRelationships(zip, "ppt/presentation.xml");
  const presentation = findFirst(parseXml(presentationXml), "p:presentation");
  const slideIds = presentation
    ? descendChildren(childrenOf(presentation), "p:sldIdLst")
    : [];

  const paths: string[] = [];

  for (const slideId of children(slideIds, "p:sldId")) {
    const relationshipId = attr(slideId, "r:id");
    const relationship = relationshipId
      ? relationships.get(relationshipId)
      : undefined;
    if (relationship && !relationship.external) {
      paths.push(relationship.target);
    }
  }

  if (paths.length > 0) {
    return paths;
  }

  // A deck with no usable slide list still ranks and still shows findings, so
  // fall back to file order rather than reporting an empty presentation.
  return Object.keys(zip.files)
    .filter((path) => /^ppt\/slides\/slide\d+\.xml$/.test(path))
    .sort(
      (a, b) =>
        Number(a.replace(/\D/g, "")) - Number(b.replace(/\D/g, ""))
    );
}

interface SlideContext {
  slidePath: string;
  page: number;
  relationships: Map<string, Relationship>;
}

/**
 * One slide becomes a `section` marker followed by its content, in the order
 * the shapes appear in the slide's shape tree.
 */
function readSlide(xml: string, context: SlideContext): DocumentNode[] {
  const slide = findFirst(parseXml(xml), "p:sld");
  const shapeTree = slide
    ? descend(childrenOf(slide), "p:cSld", "p:spTree")
    : undefined;

  const shapes = shapeTree ? childrenOf(shapeTree) : [];
  const collected = readShapes(shapes, context);

  const section: DocumentNode = {
    type: "section",
    role: "slide",
    location: { page: context.page },
    sourceRef: context.slidePath,
  };
  if (collected.title !== undefined) {
    section.title = collected.title;
  }

  const nodes: DocumentNode[] = [section];

  // A slide title is the deck's section heading: it is how a screen reader
  // navigates the file, so it is carried as a heading as well as on the
  // section marker. Empty titles are left out — A013 reports those, and an
  // empty heading node would report the same gap twice as A005.
  if (collected.title && collected.title.trim().length > 0) {
    nodes.push({
      type: "heading",
      level: 2,
      text: collected.title,
      formatting: collected.titleFormatting ?? defaultTextFormatting(),
      location: collected.titleLocation ?? { page: context.page },
      ...(collected.titleSourceRef
        ? { sourceRef: collected.titleSourceRef }
        : {}),
    });
  }

  nodes.push(...collected.nodes);
  return nodes;
}

interface SlideContent {
  title?: string;
  titleFormatting?: TextFormatting;
  titleLocation?: { page: number; bbox?: [number, number, number, number] };
  titleSourceRef?: string;
  nodes: DocumentNode[];
}

function readShapes(shapes: XmlNode[], context: SlideContext): SlideContent {
  const content: SlideContent = { nodes: [] };

  for (const shape of shapes) {
    switch (tagOf(shape)) {
      case "p:sp":
        readTextShape(shape, context, content);
        break;
      case "p:pic": {
        const figure = readPicture(shape, context);
        if (figure) {
          content.nodes.push(figure);
        }
        break;
      }
      case "p:graphicFrame":
        content.nodes.push(...readGraphicFrame(shape, context));
        break;
      case "p:grpSp": {
        // Grouped shapes hold ordinary shapes; a title can legally sit inside
        // a group, so recurse and merge rather than skipping the group.
        const inner = readShapes(childrenOf(shape), context);
        if (content.title === undefined && inner.title !== undefined) {
          content.title = inner.title;
          content.titleFormatting = inner.titleFormatting;
          content.titleLocation = inner.titleLocation;
          content.titleSourceRef = inner.titleSourceRef;
        }
        content.nodes.push(...inner.nodes);
        break;
      }
      default:
        break;
    }
  }

  return content;
}

/** The shape's non-visual properties element (`p:cNvPr`), wherever it sits. */
function nonVisualProperties(shape: XmlNode): XmlNode | undefined {
  return findFirst(childrenOf(shape), "p:cNvPr");
}

function shapeId(shape: XmlNode): string {
  return attr(nonVisualProperties(shape), "id") ?? "";
}

function sourceRefFor(shape: XmlNode, context: SlideContext): string {
  const id = shapeId(shape);
  return id ? `${context.slidePath}#${id}` : context.slidePath;
}

/** FR-4.5 — bbox in points from the shape's `a:off` / `a:ext`, when present. */
function locationFor(
  shape: XmlNode,
  context: SlideContext
): { page: number; bbox?: [number, number, number, number] } {
  const transform = findFirst(childrenOf(shape), "a:xfrm");
  const offset = transform ? child(childrenOf(transform), "a:off") : undefined;
  const extent = transform ? child(childrenOf(transform), "a:ext") : undefined;

  const x = emuToPoints(attr(offset, "x"));
  const y = emuToPoints(attr(offset, "y"));
  const width = emuToPoints(attr(extent, "cx"));
  const height = emuToPoints(attr(extent, "cy"));

  if (x === null || y === null || width === null || height === null) {
    return { page: context.page };
  }

  return { page: context.page, bbox: [x, y, width, height] };
}

function emuToPoints(value: string | undefined): number | null {
  if (value === undefined) {
    return null;
  }
  const emu = Number(value);
  if (!Number.isFinite(emu)) {
    return null;
  }
  return Math.round((emu / EMU_PER_POINT) * 100) / 100;
}

/** The placeholder type of a shape, e.g. "title", "body", or undefined. */
function placeholderType(shape: XmlNode): string | undefined {
  const placeholder = findFirst(childrenOf(shape), "p:ph");
  return placeholder ? attr(placeholder, "type") : undefined;
}

/**
 * FR-4.2 — a `p:sp` is either the slide's title placeholder or body text.
 * Each `a:p` becomes one paragraph node, so the model keeps the slide's lines.
 */
function readTextShape(
  shape: XmlNode,
  context: SlideContext,
  content: SlideContent
): void {
  const body = findFirst(childrenOf(shape), "p:txBody");
  const paragraphs = body ? children(childrenOf(body), "a:p") : [];
  const isTitle = TITLE_PLACEHOLDERS.has(placeholderType(shape) ?? "");

  if (isTitle) {
    const text = paragraphs
      .map((paragraph) => paragraphText(paragraph))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    // The first title placeholder wins, and an empty one still counts: the
    // slide has a title shape with nothing in it, which is what A013 reports
    // and what the writer fills in (FR-5.2).
    if (content.title === undefined) {
      content.title = text;
      content.titleFormatting = formattingOf(paragraphs[0]);
      content.titleLocation = locationFor(shape, context);
      content.titleSourceRef = sourceRefFor(shape, context);
    }
    return;
  }

  const location = locationFor(shape, context);
  const sourceRef = sourceRefFor(shape, context);

  for (const paragraph of paragraphs) {
    const text = paragraphText(paragraph).trim();
    if (text.length === 0) {
      continue;
    }

    content.nodes.push({
      type: "paragraph",
      text,
      formatting: formattingOf(paragraph),
      location,
      sourceRef,
    });
  }
}

/** Text of one `a:p`, treating a line break as a space. */
function paragraphText(paragraph: XmlNode | undefined): string {
  if (!paragraph) {
    return "";
  }

  let text = "";

  for (const node of childrenOf(paragraph)) {
    switch (tagOf(node)) {
      case "a:r":
        text += textOf(children(childrenOf(node), "a:t"));
        break;
      case "a:br":
        text += " ";
        break;
      case "a:fld":
        // A slide-number or date field: its cached text is in a:t.
        text += textOf(children(childrenOf(node), "a:t"));
        break;
      default:
        break;
    }
  }

  return text;
}

/**
 * Run formatting from the paragraph's first run.
 *
 * Anything the run does not state is left null rather than guessed from the
 * layout or master. A002 ("bold, large text is not a heading") only fires on
 * what the slide itself says, which keeps it off inherited theme styling.
 */
function formattingOf(paragraph: XmlNode | undefined): TextFormatting {
  if (!paragraph) {
    return defaultTextFormatting();
  }

  const paragraphProperties = child(childrenOf(paragraph), "a:pPr");
  const run = child(childrenOf(paragraph), "a:r");
  const runProperties = run ? child(childrenOf(run), "a:rPr") : undefined;

  const size = attr(runProperties, "sz");
  const latin = runProperties
    ? child(childrenOf(runProperties), "a:latin")
    : undefined;
  const fill = runProperties
    ? child(childrenOf(runProperties), "a:solidFill")
    : undefined;
  const srgb = fill ? child(childrenOf(fill), "a:srgbClr") : undefined;
  const colorValue = attr(srgb, "val");

  return defaultTextFormatting({
    bold: attr(runProperties, "b") === "1",
    // PowerPoint stores font size in hundredths of a point.
    fontSize: size !== undefined && Number.isFinite(Number(size))
      ? Number(size) / 100
      : null,
    fontFamily: attr(latin, "typeface") ?? null,
    color: colorValue ? `#${colorValue.toUpperCase()}` : null,
    textAlign: alignmentOf(attr(paragraphProperties, "algn")),
  });
}

function alignmentOf(
  algn: string | undefined
): TextFormatting["textAlign"] {
  switch (algn) {
    case "l":
      return "left";
    case "ctr":
      return "center";
    case "r":
      return "right";
    case "just":
      return "justify";
    default:
      return null;
  }
}

/**
 * FR-4.3 — a picture's alt fields map straight onto the existing figure node:
 * `@descr` is the alt description (A004). `@title` is a legacy field that no
 * rule checks any more (A003 was withdrawn); it is still read, so the writer
 * can put it back untouched.
 */
function readPicture(
  shape: XmlNode,
  context: SlideContext
): FigureNode | undefined {
  const properties = nonVisualProperties(shape);

  // A picture PowerPoint has marked decorative is exempt from alt text, so
  // reporting A004 on it would be a false finding.
  if (isDecorative(properties)) {
    return undefined;
  }

  const blip = findFirst(childrenOf(shape), "a:blip");
  const embedId = attr(blip, "r:embed");
  const relationship = embedId
    ? context.relationships.get(embedId)
    : undefined;

  const location = locationFor(shape, context);
  const bbox = location.bbox;

  return {
    type: "figure",
    altTitle: (attr(properties, "title") ?? "").trim(),
    altDescription: (attr(properties, "descr") ?? "").trim(),
    // The image's part path inside the package. The viewer resolves it against
    // the uploaded file; it is a real source, so A007 stays quiet unless the
    // relationship is genuinely broken.
    src: relationship && !relationship.external ? relationship.target : "",
    width: bbox ? bbox[2] : null,
    height: bbox ? bbox[3] : null,
    location,
    sourceRef: sourceRefFor(shape, context),
  };
}

/** PowerPoint's "Mark as decorative" lives in a cNvPr extension. */
function isDecorative(properties: XmlNode | undefined): boolean {
  if (!properties) {
    return false;
  }

  const decorative = findFirst(childrenOf(properties), "adec:decorative");
  return attr(decorative, "val") === "1";
}

/** FR-4.2 — tables live inside a `p:graphicFrame`. */
function readGraphicFrame(
  shape: XmlNode,
  context: SlideContext
): DocumentNode[] {
  const tables = findFirst(childrenOf(shape), "a:tbl");
  if (!tables) {
    return [];
  }

  return [
    {
      type: "table",
      rows: readTableRows(tables),
      location: locationFor(shape, context),
      sourceRef: sourceRefFor(shape, context),
    },
  ];
}

function readTableRows(table: XmlNode): TableRow[] {
  const tableChildren = childrenOf(table);
  const properties = child(tableChildren, "a:tblPr");
  const firstRowIsHeader = attr(properties, "firstRow") === "1";
  const firstColumnIsHeader = attr(properties, "firstCol") === "1";

  return children(tableChildren, "a:tr").map((row, rowIndex) => {
    const cells: TableCell[] = [];
    let columnIndex = 0;

    for (const cell of children(childrenOf(row), "a:tc")) {
      // A merged region is written as the spanning cell followed by
      // continuation cells (hMerge / vMerge). The model expresses the span
      // with colspan/rowspan instead, so the continuations are skipped —
      // counting them would make the row look wider than the grid and trip
      // A012.
      if (attr(cell, "hMerge") === "1" || attr(cell, "vMerge") === "1") {
        columnIndex += 1;
        continue;
      }

      const header =
        (firstRowIsHeader && rowIndex === 0) ||
        (firstColumnIsHeader && columnIndex === 0);

      cells.push({
        text: cellText(cell),
        header,
        colspan: spanOf(attr(cell, "gridSpan")),
        rowspan: spanOf(attr(cell, "rowSpan")),
      });
      columnIndex += 1;
    }

    return { cells };
  });
}

function cellText(cell: XmlNode): string {
  const body = findFirst(childrenOf(cell), "a:txBody");
  const paragraphs = body ? children(childrenOf(body), "a:p") : [];
  return paragraphs
    .map((paragraph) => paragraphText(paragraph))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function spanOf(value: string | undefined): number {
  const span = Number(value ?? 1);
  return Number.isFinite(span) && span >= 1 ? span : 1;
}
