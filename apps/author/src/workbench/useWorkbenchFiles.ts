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
  MediaMap,
  MediaStatus,
  WorkbenchFile,
  WorkerRequest,
  WorkerResponse,
} from "./types";

let sequence = 0;

function nextId(): string {
  sequence += 1;
  return `file-${sequence}`;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export interface AddFilesResult {
  /** Reasons a file was turned away before it reached the worker. */
  rejected: { name: string; reason: string }[];
}

export function useWorkbenchFiles() {
  const [files, setFiles] = useState<WorkbenchFile[]>([]);
  const [media, setMedia] = useState<MediaMap>({});
  const [mediaStatus, setMediaStatus] = useState<MediaStatus>("idle");

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

  const removeFile = useCallback(
    (id: string) => {
      if (mediaOwnerRef.current === id) {
        releaseMedia();
      }
      setFiles((current) => current.filter((file) => file.id !== id));
    },
    [releaseMedia]
  );

  const clearAll = useCallback(() => {
    releaseMedia();
    setFiles([]);
  }, [releaseMedia]);

  return {
    files,
    media,
    mediaStatus,
    addFiles,
    loadMedia,
    removeFile,
    clearAll,
  };
}
