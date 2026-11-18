/**
 * Working-copy bytes for the open PDF, so the viewer can draw pages and so
 * a fix that rewrites the file refreshes the preview.
 */
import { useEffect, useState } from "react";
import type { WorkbenchFile } from "./types";

export function usePdfBytes(file: WorkbenchFile | null): Uint8Array | null {
  const [bytes, setBytes] = useState<Uint8Array | null>(null);

  useEffect(() => {
    if (!file || file.format !== "pdf") {
      setBytes(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const next = file.fixed
        ? file.fixed
        : new Uint8Array(await file.file.arrayBuffer());
      if (!cancelled) {
        setBytes(next);
      }
    })();

    return () => {
      cancelled = true;
    };
    // fixed is replaced on every Apply; id covers opening a different file.
  }, [file, file?.id, file?.fixed, file?.format]);

  return bytes;
}
