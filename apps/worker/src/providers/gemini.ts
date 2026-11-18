import type {
  ProviderRequest,
  SuggestionProvider,
} from "./types.js";
import { ProviderError } from "./types.js";

/**
 * Gemini through its REST API (FR-10.1).
 *
 * The key is a Worker secret and is used only here. The model id is an
 * environment variable so it can be moved on without a code change.
 */
const DEFAULT_MODEL = "gemini-2.5-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

export function geminiProvider(
  apiKey: string,
  model: string = DEFAULT_MODEL
): SuggestionProvider {
  return {
    name: `gemini:${model}`,

    async complete(request: ProviderRequest): Promise<string> {
      const parts: Record<string, unknown>[] = [{ text: request.prompt }];

      if (request.image) {
        parts.push({
          inline_data: {
            mime_type: request.image.contentType,
            data: request.image.base64,
          },
        });
      }

      const response = await fetch(
        `${ENDPOINT}/${encodeURIComponent(model)}:generateContent`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: "user", parts }],
            generationConfig: {
              temperature: 0.4,
              maxOutputTokens: 512,
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (!response.ok) {
        // The provider's own body can quote the request back; it is not
        // logged and not passed on to the browser.
        throw new ProviderError(
          response.status === 429
            ? "The suggestion service is busy. Try again in a moment."
            : "The suggestion service could not be reached.",
          response.status === 429 ? 429 : 502
        );
      }

      const body = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };

      const text = body.candidates?.[0]?.content?.parts
        ?.map((part) => part.text ?? "")
        .join("")
        .trim();

      if (!text) {
        throw new ProviderError("The suggestion service returned nothing.");
      }

      return text;
    },
  };
}
