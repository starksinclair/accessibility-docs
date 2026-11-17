/**
 * Reading, checking and image extraction happen off the main thread (FR-6.4),
 * so a 50 MB deck never freezes the page.
 *
 * Nothing in here touches the network: the file is unzipped, turned into a
 * DocumentModel and checked entirely inside the browser (section 3).
 */
import { runAccessibilityChecks } from "@accessibility-docs/core";
import {
  extractPptxMedia,
  FormatReadError,
  pptxToModel,
  sniffFormat,
} from "@accessibility-docs/formats";
import type { WorkerRequest, WorkerResponse } from "./types";

function failure(
  kind: WorkerRequest["kind"],
  id: string,
  reason: string
): WorkerResponse {
  return { kind, id, ok: false, reason };
}

/** Why this file cannot be read, or undefined when it is a deck. */
function rejection(request: WorkerRequest, bytes: Uint8Array): string | undefined {
  switch (sniffFormat(bytes, request.name)) {
    case "pptx":
      return undefined;
    case "pdf":
      return "PDF reading is not ready yet. PowerPoint (.pptx) files work today.";
    case "legacy-ppt":
      return "This is a legacy PowerPoint file. Save as .pptx in PowerPoint, then upload again.";
    case "zip":
      return "This file is a ZIP archive but not a PowerPoint presentation. Check the file and upload again.";
    default:
      return "This file is not a PowerPoint (.pptx) or PDF file. Check the file and upload again.";
  }
}

async function handle(request: WorkerRequest): Promise<WorkerResponse> {
  const bytes = new Uint8Array(request.bytes);

  const rejected = rejection(request, bytes);
  if (rejected !== undefined) {
    return failure(request.kind, request.id, rejected);
  }

  try {
    if (request.kind === "media") {
      return {
        kind: "media",
        id: request.id,
        ok: true,
        images: await extractPptxMedia(bytes),
      };
    }

    const model = await pptxToModel(bytes, { fileName: request.name });
    return {
      kind: "read",
      id: request.id,
      ok: true,
      model,
      report: runAccessibilityChecks(model),
    };
  } catch (error) {
    if (error instanceof FormatReadError) {
      return failure(request.kind, request.id, error.message);
    }
    return failure(
      request.kind,
      request.id,
      "This file could not be read. It may be damaged; try re-saving it in PowerPoint."
    );
  }
}

self.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  void handle(event.data).then((response) => {
    self.postMessage(response);
  });
});
