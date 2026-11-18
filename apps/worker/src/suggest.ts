/**
 * /api/suggest (FR-10): validation, prompt selection, and parsing the model's
 * reply back into something the fix panel can show.
 *
 * Everything here is pure apart from the provider call, so the tests exercise
 * the whole route with a fake provider and never touch the network (T-5).
 */
import { altTextPrompt, ALT_TEXT_PROMPT_VERSION } from "./prompts/altText.js";
import {
  slideTitlePrompt,
  SLIDE_TITLE_PROMPT_VERSION,
} from "./prompts/slideTitle.js";
import type { SuggestionProvider } from "./providers/types.js";
import { ProviderError } from "./providers/types.js";

/** FR-10.7 — the whole request body. */
export const MAX_BODY_BYTES = 6 * 1024 * 1024;
/** FR-10.2 — one image. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
/** Enough context to be useful, short enough to bound the prompt. */
const MAX_TEXT_CHARS = 4000;

export type SuggestKind = "alt-text" | "title" | "table-header";

export interface SuggestRequest {
  kind: SuggestKind;
  image?: { base64: string; contentType: string };
  tableText?: string;
  slideTitle?: string;
  slideText?: string;
  nearbyText?: string;
  teachingGoal?: string;
  assessmentMode?: boolean;
  existingTitles?: string[];
}

export type SuggestResponse =
  | {
      kind: "alt-text";
      altDescription: string;
      decorative: boolean;
      rationale: string;
      promptVersion: string;
    }
  | {
      kind: "title";
      title: string;
      rationale: string;
      promptVersion: string;
    };

export class RequestError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "RequestError";
    this.status = status;
  }
}

const IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/bmp",
]);

function text(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new RequestError(`"${field}" must be text.`);
  }
  return value.slice(0, MAX_TEXT_CHARS);
}

/** Decoded size of a base64 string, without decoding it. */
export function base64Bytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

export function parseSuggestRequest(body: unknown): SuggestRequest {
  if (typeof body !== "object" || body === null) {
    throw new RequestError("Expected a JSON object.");
  }

  const raw = body as Record<string, unknown>;
  const kind = raw.kind;

  if (kind !== "alt-text" && kind !== "title" && kind !== "table-header") {
    throw new RequestError(
      'Unknown suggestion kind. Expected "alt-text", "title" or "table-header".'
    );
  }

  const request: SuggestRequest = { kind };

  // Only set a field when it was sent, so an absent value stays absent rather
  // than becoming an empty string the prompt would have to special-case.
  const fields = [
    "tableText",
    "slideTitle",
    "slideText",
    "nearbyText",
    "teachingGoal",
  ] as const;

  for (const field of fields) {
    const value = text(raw[field], field);
    if (value !== undefined) {
      request[field] = value;
    }
  }

  if (raw.assessmentMode !== undefined) {
    if (typeof raw.assessmentMode !== "boolean") {
      throw new RequestError('"assessmentMode" must be true or false.');
    }
    request.assessmentMode = raw.assessmentMode;
  }

  if (Array.isArray(raw.existingTitles)) {
    request.existingTitles = raw.existingTitles
      .filter((title): title is string => typeof title === "string")
      .slice(0, 60);
  }

  if (raw.image !== undefined && raw.image !== null) {
    const image = raw.image as Record<string, unknown>;
    const base64 = image.base64;
    const contentType = image.contentType;

    if (typeof base64 !== "string" || typeof contentType !== "string") {
      throw new RequestError('"image" needs base64 data and a content type.');
    }
    if (!IMAGE_TYPES.has(contentType)) {
      throw new RequestError(
        "That image format cannot be described. Use PNG, JPEG, GIF, WebP or BMP."
      );
    }
    if (base64Bytes(base64) > MAX_IMAGE_BYTES) {
      throw new RequestError("That image is larger than 5 MB.", 413);
    }

    request.image = { base64, contentType };
  }

  if (kind === "alt-text" && !request.image) {
    throw new RequestError("An alt text suggestion needs the image itself.");
  }

  if (kind === "table-header") {
    // The table header fix is deterministic (FR-9.5): the first row becomes
    // the header row. Asking a model would add latency and a failure mode to
    // a decision the file already answers.
    throw new RequestError(
      "Table headers are set directly, without a suggestion.",
      409
    );
  }

  return request;
}

/**
 * Pulls JSON out of a model reply.
 *
 * Models asked for JSON still sometimes wrap it in a code fence or add a
 * sentence before it, so the fence is stripped and the outermost braces are
 * used. Anything else is a parse failure, which the caller retries once
 * (FR-10.3).
 */
export function parseModelJson(reply: string): Record<string, unknown> {
  const withoutFence = reply
    .replace(/^\s*```(?:json)?/i, "")
    .replace(/```\s*$/, "")
    .trim();

  const start = withoutFence.indexOf("{");
  const end = withoutFence.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) {
    throw new RequestError("The suggestion could not be read.", 502);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(withoutFence.slice(start, end + 1));
  } catch {
    throw new RequestError("The suggestion could not be read.", 502);
  }

  if (typeof parsed !== "object" || parsed === null) {
    throw new RequestError("The suggestion could not be read.", 502);
  }

  return parsed as Record<string, unknown>;
}

function cleanSuggestion(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

/** Turns one model reply into a response, or throws so the caller retries. */
export function readSuggestion(
  kind: Exclude<SuggestKind, "table-header">,
  reply: string,
  promptVersion: string
): SuggestResponse {
  const parsed = parseModelJson(reply);

  if (kind === "title") {
    const title = cleanSuggestion(parsed.title);
    if (title.length === 0) {
      throw new RequestError("The suggestion came back empty.", 502);
    }
    return {
      kind: "title",
      title,
      rationale: cleanSuggestion(parsed.rationale),
      promptVersion,
    };
  }

  const decorative = parsed.decorative === true;
  const altDescription = cleanSuggestion(parsed.altDescription);

  // A decorative image is allowed to have no description; anything else with
  // no description is a failed suggestion, not an answer.
  if (!decorative && altDescription.length === 0) {
    throw new RequestError("The suggestion came back empty.", 502);
  }

  return {
    kind: "alt-text",
    altDescription,
    decorative,
    rationale: cleanSuggestion(parsed.rationale),
    promptVersion,
  };
}

export function promptFor(request: SuggestRequest): {
  prompt: string;
  version: string;
} {
  if (request.kind === "title") {
    return {
      prompt: slideTitlePrompt({
        slideText: request.slideText ?? request.nearbyText,
        teachingGoal: request.teachingGoal,
        existingTitles: request.existingTitles,
      }),
      version: SLIDE_TITLE_PROMPT_VERSION,
    };
  }

  return {
    prompt: altTextPrompt({
      slideTitle: request.slideTitle,
      nearbyText: request.nearbyText,
      teachingGoal: request.teachingGoal,
      assessmentMode: request.assessmentMode,
    }),
    version: ALT_TEXT_PROMPT_VERSION,
  };
}

/**
 * Runs one suggestion, retrying once when the model's reply is not usable
 * JSON (FR-10.3).
 */
export async function suggest(
  provider: SuggestionProvider,
  request: SuggestRequest
): Promise<SuggestResponse> {
  const kind = request.kind as Exclude<SuggestKind, "table-header">;
  const { prompt, version } = promptFor(request);

  const call = () =>
    provider.complete({
      prompt,
      promptVersion: version,
      ...(request.image ? { image: request.image } : {}),
    });

  try {
    return readSuggestion(kind, await call(), version);
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    // One retry, then give up and say so rather than inventing an answer.
    return readSuggestion(kind, await call(), version);
  }
}
