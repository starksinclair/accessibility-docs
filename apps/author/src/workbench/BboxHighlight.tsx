/**
 * FR-8.6 — a box drawn over a slide or page preview when the selected issue
 * carries a `location.bbox`.
 *
 * Coordinates are points. PPTX measures from the top-left of the slide; PDF
 * user space measures from the bottom-left of the page, so the caller picks
 * the origin. Missing bboxes are not invented — the viewer keeps scroll-only
 * behaviour.
 */
import type { NodeLocation } from "@accessibility-docs/core";

interface BboxHighlightProps {
  bbox: NonNullable<NodeLocation["bbox"]>;
  /** Page or slide width in points. */
  pageWidth: number;
  /** Page or slide height in points. */
  pageHeight: number;
  /**
   * `top-left` for PPTX shape offsets; `bottom-left` for PDF user space
   * (y is flipped against the page height).
   */
  origin: "top-left" | "bottom-left";
  label?: string;
}

export function BboxHighlight({
  bbox,
  pageWidth,
  pageHeight,
  origin,
  label = "Selected issue",
}: BboxHighlightProps) {
  const [x, y, width, height] = bbox;
  if (pageWidth <= 0 || pageHeight <= 0 || width <= 0 || height <= 0) {
    return null;
  }

  const top =
    origin === "bottom-left"
      ? pageHeight - y - height
      : y;

  return (
    <div
      className="bbox-highlight"
      style={{
        left: `${(x / pageWidth) * 100}%`,
        top: `${(top / pageHeight) * 100}%`,
        width: `${(width / pageWidth) * 100}%`,
        height: `${(height / pageHeight) * 100}%`,
      }}
      // Visual cue only: the issue sidebar already announces the selection.
      aria-hidden="true"
      data-label={label}
    />
  );
}

/** Standard widescreen slide size in points (10" × 7.5"). */
export const PPTX_SLIDE_SIZE = { width: 720, height: 540 } as const;
