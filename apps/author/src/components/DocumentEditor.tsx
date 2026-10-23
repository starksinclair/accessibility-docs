import { useCallback, useRef, useState, type ChangeEvent } from "react";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import {
  runAccessibilityChecks,
  type AccessibilityReport,
} from "@accessibility-docs/core";
import { Figure } from "../editor/Figure";
import { TitleHeading } from "../editor/TitleHeading";
import { AccessibilityDecorations } from "../editor/AccessibilityDecorations";
import { applyAccessibilityMarks } from "../editor/applyAccessibilityMarks";
import { tiptapToModel } from "../adapters/tiptapToModel";
import { trySaveDocument } from "../lib/saveDocument";
import { Toolbar } from "./Toolbar";
import { ReportPanel } from "./ReportPanel";

export function DocumentEditor() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<Editor | null>(null);
  const documentNameRef = useRef("Untitled document");
  const [documentName, setDocumentName] = useState("Untitled document");
  const [report, setReport] = useState<AccessibilityReport | null>(null);
  const [saveBlocked, setSaveBlocked] = useState(false);
  documentNameRef.current = documentName;

  const publishReport = useCallback(
    (current: Editor, next: AccessibilityReport, blocked: boolean) => {
      setReport(next);
      setSaveBlocked(blocked);
      applyAccessibilityMarks(current, next.issues);
    },
    []
  );

  const checkEditor = useCallback(
    (current: Editor) => {
      const model = tiptapToModel(
        current.getJSON(),
        documentNameRef.current.trim() || "Untitled"
      );
      publishReport(current, runAccessibilityChecks(model), false);
    },
    [publishReport]
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
      }),
      TitleHeading.configure({
        levels: [1, 2, 3, 4, 5, 6],
      }),
      Figure.configure({
        inline: false,
        allowBase64: true,
      }),
      Placeholder.configure({
        placeholder: "Start writing your scholarly document…",
      }),
      AccessibilityDecorations,
    ],
    editorProps: {
      handleKeyDown(_view, event) {
        if (event.key !== "Enter" || event.isComposing) {
          return false;
        }

        window.setTimeout(() => {
          const current = editorRef.current;
          if (current) {
            checkEditor(current);
          }
        }, 0);

        return false;
      },
    },
    content: {
      type: "doc",
      content: [
        {
          type: "heading",
          attrs: { level: 1, asTitle: true },
          content: [{ type: "text", text: "Document title" }],
        },
        {
          type: "paragraph",
          content: [{ type: "text", text: "Write your content here." }],
        },
      ],
    },
  });

  editorRef.current = editor;

  const buildModel = useCallback(() => {
    if (!editor) {
      return null;
    }
    return tiptapToModel(editor.getJSON(), documentName.trim() || "Untitled");
  }, [documentName, editor]);

  const runCheck = useCallback(() => {
    if (!editor) {
      return;
    }
    checkEditor(editor);
  }, [checkEditor, editor]);

  const handleSave = useCallback(() => {
    const model = buildModel();
    if (!model || !editor) {
      return;
    }

    const safeName =
      documentName.trim().replace(/[^\w\-]+/g, "-").toLowerCase() ||
      "document";
    const result = trySaveDocument(model, `${safeName}.a11ydoc.json`);
    publishReport(editor, result.report, !result.saved);
  }, [buildModel, documentName, editor, publishReport]);

  const onInsertImage = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const onImageSelected = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !editor) {
        return;
      }

      const altTitle = window.prompt("Alt title (short name for the image):", "") ?? "";
      const altDescription =
        window.prompt("Alt description (what the image shows):", "") ?? "";

      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result ?? "");
        editor
          .chain()
          .focus()
          .insertContent({
            type: "figure",
            attrs: {
              src,
              altTitle,
              altDescription,
            },
          })
          .run();
      };
      reader.readAsDataURL(file);
    },
    [editor]
  );

  return (
    <div className="author-layout">
      <header className="author-header">
        <div className="brand">
          <span className="brand-mark">A11y</span>
          <div>
            <h1>Author</h1>
            <p>Structured writing with compile-time accessibility checks</p>
          </div>
        </div>
        <div className="header-actions">
          <label className="doc-name">
            <span>Document name</span>
            <input
              value={documentName}
              onChange={(event) => setDocumentName(event.target.value)}
            />
          </label>
          <button type="button" className="secondary" onClick={runCheck}>
            Check
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </header>

      <Toolbar editor={editor} onInsertImage={onInsertImage} />

      <div className="author-main">
        <div className="editor-shell">
          <EditorContent editor={editor} className="editor-surface" />
        </div>
        <ReportPanel report={report} saveBlocked={saveBlocked} />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden-input"
        onChange={onImageSelected}
      />
    </div>
  );
}
