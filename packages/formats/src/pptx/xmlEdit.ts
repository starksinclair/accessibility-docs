/**
 * Surgical edits to Open XML parts, as strings.
 *
 * The writer deliberately does not parse a slide, rebuild it and serialise it
 * back: a round trip through any serialiser rewrites namespace declarations,
 * attribute order and self-closing tags across the whole part, which turns a
 * one-attribute fix into a diff PowerPoint has to be trusted to accept. These
 * helpers change the bytes that need changing and leave everything else
 * exactly as the authoring tool wrote it.
 */

/** Escapes text for an XML text node. */
export function escapeXmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Escapes a value for a double-quoted XML attribute. */
export function escapeXmlAttribute(value: string): string {
  return escapeXmlText(value).replace(/"/g, "&quot;");
}

/**
 * Strips the characters XML 1.0 cannot carry at all.
 *
 * Suggested text can arrive from a model or from a paste; a stray control
 * character would make the part unreadable, and PowerPoint would offer to
 * "repair" the file, which is the one outcome FR-5's acceptance rules out.
 */
export function sanitizeXmlText(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").trim();
}

export interface ElementRange {
  tag: string;
  /** Index of "<". */
  start: number;
  /** Index just past ">" of the closing tag (or of a self-closing element). */
  end: number;
  /** Index just past ">" of the opening tag. */
  contentStart: number;
  /** Index of "<" of the closing tag; equals contentStart when self-closed. */
  contentEnd: number;
  selfClosing: boolean;
}

/** True when `<tag` at `index` is that tag and not a longer name. */
function isTagAt(xml: string, index: number, tag: string): boolean {
  if (!xml.startsWith(`<${tag}`, index)) {
    return false;
  }
  const next = xml[index + tag.length + 1];
  return next === ">" || next === " " || next === "/" || next === "\n" || next === "\r" || next === "\t";
}

/** The end of the opening tag that starts at `index`. */
function openTagEnd(xml: string, index: number): number {
  const close = xml.indexOf(">", index);
  return close === -1 ? xml.length : close + 1;
}

/**
 * The element of `tag` beginning at `start`, including nested elements of the
 * same name.
 */
export function elementAt(
  xml: string,
  tag: string,
  start: number
): ElementRange | null {
  if (!isTagAt(xml, start, tag)) {
    return null;
  }

  const contentStart = openTagEnd(xml, start);
  const selfClosing = xml[contentStart - 2] === "/";

  if (selfClosing) {
    return {
      tag,
      start,
      end: contentStart,
      contentStart,
      contentEnd: contentStart,
      selfClosing: true,
    };
  }

  let depth = 1;
  let cursor = contentStart;

  while (cursor < xml.length && depth > 0) {
    const nextOpen = xml.indexOf(`<${tag}`, cursor);
    const nextClose = xml.indexOf(`</${tag}>`, cursor);

    if (nextClose === -1) {
      return null;
    }

    if (nextOpen !== -1 && nextOpen < nextClose && isTagAt(xml, nextOpen, tag)) {
      const inner = openTagEnd(xml, nextOpen);
      if (xml[inner - 2] !== "/") {
        depth += 1;
      }
      cursor = inner;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return {
        tag,
        start,
        end: nextClose + tag.length + 3,
        contentStart,
        contentEnd: nextClose,
        selfClosing: false,
      };
    }
    cursor = nextClose + tag.length + 3;
  }

  return null;
}

/** Every element with this tag name, in document order. */
export function findElements(xml: string, tag: string): ElementRange[] {
  const found: ElementRange[] = [];
  let cursor = 0;

  while (cursor < xml.length) {
    const index = xml.indexOf(`<${tag}`, cursor);
    if (index === -1) {
      break;
    }
    if (!isTagAt(xml, index, tag)) {
      cursor = index + 1;
      continue;
    }

    const element = elementAt(xml, tag, index);
    if (!element) {
      cursor = index + 1;
      continue;
    }

    found.push(element);
    // Step inside, so nested elements of the same name are found too.
    cursor = element.contentStart;
  }

  return found;
}

/** The first element with this tag inside `range`. */
export function firstElementWithin(
  xml: string,
  tag: string,
  range: { start: number; end: number }
): ElementRange | null {
  let cursor = range.start;

  while (cursor < range.end) {
    const index = xml.indexOf(`<${tag}`, cursor);
    if (index === -1 || index >= range.end) {
      return null;
    }
    if (!isTagAt(xml, index, tag)) {
      cursor = index + 1;
      continue;
    }
    return elementAt(xml, tag, index);
  }

  return null;
}

/** The opening tag's text, e.g. `<p:cNvPr id="3" name="Picture 2"/>`. */
export function openingTagOf(xml: string, element: ElementRange): string {
  return xml.slice(element.start, element.contentStart);
}

export function attributeOf(
  openingTag: string,
  name: string
): string | undefined {
  const match = new RegExp(`\\s${name}="([^"]*)"`).exec(openingTag);
  return match ? match[1] : undefined;
}

/**
 * Sets (or replaces) one attribute on an element's opening tag, returning the
 * whole part with that one tag rewritten.
 */
export function setAttribute(
  xml: string,
  element: ElementRange,
  name: string,
  value: string
): string {
  const opening = openingTagOf(xml, element);
  const escaped = escapeXmlAttribute(value);
  const existing = new RegExp(`\\s${name}="[^"]*"`);

  const rewritten = existing.test(opening)
    ? opening.replace(existing, ` ${name}="${escaped}"`)
    : opening.replace(
        /(\/?)>$/,
        (_match, slash: string) => ` ${name}="${escaped}"${slash}>`
      );

  return xml.slice(0, element.start) + rewritten + xml.slice(element.contentStart);
}

/** Replaces an element's children, keeping its opening and closing tags. */
export function replaceContent(
  xml: string,
  element: ElementRange,
  content: string
): string {
  if (element.selfClosing) {
    const opening = openingTagOf(xml, element).replace(/\/>$/, ">");
    return (
      xml.slice(0, element.start) +
      opening +
      content +
      `</${element.tag}>` +
      xml.slice(element.end)
    );
  }

  return (
    xml.slice(0, element.contentStart) + content + xml.slice(element.contentEnd)
  );
}

/** Inserts markup as the first child of an element. */
export function insertFirstChild(
  xml: string,
  element: ElementRange,
  content: string
): string {
  if (element.selfClosing) {
    return replaceContent(xml, element, content);
  }
  return (
    xml.slice(0, element.contentStart) + content + xml.slice(element.contentStart)
  );
}
