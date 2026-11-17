import {
  defaultTextFormatting,
  type DocumentModel,
  type DocumentNode,
  type FigureNode,
  type TableNode,
  type TextFormatting,
} from "@accessibility-docs/core";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const TOP_Y = PAGE_HEIGHT - MARGIN;
const BOTTOM_Y = MARGIN;
const FIGURE_GAP = 12;
const TABLE_FONT_SIZE = 10;
const TABLE_CELL_PADDING = 4;

type EmbeddedImage = {
  width: number;
  height: number;
  filter: "DCTDecode" | "FlateDecode" | null;
  bytes: Uint8Array;
};

type TextBlock = {
  kind: "text";
  text: string;
  formatting: TextFormatting;
  structTag: string;
  defaultSize: number;
};

type FigureBlock = {
  kind: "figure";
  altTitle: string;
  altDescription: string;
  image: EmbeddedImage;
  displayWidth: number;
  displayHeight: number;
};

type TableBlock = {
  kind: "table";
  rows: TableNode["rows"];
};

type FlowBlock = TextBlock | FigureBlock | TableBlock;

type TextLine = {
  kind: "text";
  text: string;
  fontName: string;
  fontSize: number;
  color: string;
  x: number;
  y: number;
  mcid: number;
  structTag: string;
  pageIndex: number;
};

type ImageDraw = {
  kind: "image";
  imageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  mcid: number;
  pageIndex: number;
  alt: string;
};

type TableDraw = {
  kind: "table";
  pageIndex: number;
  x: number;
  tableTop: number;
  colWidths: number[];
  rowHeights: number[];
  cells: Array<{
    row: number;
    colStart: number;
    colspan: number;
    mcid: number;
    header: boolean;
    lines: string[];
    fontName: string;
    fontSize: number;
  }>;
};

type DrawOp = TextLine | ImageDraw | TableDraw;

type StructEntry = {
  structTag: string;
  title: string;
  alt?: string;
  pageIndex: number;
  mcid?: number;
  kids?: StructEntry[];
  /** Assigned while assembling the structure tree. */
  objectIndex?: number;
};

/**
 * Compiles a DocumentModel into a tagged PDF 1.7 byte stream.
 * Text nodes keep formatting; figures are embedded via browser decode APIs (no npm image libs).
 */
export async function compilePdf(model: DocumentModel): Promise<Uint8Array> {
  const blocks = await buildFlowBlocks(model.nodes);

  if (blocks.length === 0) {
    blocks.push({
      kind: "text",
      text: "Untitled",
      formatting: defaultTextFormatting(),
      structTag: "H1",
      defaultSize: 24,
    });
  }

  const layout = layoutBlocks(blocks);
  return assembleDocument(layout, documentTitle(model, blocks));
}

async function buildFlowBlocks(nodes: DocumentNode[]): Promise<FlowBlock[]> {
  const blocks: FlowBlock[] = [];

  for (const node of nodes) {
    if (node.type === "figure") {
      const figure = await toFigureBlock(node);
      if (figure) {
        blocks.push(figure);
      }
      continue;
    }

    if (node.type === "table") {
      if (node.rows.length > 0) {
        blocks.push({ kind: "table", rows: node.rows });
      }
      continue;
    }

    const text = toTextBlock(node);
    if (text) {
      blocks.push(text);
    }
  }

  return blocks;
}

function toTextBlock(node: DocumentNode): TextBlock | null {
  switch (node.type) {
    case "title":
      return {
        kind: "text",
        text: node.text.trim(),
        formatting: node.formatting,
        structTag: "H1",
        defaultSize: 24,
      };
    case "heading": {
      const level = Math.min(6, Math.max(1, node.level));
      return {
        kind: "text",
        text: node.text.trim(),
        formatting: node.formatting,
        structTag: `H${level}`,
        defaultSize: headingDefaultSize(level),
      };
    }
    case "paragraph":
      return {
        kind: "text",
        text: node.text.trim(),
        formatting: node.formatting,
        structTag: "P",
        defaultSize: 12,
      };
    default:
      return null;
  }
}

