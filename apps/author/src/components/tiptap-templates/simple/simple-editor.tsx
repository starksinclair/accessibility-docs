"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { EditorContent, EditorContext, useEditor, type Editor } from "@tiptap/react"
import {
  assertAccessible,
  runAccessibilityChecks,
  type AccessibilityReport,
} from "@accessibility-docs/core"

// --- Tiptap Core Extensions ---
import { StarterKit } from "@tiptap/starter-kit"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { TextAlign } from "@tiptap/extension-text-align"
import { Typography } from "@tiptap/extension-typography"
import { Highlight } from "@tiptap/extension-highlight"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { FindAndReplace } from "@tiptap/extension-find-and-replace"
import { Selection } from "@tiptap/extensions"
import { TextStyleKit } from "@tiptap/extension-text-style"
import { TableKit } from "@tiptap/extension-table"
import Placeholder from "@tiptap/extension-placeholder"

// --- UI Primitives ---
import { Button } from "@/components/tiptap-ui-primitive/button"
import { Spacer } from "@/components/tiptap-ui-primitive/spacer"
import {
  Toolbar,
  ToolbarGroup,
  ToolbarSeparator,
} from "@/components/tiptap-ui-primitive/toolbar"

// --- Tiptap Node ---
import { NodeBackground } from "@/components/tiptap-extension/node-background-extension"
import { ImageUploadNode } from "@/components/tiptap-node/image-upload-node/image-upload-node-extension"
import { HorizontalRule } from "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node-extension"
import "@/components/tiptap-node/blockquote-node/blockquote-node.scss"
import "@/components/tiptap-node/code-block-node/code-block-node.scss"
import "@/components/tiptap-node/horizontal-rule-node/horizontal-rule-node.scss"
import "@/components/tiptap-node/list-node/list-node.scss"
import "@/components/tiptap-node/image-node/image-node.scss"
import "@/components/tiptap-node/heading-node/heading-node.scss"
import "@/components/tiptap-node/paragraph-node/paragraph-node.scss"

// --- Tiptap UI ---
import { HeadingDropdownMenu } from "@/components/tiptap-ui/heading-dropdown-menu"
import { ImageUploadButton } from "@/components/tiptap-ui/image-upload-button"
import { ListDropdownMenu } from "@/components/tiptap-ui/list-dropdown-menu"
import { BlockquoteButton } from "@/components/tiptap-ui/blockquote-button"
import { CodeBlockButton } from "@/components/tiptap-ui/code-block-button"
import {
  ColorHighlightPopover,
  ColorHighlightPopoverContent,
  ColorHighlightPopoverButton,
} from "@/components/tiptap-ui/color-highlight-popover"
import {
  LinkPopover,
  LinkContent,
  LinkButton,
} from "@/components/tiptap-ui/link-popover"
import { MarkButton } from "@/components/tiptap-ui/mark-button"
import { HIGHLIGHT_COLORS } from "@/components/tiptap-ui/color-highlight-button"
import type { Level } from "@/components/tiptap-ui/heading-button"
import type { ListType } from "@/components/tiptap-ui/list-button"
import { TextAlignButton } from "@/components/tiptap-ui/text-align-button"
import { UndoRedoButton } from "@/components/tiptap-ui/undo-redo-button"
import {
  SearchAndReplace,
  SearchAndReplaceButton,
} from "@/components/tiptap-ui/search-and-replace"

// --- Icons ---
import { ArrowLeftIcon } from "@/components/tiptap-icons/arrow-left-icon"
import { HighlighterIcon } from "@/components/tiptap-icons/highlighter-icon"
import { LinkIcon } from "@/components/tiptap-icons/link-icon"

// --- Hooks ---
import { useIsBreakpoint } from "@/hooks/use-is-breakpoint"
import { useWindowSize } from "@/hooks/use-window-size"
import { useCursorVisibility } from "@/hooks/use-cursor-visibility"
import { useTiptapEditor } from "@/hooks/use-tiptap-editor"

