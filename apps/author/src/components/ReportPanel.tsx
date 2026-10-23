import type { AccessibilityReport } from "@accessibility-docs/core";

interface ReportPanelProps {
  report: AccessibilityReport | null;
  saveBlocked: boolean;
}

export function ReportPanel({ report, saveBlocked }: ReportPanelProps) {
  if (!report) {
    return (
      <aside className="report-panel">
        <h2>Accessibility</h2>
        <p className="muted">Run a check or save to see results.</p>
      </aside>
    );
  }

  return (
    <aside className="report-panel">
      <h2>Accessibility</h2>
      {saveBlocked ? (
        <p className="banner error">Save blocked — fix errors first.</p>
      ) : report.issues.length === 0 ? (
        <p className="banner ok">No issues found.</p>
      ) : (
        <p className="banner warn">Saved with warnings (errors must be zero).</p>
      )}

      <div className="summary">
        <span className="chip error">{report.errorCount} errors</span>
        <span className="chip warning">{report.warningCount} warnings</span>
        <span className="chip manual">{report.manualCheckCount} manual</span>
      </div>

      <ul className="issue-list">
        {report.issues.map((issue, index) => (
          <li key={`${issue.code}-${index}`} className={`issue ${issue.severity}`}>
            <div className="issue-header">
              <strong>{issue.code}</strong>
              <span className="severity">{issue.severity}</span>
            </div>
            <p>{issue.message}</p>
            {issue.help ? <p className="help">{issue.help}</p> : null}
          </li>
        ))}
      </ul>
    </aside>
  );
}
