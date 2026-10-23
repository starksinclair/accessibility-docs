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

    // Inline images live inside paragraphs, not as top-level body children.
    if (element.getType() !== DocumentApp.ElementType.PARAGRAPH) {
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
      });
    }
  }

  return images;
}

function convertParagraph(
  paragraph: GoogleAppsScript.Document.Paragraph
): DocumentNode {
  const text = paragraph.getText().trim();
  const heading = paragraph.getHeading();

  if (heading === DocumentApp.ParagraphHeading.TITLE) {
    return { type: "title", text };
  }

  const headingLevel = getHeadingLevel(heading);

  if (headingLevel !== null) {
    return {
      type: "heading",
      level: headingLevel,
      text,
    };
  }

  return {
    type: "paragraph",
    text,
    formatting: getParagraphFormatting(paragraph),
  };
}

function getParagraphFormatting(
  paragraph: GoogleAppsScript.Document.Paragraph
): {
  bold: boolean;
  fontSize: number | null;
} {
  const textElement = paragraph.editAsText();

  if (textElement.getText().length === 0) {
    return { bold: false, fontSize: null };
  }

  const attributes = textElement.getAttributes(0);
  const bold = attributes[DocumentApp.Attribute.BOLD] === true;
  const fontSizeValue = attributes[DocumentApp.Attribute.FONT_SIZE];
  const fontSize =
    typeof fontSizeValue === "number" ? fontSizeValue : null;

  return { bold, fontSize };
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
