/**
 * Opening a PDF with pdf.js, in both places this package runs: the browser
 * worker the Workbench reads files in, and Node for the tests.
 *
 * pdf.js is loaded on demand. It is by far the largest dependency here, and a
 * batch of PowerPoint decks should not pay for it, so the import sits inside
 * `openPdf` where the bundler can split it out.
 */
import { FormatReadError } from "../errors.js";

/** "%PDF" — the header every PDF starts with. */
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46];

export interface PdfOpenOptions {
  /**
   * URL of pdf.js's own worker script.
   *
   * In Node, pdf.js runs its parser in-process and this is not needed. In the
   * browser the caller passes the bundled worker URL; without one pdf.js
   * parses on the calling thread, which for the Workbench is already a Web
   * Worker (FR-6.4) and so still off the page's main thread.
   */
  workerSrc?: string;
}

/** The parts of pdf.js's document proxy this package uses. */
export interface PdfDocument {
  numPages: number;
  getMetadata: () => Promise<{ info?: Record<string, unknown> }>;
  getPage: (page: number) => Promise<PdfPage>;
}

export interface PdfPage {
  getStructTree: () => Promise<unknown>;
  getTextContent: (options: {
    includeMarkedContent: boolean;
  }) => Promise<{ items: unknown[] }>;
}

/**
 * An open document, and the handle that lets go of it.
 *
 * pdf.js keeps a loading task — and in the browser a worker port — alive
 * behind every document, and only the task can shut it down. A batch of 30
 * files would otherwise hold all 30 open.
 */
export interface OpenPdf {
  document: PdfDocument;
  close: () => Promise<void>;
}

type PdfjsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: Record<string, unknown>) => {
    promise: Promise<PdfDocument>;
    destroy: () => Promise<void>;
  };
};

let pdfjs: Promise<PdfjsModule> | undefined;
let pendingWorkerSrc: string | undefined;

/**
 * The legacy build is the one that runs unchanged in Node and in a Web
 * Worker; the default build assumes a browser main thread.
 */
async function load(): Promise<PdfjsModule> {
  pdfjs ??= import("pdfjs-dist/legacy/build/pdf.mjs") as unknown as Promise<PdfjsModule>;
  const module = await pdfjs;

  if (pendingWorkerSrc !== undefined) {
    module.GlobalWorkerOptions.workerSrc = pendingWorkerSrc;
    pendingWorkerSrc = undefined;
  }

  return module;
}

/**
 * Remembers the caller's worker URL until pdf.js is actually loaded, so
 * configuring it never pulls the library in on its own.
 */
export function configureWorker(options: PdfOpenOptions): void {
  if (options.workerSrc) {
    pendingWorkerSrc = options.workerSrc;
  }
}

/** FR-6.2 — the signature, not the extension, decides what this file is. */
export function assertPdfSignature(bytes: Uint8Array): void {
  const matches =
    bytes.length >= PDF_SIGNATURE.length &&
    PDF_SIGNATURE.every((byte, index) => bytes[index] === byte);

  if (!matches) {
    throw new FormatReadError(
      "not-a-pdf",
      "This file is not a PDF. Check the file and upload again."
    );
  }
}

export async function openPdf(
  bytes: Uint8Array,
  options: PdfOpenOptions = {}
): Promise<OpenPdf> {
  const { getDocument } = await load();
  const task = getDocument({
      // pdf.js takes ownership of the array it is given and detaches it, so it
      // gets a copy: the Workbench keeps the uploaded bytes to write fixes
      // into later (FR-5).
      data: new Uint8Array(bytes),
      // NFR-5 — nothing about a course file leaves the machine, so no fonts,
      // images or XFA resources are fetched, and no PDF-supplied script is
      // ever evaluated.
      isEvalSupported: false,
      useSystemFonts: false,
      disableFontFace: true,
      enableXfa: false,
      // Warnings about non-standard PDFs are expected here: these are the
      // files faculty already have, not clean exports.
      verbosity: 0,
    });

  try {
    return {
      document: await task.promise,
      close: () => task.destroy(),
    };
  } catch (error) {
    await task.destroy();

    if (isPasswordError(error)) {
      throw new FormatReadError(
        "password-protected",
        "This PDF is password protected, so it cannot be read. Remove the password and upload again."
      );
    }

    throw new FormatReadError(
      "corrupt",
      "This PDF could not be opened. It may be damaged; try re-saving or re-exporting it."
    );
  }
}

function isPasswordError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { name?: string }).name === "PasswordException"
  );
}
