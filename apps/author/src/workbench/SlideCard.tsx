/**
 * One slide or page, as structure rather than as a picture (FR-8.3).
 *
 * The requirements allow a structure view instead of a browser PPTX renderer,
 * and it is the better fit here: it shows exactly what the rules see — the
 * title, the text, the pictures and their alt text, the tables and their
 * header cells — in real semantic HTML that a screen reader can read. A
 * renderer's absolutely-positioned output would have to be hidden from
 * assistive technology and this rebuilt beside it anyway.
 *
 * For PDFs, FR-8.2a adds a raster of the page above that structure list so a
 * faculty member can see the figure they are writing alt text for.
 *
 * Titles and alt text that already exist can be edited in place, so improving
 * wording does not depend on an open accessibility finding.
 */
import type {
  NodeLocation,
  OutlineNode,
  OutlineSection,
} from "@accessibility-docs/core";
import { BboxHighlight, PPTX_SLIDE_SIZE } from "./BboxHighlight";
import { InlineEdit } from "./InlineEdit";
import { PdfPageCanvas } from "./PdfPageCanvas";
import type { DocumentFix, DocumentFormat, MediaMap, MediaStatus } from "./types";
import type { ApplyResult } from "./useWorkbenchFiles";
import type { PdfJsDocument } from "./usePdfDocument";

interface SlideCardProps {
  section: OutlineSection;
  format: DocumentFormat;
  media: MediaMap;
  mediaStatus: MediaStatus;
  /** Node the selected issue belongs to, highlighted in place (FR-8.6). */
  highlightedNodeIndex?: number;
  /**
   * FR-8.6 — bbox of the selected issue when it sits on this slide/page.
   * Absent means scroll-only (no invented box).
   */
  highlightBbox?: NodeLocation["bbox"];
  /** When set, the page is drawn above the structure list. */
  pdfDocument?: PdfJsDocument | null;
  onApply: (fix: DocumentFix) => Promise<ApplyResult>;
}

export function SlideCard({
  section,
  format,
  media,
  mediaStatus,
  highlightedNodeIndex,
  highlightBbox,
  pdfDocument = null,
  onApply,
}: SlideCardProps) {
  const errors = section.issues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const warnings = section.issues.filter(
    (issue) => issue.severity === "warning"
  ).length;
  const isPage = section.role === "page";
  const slideSourceRef = section.sourceRef;
  const canEditSlideTitle = format === "pptx" && typeof slideSourceRef === "string";
  const showPptxStage = format === "pptx" && highlightBbox !== undefined;

  return (
    <section
      id={`slide-${section.page}`}
      className="slide-card"
      tabIndex={-1}
      aria-labelledby={`slide-${section.page}-title`}
    >
      <div className="slide-card-head">
        <p className="slide-card-number">
          {isPage ? "Page" : "Slide"} {section.page}
        </p>
        <h3 id={`slide-${section.page}-title`} className="slide-card-title">
          {section.title && section.title.trim().length > 0 ? (
            section.title
          ) : (
            <span className="slide-card-untitled">
              {section.title === undefined
                ? isPage
                  ? "No page heading"
                  : "No title placeholder"
                : "Title placeholder is empty"}
            </span>
          )}
        </h3>
        <p className="slide-card-counts">
          {section.issues.length === 0
            ? "No findings"
            : `${errors} ${errors === 1 ? "error" : "errors"}, ${warnings} ${
                warnings === 1 ? "warning" : "warnings"
              }`}
        </p>
      </div>

      {canEditSlideTitle ? (
        <InlineEdit
          label="Slide title"
          value={section.title?.trim() ?? ""}
          placeholder="What is this slide about?"
          note={
            section.title === undefined
              ? "This slide has no title placeholder yet. Saving adds one for assistive technology."
              : "Change the existing title and save — you do not need an open issue."
          }
          onSave={(title) =>
            onApply({
              kind: "slide-title",
              sourceRef: slideSourceRef,
              title,
            })
          }
        />
      ) : null}

      {showPptxStage && highlightBbox ? (
        <div
          className="slide-stage"
          aria-hidden="true"
          style={{
            aspectRatio: `${PPTX_SLIDE_SIZE.width} / ${PPTX_SLIDE_SIZE.height}`,
          }}
        >
          <p className="slide-stage-caption">Issue location on the slide</p>
          <BboxHighlight
            bbox={highlightBbox}
            pageWidth={PPTX_SLIDE_SIZE.width}
            pageHeight={PPTX_SLIDE_SIZE.height}
            origin="top-left"
          />
        </div>
      ) : null}

      {pdfDocument ? (
        <PdfPageCanvas
          document={pdfDocument}
          pageNumber={section.page}
          highlightBbox={highlightBbox}
        />
      ) : null}

      {section.nodes.length === 0 ? (
        <p className="slide-card-empty">
          {isPage
            ? "This page has no tagged content a screen reader can read."
            : "This slide has no readable content."}
        </p>
      ) : (
        <div className="slide-card-body">
          {section.nodes.map((entry) => (
            <SlideNode
              key={entry.nodeIndex}
              entry={entry}
              media={media}
              mediaStatus={mediaStatus}
              highlighted={entry.nodeIndex === highlightedNodeIndex}
              showPageHint={isPage}
              onApply={onApply}
            />
          ))}
        </div>
      )}
    </section>
  );
}

