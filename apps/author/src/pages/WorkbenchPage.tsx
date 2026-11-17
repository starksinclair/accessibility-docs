/**
 * Workbench: upload a batch of course files and see which one to fix first
 * (FR-6, FR-7).
 *
 * The viewer, fix panel and export arrive in the following milestones; what is
 * here is the whole path from "a folder of decks" to "open this one first".
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { rankDocuments } from "@accessibility-docs/core";
import type { AccessibilityReport } from "@accessibility-docs/core";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  acceptedFileTypes,
  formatBytes,
  rankingExplanation,
  rankingWeights,
  uploadLimits,
} from "@/config/workbench";
import { DocumentView } from "@/workbench/DocumentView";
import { FileFindings } from "@/workbench/FileFindings";
import type { WorkbenchFile } from "@/workbench/types";
import { useWorkbenchFiles } from "@/workbench/useWorkbenchFiles";
import "@/styles/hub.css";
import "@/styles/workbench.css";

const STATUS_LABEL: Record<WorkbenchFile["status"], string> = {
  reading: "Reading",
  checking: "Checking",
  ready: "Checked",
  failed: "Could not read",
};

/** How many slides a model holds, for the "12 slides" line in the list. */
function slideCount(file: WorkbenchFile): number {
  return (
    file.model?.nodes.filter(
      (node) => node.type === "section" && node.role === "slide"
    ).length ?? 0
  );
}

