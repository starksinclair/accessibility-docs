/**
 * Pulling the pictures out of a deck so the viewer can show them (FR-8.3).
 *
 * The reader records each figure's `src` as its part path inside the package
 * ("ppt/media/image1.png"); this resolves those paths to bytes. It is a second
 * pass rather than part of `pptxToModel` on purpose: a batch of 30 decks is
 * read and ranked up front, but only the deck being looked at needs its images
 * in memory.
 */
import { FormatReadError } from "../errors.js";
import type { FileLike } from "../zip.js";
import { assertZipContainer, openZip, toBytes } from "../zip.js";

export interface SlideImage {
  /** Part path inside the package, matching `FigureNode.src`. */
  path: string;
  bytes: ArrayBuffer;
  /** Media type for the Blob the viewer builds. */
  contentType: string;
}

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  bmp: "image/bmp",
  tiff: "image/tiff",
  svg: "image/svg+xml",
  webp: "image/webp",
};

function contentTypeOf(path: string): string | undefined {
  const dot = path.lastIndexOf(".");
  if (dot === -1) {
    return undefined;
  }
  return CONTENT_TYPES[path.slice(dot + 1).toLowerCase()];
}

/**
 * Every image part in the package, in `ppt/media/`.
 *
 * Parts in formats a browser cannot display (EMF, WMF) are left out rather
 * than handed over as something the viewer would fail to render; the structure
 * view says the image cannot be previewed instead.
 */
export async function extractPptxMedia(
  file: FileLike
): Promise<SlideImage[]> {
  const bytes = await toBytes(file);
  assertZipContainer(bytes);
  const zip = await openZip(bytes);

  const images: SlideImage[] = [];

  for (const path of Object.keys(zip.files)) {
    if (!path.startsWith("ppt/media/")) {
      continue;
    }

    const contentType = contentTypeOf(path);
    if (!contentType) {
      continue;
    }

    const entry = zip.file(path);
    if (!entry) {
      continue;
    }

    try {
      const data = await entry.async("arraybuffer");
      images.push({ path, bytes: data, contentType });
    } catch {
      throw new FormatReadError(
        "corrupt",
        "An image in this file could not be read. It may be damaged; try re-saving it in PowerPoint."
      );
    }
  }

  return images.sort((a, b) => a.path.localeCompare(b.path));
}