interface SlideNodeProps {
  entry: OutlineNode;
  media: MediaMap;
  mediaStatus: MediaStatus;
  highlighted: boolean;
  /** PDF figures have no image file; the page raster above is the preview. */
  showPageHint: boolean;
  onApply: (fix: DocumentFix) => Promise<ApplyResult>;
}

function SlideNode({
  entry,
  media,
  mediaStatus,
  highlighted,
  showPageHint,
  onApply,
}: SlideNodeProps) {
  const { node } = entry;
  const className = `slide-node${highlighted ? " slide-node-highlighted" : ""}${
    entry.issues.length > 0 ? " slide-node-flagged" : ""
  }`;

  if (node.type === "figure") {
    const src = media[node.src];
    const sourceRef = node.sourceRef ?? node.src;
    const canEditAlt = typeof sourceRef === "string" && sourceRef.length > 0;
    const hasAlt =
      node.altTitle.trim().length > 0 || node.altDescription.trim().length > 0;

    return (
      <figure className={className} data-node={entry.nodeIndex}>
        {src ? (
          // The alt text is shown as visible text below, so the preview itself
          // is decorative here: announcing it twice would be worse than not at
          // all, and this image is not the document's own alt text.
          <img className="slide-image" src={src} alt="" />
        ) : (
          <p className="slide-image-missing">
            {mediaStatus === "loading"
              ? "Loading image…"
              : showPageHint
                ? "See the page preview above — this figure is part of the page"
                : "Image preview unavailable"}
          </p>
        )}
        <figcaption className="slide-alt">
          <span className="slide-alt-label">Alt text</span>
          {hasAlt ? (
            <span>
              {node.altTitle.trim().length > 0 ? (
                <strong>{node.altTitle}</strong>
              ) : null}
              {node.altDescription.trim().length > 0 ? (
                <span className="slide-alt-description">
                  {node.altDescription}
                </span>
              ) : null}
            </span>
          ) : (
            <span className="slide-alt-missing">None — this image is silent</span>
          )}
        </figcaption>
        {canEditAlt ? (
          <InlineEdit
            label="Alt description"
            value={node.altDescription}
            multiline
            placeholder="What does this image tell a student who cannot see it?"
            note={
              hasAlt
                ? "Edit the existing description and save when it is better."
                : showPageHint
                  ? "Look at the page preview above, then describe the figure."
                  : undefined
            }
            onSave={(description) =>
              onApply({
                kind: "alt-text",
                sourceRef,
                description,
              })
            }
          />
        ) : null}
      </figure>
    );
  }

  if (node.type === "table") {
    return (
      <div className={className} data-node={entry.nodeIndex}>
        <table className="slide-table">
          <caption>
            {node.rows.some((row) => row.cells.some((cell) => cell.header))
              ? "Table with a header row"
              : "Table with no header cells"}
          </caption>
          <tbody>
            {node.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.cells.map((cell, cellIndex) =>
                  cell.header ? (
                    <th key={cellIndex} scope="col" colSpan={cell.colspan}>
                      {cell.text}
                    </th>
                  ) : (
                    <td key={cellIndex} colSpan={cell.colspan}>
                      {cell.text}
                    </td>
                  )
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (node.type === "heading") {
    // The slide title is already the card's heading; repeating it inside the
    // card would announce it twice.
    return null;
  }

  return (
    <p className={className} data-node={entry.nodeIndex}>
      {"text" in node ? node.text : ""}
    </p>
  );
}
