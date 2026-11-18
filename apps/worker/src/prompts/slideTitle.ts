/**
 * Slide title prompt, version 1 (FR-10.4, FR-10.6).
 */
export const SLIDE_TITLE_PROMPT_VERSION = "slide-title/v1";

export interface SlideTitlePromptInput {
  slideText?: string;
  teachingGoal?: string;
  /** Titles already used in the deck, so the suggestion is not a duplicate. */
  existingTitles?: string[];
}

export function slideTitlePrompt(input: SlideTitlePromptInput): string {
  const lines = [
    "You write slide titles for university lecture decks.",
    "",
    "A screen reader user moves through a deck by its slide titles, so the title",
    "has to say what this slide is about on its own.",
    "",
    "Rules:",
    "- Under 60 characters.",
    "- State the slide's actual point, in the words the slide already uses.",
    '- Never generic: not "Slide 4", "Introduction", "Overview", "Continued".',
    "- Sentence case, no trailing full stop.",
    "- Do not invent content that is not on the slide.",
  ];

  if (input.existingTitles && input.existingTitles.length > 0) {
    lines.push(
      "",
      "These titles are already used in this deck; do not repeat one:",
      input.existingTitles.slice(0, 40).map((title) => `- ${title}`).join("\n")
    );
  }

  lines.push("", "The text on this slide:", (input.slideText ?? "").trim() || "(the slide has no text)");

  if (input.teachingGoal && input.teachingGoal.trim().length > 0) {
    lines.push("", `What the lecturer says this slide teaches: ${input.teachingGoal.trim()}`);
  }

  lines.push(
    "",
    "Reply with JSON only, in this shape:",
    '{"title": string, "rationale": string}'
  );

  return lines.join("\n");
}
