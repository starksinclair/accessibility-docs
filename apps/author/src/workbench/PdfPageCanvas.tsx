/**
 * One PDF page, drawn when it scrolls into view (FR-8.2a).
 *
 * Lazy rendering keeps a long handout from allocating a canvas for every
 * page up front. The canvas is decorative next to the structure list: the
 * structure view remains the accessible reading of the page.
 *
 * When the selected issue has a bbox, FR-8.6 draws it on top of the raster
 * (PDF y-up flipped to CSS y-down).
 */
import { useEffect, useRef, useState } from "react";
import type { NodeLocation } from "@accessibility-docs/core";
import { BboxHighlight } from "./BboxHighlight";
import type { PdfJsDocument } from "./usePdfDocument";

interface PdfPageCanvasProps {
  document: PdfJsDocument;
  pageNumber: number;
  /** CSS pixels across; height follows the page's aspect ratio. */
  width?: number;
  /** FR-8.6 — highlight the selected finding when it has a bbox. */
  highlightBbox?: NodeLocation["bbox"];
}

export function PdfPageCanvas({
  document,
  pageNumber,
  width = 720,
  highlightBbox,
}: PdfPageCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pageSize, setPageSize] = useState<{
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "200px 0px" }
    );
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    let cancelled = false;
    let cancelRender: (() => void) | undefined;

    void (async () => {
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled) {
          return;
        }

        const unscaled = page.getViewport({ scale: 1 });
        setPageSize({ width: unscaled.width, height: unscaled.height });

        const scale = width / unscaled.width;
        const viewport = page.getViewport({ scale });
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) {
          setFailed(true);
          return;
        }

        const ratio = window.devicePixelRatio || 1;
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);

        const task = page.render({
          canvas,
          canvasContext: context,
          viewport,
        });
        cancelRender = () => task.cancel();
        await task.promise;
      } catch {
        if (!cancelled) {
          setFailed(true);
        }
      }
    })();

    return () => {
      cancelled = true;
      cancelRender?.();
    };
  }, [document, pageNumber, visible, width]);

  return (
    <div ref={hostRef} className="pdf-page-preview">
      {failed ? (
        <p className="pdf-page-preview-fallback">Page preview unavailable</p>
      ) : visible ? (
        <div className="pdf-page-frame">
          <canvas
            ref={canvasRef}
            className="pdf-page-canvas"
            // Decorative: the structure list under the preview is the readable
            // content, and announcing a bitmap of the page would compete with it.
            aria-hidden="true"
          />
          {highlightBbox && pageSize ? (
            <BboxHighlight
              bbox={highlightBbox}
              pageWidth={pageSize.width}
              pageHeight={pageSize.height}
              origin="bottom-left"
            />
          ) : null}
        </div>
      ) : (
        <p className="pdf-page-preview-fallback">Loading page preview…</p>
      )}
    </div>
  );
}
