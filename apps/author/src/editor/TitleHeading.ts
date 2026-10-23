import Heading from "@tiptap/extension-heading";

/**
 * Heading with an optional Title flag (maps to DocumentModel title node).
 */
export const TitleHeading = Heading.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      asTitle: {
        default: false,
        parseHTML: (element) => element.getAttribute("data-title") === "true",
        renderHTML: (attributes) =>
          attributes.asTitle ? { "data-title": "true" } : {},
      },
    };
  },
});
