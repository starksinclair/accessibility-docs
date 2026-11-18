/**
 * A first-draft slide title taken from the slide's own words (FR-3.2a).
 *
 * The point is that a fix is always one click away. AI writes a better title,
 * but a lecturer with no AI configured — or no patience for a round trip —
 * still gets a real title into the deck, which is what A013 is about. The
 * draft is never written without the user pressing Apply, and it is editable
 * before they do.
 */
import type { OutlineSection } from "./outline.js";

/** WCAG has no limit; this is FR-10.6's, so AI and the draft agree. */
const MAX_TITLE_LENGTH = 60;

export function draftSlideTitle(section: OutlineSection): string {
  for (const entry of section.nodes) {
    const node = entry.node;
    if (node.type !== "paragraph" && node.type !== "heading") {
      continue;
    }

    const candidate = firstSentence(node.text);
    if (candidate.length > 0) {
      return candidate;
    }
  }

  return "";
}

function firstSentence(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length === 0) {
    return "";
  }

  // Sentence end, or the first hard break in a bullet line.
  const stop = flat.search(/[.!?;:](\s|$)/);
  const sentence = stop === -1 ? flat : flat.slice(0, stop);

  return truncateOnWord(sentence.trim(), MAX_TITLE_LENGTH);
}

function truncateOnWord(text: string, limit: number): string {
  if (text.length <= limit) {
    return text;
  }

  const cut = text.slice(0, limit);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > limit / 2 ? cut.slice(0, lastSpace) : cut).trim();
}
