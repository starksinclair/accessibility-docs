/**
 * PPTX writer (FR-5): the original deck plus a list of approved fixes, out as
 * a new file.
 *
 * Two rules hold throughout. **The upload is never modified** — every edit is
 * made to a copy of the part's text and written into a new package. And a fix
 * that cannot be applied is reported, never guessed at: `skipped` carries the
 * reason, so the Workbench can tell the user plainly instead of handing back a
 * file that silently did less than it claimed.
 */
import type JSZip from "jszip";
import { FormatReadError } from "../errors.js";
import type { FileLike } from "../zip.js";
import { assertZipContainer, openZip, readPart, toBytes } from "../zip.js";
import type { ElementRange } from "./xmlEdit.js";
import {
  attributeOf,
  elementAt,
  escapeXmlText,
  findElements,
  firstElementWithin,
  insertFirstChild,
  openingTagOf,
  replaceContent,
  sanitizeXmlText,
  setAttribute,
} from "./xmlEdit.js";

/** Shapes that can carry a `p:cNvPr`, innermost first when nested. */
const SHAPE_TAGS = ["p:sp", "p:pic", "p:graphicFrame"] as const;

export type PptxFix =
  /** FR-5.1 — alt text on a picture. `sourceRef` is "<part>#<shape id>". */
  | {
      kind: "alt-text";
      sourceRef: string;
      description: string;
      /** Legacy field; written only when given (see the C-4 amendment). */
      title?: string;
    }
  /** FR-5.2 / FR-5.5 — the slide's title. `sourceRef` is the slide part. */
  | { kind: "slide-title"; sourceRef: string; title: string }
  /** FR-5.3 — mark a table's first row as its header row. */
  | { kind: "table-header"; sourceRef: string }
  /** FR-5.4 — the presentation's `dc:title`. */
  | { kind: "document-title"; title: string };

export interface SkippedFix {
  fix: PptxFix;
  reason: string;
}

export interface PptxWriteResult {
  /** A new package. The file that was passed in is untouched. */
  bytes: Uint8Array;
  applied: PptxFix[];
  skipped: SkippedFix[];
  /** Things the user should know about what was written. */
  notes: string[];
}

export async function applyPptxFixes(
  file: FileLike,
  fixes: readonly PptxFix[]
): Promise<PptxWriteResult> {
  const bytes = await toBytes(file);
  assertZipContainer(bytes);
  const zip = await openZip(bytes);

  const parts = new PartCache(zip);
  const applied: PptxFix[] = [];
  const skipped: SkippedFix[] = [];
  const notes: string[] = [];

  for (const fix of fixes) {
    try {
      const outcome = await applyOne(parts, fix);
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
          "This fix could not be written into the file. The slide may have been saved by an unusual tool.",
      });
    }
  }

  for (const [path, text] of parts.changed()) {
    zip.file(path, text);
  }

  const out = await zip.generateAsync({
    type: "uint8array",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });

  return { bytes: out, applied, skipped, notes };
}

type FixOutcome =
  | { ok: true; note?: string }
  | { ok: false; reason: string };

async function applyOne(
  parts: PartCache,
  fix: PptxFix
): Promise<FixOutcome> {
  if (fix.kind === "document-title") {
    return setDocumentTitle(parts, fix.title);
  }

  const { path, shapeId } = splitSourceRef(fix.sourceRef);
  const xml = await parts.read(path);
  if (xml === undefined) {
    return {
      ok: false,
      reason: "That slide is no longer in the file.",
    };
  }

  switch (fix.kind) {
    case "alt-text":
      return setAltText(parts, path, xml, shapeId, fix);
    case "slide-title":
      return setSlideTitle(parts, path, xml, fix.title);
    case "table-header":
      return setTableHeader(parts, path, xml, shapeId);
  }
}

/** "ppt/slides/slide2.xml#5" → { path, shapeId }. */
function splitSourceRef(sourceRef: string): {
  path: string;
  shapeId?: string;
} {
  const hash = sourceRef.indexOf("#");
  if (hash === -1) {
    return { path: sourceRef };
  }
  return {
    path: sourceRef.slice(0, hash),
    shapeId: sourceRef.slice(hash + 1),
  };
}

/**
 * The smallest shape element containing the `p:cNvPr` with this id.
 *
 * Smallest, because shapes nest: a picture inside a group sits inside the
 * group's own element, and the picture is the one being fixed.
 */
