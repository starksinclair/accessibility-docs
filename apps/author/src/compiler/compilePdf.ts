import type { DocumentModel } from "@accessibility-docs/core";

/**
 * Starter PDF compiler.
 * Reads a DocumentModel and writes PDF bytes a viewer can open.
 * Only the title node is emitted. Heading, paragraph, and figure come later.
 */
export function compilePdf(model: DocumentModel): string {
  const title = model.nodes.find((node) => node.type === "title");
  const text = title?.text.trim() || "Untitled";
  return renderTitlePdf(text);
}

function renderTitlePdf(title: string): string {
  const literal = pdfLiteral(title);
  const content = [
    "BT",
    "/H1 << /MCID 0 >> BDC",
    "/F1 24 Tf",
    "72 720 Td",
    `(${literal}) Tj`,
    "EMC",
    "ET",
    "",
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R /Lang (en-US) /MarkInfo << /Marked true >> /StructTreeRoot 6 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> /StructParents 0 >>",
    `<< /Length ${content.length} >>\nstream\n${content}endstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /StructTreeRoot /K [7 0 R] /ParentTree 8 0 R >>",
    `<< /Type /StructElem /S /H1 /P 6 0 R /Pg 3 0 R /K 0 /T (${literal}) >>`,
    "<< /Nums [0 [7 0 R]] >>",
  ];

  return assemblePdf(objects, literal);
}

function assemblePdf(objects: string[], title: string): string {
  let body = "%PDF-1.7\n";
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefAt = byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n`;
  body += "0000000000 65535 f \n";
  for (let index = 1; index < offsets.length; index += 1) {
    body += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }

  body +=
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info << /Title (${title}) >> >>\n` +
    `startxref\n${xrefAt}\n%%EOF\n`;

  return body;
}

function pdfLiteral(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}
