import type { DocumentModel } from "./types.js";

/** On-disk wrapper for `.a11ydoc.json` files. */
export interface A11yDocFile {
  version: 1;
  document: DocumentModel;
}

export function serializeDocument(model: DocumentModel): string {
  const file: A11yDocFile = {
    version: 1,
    document: model,
  };
  return JSON.stringify(file, null, 2);
}

export function parseDocument(json: string): DocumentModel {
  let parsed: unknown;

  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Invalid JSON: could not parse document file.");
  }

  if (!isA11yDocFile(parsed) && !isDocumentModel(parsed)) {
    throw new Error(
      "Invalid document file: expected versioned .a11ydoc.json or a DocumentModel."
    );
  }

  if (isA11yDocFile(parsed)) {
    if (parsed.version !== 1) {
      throw new Error(
        `Unsupported document version: ${String(parsed.version)}`
      );
    }
    return parsed.document;
  }

  return parsed;
}

function isA11yDocFile(value: unknown): value is A11yDocFile {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    record.version === 1 &&
    isDocumentModel(record.document)
  );
}

function isDocumentModel(value: unknown): value is DocumentModel {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.documentName === "string" &&
    Array.isArray(record.nodes)
  );
}