async function toFigureBlock(node: FigureNode): Promise<FigureBlock | null> {
  if (!node.src.trim()) {
    return null;
  }

  const image = await decodeImage(node.src);
  if (!image) {
    return null;
  }

  const naturalWidth = node.width && node.width > 0 ? node.width : image.width;
  const naturalHeight =
    node.height && node.height > 0 ? node.height : image.height;
  const scale = Math.min(1, CONTENT_WIDTH / naturalWidth);
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;

  return {
    kind: "figure",
    altTitle: node.altTitle,
    altDescription: node.altDescription,
    image,
    displayWidth,
    displayHeight,
  };
}

function headingDefaultSize(level: number): number {
  const sizes = [24, 20, 18, 16, 14, 13];
  return sizes[level - 1] ?? 12;
}

function documentTitle(model: DocumentModel, blocks: FlowBlock[]): string {
  const fromName = model.documentName.trim();
  if (fromName.length > 0) {
    return fromName;
  }
  const firstText = blocks.find(
    (block): block is TextBlock => block.kind === "text"
  );
  return firstText?.text || "Untitled";
}

function layoutBlocks(blocks: FlowBlock[]): {
  ops: DrawOp[];
  fonts: Map<string, string>;
  images: EmbeddedImage[];
  pageCount: number;
  structOrder: StructEntry[];
} {
  const fonts = new Map<string, string>();
  const images: EmbeddedImage[] = [];
  const ops: DrawOp[] = [];
  const structOrder: StructEntry[] = [];

  let pageIndex = 0;
  let y = TOP_Y;
  let mcid = 0;

  for (const block of blocks) {
    if (block.kind === "figure") {
      const imageIndex = images.length;
      images.push(block.image);

      let height = block.displayHeight;
      let width = block.displayWidth;
      const maxHeight = TOP_Y - BOTTOM_Y;
      if (height > maxHeight) {
        const shrink = maxHeight / height;
        height *= shrink;
        width *= shrink;
      }

      if (y - height < BOTTOM_Y) {
        pageIndex += 1;
        y = TOP_Y;
      }

      if (y < TOP_Y) {
        y -= FIGURE_GAP;
      }

      const blockMcid = mcid;
      mcid += 1;
      const alt =
        block.altDescription.trim() ||
        block.altTitle.trim() ||
        "Image";

      structOrder.push({
        mcid: blockMcid,
        structTag: "Figure",
        title: block.altTitle.trim() || alt.slice(0, 80),
        alt,
        pageIndex,
      });

      ops.push({
        kind: "image",
        imageIndex,
        x: MARGIN,
        y: y - height,
        width,
        height,
        mcid: blockMcid,
        pageIndex,
        alt,
      });
      y -= height + FIGURE_GAP;
      continue;
    }

    if (block.kind === "table") {
      const laidOut = layoutTableBlock(block, fonts, mcid);
      mcid = laidOut.nextMcid;

      if (y - laidOut.height < BOTTOM_Y) {
        pageIndex += 1;
        y = TOP_Y;
      }
      if (y < TOP_Y) {
        y -= FIGURE_GAP;
      }

      const tableTop = y;
      ops.push({
        ...laidOut.draw,
        pageIndex,
        tableTop,
      });
      structOrder.push(withPageIndex(laidOut.struct, pageIndex));
      y -= laidOut.height + FIGURE_GAP;
      continue;
    }

    if (block.text.length === 0) {
      continue;
    }

    const fontSize = block.formatting.fontSize ?? block.defaultSize;
    const fontName = ensureFont(
      fonts,
      pdfBaseFont(block.formatting.fontFamily, block.formatting.bold)
    );
    const color = pdfRgb(block.formatting.color);
    const leading = lineLeading(fontSize, block.formatting.lineHeight);
    const wrapped = wrapText(block.text, fontSize, CONTENT_WIDTH);
    const blockMcid = mcid;
    mcid += 1;

    if (y < TOP_Y) {
      y -= leading * 0.35;
    }

    let firstLinePage = pageIndex;
    let assignedPage = false;

    for (const line of wrapped) {
      if (y - fontSize < BOTTOM_Y) {
        pageIndex += 1;
        y = TOP_Y;
      }
      if (!assignedPage) {
        firstLinePage = pageIndex;
        assignedPage = true;
      }

      ops.push({
        kind: "text",
        text: line,
        fontName,
        fontSize,
        color,
        x: textX(block.formatting.textAlign, line, fontSize),
        y: y - fontSize,
        mcid: blockMcid,
        structTag: block.structTag,
        pageIndex,
      });
      y -= leading;
    }

    structOrder.push({
      mcid: blockMcid,
      structTag: block.structTag,
      title: block.text.slice(0, 80),
      pageIndex: firstLinePage,
    });
  }

  return {
    ops,
    fonts,
    images,
    pageCount: pageIndex + 1,
    structOrder,
  };
}

