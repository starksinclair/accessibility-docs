/**
 * Opening the container. Everything happens in memory: nothing is written to
 * disk and nothing leaves the machine (section 3 of the requirements).
 */
import JSZip from "jszip";
import { FormatReadError } from "./errors.js";

/** Anything the Workbench or a test can hand a reader. */
export type FileLike = ArrayBuffer | Uint8Array | Blob;

/** Local file signature of a ZIP entry: "PK\x03\x04". */
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04];

/** OLE2 compound file, which is what a legacy binary .ppt is (FR-4.6). */
const OLE_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];

export async function toBytes(file: FileLike): Promise<Uint8Array> {
  if (file instanceof Uint8Array) {
    return file;
  }
  if (file instanceof ArrayBuffer) {
    return new Uint8Array(file);
  }
  return new Uint8Array(await file.arrayBuffer());
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) {
    return false;
  }
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Checks the file signature rather than trusting the extension (FR-6.2), and
 * names the two wrong-file cases a faculty member actually hits.
 */
export function assertZipContainer(bytes: Uint8Array): void {
  if (startsWith(bytes, ZIP_SIGNATURE)) {
    return;
  }

  if (startsWith(bytes, OLE_SIGNATURE)) {
    throw new FormatReadError(
      "legacy-ppt",
      "This is a legacy PowerPoint file. Save as .pptx in PowerPoint, then upload again."
    );
  }

  throw new FormatReadError(
    "not-a-zip",
    "This file is not a PowerPoint (.pptx) file. Check the file and upload again."
  );
}

export async function openZip(bytes: Uint8Array): Promise<JSZip> {
  try {
    return await JSZip.loadAsync(bytes);
  } catch {
    throw new FormatReadError(
      "corrupt",
      "This file could not be opened. It may be damaged; try re-saving it in PowerPoint."
    );
  }
}

/** Reads one part as text, or undefined when the part is absent. */
export async function readPart(
  zip: JSZip,
  path: string
): Promise<string | undefined> {
  const entry = zip.file(path);
  if (!entry) {
    return undefined;
  }
  return entry.async("string");
}
