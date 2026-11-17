/**
 * A very small traversal layer over fast-xml-parser's order-preserving output.
 *
 * Order matters here: a slide's shapes are read in document order so the
 * resulting nodes keep the deck's reading order, and `preserveOrder` is the
 * only parser mode that keeps interleaved `p:sp` and `p:pic` siblings in the
 * order PowerPoint wrote them. That mode's shape is awkward to walk by hand —
 * every element is a one-key object, attributes live under ":@" — so these
 * helpers are the only place that awkwardness appears.
 */
import { XMLParser } from "fast-xml-parser";

/** One element: a single tag key holding its children, plus its attributes. */
export type XmlElement = {
  [tag: string]: XmlNode[] | Record<string, string> | string | undefined;
  ":@"?: Record<string, string>;
};

export type XmlNode = XmlElement;

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  preserveOrder: true,
  trimValues: false,
  // Keep every value a string: "1", "0" and "0001" all stay as written, so an
  // attribute test never has to care whether the parser guessed a number.
  parseTagValue: false,
  parseAttributeValue: false,
});

export function parseXml(xml: string): XmlNode[] {
  return parser.parse(xml) as XmlNode[];
}

/** The tag name of an element, ignoring the attribute slot. */
export function tagOf(node: XmlNode): string {
  for (const key of Object.keys(node)) {
    if (key !== ":@") {
      return key;
    }
  }
  return "";
}

/** An element's child elements, in document order. */
export function childrenOf(node: XmlNode): XmlNode[] {
  const value = node[tagOf(node)];
  return Array.isArray(value) ? value : [];
}

/** Direct children with the given tag name. */
export function children(nodes: XmlNode[], tag: string): XmlNode[] {
  return nodes.filter((node) => tagOf(node) === tag);
}

/** The first direct child with the given tag name. */
export function child(nodes: XmlNode[], tag: string): XmlNode | undefined {
  return nodes.find((node) => tagOf(node) === tag);
}

/**
 * Follows a chain of tag names from a list of siblings, for example
 * `descend(slide, "p:cSld", "p:spTree")`.
 */
export function descend(
  nodes: XmlNode[],
  ...path: string[]
): XmlNode | undefined {
  let current: XmlNode | undefined;
  let level = nodes;

  for (const tag of path) {
    current = child(level, tag);
    if (!current) {
      return undefined;
    }
    level = childrenOf(current);
  }

  return current;
}

/** The children of a chain of tags, or an empty list if the chain breaks. */
export function descendChildren(
  nodes: XmlNode[],
  ...path: string[]
): XmlNode[] {
  const found = descend(nodes, ...path);
  return found ? childrenOf(found) : [];
}

export function attr(
  node: XmlNode | undefined,
  name: string
): string | undefined {
  return node?.[":@"]?.[name];
}

/** The first element anywhere below `nodes` with the given tag name. */
export function findFirst(
  nodes: XmlNode[],
  tag: string
): XmlNode | undefined {
  for (const node of nodes) {
    if (tagOf(node) === tag) {
      return node;
    }
    const found = findFirst(childrenOf(node), tag);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/** Every element anywhere below `nodes` with the given tag name. */
export function findAll(nodes: XmlNode[], tag: string): XmlNode[] {
  const found: XmlNode[] = [];

  for (const node of nodes) {
    if (tagOf(node) === tag) {
      found.push(node);
    }
    found.push(...findAll(childrenOf(node), tag));
  }

  return found;
}

/** All `#text` content below `nodes`, concatenated in document order. */
export function textOf(nodes: XmlNode[]): string {
  let text = "";

  for (const node of nodes) {
    const tag = tagOf(node);
    if (tag === "#text") {
      const value = node["#text"];
      text += typeof value === "string" ? value : "";
      continue;
    }
    text += textOf(childrenOf(node));
  }

  return text;
}
