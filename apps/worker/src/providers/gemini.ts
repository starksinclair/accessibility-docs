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
const DEFAULT_MODEL = "gemini-3.8-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1/models";

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
              // Gemini 3 models think before answering, and those tokens are
              // billed against the same budget; 512 is no longer enough for a
              // suggestion plus its reasoning.
              maxOutputTokens: 2048,
              responseMimeType: "application/json",
              thinkingConfig: { thinkingLevel: "low" },
            },
          }),
        }
      );

      if (!response.ok) {
        // The provider's own body can quote the request back, so it is not
        // logged and not passed on to the browser. The status alone says
        // nothing about the slide, and without it a retired model id looks
        // exactly like an outage.
        console.warn(`gemini ${model}: HTTP ${response.status}`);
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
