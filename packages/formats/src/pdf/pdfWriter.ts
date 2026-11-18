/**
 * PDF writer (FR-5.6 to FR-5.10): the original file plus a list of approved
 * fixes, out as a new file.
 *
 * The two rules the PPTX writer holds to hold here as well. **The upload is
 * never modified** — pdf-lib parses the bytes and serializes a new document.
 * And a fix that cannot be applied is reported rather than guessed at, which
 * matters more for PDFs than for decks: a PDF that was never tagged has
 * nowhere to put alt text, and saying so is the honest answer (FR-5.10).
 */
import type { PDFDict, PDFObject, PDFPage, PDFRef } from "pdf-lib";
import {
  PDFArray,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
} from "pdf-lib";
import { FormatReadError } from "../errors.js";
import type { FileLike } from "../zip.js";
import { toBytes } from "../zip.js";
import { assertPdfSignature } from "./pdfjs.js";
import { parseFigureRef } from "./structTree.js";

export type PdfFix =
  /** FR-5.6 — the document title, plus "show it in the title bar". */
  | { kind: "document-title"; title: string }
  /** FR-5.7 — the catalog's `/Lang`, as a BCP 47 tag. */
  | { kind: "document-language"; language: string }
  /**
   * FR-5.8 — `/Alt` on a figure's structure element. `sourceRef` is the
   * address the reader gave the figure (`pdf:figure#page=1&mcid=2`).
   */
  | { kind: "alt-text"; sourceRef: string; description: string };

export interface SkippedPdfFix {
  fix: PdfFix;
  reason: string;
}

export interface PdfWriteResult {
  /** A new file. The one that was passed in is untouched. */
  bytes: Uint8Array;
  applied: PdfFix[];
  skipped: SkippedPdfFix[];
  /** Things the user should know about what was written. */
  notes: string[];
}

/** FR-5.10 — what a PDF with no structure tree needs instead of this tool. */
const NEEDS_TAGGING =
  "This PDF needs full tagging (or OCR). Re-export it from the source file with accessibility tags on, or use Adobe Acrobat's Autotag.";

export async function applyPdfFixes(
  file: FileLike,
  fixes: readonly PdfFix[]
): Promise<PdfWriteResult> {
  const bytes = await toBytes(file);
  assertPdfSignature(bytes);

  let doc: PDFDocument;
  try {
    doc = await PDFDocument.load(bytes, {
      // Writing a fix should not quietly rewrite when the file was produced or
      // last changed; those dates describe the original document.
      updateMetadata: false,
    });
  } catch {
    throw new FormatReadError(
      "corrupt",
      "This PDF could not be opened for editing. It may be damaged; try re-exporting it from the original file."
    );
  }

  const applied: PdfFix[] = [];
  const skipped: SkippedPdfFix[] = [];
  const notes: string[] = [];

  for (const fix of fixes) {
    try {
      const outcome = applyOne(doc, fix);
      if (outcome.ok) {
        applied.push(fix);
        if (outcome.note) {
          notes.push(outcome.note);
        }
      } else {
        skipped.push({ fix, reason: outcome.reason });
      }
    } catch {
      skipped.push({
        fix,
        reason:
          "This fix could not be written into the file. The PDF may have been produced by an unusual tool.",
      });
    }
  }

  const out = await doc.save({ useObjectStreams: false });

  return { bytes: out, applied, skipped, notes };
}

type FixOutcome = { ok: true; note?: string } | { ok: false; reason: string };

function applyOne(doc: PDFDocument, fix: PdfFix): FixOutcome {
  switch (fix.kind) {
    case "document-title":
      return setDocumentTitle(doc, fix.title);
    case "document-language":
      return setLanguage(doc, fix.language);
    case "alt-text":
      return setAltText(doc, fix.sourceRef, fix.description);
    default:
      return { ok: false, reason: "This kind of fix is not supported yet." };
  }
}

