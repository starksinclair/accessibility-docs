import { Link } from "react-router-dom";
import "@/styles/hub.css";

/**
 * Placeholder for Milestone 1. Upload/ranking/viewer land in later milestones.
 */
export function WorkbenchPage() {
  return (
    <div className="route-shell workbench-placeholder">
      <div className="route-banner">
        <Link to="/" className="route-back">
          ← Accessibility Workbench
        </Link>
        <span className="route-banner-label">Workbench</span>
      </div>

      <main className="workbench-placeholder-main">
        <p className="eyebrow">Coming next</p>
        <h1>Fix existing course files</h1>
        <p>
          Milestone 1 ships routing and this shell. Upload, ranking, viewer, and
          AI-assisted fixes arrive in the next milestones.
        </p>
        <Link className="btn btn-primary" to="/">
          Back to hub
        </Link>
      </main>
    </div>
  );
}