function layoutTableBlock(
  block: TableBlock,
  fonts: Map<string, string>,
  startMcid: number
): {
  height: number;
  nextMcid: number;
  draw: Omit<TableDraw, "pageIndex" | "tableTop"> & { x: number };
  struct: Omit<StructEntry, "pageIndex">;
} {
  const columnCount = Math.max(
    1,
    ...block.rows.map((row) =>
      row.cells.reduce((sum, cell) => sum + Math.max(1, cell.colspan), 0)
    )
  );
  const colWidth = CONTENT_WIDTH / columnCount;
  const colWidths = Array.from({ length: columnCount }, () => colWidth);
  const leading = lineLeading(TABLE_FONT_SIZE, null);
  const bodyFont = ensureFont(fonts, "Helvetica");
  const headerFont = ensureFont(fonts, "Helvetica-Bold");

  const rowHeights: number[] = [];
  const cells: TableDraw["cells"] = [];
  const rowStructs: StructEntry[] = [];
  let mcid = startMcid;

  for (let rowIndex = 0; rowIndex < block.rows.length; rowIndex += 1) {
    const row = block.rows[rowIndex];
    let colStart = 0;
    let rowHeight = TABLE_FONT_SIZE + TABLE_CELL_PADDING * 2;
    const cellStructs: StructEntry[] = [];

    for (const cell of row.cells) {
      const span = Math.max(1, cell.colspan);
      const cellWidth = colWidth * span - TABLE_CELL_PADDING * 2;
      const lines = wrapText(cell.text || " ", TABLE_FONT_SIZE, Math.max(8, cellWidth));
      const contentHeight =
        lines.length * leading + TABLE_CELL_PADDING * 2;
      rowHeight = Math.max(rowHeight, contentHeight);

      const cellMcid = mcid;
      mcid += 1;
      cells.push({
        row: rowIndex,
        colStart,
        colspan: span,
        mcid: cellMcid,
        header: cell.header,
        lines,
        fontName: cell.header ? headerFont : bodyFont,
        fontSize: TABLE_FONT_SIZE,
      });
      cellStructs.push({
        structTag: cell.header ? "TH" : "TD",
        title: cell.text.slice(0, 80) || (cell.header ? "Header" : "Cell"),
        pageIndex: 0,
        mcid: cellMcid,
      });
      colStart += span;
    }

    rowHeights.push(rowHeight);
    rowStructs.push({
      structTag: "TR",
      title: `Row ${rowIndex + 1}`,
      pageIndex: 0,
      kids: cellStructs,
    });
  }

  const height = rowHeights.reduce((sum, value) => sum + value, 0);

  return {
    height,
    nextMcid: mcid,
    draw: {
      kind: "table",
      x: MARGIN,
      colWidths,
      rowHeights,
      cells,
    },
    struct: {
      structTag: "Table",
      title: "Table",
      kids: rowStructs,
    },
  };
}

function withPageIndex(
  entry: Omit<StructEntry, "pageIndex"> & { pageIndex?: number; kids?: StructEntry[] },
  pageIndex: number
): StructEntry {
  return {
    ...entry,
    pageIndex,
    kids: entry.kids?.map((kid) => withPageIndex(kid, pageIndex)),
  };
}

function ensureFont(fonts: Map<string, string>, baseFont: string): string {
  const existing = fonts.get(baseFont);
  if (existing) {
    return existing;
  }
  const resource = `F${fonts.size + 1}`;
  fonts.set(baseFont, resource);
  return resource;
}

