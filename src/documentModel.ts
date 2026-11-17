/**
 * Converts the active Google Doc into a normalized DocumentModel.
 * Available globally to other Apps Script files.
 */
function buildDocumentModel(): DocumentModel {
  const doc = DocumentApp.getActiveDocument();
  const body = doc.getBody();
  const nodes: DocumentNode[] = [];

  for (let i = 0; i < body.getNumChildren(); i++) {
    const element = body.getChild(i);
    const type = element.getType();

    if (type === DocumentApp.ElementType.TABLE) {
      nodes.push(convertTable(element.asTable()));
      continue;
    }

    // Inline images live inside paragraphs, not as top-level body children.
    if (type !== DocumentApp.ElementType.PARAGRAPH) {
      continue;
    }

    const paragraph = element.asParagraph();
    const images = getInlineImages(paragraph);
    const text = paragraph.getText().trim();

    // Image-only paragraphs often have empty text — still keep the figures.
    if (images.length > 0) {
      nodes.push(...images);
    }

    if (text.length === 0) {
      continue;
    }

    nodes.push(convertParagraph(paragraph));
  }

  return {
    documentName: doc.getName(),
    nodes,
    source: "gdoc",
  };
}

function getInlineImages(
  paragraph: GoogleAppsScript.Document.Paragraph
): FigureNode[] {
  const images: FigureNode[] = [];

  for (let i = 0; i < paragraph.getNumChildren(); i++) {
    const child = paragraph.getChild(i);
    if (child.getType() === DocumentApp.ElementType.INLINE_IMAGE) {
      const image = child.asInlineImage();
      images.push({
        type: "figure",
        altTitle: image.getAltTitle() ?? "",
        altDescription: image.getAltDescription() ?? "",
        // Apps Script has no stable browser-style src; PDF export lives in the author app.
        src: "",
        width: image.getWidth() || null,
        height: image.getHeight() || null,
      });
    }
  }

  return images;
}

function convertTable(table: GoogleAppsScript.Document.Table): TableNode {
  const rows: TableRow[] = [];

  for (let rowIndex = 0; rowIndex < table.getNumRows(); rowIndex++) {
    const row = table.getRow(rowIndex);
    const cells: TableCell[] = [];

    for (let cellIndex = 0; cellIndex < row.getNumCells(); cellIndex++) {
      const cell = row.getCell(cellIndex);
      cells.push({
        text: cell.getText().trim(),
        // Google Docs does not expose a reliable header flag; treat first row as headers.
        header: rowIndex === 0,
        colspan: 1,
        rowspan: 1,
      });
    }

    rows.push({ cells });
  }

  return { type: "table", rows };
}

function convertParagraph(
  paragraph: GoogleAppsScript.Document.Paragraph
): DocumentNode {
  const text = paragraph.getText().trim();
  const heading = paragraph.getHeading();

  const formatting = getParagraphFormatting(paragraph);

  if (heading === DocumentApp.ParagraphHeading.TITLE) {
    return { type: "title", text, formatting };
  }

  const headingLevel = getHeadingLevel(heading);

  if (headingLevel !== null) {
    return {
      type: "heading",
      level: headingLevel,
      text,
      formatting,
    };
  }

  return {
    type: "paragraph",
    text,
    formatting,
  };
}

function getParagraphFormatting(
  paragraph: GoogleAppsScript.Document.Paragraph
): TextFormatting {
  const empty: TextFormatting = {
    bold: false,
    fontSize: null,
    fontFamily: null,
    color: null,
    lineHeight: null,
    textAlign: null,
  };
  const textElement = paragraph.editAsText();

  if (textElement.getText().length === 0) {
    return empty;
  }

  const attributes = textElement.getAttributes(0);
  const bold = attributes[DocumentApp.Attribute.BOLD] === true;
  const fontSizeValue = attributes[DocumentApp.Attribute.FONT_SIZE];
  const fontSize =
    typeof fontSizeValue === "number" ? fontSizeValue : null;
  const fontFamilyValue = attributes[DocumentApp.Attribute.FONT_FAMILY];
  const fontFamily =
    typeof fontFamilyValue === "string" ? fontFamilyValue : null;
  const colorValue = attributes[DocumentApp.Attribute.FOREGROUND_COLOR];
  const color = typeof colorValue === "string" ? colorValue : null;

  return {
    ...empty,
    bold,
    fontSize,
    fontFamily,
    color,
  };
}

function getHeadingLevel(
  heading: GoogleAppsScript.Document.ParagraphHeading
): number | null {
  switch (heading) {
    case DocumentApp.ParagraphHeading.HEADING1:
      return 1;
    case DocumentApp.ParagraphHeading.HEADING2:
      return 2;
    case DocumentApp.ParagraphHeading.HEADING3:
      return 3;
    case DocumentApp.ParagraphHeading.HEADING4:
      return 4;
    case DocumentApp.ParagraphHeading.HEADING5:
      return 5;
    case DocumentApp.ParagraphHeading.HEADING6:
      return 6;
    default:
      return null;
  }
}
