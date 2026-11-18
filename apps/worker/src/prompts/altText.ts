/**
 * Alt text prompt, version 2 (FR-10.4, FR-10.5).
 *
 * Prompts are versioned files imported at build time: a Worker has no file
 * system at runtime, and a prompt that changes silently makes every earlier
 * suggestion impossible to explain.
 *
 * v2 (17 Nov 2026): dropped the alt title, which rule A003 used to ask for and
 * which no WCAG success criterion requires.
 */
export const ALT_TEXT_PROMPT_VERSION = "alt-text/v2";

export interface AltTextPromptInput {
  slideTitle?: string;
  nearbyText?: string;
  /** FR-9.2 — what the lecturer says this slide is teaching. */
  teachingGoal?: string;
  /** FR-9.3 — the image may be a quiz question. */
  assessmentMode?: boolean;
}

export function altTextPrompt(input: AltTextPromptInput): string {
  const lines = [
    "You write alt text for images in university course materials.",
    "",
    "Describe what the image conveys in the context it appears in, not what a",
    "camera would see. Write for someone who cannot see the slide but is",
    "following the same lesson.",
    "",
    "Rules:",
    '- Do not begin with "image of", "picture of", "graphic of" or similar.',
    "- Keep the description under 150 characters unless the image is a chart,",
    "  diagram or table whose data carries the teaching point; then describe the",
    "  trend or relationship rather than reading every value aloud.",
    "- Use the subject's own vocabulary where the surrounding text establishes it.",
    "- End with a full stop.",
    "- If the image carries no information — a divider, a background texture, a",
    "  logo repeated on every slide — set decorative to true and leave the",
    "  description empty. A decorative image needs no alt text at all.",
  ];

  if (input.assessmentMode) {
    lines.push(
      "",
      "ASSESSMENT MODE. This image may be part of a quiz, exam or practice",
      "question. Describe only what a student is meant to work from. Never state",
      "the answer, never say which option is correct, and never resolve the",
      "problem the image poses."
    );
  }

  lines.push("", "Context for this image:");
  lines.push(`- Slide title: ${orUnknown(input.slideTitle)}`);
  lines.push(`- Text near the image: ${orUnknown(input.nearbyText)}`);
  lines.push(
    `- What the lecturer says this slide teaches: ${orUnknown(input.teachingGoal)}`
  );

  lines.push(
    "",
    "Reply with JSON only, in this shape:",
    '{"altDescription": string, "decorative": boolean, "rationale": string}',
    "",
    "rationale is one short sentence for the lecturer explaining the choice.",
    "It is shown to them and is not written into the file."
  );

  return lines.join("\n");
}

function orUnknown(value: string | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed.length > 0 ? trimmed : "(not given)";
}