export function WorkbenchPage() {
  const {
    files,
    media,
    mediaStatus,
    addFiles,
    clearAll,
    loadMedia,
    removeFile,
  } = useWorkbenchFiles();
  const [openFileId, setOpenFileId] = useState<string | null>(null);
  const [rejected, setRejected] = useState<
    { name: string; reason: string }[]
  >([]);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const accept = useCallback(
    async (incoming: FileList | null) => {
      if (!incoming || incoming.length === 0) {
        return;
      }
      const result = await addFiles(Array.from(incoming));
      setRejected(result.rejected);
      // Let the same file be chosen again after it was cleared.
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    },
    [addFiles]
  );

  const ready = useMemo(
    () =>
      files.filter(
        (file): file is WorkbenchFile & { report: AccessibilityReport } =>
          file.status === "ready" && file.report !== undefined
      ),
    [files]
  );

  const ranked = useMemo(
    () => rankDocuments(ready, rankingWeights),
    [ready]
  );

  const openFile = files.find(
    (file) => file.id === openFileId && file.status === "ready"
  );

  // The open file's images are read on demand, so a batch of 30 decks does not
  // hold every picture in memory (FR-8.3).
  useEffect(() => {
    void loadMedia(openFile ? openFile.id : null);
  }, [loadMedia, openFile]);

  const pending = files.filter(
    (file) => file.status === "reading" || file.status === "checking"
  ).length;
  const failed = files.filter((file) => file.status === "failed");

  // FR-8.8's live counter, in the form this milestone can honestly report:
  // how much of the batch has been checked, and where to start.
  const announcement = (() => {
    if (files.length === 0) {
      return "No files loaded.";
    }
    if (pending > 0) {
      return `Checked ${ready.length} of ${files.length} files.`;
    }
    const top = ranked.find((entry) => entry.startHere);
    if (top) {
      return `Checked ${ready.length} of ${files.length} files. Start with ${top.name}: ${top.score.errorCount} errors and ${top.score.warningCount} warnings.`;
    }
    return `Checked ${ready.length} of ${files.length} files. No accessibility issues found.`;
  })();

  return (
    <div className="route-shell workbench">
      <a className="skip-link" href="#workbench-main">
        Skip to main content
      </a>

      <div className="route-banner">
        <Link to="/" className="route-back">
          ← Accessibility Workbench
        </Link>
        <span className="route-banner-tools">
          <ThemeToggle />
          <span className="route-banner-label">Workbench</span>
        </span>
      </div>

      <main
        id="workbench-main"
        className={`workbench-main${openFile ? " workbench-main-viewer" : ""}`}
      >
        {openFile?.model && openFile.report ? (
          <DocumentView
            name={openFile.name}
            model={openFile.model}
            report={openFile.report}
            media={media}
            mediaStatus={mediaStatus}
            onClose={() => setOpenFileId(null)}
          />
        ) : (
          <>
        {/* A plain div, not <header>: a header inside main is still exposed
            as a banner landmark by some browsers, and this page has one. */}
        <div className="workbench-head">
          <p className="eyebrow">Step 1 · Triage</p>
          <h1>Which file should you fix first?</h1>
          <p className="workbench-lede">
            Add the PowerPoint files for a course. Each one is read and checked
            against the same rules as the Google Docs add-on and the editor,
            then ranked so you can spend your time where it removes the most
            barriers.
          </p>
        </div>

        {/* FR-6.6 — the privacy promise, stated before anything is added. */}
        <p className="privacy-note" role="note">
          <strong>Files are processed on your device.</strong> Nothing is
          uploaded to a server. Do not upload files containing student
          information.
        </p>

        <section className="upload" aria-labelledby="upload-title">
          <h2 id="upload-title" className="section-label">
            Add files
          </h2>

          <div
            className={`dropzone${isDragging ? " dropzone-active" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              void accept(event.dataTransfer.files);
            }}
          >
            <input
              ref={inputRef}
              id="workbench-files"
              className="dropzone-input visually-hidden"
              type="file"
              multiple
              accept={acceptedFileTypes}
              aria-describedby="dropzone-limits"
              onChange={(event) => void accept(event.target.files)}
            />
            <label className="dropzone-cta btn btn-primary" htmlFor="workbench-files">
              Choose files
            </label>
            <p className="dropzone-hint" aria-hidden="true">
              or drag them here
            </p>
            <p id="dropzone-limits" className="dropzone-limits">
              PowerPoint (.pptx) files, up to{" "}
              {uploadLimits.maxFilesPerBatch} at a time and{" "}
              {formatBytes(uploadLimits.maxBytesPerFile)} each. PDF reading
              arrives in the next milestone.
            </p>
          </div>

          {files.length > 0 ? (
            <div className="upload-actions">
              <p className="upload-count">
                {files.length} {files.length === 1 ? "file" : "files"} loaded
                {pending > 0 ? ` · ${pending} still being checked` : ""}
              </p>
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearAll}>
                Clear all
              </button>
            </div>
          ) : null}
        </section>

        {/* The polite live region: progress is announced, not just drawn. */}
        <p className="visually-hidden" role="status">
          {announcement}
        </p>

        {rejected.length > 0 ? (
          <section className="notice notice-problem" aria-labelledby="rejected-title">
            <h2 id="rejected-title" className="section-label">
              Not added
            </h2>
            <ul className="notice-list">
              {rejected.map((item) => (
                <li key={item.name}>
                  <strong>{item.name}</strong> — {item.reason}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {failed.length > 0 ? (
          <section className="notice notice-problem" aria-labelledby="failed-title">
            <h2 id="failed-title" className="section-label">
              Could not be read
            </h2>
            <ul className="notice-list">
              {failed.map((file) => (
                <li key={file.id}>
                  <strong>{file.name}</strong> — {file.reason}{" "}
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => removeFile(file.id)}
                  >
                    Remove
                    <span className="visually-hidden"> {file.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {pending > 0 ? (
          <p className="working">
            Reading and checking {pending}{" "}
            {pending === 1 ? "file" : "files"}…
          </p>
        ) : null}

        {ranked.length > 0 ? (
          <section className="ranking" aria-labelledby="ranking-title">
            <div className="ranking-head">
              <h2 id="ranking-title">Fix in this order</h2>
              <details className="ranking-explainer">
                <summary>How is this ranked?</summary>
                <div className="ranking-explainer-body">
                  <p>
                    Each file gets a priority score:{" "}
                    <strong>{rankingExplanation.errorPoints} points</strong> for
                    every error and{" "}
                    <strong>{rankingExplanation.warningPoints} points</strong>{" "}
                    for every warning, plus a flat{" "}
                    <strong>{rankingExplanation.blockerBonus} points</strong>{" "}
                    when a file has a barrier this tool cannot repair at all —
                    an untagged PDF ({rankingExplanation.blockerCodes[0]}) or a
                    scan with no text layer (
                    {rankingExplanation.blockerCodes[1]}). Those need a person
                    before anything else can help.
                  </p>
                  <p>
                    The score is a triage aid, not a grade. A low score does not
                    mean a file is compliant — it means these checks found less
                    to flag.
                  </p>
                </div>
              </details>
            </div>

            <ol className="rank-list">
              {ranked.map((entry) => (
                <li
                  key={entry.id}
                  className={`rank-card${entry.startHere ? " rank-card-start" : ""}`}
                >
                  <div className="rank-top">
                    <span className="rank-number" aria-hidden="true">
                      {entry.rank}
                    </span>
                    <div className="rank-identity">
                      <h3 className="rank-name">
                        <span className="visually-hidden">
                          Number {entry.rank}:{" "}
                        </span>
                        {entry.name}
                      </h3>
                      <p className="rank-facts">
                        {entry.kind.toUpperCase()} · {slideCount(entry)}{" "}
                        {slideCount(entry) === 1 ? "slide" : "slides"} ·{" "}
                        {formatBytes(entry.size)}
                      </p>
                    </div>
                    {entry.startHere ? (
                      <p className="start-here">Start here</p>
                    ) : null}
                  </div>

                  <dl className="rank-counts">
                    <div>
                      <dt>Errors</dt>
                      <dd className="count count-error">
                        {entry.score.errorCount}
                      </dd>
                    </div>
                    <div>
                      <dt>Warnings</dt>
                      <dd className="count count-warning">
                        {entry.score.warningCount}
                      </dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd className="count">{entry.score.priority}</dd>
                    </div>
                    <div>
                      <dt>One-click</dt>
                      <dd className="count">{entry.score.effort.auto}</dd>
                    </div>
                    <div>
                      <dt>AI-assisted</dt>
                      <dd className="count">
                        {entry.score.effort["ai-assisted"]}
                      </dd>
                    </div>
                    <div>
                      <dt>By hand</dt>
                      <dd className="count">
                        {entry.score.effort["manual-only"]}
                      </dd>
                    </div>
                  </dl>

                  {entry.score.blockers.length > 0 ? (
                    <p className="rank-blocker">
                      This file has a barrier the tool cannot repair (
                      {entry.score.blockers.join(", ")}). It needs re-exporting
                      from its source before fixes will help.
                    </p>
                  ) : null}

                  {entry.report.issues.length > 0 ? (
                    <details className="rank-findings">
                      <summary>
                        {entry.report.issues.length}{" "}
                        {entry.report.issues.length === 1
                          ? "finding"
                          : "findings"}
                        <span className="visually-hidden"> in {entry.name}</span>
                      </summary>
                      <FileFindings issues={entry.report.issues} />
                    </details>
                  ) : (
                    <p className="rank-clean">
                      These checks found nothing to flag. Reading order, colour
                      contrast and the teaching value of each description still
                      need a human read.
                    </p>
                  )}

                  <p className="rank-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => setOpenFileId(entry.id)}
                    >
                      Open
                      <span className="visually-hidden"> {entry.name}</span>
                    </button>
                    <span className="rank-status">
                      {STATUS_LABEL[entry.status]}
                    </span>{" "}
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => removeFile(entry.id)}
                    >
                      Remove
                      <span className="visually-hidden"> {entry.name}</span>
                    </button>
                  </p>
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {files.length === 0 ? (
          <section className="empty" aria-labelledby="empty-title">
            <h2 id="empty-title" className="section-label">
              What you will see
            </h2>
            <p>
              A ranked list of your files, each one showing its errors and
              warnings, how many of them can be fixed in one click, and which
              slide every finding sits on.
            </p>
            <p>
              Nothing is changed in your original files. Repairing them, with
              AI-suggested alt text and slide titles you review before applying,
              comes next.
            </p>
          </section>
        ) : null}
          </>
        )}
      </main>
    </div>
  );
}
