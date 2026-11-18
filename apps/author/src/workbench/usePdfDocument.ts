/**
 * Opens a PDF for page rendering in the Workbench viewer (FR-8.2a).
 *
 * The parsing worker already uses pdf.js for reading; this hook is the
 * main-thread twin that draws pages onto canvases. It shares the same
 * security posture: no remote fonts, no XFA, no eval.
 */
import { useEffect, useState } from "react";
import workerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";

export interface PdfJsDocument {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfJsPage>;
  destroy: () => Promise<void>;
}

export interface PdfJsPage {
  getViewport: (params: { scale: number }) => {
    width: number;
    height: number;
  };
  render: (params: {
    canvas: HTMLCanvasElement;
    canvasContext?: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => { promise: Promise<void>; cancel: () => void };
}

type PdfjsModule = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (options: Record<string, unknown>) => {
    promise: Promise<PdfJsDocument>;
    destroy: () => Promise<void>;
  };
};

let pdfjsPromise: Promise<PdfjsModule> | undefined;

async function loadPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import(
    "pdfjs-dist/legacy/build/pdf.mjs"
  ) as unknown as Promise<PdfjsModule>;
  const module = await pdfjsPromise;
  module.GlobalWorkerOptions.workerSrc = workerSrc;
  return module;
}

export type PdfDocumentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; document: PdfJsDocument }
  | { status: "failed"; reason: string };

/**
 * Loads `bytes` into a pdf.js document. Pass a stable reference (or a new
 * buffer after a fix) so the document is rebuilt when the working copy
 * changes.
 */
export function usePdfDocument(bytes: Uint8Array | null): PdfDocumentState {
  const [state, setState] = useState<PdfDocumentState>({ status: "idle" });

  useEffect(() => {
    if (!bytes || bytes.byteLength === 0) {
      setState({ status: "idle" });
      return;
    }

    let cancelled = false;
    let destroyTask: (() => Promise<void>) | undefined;
    let destroyDoc: (() => Promise<void>) | undefined;

    setState({ status: "loading" });

    void (async () => {
      try {
        const pdfjs = await loadPdfjs();
        // pdf.js detaches the ArrayBuffer it is given, so hand it a copy.
        const task = pdfjs.getDocument({
          data: new Uint8Array(bytes),
          isEvalSupported: false,
          useSystemFonts: false,
          disableFontFace: true,
          enableXfa: false,
          verbosity: 0,
        });
        destroyTask = () => task.destroy();

        const document = await task.promise;
        destroyDoc = () => document.destroy();

        if (cancelled) {
          await document.destroy();
          return;
        }

        setState({ status: "ready", document });
      } catch {
        if (!cancelled) {
          setState({
            status: "failed",
            reason: "This PDF could not be drawn. The structure view is still available.",
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      void destroyDoc?.();
      void destroyTask?.();
    };
  }, [bytes]);

  return state;
}
