import {
  assertAccessible,
  serializeDocument,
  type AccessibilityReport,
  type DocumentModel,
} from "@accessibility-docs/core";

export type SaveResult =
  | { saved: true; report: AccessibilityReport }
  | { saved: false; report: AccessibilityReport };

/**
 * Compile gate: only download JSON when there are no error-severity issues.
 */
export function trySaveDocument(
  model: DocumentModel,
  filename = "document.a11ydoc.json"
): SaveResult {
  const result = assertAccessible(model);

  if (!result.ok) {
    return { saved: false, report: result.report };
  }

  const blob = new Blob([serializeDocument(model)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);

  return { saved: true, report: result.report };
}