function shapeById(xml: string, shapeId: string): ElementRange | null {
  const marker = new RegExp(`<p:cNvPr\\s[^>]*\\bid="${shapeId}"`);
  const match = marker.exec(xml);
  if (!match) {
    return null;
  }

  const index = match.index;
  let best: ElementRange | null = null;

  for (const tag of SHAPE_TAGS) {
    for (const element of findElements(xml, tag)) {
      if (element.start > index || element.end < index) {
        continue;
      }
      if (!best || element.end - element.start < best.end - best.start) {
        best = element;
      }
    }
  }

  return best;
}

/** FR-5.1 — alt text lives on the picture's `p:cNvPr`. */
function setAltText(
  parts: PartCache,
  path: string,
  xml: string,
  shapeId: string | undefined,
  fix: Extract<PptxFix, { kind: "alt-text" }>
): FixOutcome {
  if (!shapeId) {
    return { ok: false, reason: "This fix does not say which image to change." };
  }

  const shape = shapeById(xml, shapeId);
  if (!shape) {
    return { ok: false, reason: "That image is no longer on the slide." };
  }

  const properties = firstElementWithin(xml, "p:cNvPr", shape);
  if (!properties) {
    return { ok: false, reason: "That image has no properties to write to." };
  }

  const description = sanitizeXmlText(fix.description);
  if (description.length === 0) {
    return {
      ok: false,
      reason: "An alt description cannot be empty.",
    };
  }

  let next = setAttribute(xml, properties, "descr", description);

  if (fix.title !== undefined) {
    const refreshed = firstElementWithin(next, "p:cNvPr", {
      start: shape.start,
      // The tag grew, so look a little further than the original range.
      end: shape.end + (next.length - xml.length) + 1,
    });
    if (refreshed) {
      next = setAttribute(next, refreshed, "title", sanitizeXmlText(fix.title));
    }
  }

  parts.write(path, next);
  return { ok: true };
}

/**
 * FR-5.2 and FR-5.5 — the slide's title.
 *
 * Filling an existing title placeholder is the easy half. A slide with no
 * title placeholder at all is the common case in the decks this tool is for,
 * and it is exactly what other checkers can only tell a lecturer to fix by
 * hand, so one is inserted.
 */
function setSlideTitle(
  parts: PartCache,
  path: string,
  xml: string,
  rawTitle: string
): FixOutcome {
  const title = sanitizeXmlText(rawTitle);
  if (title.length === 0) {
    return { ok: false, reason: "A slide title cannot be empty." };
  }

  const placeholder = titlePlaceholder(xml);

  if (placeholder) {
    const body = firstElementWithin(xml, "p:txBody", placeholder);
    if (!body) {
      return {
        ok: false,
        reason: "The slide's title placeholder has no text box to write into.",
      };
    }

    // Keep `a:bodyPr` and `a:lstStyle` — they carry the placeholder's own
    // autofit and list settings — and replace only the paragraphs.
    const content = xml.slice(body.contentStart, body.contentEnd);
    const firstParagraph = content.search(/<a:p[\s/>]/);
    const kept = firstParagraph === -1 ? content : content.slice(0, firstParagraph);

    parts.write(
      path,
      replaceContent(xml, body, kept + paragraphXml(title))
    );
    return { ok: true };
  }

  const tree = firstElementWithin(xml, "p:spTree", { start: 0, end: xml.length });
  if (!tree) {
    return { ok: false, reason: "This slide has no shape tree to add a title to." };
  }

  // The group properties must stay first in the tree; the title goes straight
  // after them, so assistive technology reads the title before the content.
  const groupProperties = firstElementWithin(xml, "p:grpSpPr", tree);
  const insertAt = groupProperties ? groupProperties.end : tree.contentStart;

  const next =
    xml.slice(0, insertAt) +
    titleShapeXml(nextShapeId(xml), title) +
    xml.slice(insertAt);

  parts.write(path, next);
  return {
    ok: true,
    note:
      "This slide had no title placeholder, so one was added off the edge of the slide. " +
      "Screen readers and the slide outline will read the title; the slide itself looks unchanged.",
  };
}

/** The slide's title placeholder shape, if it has one. */
function titlePlaceholder(xml: string): ElementRange | null {
  for (const shape of findElements(xml, "p:sp")) {
    const placeholder = firstElementWithin(xml, "p:ph", shape);
    if (!placeholder) {
      continue;
    }
    const type = attributeOf(openingTagOf(xml, placeholder), "type");
    if (type === "title" || type === "ctrTitle") {
      return shape;
    }
  }
  return null;
}

