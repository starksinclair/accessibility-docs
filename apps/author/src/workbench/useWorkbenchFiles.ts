/**
 * The upload batch: accepting files, handing them to the parsing worker, and
 * keeping per-file status (FR-6) and the selected file's images (FR-8.3).
 *
 * Files live in this hook's state for the session only. There is no upload,
 * no persistence and no cache; "Clear all" drops them and a refresh loses
 * them, which is the privacy promise the page makes (FR-6.5).
 */
import { useCallback, useEffect, useRef, useState } from "react";

import { uploadLimits } from "@/config/workbench";
import type {
  DocumentFix,
  DocumentFormat,
  SkippedDocumentFix,
  MediaMap,
  MediaStatus,
  WorkbenchFile,
  WorkerRequest,
  WorkerResponse,
} from "./types";

/** How many Applies can be stepped back; each entry holds a whole deck. */
const UNDO_DEPTH = 10;

const MIME_TYPES: Record<DocumentFormat, string> = {
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  pdf: "application/pdf",
};

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `file-${sequence}`;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** What one Apply did, for the message the panel shows afterwards. */
export interface ApplyResult {
  applied: number;
  skipped: SkippedDocumentFix[];
  notes: string[];
}

export interface AddFilesResult {
  /** Reasons a file was turned away before it reached the worker. */
  rejected: { name: string; reason: string }[];
}

