import type { Editor } from "@tiptap/react";

interface ToolbarProps {
  editor: Editor | null;
  onInsertImage: () => void;
}

export function Toolbar({ editor, onInsertImage }: ToolbarProps) {
  if (!editor) {
    return null;
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Document styles">
      <button
        type="button"
        className={editor.isActive("heading", { level: 1, asTitle: true }) ? "active" : ""}
        onClick={() =>
          editor
            .chain()
            .focus()
            .setHeading({ level: 1 })
            .updateAttributes("heading", { asTitle: true })
            .run()
        }
      >
        Title
      </button>
      <button
        type="button"
        className={
          editor.isActive("heading", { level: 1 }) &&
          !editor.getAttributes("heading").asTitle
            ? "active"
            : ""
        }
        onClick={() =>
          editor
            .chain()
            .focus()
            .setHeading({ level: 1 })
            .updateAttributes("heading", { asTitle: false })
            .run()
        }
      >
        H1
      </button>
      <button
        type="button"
        className={editor.isActive("heading", { level: 2 }) ? "active" : ""}
        onClick={() =>
          editor
            .chain()
            .focus()
            .setHeading({ level: 2 })
            .updateAttributes("heading", { asTitle: false })
            .run()
        }
      >
        H2
      </button>
      <button
        type="button"
        className={editor.isActive("heading", { level: 3 }) ? "active" : ""}
        onClick={() =>
          editor
            .chain()
            .focus()
            .setHeading({ level: 3 })
            .updateAttributes("heading", { asTitle: false })
            .run()
        }
      >
        H3
      </button>
      <button
        type="button"
        className={editor.isActive("paragraph") ? "active" : ""}
        onClick={() => editor.chain().focus().setParagraph().run()}
      >
        Paragraph
      </button>
      <button
        type="button"
        className={editor.isActive("bold") ? "active" : ""}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        Bold
      </button>
      <button type="button" onClick={onInsertImage}>
        Image
      </button>
    </div>
  );
}