/** One shape id above the highest in the part, so the new shape is unique. */
function nextShapeId(xml: string): number {
  let highest = 1;
  const pattern = /<p:cNvPr\s[^>]*\bid="(\d+)"/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    highest = Math.max(highest, Number(match[1]));
  }

  return highest + 1;
}

function paragraphXml(text: string): string {
  return `<a:p><a:r><a:t>${escapeXmlText(text)}</a:t></a:r></a:p>`;
}

/**
 * A title placeholder parked above the slide.
 *
 * Off-slide rather than on it, because a lecturer's deck is already laid out
 * and a title box dropped into the middle of it would be a visual change they
 * did not ask for. The title is still in the file's structure, which is what
 * a screen reader, the Outline view and PowerPoint's own checker read.
 */
function titleShapeXml(id: number, title: string): string {
  return (
    `<p:sp><p:nvSpPr>` +
    `<p:cNvPr id="${id}" name="Title ${id}"/>` +
    `<p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>` +
    `<p:nvPr><p:ph type="title"/></p:nvPr>` +
    `</p:nvSpPr>` +
    `<p:spPr><a:xfrm><a:off x="0" y="-1143000"/>` +
    `<a:ext cx="9144000" cy="1143000"/></a:xfrm></p:spPr>` +
    `<p:txBody><a:bodyPr/><a:lstStyle/>${paragraphXml(title)}</p:txBody>` +
    `</p:sp>`
  );
}

/** FR-5.3 — `firstRow="1"` on the table's `a:tblPr`. */
function setTableHeader(
  parts: PartCache,
  path: string,
  xml: string,
  shapeId: string | undefined
): FixOutcome {
  if (!shapeId) {
    return { ok: false, reason: "This fix does not say which table to change." };
  }

  const shape = shapeById(xml, shapeId);
  if (!shape) {
    return { ok: false, reason: "That table is no longer on the slide." };
  }

  const table = firstElementWithin(xml, "a:tbl", shape);
  if (!table) {
    return { ok: false, reason: "That shape is not a table." };
  }

  const properties = firstElementWithin(xml, "a:tblPr", table);
  if (properties) {
    parts.write(path, setAttribute(xml, properties, "firstRow", "1"));
    return { ok: true };
  }

  // `a:tblPr` is optional, but when present it must be the table's first
  // child, so an inserted one goes at the front.
  parts.write(path, insertFirstChild(xml, table, `<a:tblPr firstRow="1"/>`));
  return { ok: true };
}

/** FR-5.4 — `dc:title` in docProps/core.xml. */
async function setDocumentTitle(
  parts: PartCache,
  rawTitle: string
): Promise<FixOutcome> {
  const title = sanitizeXmlText(rawTitle);
  if (title.length === 0) {
    return { ok: false, reason: "A document title cannot be empty." };
  }

  const path = "docProps/core.xml";
  const xml = await parts.read(path);
  if (xml === undefined) {
    return {
      ok: false,
      reason:
        "This file has no document properties part, so a title cannot be stored in it.",
    };
  }

  const existing = findElements(xml, "dc:title")[0];
  if (existing) {
    parts.write(path, replaceContent(xml, existing, escapeXmlText(title)));
    return { ok: true };
  }

  const properties = elementAt(xml, "cp:coreProperties", xml.indexOf("<cp:coreProperties"));
  if (!properties) {
    return {
      ok: false,
      reason: "This file's document properties could not be read.",
    };
  }

  parts.write(
    path,
    insertFirstChild(xml, properties, `<dc:title>${escapeXmlText(title)}</dc:title>`)
  );
  return { ok: true };
}

/**
 * Part text, read once and edited in memory.
 *
 * Several fixes often land on the same slide; without this, each one would
 * read the part again and overwrite the one before it.
 */
class PartCache {
  private readonly texts = new Map<string, string>();
  private readonly dirty = new Set<string>();

  constructor(private readonly zip: JSZip) {}

  async read(path: string): Promise<string | undefined> {
    const cached = this.texts.get(path);
    if (cached !== undefined) {
      return cached;
    }

    const text = await readPart(this.zip, path);
    if (text === undefined) {
      return undefined;
    }

    this.texts.set(path, text);
    return text;
  }

  write(path: string, text: string): void {
    this.texts.set(path, text);
    this.dirty.add(path);
  }

  *changed(): Generator<[string, string]> {
    for (const path of this.dirty) {
      const text = this.texts.get(path);
      if (text !== undefined) {
        yield [path, text];
      }
    }
  }
}

/** Re-exported so callers can narrow a thrown error. */
export { FormatReadError };
