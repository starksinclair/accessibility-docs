/**
 * The two-pane document view (FR-8.1): the deck on the left, its issues on the
 * right, and a slide map for navigation (FR-8.4).
 */
import { useCallback, useMemo, useState } from "react";
import { buildOutline } from "@accessibility-docs/core";
import type {
  AccessibilityIssue,
  AccessibilityReport,
  DocumentModel,
} from "@accessibility-docs/core";
import { IssueSidebar, type IssueState, type SidebarIssue } from "./IssueSidebar";
import { SlideCard } from "./SlideCard";
import type { MediaMap, MediaStatus } from "./types";

interface DocumentViewProps {
  name: string;
  model: DocumentModel;
  report: AccessibilityReport;
  media: MediaMap;
  mediaStatus: MediaStatus;
  onClose: () => void;
}

export function DocumentView({
  name,
  model,
  report,
  media,
  mediaStatus,
  onClose,
}: DocumentViewProps) {
  const outline = useMemo(
    () => buildOutline(model, report),
    [model, report]
  );
  const [statuses, setStatuses] = useState<Record<number, IssueState>>({});
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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

  const fixed = Object.values(statuses).filter(
    (state) => state === "fixed"
  ).length;
  const skipped = Object.values(statuses).filter(
    (state) => state === "skipped"
  ).length;

  const counter =
    outline.issueCount === 0
      ? "No issues found in this file."
      : `${fixed} of ${outline.issueCount} issues fixed` +
        (skipped > 0 ? `, ${skipped} skipped` : "");

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
            {outline.sections.length === 1 ? "slide" : "slides"} ·{" "}
            {report.errorCount}{" "}
            {report.errorCount === 1 ? "error" : "errors"} ·{" "}
            {report.warningCount}{" "}
            {report.warningCount === 1 ? "warning" : "warnings"}
          </p>
        </div>

        {/* FR-8.8 — the counter is announced, not only drawn. */}
        <p className="viewer-counter" role="status">
          {counter}
        </p>
      </div>

      <div className="viewer-panes">
        <nav className="slide-map" aria-label="Slides">
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
          aria-label={`${name} slides`}
        >
          {outline.preamble.length > 0 || outline.sections.length === 0 ? (
            <p className="slide-stack-note">
              {outline.sections.length === 0
                ? "This file has no slides to show."
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
