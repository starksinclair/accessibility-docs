import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

export interface AltTextValues {
  altTitle: string;
  altDescription: string;
}

interface AltTextDialogProps {
  open: boolean;
  title?: string;
  previewSrc?: string | null;
  initial: AltTextValues;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (values: AltTextValues) => void;
}

export function AltTextDialog({
  open,
  title = "Image accessibility text",
  previewSrc,
  initial,
  confirmLabel = "Save alt text",
  onCancel,
  onConfirm,
}: AltTextDialogProps) {
  const titleId = useId();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const [altTitle, setAltTitle] = useState(initial.altTitle);
  const [altDescription, setAltDescription] = useState(initial.altDescription);

  useEffect(() => {
    if (!open) {
      return;
    }
    setAltTitle(initial.altTitle);
    setAltDescription(initial.altDescription);
    const timer = window.setTimeout(() => titleInputRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [open, initial.altTitle, initial.altDescription]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onCancel]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div
      className="alt-text-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="alt-text-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <h2 id={titleId}>{title}</h2>
        <p className="alt-text-dialog-help">
          Screen readers use this text instead of seeing the image. Description
          is required for informative images.
        </p>

        {previewSrc ? (
          <div className="alt-text-dialog-preview">
            <img src={previewSrc} alt="" />
          </div>
        ) : null}

        <label className="alt-text-dialog-field">
          <span>Alt title</span>
          <input
            ref={titleInputRef}
            type="text"
            value={altTitle}
            onChange={(event) => setAltTitle(event.target.value)}
            placeholder="Short name for the image"
          />
        </label>

        <label className="alt-text-dialog-field">
          <span>Alt description</span>
          <textarea
            value={altDescription}
            onChange={(event) => setAltDescription(event.target.value)}
            placeholder="What the image shows or conveys"
            rows={4}
            required
          />
        </label>

        <div className="alt-text-dialog-actions">
          <button type="button" className="secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                altTitle: altTitle.trim(),
                altDescription: altDescription.trim(),
              })
            }
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
