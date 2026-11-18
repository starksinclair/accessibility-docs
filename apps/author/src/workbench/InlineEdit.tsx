/**
 * Small in-place editors for values that already exist in the file — so a
 * faculty member can improve a title or alt description without waiting for
 * an accessibility finding to open the fix panel.
 */
import { useEffect, useId, useState } from "react";
import type { ApplyResult } from "./useWorkbenchFiles";

interface InlineEditProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  note?: string;
  /** Disable when the writer has nowhere to put the value. */
  disabled?: boolean;
  onSave: (next: string) => Promise<ApplyResult | void>;
}

export function InlineEdit({
  label,
  value,
  placeholder,
  multiline = false,
  rows = 3,
  note,
  disabled = false,
  onSave,
}: InlineEditProps) {
  const fieldId = useId();
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    setDraft(value);
    setProblem(null);
  }, [value]);

  const dirty = draft.trim() !== value.trim();
  const canSave = !disabled && !busy && dirty && draft.trim().length > 0;

  const save = async () => {
    if (!canSave) {
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      const result = await onSave(draft.trim());
      if (result && result.applied === 0 && result.skipped.length > 0) {
        setProblem(result.skipped[0].reason);
      }
    } catch {
      setProblem("That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="inline-edit">
      <label className="inline-edit-label" htmlFor={fieldId}>
        {label}
      </label>
      {multiline ? (
        <textarea
          id={fieldId}
          className="fix-input"
          rows={rows}
          value={draft}
          disabled={disabled || busy}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
        />
      ) : (
        <input
          id={fieldId}
          className="fix-input"
          type="text"
          value={draft}
          disabled={disabled || busy}
          placeholder={placeholder}
          onChange={(event) => setDraft(event.target.value)}
        />
      )}
      {note ? <p className="inline-edit-note">{note}</p> : null}
      {problem ? <p className="fix-problem">{problem}</p> : null}
      <div className="inline-edit-actions">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={!canSave}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {dirty ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setDraft(value);
              setProblem(null);
            }}
          >
            Reset
          </button>
        ) : null}
      </div>
    </div>
  );
}
