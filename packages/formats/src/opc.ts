/**
 * Open Packaging Conventions plumbing shared by the Open XML readers:
 * relationship lookup and part-path arithmetic.
 */
import type JSZip from "jszip";
import { attr, childrenOf, findFirst, parseXml } from "./xml.js";
import { readPart } from "./zip.js";

export interface Relationship {
  id: string;
  type: string;
  /** Resolved absolute part path inside the package, e.g. "ppt/media/a.png". */
  target: string;
  /** True for a link out of the package; those have no part to read. */
  external: boolean;
}

/** "ppt/slides/slide1.xml" → "ppt/slides/_rels/slide1.xml.rels" */
export function relsPathFor(partPath: string): string {
  const slash = partPath.lastIndexOf("/");
  const directory = slash === -1 ? "" : partPath.slice(0, slash + 1);
  const name = partPath.slice(slash + 1);
  return `${directory}_rels/${name}.rels`;
}

/** Resolves a relationship target against the part that declared it. */
export function resolveTarget(partPath: string, target: string): string {
  if (target.startsWith("/")) {
    return target.slice(1);
  }

  const segments = partPath.split("/").slice(0, -1);

  for (const segment of target.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      segments.pop();
      continue;
    }
    segments.push(segment);
  }

  return segments.join("/");
}

/** Relationships declared by one part, keyed by r:id. */
export async function readRelationships(
  zip: JSZip,
  partPath: string
): Promise<Map<string, Relationship>> {
  const relationships = new Map<string, Relationship>();
  const xml = await readPart(zip, relsPathFor(partPath));
  if (!xml) {
    return relationships;
  }

  const root = findFirst(parseXml(xml), "Relationships");
  if (!root) {
    return relationships;
  }

  for (const element of childrenOf(root)) {
    const id = attr(element, "Id");
    const target = attr(element, "Target");
    if (!id || target === undefined) {
      continue;
    }

    const external = attr(element, "TargetMode") === "External";
    relationships.set(id, {
      id,
      type: attr(element, "Type") ?? "",
      target: external ? target : resolveTarget(partPath, target),
      external,
    });
  }

  return relationships;
}