function wrapText(text: string, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return [""];
  }

  const lines: string[] = [];
  let current = words[0];

  for (let index = 1; index < words.length; index += 1) {
    const next = `${current} ${words[index]}`;
    if (estimateWidth(next, fontSize) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[index];
    }
  }

  lines.push(current);
  return lines;
}

function estimateWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.5;
}

function lineLeading(fontSize: number, lineHeight: string | null): number {
  if (!lineHeight) {
    return fontSize * 1.35;
  }

  const trimmed = lineHeight.trim();
  if (trimmed.endsWith("px")) {
    const px = Number.parseFloat(trimmed);
    return Number.isFinite(px) ? Math.max(fontSize, px) : fontSize * 1.35;
  }

  const ratio = Number.parseFloat(trimmed);
  if (Number.isFinite(ratio) && ratio > 0) {
    return fontSize * ratio;
  }

  return fontSize * 1.35;
}

function textX(
  align: TextFormatting["textAlign"],
  text: string,
  fontSize: number
): number {
  const width = estimateWidth(text, fontSize);
  if (align === "center") {
    return MARGIN + Math.max(0, (CONTENT_WIDTH - width) / 2);
  }
  if (align === "right") {
    return MARGIN + Math.max(0, CONTENT_WIDTH - width);
  }
  return MARGIN;
}

async function decodeImage(src: string): Promise<EmbeddedImage | null> {
  try {
    const response = await fetch(src);
    if (!response.ok) {
      return null;
    }
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length === 0) {
      return null;
    }

    if (isJpeg(bytes)) {
      const size = await loadImageSize(src);
      if (!size) {
        return null;
      }
      return {
        width: size.width,
        height: size.height,
        filter: "DCTDecode",
        bytes,
      };
    }

    return rasterizeToFlateRgb(src);
  } catch {
    return null;
  }
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0xff && bytes[1] === 0xd8;
}

function loadImageSize(
  src: string
): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

async function rasterizeToFlateRgb(src: string): Promise<EmbeddedImage | null> {
  const size = await loadImageSize(src);
  if (!size || size.width === 0 || size.height === 0) {
    return null;
  }

  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return null;
  }

  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      context.drawImage(image, 0, 0);
      resolve();
    };
    image.onerror = () => reject(new Error("Failed to decode image"));
    image.src = src;
  });

  const { data } = context.getImageData(0, 0, size.width, size.height);
  const rgb = new Uint8Array(size.width * size.height * 3);
  for (let pixel = 0, out = 0; pixel < data.length; pixel += 4, out += 3) {
    const alpha = data[pixel + 3] / 255;
    rgb[out] = Math.round(data[pixel] * alpha + 255 * (1 - alpha));
    rgb[out + 1] = Math.round(data[pixel + 1] * alpha + 255 * (1 - alpha));
    rgb[out + 2] = Math.round(data[pixel + 2] * alpha + 255 * (1 - alpha));
  }

  const compressed = await flateCompress(rgb);
  return {
    width: size.width,
    height: size.height,
    filter: compressed ? "FlateDecode" : null,
    bytes: compressed ?? rgb,
  };
}

