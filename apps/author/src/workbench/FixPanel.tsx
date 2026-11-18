/**
 * The fix panel (FR-9): what the tool can do about one finding.
 *
 * Three rules shape it. Nothing is written without an explicit click
 * (FR-9.6). Every AI result is labelled as a suggestion to review (FR-9.9).
 * And a finding the tool cannot repair says so and shows the manual steps
 * instead of a dead button (FR-9.8).
 */
import { useEffect, useId, useState } from "react";
import { draftSlideTitle, getRuleMetadata } from "@accessibility-docs/core";
import type {
  AccessibilityIssue,
  DocumentModel,
  OutlineSection,
} from "@accessibility-docs/core";
import type { PptxFix } from "@accessibility-docs/formats";
import type { ApplyResult } from "./useWorkbenchFiles";
import {
  requestSuggestion,
  SuggestionError,
  type Suggestion,
} from "./suggestClient";
import type { MediaMap } from "./types";

interface FixPanelProps {
  issue: AccessibilityIssue;
  model: DocumentModel;
  /** The slide this issue sits on, when it sits on one. */
  section?: OutlineSection;
  /** Titles already in the deck, so a suggestion is not another duplicate. */
  existingTitles: string[];
  fileName: string;
  media: MediaMap;
  onApply: (fix: PptxFix) => Promise<ApplyResult>;
  onSkip: () => void;
}

export function FixPanel(props: FixPanelProps) {
  const rule = getRuleMetadata(props.issue.code);

  if (rule?.fixable === "manual-only") {
    return (
      <div className="fix-panel">
        <p className="fix-manual">{rule.manualFix}</p>
        <p className="fix-note">
          This one has to be done in PowerPoint. The tool will not pretend
          otherwise.
        </p>
        <div className="fix-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={props.onSkip}>
            Skip
          </button>
        </div>
      </div>
    );
  }

  switch (props.issue.code) {
    case "A004":
      return <AltTextFix {...props} />;
    case "A013":
    case "A014":
      return <SlideTitleFix {...props} />;
    case "A011":
      return <TableHeaderFix {...props} />;
    case "A001":
      return <DocumentTitleFix {...props} />;
    default:
      return (
        <div className="fix-panel">
          <p className="fix-manual">{rule?.manualFix}</p>
          <div className="fix-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={props.onSkip}
            >
              Skip
            </button>
          </div>
        </div>
      );
  }
}

