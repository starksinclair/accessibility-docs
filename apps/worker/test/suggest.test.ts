/**
 * /api/suggest tests (T-5).
 *
 * Every provider here is a fake. Nothing in this suite reaches Gemini, or any
 * other network service — a test that called a paid model would be slow,
 * flaky, and would send course material to a third party from CI.
 */
import { describe, expect, it } from "vitest";
import { ProviderError } from "../src/providers/types.js";
import type {
  ProviderRequest,
  SuggestionProvider,
} from "../src/providers/types.js";
import {
  base64Bytes,
  parseModelJson,
  parseSuggestRequest,
  promptFor,
  readSuggestion,
  RequestError,
  suggest,
} from "../src/suggest.js";

/** A 1x1 PNG, so an image-shaped request carries something real. */
const PIXEL =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

function fakeProvider(
  replies: string[] | ((request: ProviderRequest) => string)
): SuggestionProvider & { calls: ProviderRequest[] } {
  const calls: ProviderRequest[] = [];
  let index = 0;

  return {
    name: "fake",
    calls,
    async complete(request) {
      calls.push(request);
      if (typeof replies === "function") {
        return replies(request);
      }
      const reply = replies[Math.min(index, replies.length - 1)];
      index += 1;
      return reply;
    },
  };
}

describe("parseSuggestRequest", () => {
  it("accepts an alt text request with an image", () => {
    const parsed = parseSuggestRequest({
      kind: "alt-text",
      image: { base64: PIXEL, contentType: "image/png" },
      slideTitle: "Week 3",
      teachingGoal: "Phases of the cell cycle",
      assessmentMode: true,
    });

    expect(parsed.kind).toBe("alt-text");
    expect(parsed.image?.contentType).toBe("image/png");
    expect(parsed.assessmentMode).toBe(true);
  });

  it("rejects an alt text request with no image", () => {
    expect(() => parseSuggestRequest({ kind: "alt-text" })).toThrow(
      /needs the image itself/
    );
  });

  it("rejects an unknown kind", () => {
    expect(() => parseSuggestRequest({ kind: "poem" })).toThrow(
      /Unknown suggestion kind/
    );
  });

  it("rejects an image format a model cannot read", () => {
    expect(() =>
      parseSuggestRequest({
        kind: "alt-text",
        image: { base64: PIXEL, contentType: "image/x-emf" },
      })
    ).toThrow(/PNG, JPEG/);
  });

  it("rejects an image over 5 MB (FR-10.2)", () => {
    // Base64 is 4 characters per 3 bytes, so this clears the limit.
    const huge = "A".repeat(Math.ceil((5 * 1024 * 1024 + 1024) / 3) * 4);
    expect(base64Bytes(huge)).toBeGreaterThan(5 * 1024 * 1024);

    try {
      parseSuggestRequest({
        kind: "alt-text",
        image: { base64: huge, contentType: "image/png" },
      });
      throw new Error("expected a rejection");
    } catch (error) {
      expect(error).toBeInstanceOf(RequestError);
      expect((error as RequestError).status).toBe(413);
    }
  });

  it("says table headers need no model (FR-9.5)", () => {
    try {
      parseSuggestRequest({ kind: "table-header" });
      throw new Error("expected a rejection");
    } catch (error) {
      expect((error as RequestError).status).toBe(409);
    }
  });

  it("rejects a body that is not an object", () => {
    expect(() => parseSuggestRequest("alt text please")).toThrow(
      /JSON object/
    );
  });
});