async function flateCompress(data: Uint8Array): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") {
    return null;
  }

  const stream = new Blob([toArrayBuffer(data)])
    .stream()
    .pipeThrough(new CompressionStream("deflate"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function assembleDocument(
  layout: {
    ops: DrawOp[];
    fonts: Map<string, string>;
    images: EmbeddedImage[];
    pageCount: number;
    structOrder: StructEntry[];
  },
  title: string
): Uint8Array {
  const { ops, fonts, images, pageCount, structOrder } = layout;

  const pageObj = (index: number) => 3 + index;
  const contentStart = 3 + pageCount;
  const contentObj = (index: number) => contentStart + index;
  const fontStart = contentStart + pageCount;
  const fontEntries = [...fonts.entries()];
  const fontObjByResource = new Map<string, number>();
  fontEntries.forEach(([, resource], index) => {
    fontObjByResource.set(resource, fontStart + index);
  });

  const imageStart = fontStart + fontEntries.length;
  const imageResourceNames = images.map((_, index) => `Im${index + 1}`);
  const structRootObj = imageStart + images.length;
  const structElemStart = structRootObj + 1;

  let structCounter = 0;
  const assignStructIndexes = (entry: StructEntry) => {
    entry.objectIndex = structCounter;
    structCounter += 1;
    entry.kids?.forEach(assignStructIndexes);
  };
  structOrder.forEach(assignStructIndexes);

  const parentTreeObj = structElemStart + structCounter;

  const pageKids = Array.from(
    { length: pageCount },
    (_, index) => `${pageObj(index)} 0 R`
  ).join(" ");

  const fontResourceDict = fontEntries
    .map(
      ([, resource]) => `/${resource} ${fontObjByResource.get(resource)} 0 R`
    )
    .join(" ");

  const xObjectDict = imageResourceNames
    .map((name, index) => `/${name} ${imageStart + index} 0 R`)
    .join(" ");

  const objects: Array<string | Uint8Array> = [];
  objects[0] =
    `<< /Type /Catalog /Pages 2 0 R /Lang (en-US) /MarkInfo << /Marked true >> /StructTreeRoot ${structRootObj} 0 R >>`;
  objects[1] = `<< /Type /Pages /Kids [${pageKids}] /Count ${pageCount} >>`;

  for (let page = 0; page < pageCount; page += 1) {
    const resources = [
      `/Font << ${fontResourceDict} >>`,
      xObjectDict ? `/XObject << ${xObjectDict} >>` : "",
    ]
      .filter(Boolean)
      .join(" ");

    objects[pageObj(page) - 1] =
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH} ${PAGE_HEIGHT}] ` +
      `/Contents ${contentObj(page)} 0 R /Resources << ${resources} >> ` +
      `/StructParents ${page} >>`;
  }

  for (let page = 0; page < pageCount; page += 1) {
    const content = buildPageContent(
      ops.filter((op) => op.pageIndex === page),
      imageResourceNames
    );
    objects[contentObj(page) - 1] = streamObject(encodeAscii(content));
  }

  fontEntries.forEach(([baseFont], index) => {
    objects[fontStart + index - 1] =
      `<< /Type /Font /Subtype /Type1 /BaseFont /${baseFont} >>`;
  });

  images.forEach((image, index) => {
    const filter = image.filter ? `/Filter /${image.filter}` : "";
    const header =
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 ${filter} /Length ${image.bytes.length} >>\n` +
      `stream\n`;
    const tail = `\nendstream`;
    objects[imageStart + index - 1] = concatBytes([
      encodeAscii(header),
      image.bytes,
      encodeAscii(tail),
    ]);
  });

  const rootKids = structOrder
    .map((entry) => `${structElemStart + (entry.objectIndex ?? 0)} 0 R`)
    .join(" ");
  objects[structRootObj - 1] =
    `<< /Type /StructTreeRoot /K [${rootKids}] /ParentTree ${parentTreeObj} 0 R >>`;

  const mcidToStructObj = new Map<number, number>();

  const writeStruct = (entry: StructEntry, parentObj: number) => {
    const objNum = structElemStart + (entry.objectIndex ?? 0);
    const alt = entry.alt ? `/Alt (${pdfLiteral(entry.alt)}) ` : "";
    let kidsValue = "";
    if (entry.kids && entry.kids.length > 0) {
      kidsValue = entry.kids
        .map((kid) => `${structElemStart + (kid.objectIndex ?? 0)} 0 R`)
        .join(" ");
      kidsValue = `[${kidsValue}]`;
    } else if (typeof entry.mcid === "number") {
      kidsValue = String(entry.mcid);
      mcidToStructObj.set(entry.mcid, objNum);
    } else {
      kidsValue = "[]";
    }

    objects[objNum - 1] =
      `<< /Type /StructElem /S /${entry.structTag} /P ${parentObj} 0 R ` +
      `/Pg ${pageObj(entry.pageIndex)} 0 R /K ${kidsValue} ` +
      `${alt}/T (${pdfLiteral(entry.title)}) >>`;

    entry.kids?.forEach((kid) => writeStruct(kid, objNum));
  };

  structOrder.forEach((entry) => writeStruct(entry, structRootObj));

  const parentTreeNums: string[] = [];
  for (let page = 0; page < pageCount; page += 1) {
    const mcidsOnPage = collectMcids(ops.filter((op) => op.pageIndex === page));
    const maxMcid = mcidsOnPage.length > 0 ? Math.max(...mcidsOnPage) : -1;
    const slots: string[] = [];
    for (let id = 0; id <= maxMcid; id += 1) {
      const structObj = mcidToStructObj.get(id);
      const onThisPage = mcidsOnPage.includes(id);
      slots.push(onThisPage && structObj ? `${structObj} 0 R` : "null");
    }
    parentTreeNums.push(`${page} [${slots.join(" ")}]`);
  }
  objects[parentTreeObj - 1] = `<< /Nums [${parentTreeNums.join(" ")}] >>`;

  return assemblePdf(objects, pdfLiteral(title));
}

