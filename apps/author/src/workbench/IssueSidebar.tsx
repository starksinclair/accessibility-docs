/**
 * The issue sidebar (FR-8.5 to FR-8.8): every finding, grouped by slide, with
 * its status, and keyboard movement between them.
 */
import { useRef } from "react";
import { getRuleMetadata } from "@accessibility-docs/core";
import type {
  AccessibilityIssue,
  DocumentOutline,
} from "@accessibility-docs/core";
import { scrollToSlide } from "./DocumentView";

export type IssueState = "open" | "fixed" | "skipped";

const SEVERITY_LABEL: Record<string, string> = {
  error: "Error",
  warning: "Warning",
  manual: "Check by hand",
};

const FIX_LABEL: Record<string, string> = {
  auto: "One-click fix",
  "ai-assisted": "AI-assisted fix",
  "manual-only": "Manual fix",
};

export interface SidebarIssue {
  /** Position in the report, used as a stable key and as the status key. */
  index: number;
  issue: AccessibilityIssue;
  /** The slide to scroll to, or null for a whole-file finding. */
  page: number | null;
}

interface IssueSidebarProps {
  outline: DocumentOutline;
  statuses: Record<number, IssueState>;
  selectedIndex: number | null;
  onSelect: (issue: SidebarIssue) => void;
  onSetStatus: (index: number, state: IssueState) => void;
  indexOf: (issue: AccessibilityIssue) => number;
}

/** Issues in reading order: whole-file findings first, then slide by slide. */
export function sidebarIssues(
  outline: DocumentOutline,
  indexOf: (issue: AccessibilityIssue) => number
): SidebarIssue[] {
  const rows: SidebarIssue[] = outline.documentIssues.map((issue) => ({
    index: indexOf(issue),
    issue,
    page: null,
  }));

  for (const section of outline.sections) {
    for (const issue of section.issues) {
      rows.push({ index: indexOf(issue), issue, page: section.page });
    }
  }

  return rows;
}

export function IssueSidebar({
  outline,
  statuses,
  selectedIndex,
  onSelect,
  onSetStatus,
  indexOf,
}: IssueSidebarProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const rows = sidebarIssues(outline, indexOf);

  /**
   * FR-8.7 — arrow keys move between issues. Every issue is also an ordinary
   * tab stop, so this is movement on top of the normal order rather than a
   * custom widget that assistive technology has to be taught.
   */
  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowDown", "ArrowUp", "Home", "End"];
    if (!keys.includes(event.key)) {
      return;
    }

    const buttons = Array.from(
      listRef.current?.querySelectorAll<HTMLButtonElement>(
        "button.issue-button"
      ) ?? []
    );
    if (buttons.length === 0) {
      return;
    }

    const current = buttons.indexOf(
      document.activeElement as HTMLButtonElement
    );
    let next = current;

    if (event.key === "ArrowDown") {
      next = current < 0 ? 0 : Math.min(current + 1, buttons.length - 1);
    } else if (event.key === "ArrowUp") {
      next = current <= 0 ? 0 : current - 1;
    } else if (event.key === "Home") {
      next = 0;
    } else {
      next = buttons.length - 1;
    }

    event.preventDefault();
    buttons[next]?.focus();
  };

  const groups: { key: string; label: string; rows: SidebarIssue[] }[] = [];
  const documentRows = rows.filter((row) => row.page === null);
  if (documentRows.length > 0) {
    groups.push({ key: "document", label: "Whole file", rows: documentRows });
  }
  for (const section of outline.sections) {
    const sectionRows = rows.filter((row) => row.page === section.page);
    if (sectionRows.length > 0) {
      groups.push({
        key: `slide-${section.page}`,
        label: `${section.role === "slide" ? "Slide" : "Page"} ${section.page}`,
        rows: sectionRows,
      });
    }
  }

  if (rows.length === 0) {
    return (
      <p className="sidebar-clean">
        These checks found nothing to flag in this file. Reading order, colour
        contrast and the teaching value of each description still need a human
        read.
      </p>
    );
  }

  return (
    <div ref={listRef} className="issue-list" onKeyDown={onKeyDown}>
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`issues-${group.key}`}>
          <h3 id={`issues-${group.key}`} className="issue-group-label">
            {group.label}
          </h3>
          <ul>
            {group.rows.map((row) => {
              const state = statuses[row.index] ?? "open";
              const rule = getRuleMetadata(row.issue.code);
              const selected = selectedIndex === row.index;

              return (
                <li
                  key={row.index}
                  className={`issue${selected ? " issue-selected" : ""} issue-${state}`}
                >
                  <button
                    type="button"
                    className="issue-button"
                    aria-expanded={selected}
                    onClick={() => onSelect(row)}
                  >
                    <span className={`sev sev-${row.issue.severity}`}>
                      {SEVERITY_LABEL[row.issue.severity] ?? row.issue.severity}
                    </span>
                    <span className="issue-text">
                      <span className="issue-message">{row.issue.message}</span>
                      <span className="issue-meta">
                        {row.issue.code}
                        {" · "}
                        {FIX_LABEL[row.issue.fixable] ?? row.issue.fixable}
                        {state !== "open" ? ` · ${state}` : ""}
                      </span>
                    </span>
                  </button>

                  {selected ? (
                    <div className="issue-detail">
                      {rule ? <p>{rule.manualFix}</p> : null}
                      <p className="issue-detail-note">
                        Applying this fix to the file arrives in the next
                        milestone. For now you can mark it so you know where you
                        stopped.
                      </p>
                      <div className="issue-actions">
                        {row.page !== null ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() =>
                              scrollToSlide(row.page as number, { focus: true })
                            }
                          >
                            Go to slide {row.page}
                          </button>
                        ) : null}
                        {state === "skipped" ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => onSetStatus(row.index, "open")}
                          >
                            Reopen
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => onSetStatus(row.index, "skipped")}
                          >
                            Skip
                          </button>
                        )}
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
