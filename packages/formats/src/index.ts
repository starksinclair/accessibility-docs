/**
 * @accessibility-docs/formats — readers (and later writers) for the file
 * formats faculty already have.
 *
 * This is the package that is allowed runtime dependencies. `packages/core`
 * must stay dependency-free because esbuild bundles it into Apps Script, which
 * cannot load npm packages at runtime (constraint C-1), so every parsing
 * library lives here.
 */
export type { FileLike } from "./zip.js";
export { FormatReadError } from "./errors.js";
export type { FormatReadErrorCode } from "./errors.js";

export type { SniffedFormat } from "./sniff.js";
export { sniffFormat } from "./sniff.js";

export type { PptxReadOptions } from "./pptx/pptxToModel.js";
export { pptxToModel } from "./pptx/pptxToModel.js";

export type { SlideImage } from "./pptx/media.js";
export { extractPptxMedia } from "./pptx/media.js";
