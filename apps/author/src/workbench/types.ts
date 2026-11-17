import type {
  AccessibilityReport,
  DocumentModel,
} from "@accessibility-docs/core";
import type { SlideImage } from "@accessibility-docs/formats";

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
  | { kind: "media"; id: string; name: string; bytes: ArrayBuffer };

export type WorkerResponse =
  | {
      kind: "read";
      id: string;
      ok: true;
      model: DocumentModel;
      report: AccessibilityReport;
    }
  | { kind: "media"; id: string; ok: true; images: SlideImage[] }
  | {
      kind: "read" | "media";
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
}

/** Images for one file, keyed by the part path a FigureNode's `src` holds. */
export type MediaMap = Record<string, string>;

export type MediaStatus = "idle" | "loading" | "ready" | "failed";
