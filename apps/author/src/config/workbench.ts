/**
 * Workbench limits and ranking weights, in one place (FR-6.1, FR-7.4).
 */
import {
  DEFAULT_RANKING_WEIGHTS,
  type RankingWeights,
} from "@accessibility-docs/core";

export const uploadLimits = {
  /** FR-6.1 — 50 MB per file. */
  maxBytesPerFile: 50 * 1024 * 1024,
  /** FR-6.1 — 30 files per batch. */
  maxFilesPerBatch: 30,
} as const;

/**
 * What the file picker offers. PDF is accepted by the picker but not yet read:
 * the PDF reader arrives in a later milestone, so a .pdf is reported as "not
 * supported yet" rather than silently ignored.
 */
export const acceptedFileTypes = ".pptx,.pdf" as const;

export const supportedExtensions = ["pptx"] as const;

/** FR-7.1 weights, exported here so they are adjustable in one place. */
export const rankingWeights: RankingWeights = DEFAULT_RANKING_WEIGHTS;

/** The plain-language version of the formula, for the ranking disclosure. */
export const rankingExplanation = {
  errorPoints: rankingWeights.errorWeight,
  warningPoints: rankingWeights.warningWeight,
  blockerBonus: rankingWeights.blockerBonus,
  blockerCodes: [...rankingWeights.blockerCodes],
} as const;

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