function collectMcids(ops: DrawOp[]): number[] {
  const ids: number[] = [];
  for (const op of ops) {
    if (op.kind === "table") {
      for (const cell of op.cells) {
        ids.push(cell.mcid);
      }
      continue;
    }
    ids.push(op.mcid);
  }
  return ids;
}

function buildPageContent(ops: DrawOp[], imageNames: string[]): string {
  if (ops.length === 0) {
    return "\n";
  }

  const parts: string[] = [];
  let inText = false;
  let openMcid: number | null = null;
  let lastX = 0;
  let lastY = 0;
  let positioned = false;

  const closeText = () => {
    if (openMcid !== null) {
      parts.push("EMC");
      openMcid = null;
    }
    if (inText) {
      parts.push("ET");
      inText = false;
      positioned = false;
    }
  };

  for (const op of ops) {
    if (op.kind === "image") {
      closeText();
      parts.push(`/Figure << /MCID ${op.mcid} >> BDC`);
      parts.push("q");
      parts.push(
        `${fmt(op.width)} 0 0 ${fmt(op.height)} ${fmt(op.x)} ${fmt(op.y)} cm`
      );
      parts.push(`/${imageNames[op.imageIndex]} Do`);
      parts.push("Q");
      parts.push("EMC");
      continue;
    }

    if (op.kind === "table") {
      closeText();
      parts.push(...buildTableContent(op));
      continue;
    }

    if (!inText) {
      parts.push("BT");
      inText = true;
      positioned = false;
    }

    if (openMcid !== op.mcid) {
      if (openMcid !== null) {
        parts.push("EMC");
      }
      parts.push(`/${op.structTag} << /MCID ${op.mcid} >> BDC`);
      openMcid = op.mcid;
    }

    parts.push(`/${op.fontName} ${op.fontSize} Tf`);
    parts.push(`${op.color} rg`);

    if (!positioned) {
      parts.push(`${fmt(op.x)} ${fmt(op.y)} Td`);
      positioned = true;
    } else {
      parts.push(`${fmt(op.x - lastX)} ${fmt(op.y - lastY)} Td`);
    }

    parts.push(`(${pdfLiteral(op.text)}) Tj`);
    lastX = op.x;
    lastY = op.y;
  }

  closeText();
  parts.push("");
  return parts.join("\n");
}