export function useWorkbenchFiles() {
  const [files, setFiles] = useState<WorkbenchFile[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>("idle");

  /**
   * Undo is session-only and in memory (FR-9.6): each entry is the file's
   * state before one Apply. The depth is capped because every entry holds a
   * whole deck.
   */
  const undoRef = useRef<Map<string, WorkbenchFile[]>>(new Map());
  /** Resolvers for the Apply currently in flight, keyed by file. */
  const applyWaitersRef = useRef<Map<string, (result: ApplyResult) => void>>(
    new Map()
  );

  const workerRef = useRef<Worker | null>(null);
  /** Which file the images in `media` belong to. */
  const mediaOwnerRef = useRef<string | null>(null);
  /** Object URLs to revoke; the browser holds the blob until we do. */
  const objectUrlsRef = useRef<string[]>([]);

  const releaseMedia = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      URL.revokeObjectURL(url);
    }
    objectUrlsRef.current = [];
    mediaOwnerRef.current = null;
    setMedia({});
    setMediaStatus("idle");
  }, []);

  const handleResponse = useCallback(
    (response: WorkerResponse) => {
      if (response.kind === "apply") {
        const waiter = applyWaitersRef.current.get(response.id);
        applyWaitersRef.current.delete(response.id);

        if (!response.ok) {
          waiter?.({
            applied: 0,
            skipped: [],
            notes: [],
          });
          setFiles((current) =>
            current.map((file) =>
              file.id === response.id
                ? { ...file, reason: response.reason }
                : file
            )
          );
          return;
        }

        setFiles((current) =>
          current.map((file) =>
            file.id === response.id
              ? {
                  ...file,
                  model: response.model,
                  report: response.report,
                  fixed: new Uint8Array(response.bytes),
                  appliedCount: (file.appliedCount ?? 0) + response.applied,
                  reason: undefined,
                }
              : file
          )
        );

        waiter?.({
          applied: response.applied,
          skipped: response.skipped,
          notes: response.notes,
        });
        return;
      }

      if (response.kind === "media") {
        // A second file may have been opened while this one was unzipping.
        if (mediaOwnerRef.current !== response.id) {
          return;
        }
        if (!response.ok) {
          setMediaStatus("failed");
          return;
        }

        const next: MediaMap = {};
        for (const image of response.images) {
          const url = URL.createObjectURL(
            new Blob([image.bytes], { type: image.contentType })
          );
          objectUrlsRef.current.push(url);
          next[image.path] = url;
        }
        setMedia(next);
        setMediaStatus("ready");
        return;
      }

      setFiles((current) =>
        current.map((file) => {
          if (file.id !== response.id) {
            return file;
          }
          return response.ok
            ? {
                ...file,
                status: "ready",
                model: response.model,
                report: response.report,
                format: response.format,
              }
            : { ...file, status: "failed", reason: response.reason };
        })
      );
    },
    []
  );

  const getWorker = useCallback((): Worker => {
    if (!workerRef.current) {
      workerRef.current = new Worker(
        new URL("./readFile.worker.ts", import.meta.url),
        { type: "module" }
      );

      workerRef.current.addEventListener(
        "message",
        (event: MessageEvent<WorkerResponse>) => handleResponse(event.data)
      );

      workerRef.current.addEventListener("error", () => {
        setFiles((current) =>
          current.map((file) =>
            file.status === "ready" || file.status === "failed"
              ? file
              : {
                  ...file,
                  status: "failed",
                  reason:
                    "Reading stopped unexpectedly. Reload the page and try this file on its own.",
                }
          )
        );
      });
    }

    return workerRef.current;
  }, [handleResponse]);

  useEffect(() => {
    return () => {
      workerRef.current?.terminate();
      workerRef.current = null;
      for (const url of objectUrlsRef.current) {
        URL.revokeObjectURL(url);
      }
      objectUrlsRef.current = [];
    };
  }, []);

  const addFiles = useCallback(
    async (incoming: File[]): Promise<AddFilesResult> => {
      const rejected: AddFilesResult["rejected"] = [];
      const accepted: File[] = [];

      // The batch cap counts what is already on the page, so a second drop
      // cannot slip past it.
      let room = uploadLimits.maxFilesPerBatch - files.length;

      for (const file of incoming) {
        if (room <= 0) {
          rejected.push({
            name: file.name,
            reason: `Only ${uploadLimits.maxFilesPerBatch} files can be checked at a time.`,
          });
          continue;
        }
        if (file.size > uploadLimits.maxBytesPerFile) {
          rejected.push({
            name: file.name,
            reason: "This file is larger than 50 MB.",
          });
          continue;
        }
        accepted.push(file);
        room -= 1;
      }

      if (accepted.length === 0) {
        return { rejected };
      }

      const entries: WorkbenchFile[] = accepted.map((file) => ({
        id: nextId(),
        name: file.name,
        size: file.size,
        kind: extensionOf(file.name),
        file,
        status: "reading",
      }));

      setFiles((current) => [...current, ...entries]);

      const worker = getWorker();

      await Promise.all(
        entries.map(async (entry) => {
          const bytes = await entry.file.arrayBuffer();

          setFiles((current) =>
            current.map((file) =>
              file.id === entry.id ? { ...file, status: "checking" } : file
            )
          );

          const request: WorkerRequest = {
            kind: "read",
            id: entry.id,
            name: entry.name,
            bytes,
          };
          // Transfer the buffer rather than copy it.
          worker.postMessage(request, [bytes]);
        })
      );

      return { rejected };
    },
    [files.length, getWorker]
  );

  /**
   * Loads one file's pictures for the viewer, releasing the previous file's.
   * Re-reads from the File handle, so no upload's bytes are held open.
   */
  const loadMedia = useCallback(
    async (id: string | null) => {
      // Already holding this file's images: nothing to do. The caller is an
      // effect, so it runs again whenever any file's status changes.
      if (mediaOwnerRef.current === id) {
        return;
      }

      releaseMedia();
      if (id === null) {
        return;
      }

      const entry = files.find((file) => file.id === id);
      if (!entry || entry.status !== "ready") {
        return;
      }

      mediaOwnerRef.current = id;
      setMediaStatus("loading");

      const bytes = await entry.file.arrayBuffer();
      const request: WorkerRequest = {
        kind: "media",
        id,
        name: entry.name,
        bytes,
      };
      getWorker().postMessage(request, [bytes]);
    },
    [files, getWorker, releaseMedia]
  );

  /**
   * FR-9.6, FR-9.7 — writes approved fixes into the working copy, then
   * re-reads and re-checks it. Each call starts from the current working copy,
   * so fixes accumulate.
   */
  const applyFixes = useCallback(
    async (id: string, fixes: DocumentFix[]): Promise<ApplyResult> => {
      const entry = files.find((file) => file.id === id);
      if (!entry || fixes.length === 0) {
        return { applied: 0, skipped: [], notes: [] };
      }

      const history = undoRef.current.get(id) ?? [];
      undoRef.current.set(id, [...history, entry].slice(-UNDO_DEPTH));

      const source = entry.fixed
        ? entry.fixed.slice().buffer
        : await entry.file.arrayBuffer();

      const result = new Promise<ApplyResult>((resolve) => {
        applyWaitersRef.current.set(id, resolve);
      });

      const request: WorkerRequest = {
        kind: "apply",
        id,
        name: entry.name,
        bytes: source as ArrayBuffer,
        fixes,
      };
      getWorker().postMessage(request, [source as ArrayBuffer]);

      return result;
    },
    [files, getWorker]
  );

  /** FR-9.6 — step back one Apply, for this session only. */
  const undoLastFix = useCallback((id: string) => {
    const history = undoRef.current.get(id);
    const previous = history?.pop();
    if (!previous) {
      return;
    }
    undoRef.current.set(id, history ?? []);
    setFiles((current) =>
      current.map((file) => (file.id === id ? previous : file))
    );
  }, []);

  const canUndo = useCallback(
    (id: string) => (undoRef.current.get(id)?.length ?? 0) > 0,
    []
  );

  /** FR-11.1 — "<original>-accessible.pptx" or "-accessible.pdf". */
  const downloadFixed = useCallback(
    (id: string) => {
      const entry = files.find((file) => file.id === id);
      if (!entry?.fixed) {
        return;
      }

      // The format the reader found, not the name it arrived with: a renamed
      // file still downloads as the kind of file it actually is.
      const format: DocumentFormat = entry.format ?? "pptx";
      const base = entry.name.replace(/\.(pptx|pdf)$/i, "");
      const url = URL.createObjectURL(
        new Blob([entry.fixed.slice()], { type: MIME_TYPES[format] })
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = `${base}-accessible.${format}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // The blob is only needed until the download starts.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    },
    [files]
  );

  const removeFile = useCallback(
    (id: string) => {
      if (mediaOwnerRef.current === id) {
        releaseMedia();
      }
      undoRef.current.delete(id);
      setFiles((current) => current.filter((file) => file.id !== id));
    },
    [releaseMedia]
  );

  const clearAll = useCallback(() => {
    releaseMedia();
    undoRef.current.clear();
    setFiles([]);
  }, [releaseMedia]);

  return {
    files,
    media,
    mediaStatus,
    addFiles,
    applyFixes,
    canUndo,
    downloadFixed,
    loadMedia,
    removeFile,
    undoLastFix,
    clearAll,
  };
}
