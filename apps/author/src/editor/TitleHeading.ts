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

  addCommands() {
    return {
      setHeading:
        (attributes) =>
        ({ commands }) => {
          if (!this.options.levels.includes(attributes.level)) {
            return false;
          }

          const asTitle =
            "asTitle" in attributes &&
            (attributes as { asTitle?: boolean }).asTitle === true;

          return commands.setNode(this.name, { ...attributes, asTitle });
        },
      toggleHeading:
        (attributes) =>
        ({ commands }) => {
          if (!this.options.levels.includes(attributes.level)) {
            return false;
          }

          return commands.toggleNode(this.name, "paragraph", {
            ...attributes,
            asTitle: false,
          });
        },
    };
  },
});
