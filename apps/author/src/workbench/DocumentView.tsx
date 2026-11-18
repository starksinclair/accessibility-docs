/**
 * The two-pane document view (FR-8.1): the file on the left, its issues on the
 * right, and a slide or page map for navigation (FR-8.4).
 */
import { useCallback, useMemo, useState } from "react";
import { buildOutline } from "@accessibility-docs/core";
import type {
  AccessibilityIssue,
  AccessibilityReport,
  DocumentModel,
} from "@accessibility-docs/core";
import { FixPanel } from "./FixPanel";
import { IssueSidebar, type IssueState, type SidebarIssue } from "./IssueSidebar";
import { SlideCard } from "./SlideCard";
import type {
  DocumentFix,
  DocumentFormat,
  MediaMap,
  MediaStatus,
} from "./types";
import type { ApplyResult } from "./useWorkbenchFiles";

interface DocumentViewProps {
  name: string;
  model: DocumentModel;
  report: AccessibilityReport;
  /** The format the reader found, which decides what a fix can do. */
  format: DocumentFormat;
  media: MediaMap;
  mediaStatus: MediaStatus;
  /** How many fixes have been written into the working copy so far. */
  appliedCount: number;
  hasFixedCopy: boolean;
  canUndo: boolean;
  onApply: (fix: DocumentFix) => Promise<ApplyResult>;
  onUndo: () => void;
  onDownload: () => void;
  onClose: () => void;
}

