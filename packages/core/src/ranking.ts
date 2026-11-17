/**
 * Ranking (FR-7): which uploaded file should a faculty member fix first?
 *
 * This lives in core, next to the rules, for two reasons: it is pure
 * arithmetic over an AccessibilityReport with no dependencies (C-1 safe), and
 * keeping it beside the rule catalog means the weights cannot drift away from
 * the severities they weigh. The Workbench imports the weights from its own
 * config so they stay adjustable in one place (FR-7.4).
 */
import { RULES } from "./ruleCatalog.js";
import type { AccessibilityReport, FixStrategy } from "./types.js";

export interface RankingWeights {
  /** Points per error-severity issue. */
  errorWeight: number;
  /** Points per warning-severity issue. */
  warningWeight: number;
  /** Flat bonus when any blocker code is present. */
  blockerBonus: number;
  /**
   * Codes that make a file unfixable by this tool, so it needs attention from
   * a person first: an untagged PDF (A016) or a scan with no text (A017).
   */
  blockerCodes: readonly string[];
}

/** The weights FR-7.1 specifies. */
export const DEFAULT_RANKING_WEIGHTS: RankingWeights = {
  errorWeight: 10,
  warningWeight: 3,
  blockerBonus: 50,
  blockerCodes: ["A016", "A017"],
};

/** How many of a file's issues fall into each fix strategy (FR-7.3). */
export type EffortEstimate = Record<FixStrategy, number>;

export interface PriorityScore {
  /** `errorWeight x errors + warningWeight x warnings`. */
  issueScore: number;
  /** `blockerBonus`, or 0 when no blocker code is present. */
  blockerBonus: number;
  /** `issueScore + blockerBonus`. */
  priority: number;
  errorCount: number;
  warningCount: number;
  manualCheckCount: number;
  /** Which blocker codes were found, in catalog order. */
  blockers: string[];
  effort: EffortEstimate;
}

export function scoreReport(
  report: AccessibilityReport,
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): PriorityScore {
  const issueScore =
    weights.errorWeight * report.errorCount +
    weights.warningWeight * report.warningCount;

  const present = new Set(report.issues.map((issue) => issue.code));
  const blockers = weights.blockerCodes.filter((code) => present.has(code));
  const blockerBonus = blockers.length > 0 ? weights.blockerBonus : 0;

  const effort: EffortEstimate = {
    auto: 0,
    "ai-assisted": 0,
    "manual-only": 0,
  };
  for (const issue of report.issues) {
    const strategy = issue.fixable ?? RULES[issue.code]?.fixable;
    if (strategy) {
      effort[strategy] += 1;
    }
  }

  return {
    issueScore,
    blockerBonus,
    priority: issueScore + blockerBonus,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    manualCheckCount: report.manualCheckCount,
    blockers: [...blockers],
    effort,
  };
}

/** The minimum a file needs to be ranked. */
export interface RankableDocument {
  /** Stable identity, used to break ties so the order is deterministic. */
  id: string;
  report: AccessibilityReport;
}

export type RankedDocument<T extends RankableDocument> = T & {
  score: PriorityScore;
  /** 1-based position in the ranked list. */
  rank: number;
  /** True for the single file the user should open first (FR-7.2). */
  startHere: boolean;
};

/**
 * Highest priority first.
 *
 * Ties break on errors, then warnings, then id, so the same batch always
 * produces the same order whatever order the files finished parsing in — which
 * is what the ranking test pins (FR-7 acceptance).
 */
export function rankDocuments<T extends RankableDocument>(
  documents: readonly T[],
  weights: RankingWeights = DEFAULT_RANKING_WEIGHTS
): RankedDocument<T>[] {
  const scored = documents.map((document) => ({
    document,
    score: scoreReport(document.report, weights),
  }));

  scored.sort((a, b) => {
    if (a.score.priority !== b.score.priority) {
      return b.score.priority - a.score.priority;
    }
    if (a.score.errorCount !== b.score.errorCount) {
      return b.score.errorCount - a.score.errorCount;
    }
    if (a.score.warningCount !== b.score.warningCount) {
      return b.score.warningCount - a.score.warningCount;
    }
    return a.document.id.localeCompare(b.document.id);
  });

  return scored.map(({ document, score }, index) => ({
    ...document,
    score,
    rank: index + 1,
    // Only a file that actually has something to fix is worth opening first.
    startHere: index === 0 && score.priority > 0,
  }));
}
