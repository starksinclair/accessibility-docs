/**
 * Reading, checking, writing and image extraction happen off the main thread
 * (FR-6.4), so a 50 MB deck never freezes the page.
 *
 * Nothing in here touches the network: the file is parsed, turned into a
 * DocumentModel and checked entirely inside the browser (section 3).
 */
import { runAccessibilityChecks } from "@accessibility-docs/core";
import {
  applyPdfFixes,
  applyPptxFixes,
  extractPptxMedia,
  FormatReadError,
  pdfToModel,
  pptxToModel,
  sniffFormat,
  type PdfFix,
  type PptxFix,
} from "@accessibility-docs/formats";
// pdf.js parses in a worker of its own. We are already in one, so this is a
// nested worker; where a browser refuses that, pdf.js falls back to parsing on
// this thread, which is still off the page's main thread.
import pdfWorkerSrc from "pdfjs-dist/legacy/build/pdf.worker.mjs?url";
import type { DocumentFormat, WorkerRequest, WorkerResponse } from "./types";

function failure(
  kind: WorkerRequest["kind"],
  id: string,
  reason: string
): WorkerResponse {
  return { kind, id, ok: false, reason };
}

type Routed =
  | { format: DocumentFormat }
  /** Why this file cannot be read, in words for the person who uploaded it. */
  | { reason: string };

/** FR-6.2 — the signature decides what a file is, not its extension. */
function route(request: WorkerRequest, bytes: Uint8Array): Routed {
  switch (sniffFormat(bytes, request.name)) {
    case "pptx":
      return { format: "pptx" };
    case "pdf":
      return { format: "pdf" };
    case "legacy-ppt":
      return {
        reason:
          "This is a legacy PowerPoint file. Save as .pptx in PowerPoint, then upload again.",
      };
    case "zip":
      return {
        reason:
          "This file is a ZIP archive but not a PowerPoint presentation. Check the file and upload again.",
      };
    default:
      return {
        reason:
          "This file is not a PowerPoint (.pptx) or PDF file. Check the file and upload again.",
      };
  }
}

/** Reading a file of either format into the one model the rules check. */
async function readModel(
  format: DocumentFormat,
  bytes: Uint8Array,
  fileName: string
) {
  return format === "pdf"
    ? pdfToModel(bytes, { fileName, workerSrc: pdfWorkerSrc })
    : pptxToModel(bytes, { fileName });
}

async function handle(request: WorkerRequest): Promise<WorkerResponse> {
  const bytes = new Uint8Array(request.bytes);

  const routed = route(request, bytes);
  if ("reason" in routed) {
    return failure(request.kind, request.id, routed.reason);
  }
  const { format } = routed;

  try {
    if (request.kind === "apply") {
      const result =
        format === "pdf"
          ? await applyPdfFixes(bytes, request.fixes as PdfFix[])
          : await applyPptxFixes(bytes, request.fixes as PptxFix[]);

      // FR-9.7 — the working copy is re-read and re-checked, so the score the
      // user sees is the score of the file they would download, not a guess
      // at what the fix did.
      const fixedModel = await readModel(format, result.bytes, request.name);

      return {
        kind: "apply",
        id: request.id,
        ok: true,
        bytes: result.bytes.buffer as ArrayBuffer,
        model: fixedModel,
        report: runAccessibilityChecks(fixedModel),
        applied: result.applied.length,
        skipped: result.skipped,
        notes: result.notes,
      };
    }

    if (request.kind === "media") {
      // A PDF figure is a region of a page's content stream, not a separate
      // image file, so there is nothing to extract: the structure view shows
      // the figure and its alt text without a preview (FR-8.3b).
      return {
        kind: "media",
        id: request.id,
        ok: true,
        images: format === "pdf" ? [] : await extractPptxMedia(bytes),
      };
    }

    const model = await readModel(format, bytes, request.name);
    return {
      kind: "read",
      id: request.id,
      ok: true,
      model,
      report: runAccessibilityChecks(model),
      format,
    };
  } catch (error) {
    if (error instanceof FormatReadError) {
      return failure(request.kind, request.id, error.message);
    }
    return failure(
      request.kind,
      request.id,
      format === "pdf"
        ? "This PDF could not be read. It may be damaged; try re-exporting it from the original file."
        : "This file could not be read. It may be damaged; try re-saving it in PowerPoint."
    );
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data).then((response) => {
    self.postMessage(response);
  });
});
