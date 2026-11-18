/**
 * The model provider seam (FR-10.8).
 *
 * Everything above this interface — validation, prompts, JSON repair, the
 * route itself — is provider-agnostic, so swapping Gemini for a locally hosted
 * model later is one new file and one line in the route, not a rewrite. It
 * also means the tests never need a network: a fake provider satisfies this
 * interface in three lines (T-5).
 */
export interface ProviderImage {
  /** Base64 without a data: prefix. */
  base64: string;
  contentType: string;
}

export interface ProviderRequest {
  prompt: string;
  image?: ProviderImage;
  /** Identifies the prompt file and version that produced `prompt`. */
  promptVersion: string;
}

export interface SuggestionProvider {
  readonly name: string;
  /** Returns the model's raw text, which the caller parses as JSON. */
  complete(request: ProviderRequest): Promise<string>;
}

export class ProviderError extends Error {
  readonly status: number;

  constructor(message: string, status = 502) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
  }
}
