/**
 * One slide or page, as structure rather than as a picture (FR-8.3).
 *
 * The requirements allow a structure view instead of a browser PPTX renderer,
 * and it is the better fit here: it shows exactly what the rules see — the
 * title, the text, the pictures and their alt text, the tables and their
 * header cells — in real semantic HTML that a screen reader can read. A
 * renderer's absolutely-positioned output would have to be hidden from
 * assistive technology and this rebuilt beside it anyway.
 */
import type { OutlineNode, OutlineSection } from "@accessibility-docs/core";
import type { MediaMap, MediaStatus } from "./types";

interface SlideCardProps {
  section: OutlineSection;
  media: MediaMap;
  mediaStatus: MediaStatus;
  /** Node the selected issue belongs to, highlighted in place (FR-8.6). */
  highlightedNodeIndex?: number;
}

export function SlideCard({
  section,
  media,
  mediaStatus,
  highlightedNodeIndex,
}: SlideCardProps) {
  const errors = section.issues.filter(
    (issue) => issue.severity === "error"
  ).length;
  const warnings = section.issues.filter(
    (issue) => issue.severity === "warning"
  ).length;

  return (
    <section
      id={`slide-${section.page}`}
      className="slide-card"
      tabIndex={-1}
      aria-labelledby={`slide-${section.page}-title`}
    >
      <div className="slide-card-head">
        <p className="slide-card-number">
          {section.role === "slide" ? "Slide" : "Page"} {section.page}
        </p>
        <h3 id={`slide-${section.page}-title`} className="slide-card-title">
          {section.title && section.title.trim().length > 0 ? (
            section.title
          ) : (
            <span className="slide-card-untitled">
              {section.title === undefined
                ? "No title placeholder"
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

      {section.nodes.length === 0 ? (
        <p className="slide-card-empty">
          {section.role === "slide"
            ? "This slide has no readable content."
            : "This page has no tagged content a screen reader can read."}
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
}

function SlideNode({ entry, media, mediaStatus, highlighted }: SlideNodeProps) {
  const { node } = entry;
  const className = `slide-node${highlighted ? " slide-node-highlighted" : ""}${
    entry.issues.length > 0 ? " slide-node-flagged" : ""
  }`;

  if (node.type === "figure") {
    const src = media[node.src];
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
