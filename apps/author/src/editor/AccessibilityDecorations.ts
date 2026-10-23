import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { DecorationSet } from "@tiptap/pm/view";

/** Plugin state holds the current inline accessibility marks. */
export const accessibilityPluginKey = new PluginKey<DecorationSet>(
  "accessibilityDecorations"
);

export const AccessibilityDecorations = Extension.create({
  name: "accessibilityDecorations",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: accessibilityPluginKey,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, decorations) {
            const next = tr.getMeta(accessibilityPluginKey) as
              | DecorationSet
              | undefined;
            if (next) {
              return next;
            }
            return decorations.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations(state) {
            return accessibilityPluginKey.getState(state);
          },
        },
      }),
    ];
  },
});