/** Shared state for a panel that writes one value into the deck. */
function useApplyState() {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (action: () => Promise<ApplyResult | void>) => {
    setBusy(true);
    setProblem(null);
    try {
      const result = await action();
      if (result && result.applied === 0 && result.skipped.length > 0) {
        setProblem(result.skipped[0].reason);
      }
    } catch (error) {
      setProblem(
        error instanceof SuggestionError
          ? error.message
          : "That did not work. Try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return { busy, problem, setProblem, run };
}

function AiNotice({ suggestion }: { suggestion: Suggestion | null }) {
  if (!suggestion) {
    return null;
  }

  return (
    <p className="fix-ai-notice">
      {/* FR-9.9 — never presented as a finished answer. */}
      <strong>AI suggestion, review before applying.</strong>
      {suggestion.rationale ? ` ${suggestion.rationale}` : ""}
    </p>
  );
}

/** A004 — the image's text alternative (FR-9.1 to FR-9.3). */
function AltTextFix({
  issue,
  model,
  section,
  media,
  onApply,
  onSkip,
}: FixPanelProps) {
  const fieldId = useId();
  const node =
    issue.nodeIndex === undefined ? undefined : model.nodes[issue.nodeIndex];
  const figure = node?.type === "figure" ? node : undefined;
  const imageUrl = figure ? media[figure.src] : undefined;

  const [description, setDescription] = useState(figure?.altDescription ?? "");
  const [teachingGoal, setTeachingGoal] = useState("");
  const [assessmentMode, setAssessmentMode] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const { busy, problem, setProblem, run } = useApplyState();

  useEffect(() => {
    setDescription(figure?.altDescription ?? "");
    setSuggestion(null);
  }, [figure?.altDescription, issue.nodeIndex]);

  const nearbyText = (section?.nodes ?? [])
    .map((entry) =>
      entry.node.type === "paragraph" || entry.node.type === "heading"
        ? entry.node.text
        : ""
    )
    .filter((text) => text.length > 0)
    .join(" ")
    .slice(0, 600);

  const suggestWithAi = () =>
    run(async () => {
      if (!imageUrl) {
        setProblem(
          "The image itself is still loading, so it cannot be sent yet."
        );
        return;
      }

      const result = await requestSuggestion({
        kind: "alt-text",
        imageUrl,
        slideTitle: section?.title,
        nearbyText,
        teachingGoal,
        assessmentMode,
      });

      setSuggestion(result);
      if (result.kind === "alt-text") {
        setDescription(
          result.decorative
            ? "Decorative: this image carries no information."
            : result.altDescription
        );
      }
    });

  return (
    <div className="fix-panel">
      {imageUrl ? (
        <img className="fix-image" src={imageUrl} alt="" />
      ) : null}

      <label className="fix-label" htmlFor={`${fieldId}-alt`}>
        Alt description
      </label>
      <textarea
        id={`${fieldId}-alt`}
        className="fix-input"
        rows={3}
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        placeholder="What does this image tell a student who cannot see it?"
      />

      <label className="fix-label" htmlFor={`${fieldId}-goal`}>
        What is this slide teaching? <span className="fix-optional">Optional</span>
      </label>
      <input
        id={`${fieldId}-goal`}
        className="fix-input"
        type="text"
        value={teachingGoal}
        onChange={(event) => setTeachingGoal(event.target.value)}
        placeholder="Sent with the suggestion request to keep it on topic"
      />

      <div className="fix-check">
        <input
          id={`${fieldId}-assess`}
          type="checkbox"
          checked={assessmentMode}
          onChange={(event) => setAssessmentMode(event.target.checked)}
        />
        <label htmlFor={`${fieldId}-assess`}>
          This image is part of a quiz or exam
        </label>
      </div>

      {assessmentMode ? (
        <p className="fix-note">
          The suggestion will avoid giving the answer away. Read it before
          applying — only you know what the question is testing.
        </p>
      ) : null}

      <AiNotice suggestion={suggestion} />
      {problem ? <p className="fix-problem">{problem}</p> : null}

      <div className="fix-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || description.trim().length === 0}
          onClick={() =>
            run(() =>
              onApply({
                kind: "alt-text",
                sourceRef: issue.sourceRef ?? "",
                description,
              })
            )
          }
        >
          Apply
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={suggestWithAi}
        >
          {busy ? "Working…" : "Suggest with AI"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

/** A013 and A014 — the slide's title (FR-9.4). */
function SlideTitleFix({
  issue,
  section,
  existingTitles,
  onApply,
  onSkip,
}: FixPanelProps) {
  const fieldId = useId();
  // FR-3.2a — a usable draft from the slide's own words, so a fix never waits
  // on an AI round trip.
  const draft = section ? draftSlideTitle(section) : "";
  const [title, setTitle] = useState(section?.title?.trim() || draft);
  const [teachingGoal, setTeachingGoal] = useState("");
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const { busy, problem, run } = useApplyState();

  useEffect(() => {
    setTitle(section?.title?.trim() || draft);
    setSuggestion(null);
  }, [draft, section?.title, issue.nodeIndex]);

  const slideText = (section?.nodes ?? [])
    .map((entry) =>
      entry.node.type === "paragraph" || entry.node.type === "heading"
        ? entry.node.text
        : ""
    )
    .filter((text) => text.length > 0)
    .join("\n")
    .slice(0, 1200);

  return (
    <div className="fix-panel">
      <label className="fix-label" htmlFor={`${fieldId}-title`}>
        Slide title
      </label>
      <input
        id={`${fieldId}-title`}
        className="fix-input"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        placeholder="What is this slide about?"
      />
      {draft && title === draft ? (
        <p className="fix-note">
          Drafted from the slide's own text. Edit it, or ask for a better one.
        </p>
      ) : null}

      <label className="fix-label" htmlFor={`${fieldId}-goal`}>
        What is this slide teaching? <span className="fix-optional">Optional</span>
      </label>
      <input
        id={`${fieldId}-goal`}
        className="fix-input"
        type="text"
        value={teachingGoal}
        onChange={(event) => setTeachingGoal(event.target.value)}
      />

      <AiNotice suggestion={suggestion} />
      {problem ? <p className="fix-problem">{problem}</p> : null}

      <div className="fix-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || title.trim().length === 0}
          onClick={() =>
            run(() =>
              onApply({
                kind: "slide-title",
                sourceRef: section?.sourceRef ?? issue.sourceRef ?? "",
                title,
              })
            )
          }
        >
          Apply
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={busy}
          onClick={() =>
            run(async () => {
              const result = await requestSuggestion({
                kind: "title",
                slideText,
                teachingGoal,
                existingTitles,
              });
              setSuggestion(result);
              if (result.kind === "title") {
                setTitle(result.title);
              }
            })
          }
        >
          {busy ? "Working…" : "Suggest with AI"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

/** A011 — one click, no model needed (FR-9.5). */
function TableHeaderFix({ issue, onApply, onSkip }: FixPanelProps) {
  const { busy, problem, run } = useApplyState();

  return (
    <div className="fix-panel">
      <p className="fix-note">
        The first row becomes the table's header row, so every data cell is
        announced with the column it belongs to.
      </p>
      {problem ? <p className="fix-problem">{problem}</p> : null}
      <div className="fix-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy}
          onClick={() =>
            run(() =>
              onApply({
                kind: "table-header",
                sourceRef: issue.sourceRef ?? "",
              })
            )
          }
        >
          Set first row as header
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}

/** A001 — the presentation's document title (FR-5.4). */
function DocumentTitleFix({ fileName, model, onApply, onSkip }: FixPanelProps) {
  const fieldId = useId();
  const [title, setTitle] = useState(
    model.documentName || fileName.replace(/\.pptx$/i, "")
  );
  const { busy, problem, run } = useApplyState();

  return (
    <div className="fix-panel">
      <label className="fix-label" htmlFor={`${fieldId}-doc`}>
        Document title
      </label>
      <input
        id={`${fieldId}-doc`}
        className="fix-input"
        type="text"
        value={title}
        onChange={(event) => setTitle(event.target.value)}
      />
      <p className="fix-note">
        This is the name assistive technology announces when the file opens, and
        the title a PDF export carries.
      </p>
      {problem ? <p className="fix-problem">{problem}</p> : null}

      <div className="fix-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={busy || title.trim().length === 0}
          onClick={() => run(() => onApply({ kind: "document-title", title }))}
        >
          Apply
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onSkip}>
          Skip
        </button>
      </div>
    </div>
  );
}