/**
 * FR-5.6 — `/Title` on its own is not enough: a reader announces the file
 * name unless `/ViewerPreferences /DisplayDocTitle` says to use the title, so
 * both are written together.
 */
function setDocumentTitle(doc: PDFDocument, title: string): FixOutcome {
  const trimmed = title.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: "A document title cannot be empty." };
  }

  doc.setTitle(trimmed, { showInWindowTitleBar: true });
  return { ok: true };
}

/** FR-5.7 — `/Lang` on the catalog, which is the one assistive tech reads. */
function setLanguage(doc: PDFDocument, language: string): FixOutcome {
  const trimmed = language.trim();
  if (!/^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(trimmed)) {
    return {
      ok: false,
      reason: `"${language}" is not a language tag. Use a tag like "en-US".`,
    };
  }

  doc.setLanguage(trimmed);
  return { ok: true };
}

/**
 * FR-5.8 — `/Alt` on the figure's structure element.
 *
 * The element is found the way the format itself defines the link: the page's
 * `/StructParents` is a key into the structure tree's parent tree, and the
 * figure's marked-content id is the index into that key's array. Where a
 * figure has no marked content of its own, the reader fell back to counting
 * figures on the page, and so does this.
 */
function setAltText(
  doc: PDFDocument,
  sourceRef: string,
  description: string
): FixOutcome {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      reason:
        "An alt description cannot be empty. Describe the image, or mark it decorative in the source file.",
    };
  }

  const target = parseFigureRef(sourceRef);
  if (!target) {
    return { ok: false, reason: "This image's location could not be read." };
  }

  const structTreeRoot = lookupDict(
    doc,
    doc.catalog.get(PDFName.of("StructTreeRoot"))
  );
  if (!structTreeRoot) {
    // FR-5.10 — there is no structure tree, so there is no element to carry
    // the description. Writing it anywhere else would look like a fix and
    // change nothing a screen reader reads.
    return { ok: false, reason: NEEDS_TAGGING };
  }

  let page: PDFPage;
  try {
    page = doc.getPage(target.page - 1);
  } catch {
    return { ok: false, reason: "That page is not in this PDF any more." };
  }

  const element =
    target.mcid === undefined
      ? figureByOrdinal(doc, structTreeRoot, page, target.ordinal ?? 1)
      : figureByMcid(doc, structTreeRoot, page, target.mcid);

  if (!element) {
    return {
      ok: false,
      reason:
        "This image could not be found in the PDF's structure tree. Re-read the file and try again.",
    };
  }

  const role = element.get(PDFName.of("S"));
  if (role instanceof PDFName && role.asString() !== "/Figure") {
    return {
      ok: false,
      reason:
        "The element at this position is not tagged as a figure, so alt text does not belong on it.",
    };
  }

  // A hex string carries any character a description might use; a literal
  // string would have to escape them and cannot hold UTF-16 at all.
  element.set(PDFName.of("Alt"), PDFHexString.fromText(trimmed));
  return { ok: true };
}

/** The structure element that owns a marked-content id on a page. */
function figureByMcid(
  doc: PDFDocument,
  structTreeRoot: PDFDict,
  page: PDFPage,
  mcid: number
): PDFDict | undefined {
  const structParents = page.node.get(PDFName.of("StructParents"));
  if (!(structParents instanceof PDFNumber)) {
    return undefined;
  }

  const parentTree = lookupDict(
    doc,
    structTreeRoot.get(PDFName.of("ParentTree"))
  );
  if (!parentTree) {
    return undefined;
  }

  const entry = numberTreeLookup(doc, parentTree, structParents.asNumber());
  if (!(entry instanceof PDFArray)) {
    // A page with a single tagged element may point straight at it rather
    // than at an array of elements, in which case mcid 0 is that element.
    return mcid === 0 ? lookupDict(doc, entry) : undefined;
  }

  return lookupDict(doc, entry.get(mcid));
}

