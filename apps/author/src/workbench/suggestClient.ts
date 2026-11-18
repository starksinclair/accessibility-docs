/**
 * Client side of /api/suggest (FR-10).
 *
 * The whole file stays on the device; only the single image or slide text
 * being fixed is sent, and only when the user presses "Suggest with AI"
 * (section 3 of the requirements).
 */
export interface AltTextSuggestion {
  kind: "alt-text";
  altDescription: string;
  decorative: boolean;
  rationale: string;
  promptVersion: string;
}

export interface TitleSuggestion {
  kind: "title";
  title: string;
  rationale: string;
  promptVersion: string;
}

export type Suggestion = AltTextSuggestion | TitleSuggestion;

export interface AltTextRequest {
  kind: "alt-text";
  imageUrl: string;
  slideTitle?: string;
  nearbyText?: string;
  teachingGoal?: string;
  assessmentMode?: boolean;
}

export interface TitleRequest {
  kind: "title";
  slideText?: string;
  teachingGoal?: string;
  existingTitles?: string[];
}

export class SuggestionError extends Error {}

/** FR-10.2 — the endpoint refuses anything larger. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export async function requestSuggestion(
  request: AltTextRequest | TitleRequest,
  signal?: AbortSignal
): Promise<Suggestion> {
  const body: Record<string, unknown> = { kind: request.kind };

  if (request.kind === "alt-text") {
    body.image = await encodeImage(request.imageUrl);
    body.slideTitle = request.slideTitle;
    body.nearbyText = request.nearbyText;
    body.assessmentMode = request.assessmentMode ?? false;
  } else {
    body.slideText = request.slideText;
    body.existingTitles = request.existingTitles;
  }

  if (request.teachingGoal) {
    body.teachingGoal = request.teachingGoal;
  }

  let response: Response;
  try {
    response = await fetch("/api/suggest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      ...(signal ? { signal } : {}),
    });
  } catch {
    throw new SuggestionError(
      "The suggestion service could not be reached. Check your connection, or write the text yourself."
    );
  }

  if (response.status === 404) {
    // Vite's dev server serves the app alone; the API only exists when the
    // Worker is running (npm run dev:workbench).
    throw new SuggestionError(
      "AI suggestions are not available here. Run the app through the Worker (npm run dev:workbench), or write the text yourself."
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new SuggestionError("The suggestion service sent something unreadable.");
  }

  if (!response.ok) {
    const message =
      typeof payload === "object" &&
      payload !== null &&
      typeof (payload as { error?: unknown }).error === "string"
        ? (payload as { error: string }).error
        : "The suggestion could not be produced.";
    throw new SuggestionError(message);
  }

  return payload as Suggestion;
}

/** Reads a blob URL back into base64 for the request body. */
async function encodeImage(
  url: string
): Promise<{ base64: string; contentType: string }> {
  const blob = await (await fetch(url)).blob();

  if (blob.size > MAX_IMAGE_BYTES) {
    throw new SuggestionError(
      "This image is larger than 5 MB, so it cannot be sent for a suggestion. Describe it yourself instead."
    );
  }

  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < buffer.length; index += 1) {
    binary += String.fromCharCode(buffer[index]);
  }

  return {
    base64: btoa(binary),
    contentType: blob.type || "image/png",
  };
}
