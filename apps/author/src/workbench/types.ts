import type {
  AccessibilityReport,
  DocumentModel,
} from "@accessibility-docs/core";
import type {
  PdfFix,
  PptxFix,
  SkippedFix,
  SkippedPdfFix,
  SlideImage,
} from "@accessibility-docs/formats";

/** Which reader and writer a file goes through. */
export type DocumentFormat = "pptx" | "pdf";

/**
 * A fix for whichever format the file turned out to be.
 *
 * The two writers overlap where the fix is the same idea in both formats — a
 * document title, a description on an image — so the panel that collects a
 * fix does not have to know which file it is looking at. The worker routes by
 * the file's own format, not by the fix.
 */
export type DocumentFix = PptxFix | PdfFix;

/** A fix the writer would not make, with the reason the user is shown. */
export type SkippedDocumentFix = SkippedFix | SkippedPdfFix;

/**
 * What the parsing worker is asked to do.
 *
 * "read" turns a file into a model and checks it; "media" pulls that same
 * file's pictures out for the viewer. They are separate messages because a
 * batch of 30 decks is read up front, while only the deck on screen needs its
 * images in memory (FR-8.3).
 */
export type WorkerRequest =
  | { kind: "read"; id: string; name: string; bytes: ArrayBuffer }
  | { kind: "media"; id: string; name: string; bytes: ArrayBuffer }
  /** FR-9.6 / FR-9.7 — write approved fixes, then re-read and re-check. */
  | {
      kind: "apply";
      id: string;
      name: string;
      bytes: ArrayBuffer;
      fixes: DocumentFix[];
    };

export type WorkerResponse =
  | {
      kind: "read";
      id: string;
      ok: true;
      model: DocumentModel;
      report: AccessibilityReport;
      /** What the file actually is, by signature rather than by name. */
      format: DocumentFormat;
    }
  | { kind: "media"; id: string; ok: true; images: SlideImage[] }
  | {
      kind: "apply";
      id: string;
      ok: true;
      /** The fixed deck. The upload itself is never modified (FR-5). */
      bytes: ArrayBuffer;
      model: DocumentModel;
      report: AccessibilityReport;
      applied: number;
      skipped: SkippedDocumentFix[];
      notes: string[];
    }
  | {
      kind: "read" | "media" | "apply";
      id: string;
      ok: false;
      /** Shown to the user verbatim as the failure reason (FR-6.3). */
      reason: string;
    };

/** FR-6.3 — the states a file moves through in the upload list. */
export type FileStatus = "reading" | "checking" | "ready" | "failed";

export interface WorkbenchFile {
  id: string;
  name: string;
  size: number;
  /** "pptx", "pdf", or whatever the name ends in. */
  kind: string;
  /**
   * What the reader found the file to be, once it has been read. It can
   * disagree with `kind`: a PDF someone renamed .pptx is read as the PDF it
   * is (FR-6.2).
   */
  format?: DocumentFormat;
  /**
   * The browser's handle on the file. Holding it is cheap — it is a reference
   * to the bytes on disk, not a copy — and it lets the viewer re-read the deck
   * for its images, and the writer re-read it to produce a fixed copy, without
   * keeping every upload's bytes in memory.
   */
  file: File;
  status: FileStatus;
  model?: DocumentModel;
  report?: AccessibilityReport;
  reason?: string;
  /**
   * The fixed deck, once anything has been applied. Present means "this file
   * has unsaved changes you can download"; absent means it is still as
   * uploaded.
   */
  fixed?: Uint8Array;
  /** How many fixes have been written, for the counter (FR-8.8). */
  appliedCount?: number;
}

/** Images for one file, keyed by the part path a FigureNode's `src` holds. */
export type MediaMap = Record<string, string>;

export type MediaStatus = "idle" | "loading" | "ready" | "failed";