describe("prompts", () => {
  it("tells the model not to give answers away in assessment mode", () => {
    const { prompt, version } = promptFor({
      kind: "alt-text",
      assessmentMode: true,
      image: { base64: PIXEL, contentType: "image/png" },
    });

    expect(prompt).toMatch(/ASSESSMENT MODE/);
    expect(prompt).toMatch(/[Nn]ever state/);
    expect(version).toBe("alt-text/v2");
  });

  it("carries the teaching goal into the prompt (FR-9.2)", () => {
    const { prompt } = promptFor({
      kind: "alt-text",
      teachingGoal: "Mitosis has four phases",
      image: { base64: PIXEL, contentType: "image/png" },
    });

    expect(prompt).toContain("Mitosis has four phases");
  });

  it("bans generic slide titles and names the ones already used", () => {
    const { prompt, version } = promptFor({
      kind: "title",
      slideText: "Prophase, metaphase, anaphase, telophase",
      existingTitles: ["Agenda", "Week 5: Genetics"],
    });

    expect(prompt).toMatch(/Under 60 characters/);
    expect(prompt).toContain("- Agenda");
    expect(prompt).toContain("Prophase");
    expect(version).toBe("slide-title/v1");
  });
});

describe("parseModelJson", () => {
  it("reads plain JSON", () => {
    expect(parseModelJson('{"title":"Cells"}')).toEqual({ title: "Cells" });
  });

  it("reads JSON the model wrapped in a code fence", () => {
    expect(parseModelJson('```json\n{"title":"Cells"}\n```')).toEqual({
      title: "Cells",
    });
  });

  it("reads JSON with a sentence in front of it", () => {
    expect(
      parseModelJson('Sure! Here you go: {"title":"Cells"} Hope that helps.')
    ).toEqual({ title: "Cells" });
  });

  it("refuses something that is not JSON at all", () => {
    expect(() => parseModelJson("I cannot help with that.")).toThrow(
      /could not be read/
    );
  });
});

describe("readSuggestion", () => {
  it("accepts a decorative image with no description", () => {
    const result = readSuggestion(
      "alt-text",
      '{"altDescription":"","decorative":true,"rationale":"Divider."}',
      "alt-text/v2"
    );

    expect(result).toMatchObject({ decorative: true, altDescription: "" });
  });

  it("refuses an empty description on an image that is not decorative", () => {
    expect(() =>
      readSuggestion(
        "alt-text",
        '{"altDescription":"   ","decorative":false}',
        "alt-text/v2"
      )
    ).toThrow(/came back empty/);
  });

  it("collapses whitespace in a title", () => {
    expect(
      readSuggestion(
        "title",
        '{"title":"  Mitosis   in   four phases \\n"}',
        "slide-title/v1"
      )
    ).toMatchObject({ title: "Mitosis in four phases" });
  });
});

describe("suggest", () => {
  it("returns a parsed alt text suggestion", async () => {
    const provider = fakeProvider([
      '{"altDescription":"Four phases of the cell cycle, in order.","decorative":false,"rationale":"Matches the slide."}',
    ]);

    const result = await suggest(
      provider,
      parseSuggestRequest({
        kind: "alt-text",
        image: { base64: PIXEL, contentType: "image/png" },
      })
    );

    expect(result).toMatchObject({
      kind: "alt-text",
      altDescription: "Four phases of the cell cycle, in order.",
      promptVersion: "alt-text/v2",
    });
    expect(provider.calls[0].image?.base64).toBe(PIXEL);
  });

  it("retries once when the first reply is not usable JSON (FR-10.3)", async () => {
    const provider = fakeProvider([
      "I think the image shows a chart.",
      '{"title":"Weekly lab results"}',
    ]);

    const result = await suggest(
      provider,
      parseSuggestRequest({ kind: "title", slideText: "Results" })
    );

    expect(provider.calls).toHaveLength(2);
    expect(result).toMatchObject({ title: "Weekly lab results" });
  });

  it("gives up after the retry rather than inventing an answer", async () => {
    const provider = fakeProvider(["nope", "still nope"]);

    await expect(
      suggest(provider, parseSuggestRequest({ kind: "title", slideText: "x" }))
    ).rejects.toThrow(/could not be read/);
    expect(provider.calls).toHaveLength(2);
  });

  it("does not retry when the provider itself failed", async () => {
    const provider = fakeProvider(() => {
      throw new ProviderError("The suggestion service is busy.", 429);
    });

    await expect(
      suggest(provider, parseSuggestRequest({ kind: "title", slideText: "x" }))
    ).rejects.toBeInstanceOf(ProviderError);
    expect(provider.calls).toHaveLength(1);
  });
});
