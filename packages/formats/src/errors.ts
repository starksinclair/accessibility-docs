/**
 * A file the reader cannot turn into a DocumentModel, with a message written
 * for the person who uploaded it rather than for a developer.
 *
 * The Workbench shows `message` verbatim as the per-file failure reason
 * (FR-6.3), so every message says what to do next.
 */
export class FormatReadError extends Error {
  readonly code: FormatReadErrorCode;

  constructor(code: FormatReadErrorCode, message: string) {
    super(message);
    this.name = "FormatReadError";
    this.code = code;
  }
}

export type FormatReadErrorCode =
  /** Not a ZIP container at all (FR-6.2). */
  | "not-a-zip"
  /** A legacy binary PowerPoint file (FR-4.6). */
  | "legacy-ppt"
  /** A ZIP, but not an Open XML presentation. */
  | "not-a-presentation"
  /** The container is readable but its XML is not. */
  | "corrupt";