// --- Components ---
import { ThemeToggle } from "@/components/tiptap-templates/simple/theme-toggle"
import { TitleHeading } from "@/editor/TitleHeading"
import { Figure } from "@/editor/Figure"
import { AccessibilityDecorations } from "@/editor/AccessibilityDecorations"
import { applyAccessibilityMarks } from "@/editor/applyAccessibilityMarks"
import { tiptapToModel } from "@/adapters/tiptapToModel"
import { trySaveDocument } from "@/lib/saveDocument"
import { compilePdf } from "@/compiler/compilePdf"
import { ReportPanel } from "@/components/ReportPanel"

// --- Lib ---
import { handleImageUpload, MAX_FILE_SIZE } from "@/lib/tiptap-utils"

// --- Styles ---
import "@/components/tiptap-templates/simple/simple-editor.scss"

const SEARCH_AND_REPLACE_SCROLL_OPTIONS: ScrollIntoViewOptions = {
  block: "center",
}

const HEADING_LEVELS: Level[] = [1, 2, 3, 4, 5, 6]
const LIST_TYPES: ListType[] = ["bulletList", "orderedList", "taskList"]
const HIGHLIGHT_OPTIONS = HIGHLIGHT_COLORS.filter((color) =>
  color.value.startsWith("var(--tt-color-highlight-")
)