export function DocumentView({
  name,
  model,
  report,
  format,
  media,
  mediaStatus,
  appliedCount,
  hasFixedCopy,
  canUndo,
  onApply,
  onUndo,
  onDownload,
  onClose,
}: DocumentViewProps) {
  const outline = useMemo(
    () => buildOutline(model, report),
    [model, report]
  );
  const [statuses, setStatuses] = useState<Record<number, IssueState>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // A deck is navigated by slide and a PDF by page, and the words have to
  // follow the file: "1 slide" for a one-page handout reads as a mistake.
  const unit = format === "pdf" ? "page" : "slide";
  const units = `${unit}s`;

  const existingTitles = useMemo(
    () =>
      outline.sections
        .map((section) => (section.title ?? "").trim())
        .filter((title) => title.length > 0),
    [outline]
  );

  const indexOf = useCallback(
    (issue: AccessibilityIssue) => report.issues.indexOf(issue),
    [report]
  );

  const selectedIssue =
    selectedIndex === null ? undefined : report.issues[selectedIndex];

  /**
   * FR-8.6 — selecting an issue scrolls its slide into view and opens the
   * issue's detail.
   *
   * Focus deliberately stays on the issue: FR-8.7 wants the arrow keys to keep
   * moving through the list, and sending focus to the slide on every selection
   * would end that after the first press. The detail carries an explicit
   * "Go to slide" button for readers who do want to land there.
   */
  const onSelect = useCallback((row: SidebarIssue) => {
    setSelectedIndex(row.index);

    if (row.page !== null) {
      scrollToSlide(row.page, { focus: false });
    }
  }, []);

  const onSetStatus = useCallback((index: number, state: IssueState) => {
    setStatuses((current) => ({ ...current, [index]: state }));
  }, []);

  const skipped = Object.values(statuses).filter(
    (state) => state === "skipped"
  ).length;

  // The denominator is what was wrong when the file was opened: fixing an
  // issue removes it from the report, so counting today's issues would make
  // the total shrink as the user worked.
  const [startingCount] = useState(outline.issueCount + appliedCount);
  const fixed = Math.min(appliedCount, startingCount);

  const counter =
    startingCount === 0
      ? "No issues found in this file."
      : `${fixed} of ${startingCount} issues fixed` +
        (skipped > 0 ? `, ${skipped} skipped` : "");

  const [lastNotes, setLastNotes] = useState<string[]>([]);

  const applyFix = useCallback(
    async (fix: DocumentFix) => {
      const result = await onApply(fix);
      if (result.notes.length > 0) {
        setLastNotes(result.notes);
      }
      if (result.applied > 0) {
        // The issue is gone from the re-checked report, so there is nothing
        // left to keep selected.
        setSelectedIndex(null);
      }
      return result;
    },
    [onApply]
  );

  return (
    <div className="viewer">
      <div className="viewer-head">
        <div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            ← All files
          </button>
          <h2 className="viewer-title">{name}</h2>
          <p className="viewer-facts">
            {outline.sections.length}{" "}
            {outline.sections.length === 1 ? unit : units} ·{" "}
            {report.errorCount}{" "}
            {report.errorCount === 1 ? "error" : "errors"} ·{" "}
            {report.warningCount}{" "}
            {report.warningCount === 1 ? "warning" : "warnings"}
          </p>
        </div>

        <div className="viewer-tools">
          {/* FR-8.8 — the counter is announced, not only drawn. */}
          <p className="viewer-counter" role="status">
            {counter}
          </p>
          <div className="viewer-buttons">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={!hasFixedCopy}
              onClick={onDownload}
            >
              Download fixed file
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={!canUndo}
              onClick={() => {
                // The note belonged to the fix being undone.
                setLastNotes([]);
                onUndo();
              }}
            >
              Undo last fix
            </button>
          </div>
        </div>
      </div>

      {lastNotes.length > 0 ? (
        <ul className="viewer-notes" aria-live="polite">
          {lastNotes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}

      {hasFixedCopy ? (
        <p className="viewer-dirty">
          This file has been fixed in memory. Your uploaded file is untouched —
          download the fixed copy to keep the changes.
        </p>
      ) : null}

      <div className="viewer-panes">
        <nav className="slide-map" aria-label={format === "pdf" ? "Pages" : "Slides"}>
          <ul>
            {outline.sections.map((section) => {
              const errors = section.issues.filter(
                (issue) => issue.severity === "error"
              ).length;

              return (
                <li key={section.page}>
                  <a
                    href={`#slide-${section.page}`}
                    className="slide-map-item"
                    onClick={(event) => {
                      event.preventDefault();
                      scrollToSlide(section.page, { focus: true });
                    }}
                  >
                    <span className="slide-map-number">{section.page}</span>
                    <span className="slide-map-title">
                      {section.title && section.title.trim().length > 0
                        ? section.title
                        : "No title"}
                    </span>
                    <span className="slide-map-count">
                      {section.issues.length > 0 ? (
                        <>
                          {section.issues.length}
                          <span className="visually-hidden">
                            {" "}
                            {section.issues.length === 1
                              ? "finding"
                              : "findings"}
                            {errors > 0 ? `, ${errors} of them errors` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="visually-hidden">No findings</span>
                      )}
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* A region, not <main>: the page already has one landmark main. */}
        <div
          className="slide-stack"
          role="region"
          aria-label={`${name} ${units}`}
        >
          {outline.preamble.length > 0 || outline.sections.length === 0 ? (
            <p className="slide-stack-note">
              {outline.sections.length === 0
                ? `This file has no ${units} to show.`
                : `Document title: ${model.documentName}`}
            </p>
          ) : null}

          {outline.sections.map((section) => (
            <SlideCard
              key={section.page}
              section={section}
              media={media}
              mediaStatus={mediaStatus}
              highlightedNodeIndex={selectedIssue?.nodeIndex}
            />
          ))}
        </div>

        <aside className="issue-pane" aria-labelledby="issue-pane-title">
          <h2 id="issue-pane-title" className="issue-pane-title">
            Issues
          </h2>
          <IssueSidebar
            outline={outline}
            statuses={statuses}
            selectedIndex={selectedIndex}
            onSelect={onSelect}
            onSetStatus={onSetStatus}
            indexOf={indexOf}
            renderFixPanel={(row) => (
              <FixPanel
                issue={row.issue}
                model={model}
                {...(row.page !== null
                  ? {
                      section: outline.sections.find(
                        (section) => section.page === row.page
                      ),
                    }
                  : {})}
                existingTitles={existingTitles}
                fileName={name}
                format={format}
                media={media}
                onApply={applyFix}
                onSkip={() => onSetStatus(row.index, "skipped")}
              />
            )}
          />
        </aside>
      </div>
    </div>
  );
}

/** Scrolls a slide into view, optionally moving focus onto it. */
export function scrollToSlide(page: number, { focus }: { focus: boolean }) {
  const target = document.getElementById(`slide-${page}`);
  if (!target) {
    return;
  }

  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  target.scrollIntoView({
    block: "start",
    behavior: reduceMotion ? "auto" : "smooth",
  });

  if (focus) {
    target.focus({ preventScroll: true });
  }
}
