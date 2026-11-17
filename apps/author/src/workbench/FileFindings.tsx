/**
 * One file's findings, grouped by the slide they sit on (FR-7.2 context, and
 * the groundwork for the sidebar in FR-8).
 *
 * Every finding names its slide, so the ranking already answers "where is it?"
 * before the viewer exists.
 */
import { getRuleMetadata } from "@accessibility-docs/core";
import type { AccessibilityIssue } from "@accessibility-docs/core";

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

interface Group {
  key: string;
  label: string;
  issues: AccessibilityIssue[];
}

function groupByLocation(issues: AccessibilityIssue[]): Group[] {
  const groups = new Map<string, Group>();

  for (const issue of issues) {
    const page = issue.location?.page;
    const key = page === undefined ? "document" : `slide-${page}`;
    const label = page === undefined ? "Whole file" : `Slide ${page}`;

    const group = groups.get(key);
    if (group) {
      group.issues.push(issue);
    } else {
      groups.set(key, { key, label, issues: [issue] });
    }
  }

  // Document-level findings first, then slides in deck order.
  return [...groups.values()].sort((a, b) => {
    if (a.key === "document") return -1;
    if (b.key === "document") return 1;
    return (
      (a.issues[0].location?.page ?? 0) - (b.issues[0].location?.page ?? 0)
    );
  });
}

export function FileFindings({ issues }: { issues: AccessibilityIssue[] }) {
  const groups = groupByLocation(issues);

  return (
    <ul className="findings">
      {groups.map((group) => (
        <li key={group.key} className="findings-group">
          <h4 className="findings-where">{group.label}</h4>
          <ul className="findings-items">
            {group.issues.map((issue, index) => {
              const rule = getRuleMetadata(issue.code);
              return (
                <li key={`${issue.code}-${index}`} className="finding">
                  <span className={`sev sev-${issue.severity}`}>
                    {SEVERITY_LABEL[issue.severity] ?? issue.severity}
                  </span>
                  <span className="finding-body">
                    <span className="finding-message">{issue.message}</span>
                    <span className="finding-meta">
                      {issue.code}
                      {" · "}
                      {FIX_LABEL[issue.fixable] ?? issue.fixable}
                    </span>
                    {/* Honest scope: say how it gets fixed, including when the
                        answer is "by hand, like this". */}
                    {issue.fixable === "manual-only" && rule ? (
                      <span className="finding-help">{rule.manualFix}</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        </li>
      ))}
    </ul>
  );
}
