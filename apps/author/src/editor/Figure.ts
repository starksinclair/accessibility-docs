import Image from "@tiptap/extension-image";

/**
 * Figure node: image plus accessibility alt fields required by DocumentModel.
 */
export const Figure = Image.extend({
  name: "figure",

  addAttributes() {
    return {
      ...this.parent?.(),
      altTitle: {
        default: "",
        parseHTML: (element) => element.getAttribute("data-alt-title") ?? "",
        renderHTML: (attributes) => ({
          "data-alt-title": attributes.altTitle ?? "",
        }),
      },
      altDescription: {
        default: "",
        parseHTML: (element) =>
          element.getAttribute("data-alt-description") ??
          element.getAttribute("alt") ??
          "",
        renderHTML: (attributes) => ({
          "data-alt-description": attributes.altDescription ?? "",
          alt: attributes.altDescription ?? "",
        }),
      },
    };
  },
});