function buildTableContent(op: TableDraw): string[] {
  const parts: string[] = [];
  const tableHeight = op.rowHeights.reduce((sum, value) => sum + value, 0);
  const tableWidth = op.colWidths.reduce((sum, value) => sum + value, 0);
  const tableBottom = op.tableTop - tableHeight;

  parts.push("q");
  parts.push("0.5 w");
  parts.push("0 0 0 RG");

  // Outer border
  parts.push(
    `${fmt(op.x)} ${fmt(tableBottom)} ${fmt(tableWidth)} ${fmt(tableHeight)} re S`
  );

  // Horizontal rules
  let y = op.tableTop;
  for (let row = 0; row < op.rowHeights.length - 1; row += 1) {
    y -= op.rowHeights[row];
    parts.push(
      `${fmt(op.x)} ${fmt(y)} m ${fmt(op.x + tableWidth)} ${fmt(y)} l S`
    );
  }

  // Vertical rules
  let x = op.x;
  for (let col = 0; col < op.colWidths.length - 1; col += 1) {
    x += op.colWidths[col];
    parts.push(
      `${fmt(x)} ${fmt(tableBottom)} m ${fmt(x)} ${fmt(op.tableTop)} l S`
    );
  }
  parts.push("Q");

  for (const cell of op.cells) {
    const tag = cell.header ? "TH" : "TD";
    const cellX =
      op.x +
      op.colWidths
        .slice(0, cell.colStart)
        .reduce((sum, value) => sum + value, 0) +
      TABLE_CELL_PADDING;
    const rowTop =
      op.tableTop -
      op.rowHeights.slice(0, cell.row).reduce((sum, value) => sum + value, 0);
    const leading = lineLeading(cell.fontSize, null);

    parts.push(`/${tag} << /MCID ${cell.mcid} >> BDC`);
    parts.push("BT");
    parts.push(`/${cell.fontName} ${cell.fontSize} Tf`);
    parts.push("0 0 0 rg");

    let textY = rowTop - TABLE_CELL_PADDING - cell.fontSize;
    cell.lines.forEach((line, lineIndex) => {
      if (lineIndex === 0) {
        parts.push(`${fmt(cellX)} ${fmt(textY)} Td`);
      } else {
        parts.push(`0 ${fmt(-leading)} Td`);
      }
      parts.push(`(${pdfLiteral(line)}) Tj`);
    });

    parts.push("ET");
    parts.push("EMC");
  }

  return parts;
}

function streamObject(content: Uint8Array): Uint8Array {
  return concatBytes([
    encodeAscii(`<< /Length ${content.length} >>\nstream\n`),
    content,
    encodeAscii("endstream"),
  ]);
}

function assemblePdf(
  objects: Array<string | Uint8Array>,
  title: string
): Uint8Array {
  const chunks: Uint8Array[] = [encodeAscii("%PDF-1.7\n")];
  const offsets = [0];
  let size = chunks[0].length;

  objects.forEach((object, index) => {
    offsets.push(size);
    const prefix = encodeAscii(`${index + 1} 0 obj\n`);
    const body = typeof object === "string" ? encodeAscii(object) : object;
    const suffix = encodeAscii("\nendobj\n");
    chunks.push(prefix, body, suffix);
    size += prefix.length + body.length + suffix.length;
  });

  const xrefAt = size;
  let xref = `xref\n0 ${objects.length + 1}\n`;
  xref += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${title}) >> >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;
  chunks.push(encodeAscii(xref));

  return concatBytes(chunks);
}

function encodeAscii(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function pdfBaseFont(fontFamily: string | null, bold: boolean): string {
  const family = (fontFamily ?? "Helvetica").toLowerCase();

  if (
    family.includes("courier") ||
    family.includes("consolas") ||
    family.includes("lucida console")
  ) {
    return bold ? "Courier-Bold" : "Courier";
  }

  if (
    family.includes("times") ||
    family.includes("georgia") ||
    family.includes("garamond") ||
    family.includes("cambria") ||
    family.includes("palatino") ||
    family.includes("constantia")
  ) {
    return bold ? "Times-Bold" : "Times-Roman";
  }

  return bold ? "Helvetica-Bold" : "Helvetica";
}

function pdfRgb(color: string | null): string {
  if (!color) {
    return "0 0 0";
  }

  const hex = color.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(hex);
  if (short) {
    const [r, g, b] = short[1]
      .split("")
      .map((ch) => Number.parseInt(ch + ch, 16) / 255);
    return `${fmt(r)} ${fmt(g)} ${fmt(b)}`;
  }

  const long = /^#([0-9a-f]{6})$/i.exec(hex);
  if (long) {
    const value = long[1];
    const r = Number.parseInt(value.slice(0, 2), 16) / 255;
    const g = Number.parseInt(value.slice(2, 4), 16) / 255;
    const b = Number.parseInt(value.slice(4, 6), 16) / 255;
    return `${fmt(r)} ${fmt(g)} ${fmt(b)}`;
  }

  const rgb = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/i.exec(hex);
  if (rgb) {
    return `${fmt(Number(rgb[1]) / 255)} ${fmt(Number(rgb[2]) / 255)} ${fmt(Number(rgb[3]) / 255)}`;
  }

  return "0 0 0";
}

function fmt(value: number): string {
  return Number.parseFloat(value.toFixed(3)).toString();
}

function pdfLiteral(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}