const FONT_FAMILIES = [
  "Aptos",
  "Arial",
  "Arial Black",
  "Calibri",
  "Cambria",
  "Candara",
  "Comic Sans MS",
  "Consolas",
  "Constantia",
  "Corbel",
  "Courier New",
  "Franklin Gothic Medium",
  "Garamond",
  "Georgia",
  "Impact",
  "Lucida Console",
  "Palatino Linotype",
  "Segoe UI",
  "Tahoma",
  "Times New Roman",
  "Trebuchet MS",
  "Verdana",
]
const FONT_SIZES = ["10px", "12px", "14px", "16px", "18px", "24px", "32px", "48px"]
const LINE_HEIGHTS = ["1", "1.15", "1.5", "2"]
const TEXT_COLORS = [
  { label: "Black", value: "#1c1917" },
  { label: "Dark red", value: "#991b1b" },
  { label: "Red", value: "#dc2626" },
  { label: "Orange", value: "#c2410c" },
  { label: "Gold", value: "#a16207" },
  { label: "Green", value: "#15803d" },
  { label: "Teal", value: "#0f766e" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Purple", value: "#7e22ce" },
]

function isAutomaticTextColor(value: string): boolean {
  const color = value.trim().toLowerCase().replace(/\s+/g, "")
  return (
    color === "black" ||
    color === "#000" ||
    color === "#000000" ||
    color === "rgb(0,0,0)" ||
    color === "rgba(0,0,0,1)" ||
    color === "windowtext" ||
    color === "canvastext"
  )
}

function stripAutomaticTextColor(html: string): string {
  const parsed = new DOMParser().parseFromString(html, "text/html")

  parsed.querySelectorAll<HTMLElement>("[style], font").forEach((element) => {
    if (element.style.color && isAutomaticTextColor(element.style.color)) {
      element.style.removeProperty("color")
    }
    if (
      element.style.webkitTextFillColor &&
      isAutomaticTextColor(element.style.webkitTextFillColor)
    ) {
      element.style.removeProperty("-webkit-text-fill-color")
    }
    const fontColor = element.getAttribute("color")
    if (fontColor && isAutomaticTextColor(fontColor)) {
      element.removeAttribute("color")
    }
    if (!element.getAttribute("style")?.trim()) {
      element.removeAttribute("style")
    }
  })

  return parsed.body.innerHTML
}

const INITIAL_CONTENT = {
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
}

function FormatSelect({
  label,
  value,
  onChange,
  className,
  style,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  className?: string
  style?: React.CSSProperties
  children: React.ReactNode
}) {
  return (
    <select
      className={className ? `author-format-select ${className}` : "author-format-select"}
      aria-label={label}
      title={label}
      value={value}
      style={style}
      onChange={(event) => onChange(event.target.value)}
    >
      {children}
    </select>
  )
}

function TitleButton() {
  const { editor } = useTiptapEditor()
  const active = editor?.isActive("heading", { asTitle: true }) ?? false

  return (
    <Button
      type="button"
      variant="ghost"
      tooltip="Title"
      aria-label="Title"
      data-active-state={active ? "on" : "off"}
      disabled={!editor}
      onClick={() =>
        editor
          ?.chain()
          .focus()
          .setHeading({ level: 1 })
          .updateAttributes("heading", { asTitle: true })
          .run()
      }
    >
      Title
    </Button>
  )
}

function FontFamilySelect() {
  const { editor } = useTiptapEditor()
  const value = String(editor?.getAttributes("textStyle").fontFamily ?? "")

  return (
    <FormatSelect
      label="Font family"
      className="author-font-select"
      style={{ fontFamily: value || "inherit" }}
      value={FONT_FAMILIES.includes(value) ? value : ""}
      onChange={(next) => {
        if (!next) {
          editor?.chain().focus().unsetFontFamily().run()
          return
        }
        editor?.chain().focus().setFontFamily(next).run()
      }}
    >
      <option value="">Font</option>
      {FONT_FAMILIES.map((font) => (
        <option key={font} value={font} style={{ fontFamily: font }}>
          {font}
        </option>
      ))}
    </FormatSelect>
  )
}

function FontSizeSelect() {
  const { editor } = useTiptapEditor()
  const value = String(editor?.getAttributes("textStyle").fontSize ?? "")

  return (
    <FormatSelect
      label="Font size"
      value={FONT_SIZES.includes(value) ? value : ""}
      onChange={(next) => {
        if (!next) {
          editor?.chain().focus().unsetFontSize().run()
          return
        }
        editor?.chain().focus().setFontSize(next).run()
      }}
    >
      <option value="">Size</option>
      {FONT_SIZES.map((size) => (
        <option key={size} value={size}>
          {size.replace("px", "")}
        </option>
      ))}
    </FormatSelect>
  )
}

function LineHeightSelect() {
  const { editor } = useTiptapEditor()
  const value = String(editor?.getAttributes("textStyle").lineHeight ?? "")

  return (
    <FormatSelect
      label="Line spacing"
      value={LINE_HEIGHTS.includes(value) ? value : ""}
      onChange={(next) => {
        if (!next) {
          editor?.chain().focus().unsetLineHeight().run()
          return
        }
        editor?.chain().focus().setLineHeight(next).run()
      }}
    >
      <option value="">Line spacing</option>
      {LINE_HEIGHTS.map((height) => (
        <option key={height} value={height}>
          {height}
        </option>
      ))}
    </FormatSelect>
  )
}

function TextColorSelect() {
  const { editor } = useTiptapEditor()
  const value = String(editor?.getAttributes("textStyle").color ?? "")

  return (
    <FormatSelect
      label="Text color"
      value={TEXT_COLORS.some((color) => color.value === value) ? value : ""}
      onChange={(next) => {
        if (!next) {
          editor?.chain().focus().unsetColor().run()
          return
        }
        editor?.chain().focus().setColor(next).run()
      }}
    >
      <option value="">Color</option>
      {TEXT_COLORS.map((color) => (
        <option key={color.value} value={color.value}>
          {color.label}
        </option>
      ))}
    </FormatSelect>
  )
}

function ClearFormattingButton() {
  const { editor } = useTiptapEditor()

  return (
    <Button
      type="button"
      variant="ghost"
      tooltip="Clear formatting"
      aria-label="Clear formatting"
      disabled={!editor}
      onClick={() => editor?.chain().focus().unsetAllMarks().run()}
    >
      Clear
    </Button>
  )
}

function TableSelect() {
  const { editor } = useTiptapEditor()

  return (
    <FormatSelect
      label="Table"
      value=""
      onChange={(action) => {
        const chain = editor?.chain().focus()
        if (!chain) {
          return
        }
        if (action === "insert") {
          chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        } else if (action === "row-after") {
          chain.addRowAfter().run()
        } else if (action === "row-before") {
          chain.addRowBefore().run()
        } else if (action === "column-after") {
          chain.addColumnAfter().run()
        } else if (action === "column-before") {
          chain.addColumnBefore().run()
        } else if (action === "delete-row") {
          chain.deleteRow().run()
        } else if (action === "delete-column") {
          chain.deleteColumn().run()
        } else if (action === "delete-table") {
          chain.deleteTable().run()
        } else if (action === "header-row") {
          chain.toggleHeaderRow().run()
        } else if (action === "merge") {
          chain.mergeCells().run()
        } else if (action === "split") {
          chain.splitCell().run()
        }
      }}
    >
      <option value="">Table</option>
      <option value="insert">Insert 3×3 table</option>
      <option value="row-before">Add row above</option>
      <option value="row-after">Add row below</option>
      <option value="column-before">Add column left</option>
      <option value="column-after">Add column right</option>
      <option value="delete-row">Delete row</option>
      <option value="delete-column">Delete column</option>
      <option value="delete-table">Delete table</option>
      <option value="header-row">Toggle header row</option>
      <option value="merge">Merge cells</option>
      <option value="split">Split cell</option>
    </FormatSelect>
  )
}

function HorizontalRuleButton() {
  const { editor } = useTiptapEditor()
  const canInsert = editor?.can().setHorizontalRule() ?? false

  return (
    <Button
      type="button"
      variant="ghost"
      tooltip="Horizontal rule"
      aria-label="Insert horizontal rule"
      data-disabled={!canInsert}
      disabled={!canInsert}
      onClick={() => editor?.chain().focus().setHorizontalRule().run()}
    >
      <svg
        className="tiptap-button-icon"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <path
          d="M4 12h16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </Button>
  )
}

const MainToolbarContent = ({
  onHighlighterClick,
  onNodeBackgroundClick,
  onLinkClick,
  onSearchAndReplaceClick,
  isSearchAndReplaceOpen,
  searchAndReplaceButtonRef,
  isMobile,
}: {
  onHighlighterClick: () => void
  onNodeBackgroundClick: () => void
  onLinkClick: () => void
  onSearchAndReplaceClick: () => void
  isSearchAndReplaceOpen: boolean
  searchAndReplaceButtonRef: React.RefObject<HTMLButtonElement | null>
  isMobile: boolean
}) => {
  return (
    <>
      <Spacer />

      <ToolbarGroup>
        <UndoRedoButton action="undo" />
        <UndoRedoButton action="redo" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TitleButton />
        <HeadingDropdownMenu modal={false} levels={HEADING_LEVELS} />
        <ListDropdownMenu modal={false} types={LIST_TYPES} />
        <BlockquoteButton />
        <CodeBlockButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <FontFamilySelect />
        <FontSizeSelect />
        <LineHeightSelect />
        <TextColorSelect />
        <ClearFormattingButton />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="bold" />
        <MarkButton type="italic" />
        <MarkButton type="strike" />
        <MarkButton type="code" />
        <MarkButton type="underline" />
        {!isMobile ? (
          <ColorHighlightPopover
            colors={HIGHLIGHT_OPTIONS}
            label="Text highlight"
          />
        ) : (
          <ColorHighlightPopoverButton
            tooltip="Text highlight"
            aria-label="Text highlight"
            onClick={onHighlighterClick}
          />
        )}
        {!isMobile ? (
          <ColorHighlightPopover
            mode="node"
            colors={HIGHLIGHT_OPTIONS}
            label="Block background"
          />
        ) : (
          <ColorHighlightPopoverButton
            tooltip="Block background"
            aria-label="Block background"
            onClick={onNodeBackgroundClick}
          />
        )}
        {!isMobile ? <LinkPopover /> : <LinkButton onClick={onLinkClick} />}
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <MarkButton type="superscript" />
        <MarkButton type="subscript" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <TextAlignButton align="left" />
        <TextAlignButton align="center" />
        <TextAlignButton align="right" />
        <TextAlignButton align="justify" />
      </ToolbarGroup>

      <ToolbarSeparator />

      <ToolbarGroup>
        <ImageUploadButton text="Add" />
        <HorizontalRuleButton />
        <TableSelect />
      </ToolbarGroup>

      <Spacer />

      {isMobile && <ToolbarSeparator />}

      <ToolbarGroup>
        <SearchAndReplaceButton
          ref={searchAndReplaceButtonRef}
          aria-expanded={isSearchAndReplaceOpen}
          data-active-state={isSearchAndReplaceOpen ? "on" : "off"}
          onClick={onSearchAndReplaceClick}
        />
        <ThemeToggle />
      </ToolbarGroup>
    </>
  )
}

const MobileToolbarContent = ({
  type,
  onBack,
}: {
  type: "highlighter" | "node" | "link"
  onBack: () => void
}) => (
  <>
    <ToolbarGroup>
      <Button variant="ghost" onClick={onBack}>
        <ArrowLeftIcon className="tiptap-button-icon" />
        {type === "link" ? (
          <LinkIcon className="tiptap-button-icon" />
        ) : (
          <HighlighterIcon className="tiptap-button-icon" />
        )}
      </Button>
    </ToolbarGroup>

    <ToolbarSeparator />

    {type === "highlighter" ? (
      <ColorHighlightPopoverContent colors={HIGHLIGHT_OPTIONS} />
    ) : type === "node" ? (
      <ColorHighlightPopoverContent mode="node" colors={HIGHLIGHT_OPTIONS} />
    ) : (
      <LinkContent />
    )}
  </>
)

export function SimpleEditor() {
  const isMobile = useIsBreakpoint()
  const { height } = useWindowSize()
  const [mobileView, setMobileView] = useState<
    "main" | "highlighter" | "node" | "link"
  >("main")
  const [isSearchAndReplaceOpen, setIsSearchAndReplaceOpen] = useState(false)
  const [documentName, setDocumentName] = useState("Untitled document")
  const [report, setReport] = useState<AccessibilityReport | null>(null)
  const [saveBlocked, setSaveBlocked] = useState(false)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const searchAndReplaceButtonRef = useRef<HTMLButtonElement>(null)
  const editorRef = useRef<Editor | null>(null)
  const documentNameRef = useRef(documentName)
  documentNameRef.current = documentName

  const publishReport = useCallback(
    (current: Editor, next: AccessibilityReport, blocked: boolean) => {
      setReport(next)
      setSaveBlocked(blocked)
      applyAccessibilityMarks(current, next.issues)
    },
    []
  )

  const checkEditor = useCallback(
    (current: Editor) => {
      const model = tiptapToModel(
        current.getJSON(),
        documentNameRef.current.trim() || "Untitled"
      )
      publishReport(current, runAccessibilityChecks(model), false)
    },
    [publishReport]
  )

  const editor = useEditor({
    immediatelyRender: false,
    editorProps: {
      attributes: {
        autocomplete: "off",
        autocorrect: "off",
        autocapitalize: "off",
        "aria-label": "Main content area, start typing to enter text.",
        class: "simple-editor",
      },
      transformPastedHTML(html) {
        return stripAutomaticTextColor(html)
      },
      handleKeyDown(_view, event) {
        if (event.key !== "Enter" || event.isComposing) {
          return false
        }

        window.setTimeout(() => {
          const current = editorRef.current
          if (current) {
            checkEditor(current)
          }
        }, 0)

        return false
      },
    },
    extensions: [
      StarterKit.configure({
        horizontalRule: false,
        heading: false,
        link: {
          openOnClick: false,
          enableClickSelection: true,
        },
      }),
      TitleHeading.configure({
        levels: HEADING_LEVELS,
      }),
      HorizontalRule,
      NodeBackground,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Highlight.configure({ multicolor: true }),
      Figure.configure({
        inline: false,
        allowBase64: true,
      }),
      TextStyleKit,
      TableKit.configure({
        table: { resizable: true },
      }),
      Typography,
      Superscript,
      Subscript,
      Selection,
      Placeholder.configure({
        placeholder: "Start writing your scholarly document…",
      }),
      AccessibilityDecorations,
      FindAndReplace.configure({
        searchDebounceMs: 500,
        injectCSS: false,
      }),
      ImageUploadNode.configure({
        type: "figure",
        accept: "image/*",
        maxSize: MAX_FILE_SIZE,
        limit: 3,
        upload: handleImageUpload,
        onError: (error) => console.error("Upload failed:", error),
      }),
    ],
    content: INITIAL_CONTENT,
  })

  editorRef.current = editor

  const buildModel = useCallback(() => {
    if (!editor) {
      return null
    }
    return tiptapToModel(editor.getJSON(), documentName.trim() || "Untitled")
  }, [documentName, editor])

  const runCheck = useCallback(() => {
    if (!editor) {
      return
    }
    checkEditor(editor)
  }, [checkEditor, editor])

  const handleSave = useCallback(() => {
    const model = buildModel()
    if (!model || !editor) {
      return
    }

    const safeName =
      documentName.trim().replace(/[^\w\-]+/g, "-").toLowerCase() || "document"
    const result = trySaveDocument(model, `${safeName}.a11ydoc.json`)
    publishReport(editor, result.report, !result.saved)
  }, [buildModel, documentName, editor, publishReport])

  const downloadPdf = useCallback(() => {
    const model = buildModel()
    if (!model || !editor) {
      return
    }

    const result = assertAccessible(model)
    if (!result.ok) {
      publishReport(editor, result.report, true)
      return
    }

    const safeName =
      documentName.trim().replace(/[^\w\-]+/g, "-").toLowerCase() || "document"
    const pdf = compilePdf(model)
    const blob = new Blob([pdf], { type: "application/pdf" })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = `${safeName}.pdf`
    anchor.click()
    URL.revokeObjectURL(url)
    publishReport(editor, result.report, false)
  }, [buildModel, documentName, editor, publishReport])

  const rect = useCursorVisibility({
    editor,
    overlayHeight: toolbarRef.current?.getBoundingClientRect().height ?? 0,
  })

  useEffect(() => {
    if (!isMobile && mobileView !== "main") {
      setMobileView("main")
    }
  }, [isMobile, mobileView])

  const openSearchAndReplace = useCallback(() => {
    setMobileView("main")
    setIsSearchAndReplaceOpen(true)
  }, [])

  const closeSearchAndReplace = useCallback(() => {
    setIsSearchAndReplaceOpen(false)
    searchAndReplaceButtonRef.current?.focus()
  }, [])

  const toggleSearchAndReplace = useCallback(() => {
    if (isSearchAndReplaceOpen) {
      closeSearchAndReplace()
      return
    }

    openSearchAndReplace()
  }, [closeSearchAndReplace, isSearchAndReplaceOpen, openSearchAndReplace])

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
          <button type="button" className="secondary" onClick={downloadPdf}>
            Download PDF
          </button>
          <button type="button" className="secondary" onClick={runCheck}>
            Check
          </button>
          <button type="button" className="primary" onClick={handleSave}>
            Save
          </button>
        </div>
      </header>

      <div className="author-main">
    <div className="simple-editor-wrapper">
      <EditorContext.Provider value={{ editor }}>
        <Toolbar
          ref={toolbarRef}
          style={{
            ...(isMobile
              ? {
                  bottom: `calc(100% - ${height - rect.y}px)`,
                }
              : {}),
          }}
        >
          {mobileView === "main" ? (
            <MainToolbarContent
              onHighlighterClick={() => setMobileView("highlighter")}
              onNodeBackgroundClick={() => setMobileView("node")}
              onLinkClick={() => setMobileView("link")}
              onSearchAndReplaceClick={toggleSearchAndReplace}
              isSearchAndReplaceOpen={isSearchAndReplaceOpen}
              searchAndReplaceButtonRef={searchAndReplaceButtonRef}
              isMobile={isMobile}
            />
          ) : (
            <MobileToolbarContent
              type={
                mobileView === "highlighter"
                  ? "highlighter"
                  : mobileView === "node"
                    ? "node"
                    : "link"
              }
              onBack={() => setMobileView("main")}
            />
          )}
        </Toolbar>

        <SearchAndReplace
          className="simple-editor-search-and-replace"
          open={isSearchAndReplaceOpen}
          onOpen={openSearchAndReplace}
          onClose={closeSearchAndReplace}
          scrollIntoViewOptions={SEARCH_AND_REPLACE_SCROLL_OPTIONS}
        />

        <EditorContent
          editor={editor}
          role="presentation"
          className="simple-editor-content"
        />
      </EditorContext.Provider>
    </div>
        <ReportPanel report={report} saveBlocked={saveBlocked} />
      </div>
    </div>
  )
}