/** The nth `Figure` on a page, in structure-tree order. */
function figureByOrdinal(
  doc: PDFDocument,
  structTreeRoot: PDFDict,
  page: PDFPage,
  ordinal: number
): PDFDict | undefined {
  const pageRef = page.ref;
  let seen = 0;
  let found: PDFDict | undefined;

  walkStructTree(doc, structTreeRoot, (element) => {
    if (found) {
      return;
    }
    const role = element.get(PDFName.of("S"));
    const owner = element.get(PDFName.of("Pg"));
    if (
      role instanceof PDFName &&
      role.asString() === "/Figure" &&
      isRefTo(owner, pageRef)
    ) {
      seen += 1;
      if (seen === ordinal) {
        found = element;
      }
    }
  });

  return found;
}

function walkStructTree(
  doc: PDFDocument,
  node: PDFDict,
  visit: (element: PDFDict) => void,
  depth = 0
): void {
  // Structure trees are shallow in practice; the limit is only here so a file
  // with a cycle cannot hang the browser.
  if (depth > 64) {
    return;
  }

  const kids = node.get(PDFName.of("K"));

  for (const kid of asList(doc, kids)) {
    const element = lookupDict(doc, kid);
    if (!element) {
      continue;
    }
    visit(element);
    walkStructTree(doc, element, visit, depth + 1);
  }
}

/** `/K` is one object, an array of them, or a marked-content id. */
function asList(doc: PDFDocument, value: PDFObject | undefined): PDFObject[] {
  const resolved = resolve(doc, value);
  if (resolved instanceof PDFArray) {
    return resolved.asArray().slice();
  }
  return resolved ? [resolved] : [];
}

/**
 * A number tree (PDF 1.7, 7.9.7): `/Nums` holds key and value side by side,
 * and `/Kids` splits a large tree into ranges.
 */
function numberTreeLookup(
  doc: PDFDocument,
  node: PDFDict,
  key: number,
  depth = 0
): PDFObject | undefined {
  if (depth > 32) {
    return undefined;
  }

  const nums = resolve(doc, node.get(PDFName.of("Nums")));
  if (nums instanceof PDFArray) {
    for (let index = 0; index + 1 < nums.size(); index += 2) {
      const candidate = resolve(doc, nums.get(index));
      if (candidate instanceof PDFNumber && candidate.asNumber() === key) {
        return resolve(doc, nums.get(index + 1));
      }
    }
  }

  const kids = resolve(doc, node.get(PDFName.of("Kids")));
  if (!(kids instanceof PDFArray)) {
    return undefined;
  }

  for (const kid of kids.asArray()) {
    const child = lookupDict(doc, kid);
    if (!child) {
      continue;
    }

    const limits = resolve(doc, child.get(PDFName.of("Limits")));
    if (limits instanceof PDFArray) {
      const low = resolve(doc, limits.get(0));
      const high = resolve(doc, limits.get(1));
      if (
        low instanceof PDFNumber &&
        high instanceof PDFNumber &&
        (key < low.asNumber() || key > high.asNumber())
      ) {
        continue;
      }
    }

    const found = numberTreeLookup(doc, child, key, depth + 1);
    if (found !== undefined) {
      return found;
    }
  }

  return undefined;
}

function resolve(
  doc: PDFDocument,
  value: PDFObject | undefined
): PDFObject | undefined {
  if (value === undefined) {
    return undefined;
  }
  return doc.context.lookup(value) ?? value;
}

function lookupDict(
  doc: PDFDocument,
  value: PDFObject | undefined
): PDFDict | undefined {
  const resolved = resolve(doc, value);
  return isDict(resolved) ? resolved : undefined;
}

function isDict(value: PDFObject | undefined): value is PDFDict {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PDFDict).get === "function" &&
    typeof (value as PDFDict).set === "function"
  );
}

function isRefTo(value: PDFObject | undefined, ref: PDFRef): boolean {
  const candidate = value as PDFRef | undefined;
  return (
    candidate?.objectNumber === ref.objectNumber &&
    candidate?.generationNumber === ref.generationNumber
  );
}
