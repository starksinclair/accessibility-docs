# Accessibility Docs

## Try the tools

Both tools are available now. No local install is required to use them.

| Tool | Open it | How to use it |
|------|---------|----------------|
| **Checker** | [Accessibility Research Prototype](https://docs.google.com/document/d/1MJitDY4B4eKFei_fvgcy-C6Vwit8reCLoMXnKSyIZuY/edit) | Sign in to Google, open this document, then choose **Accessibility → Open checker**. The menu exists only in this document. The first run asks you to authorize the script. |
| **Author** | [a11yeditor.netlify.app](https://a11yeditor.netlify.app/) | Write in the browser. **Check** runs the rules. **Save** downloads a new `.a11ydoc.json` file when there are no errors. It does not update a previous file, store the document in the cloud, or export PDF or Word. See [Current limitations](#current-limitations). |

Research prototype for CS 499. It asks whether enforcing alt text, heading structure, and reading order as structural rules at authoring time produces scholarly documents with higher WCAG 2.2 Level AA compliance than documents written in Microsoft Word and exported as PDF.

The project has two tools that share one rules engine:

| Tool | App | What it does |
|------|-----|----------------|
| **Checker** | Google Docs add-on (`src/`) | Audits an existing Google Doc and shows issues in a sidebar |
| **Author** | React editor (`apps/author/`) | Lets you write, style text, and insert images. Save is blocked when error-severity rules fail |

Both tools convert a document into the same `DocumentModel`, then run the same checks from `@accessibility-docs/core`.

```
Google Docs  →  documentModel.ts  →  DocumentModel  ┐
TipTap editor →  tiptapToModel.ts →  DocumentModel  ┼→  runAccessibilityChecks()
.a11ydoc.json →  parseDocument()  →  DocumentModel  ┘
```

## Repository layout

```text
accessibility-docs/
├── packages/core/     Shared types, rules, and .a11ydoc.json format
├── apps/author/       Tool B — TipTap authoring app
├── src/               Tool A — Apps Script checker (clasp)
└── dist/              Built Apps Script files that clasp pushes
```

## Rules

| Code | Severity | Check |
|------|----------|--------|
| A001 | error | Document has a semantic title |
| A002 | warning | Bold, large text is not marked as a heading |
| A003 | warning | Image is missing an alt title |
| A004 | error | Image is missing an alt description |

`assertAccessible()` blocks a save only when `errorCount > 0`. Warnings are reported and do not block save.

These rules currently implement a focused subset of accessibility requirements derived from WCAG 2.2 and WCAG2ICT for non-web documents. The project does not yet claim full WCAG, PDF/UA, or document accessibility conformance.

## File format

The author tool saves a versioned JSON file named `*.a11ydoc.json`:

```json
{
  "version": 1,
  "document": {
    "documentName": "Paper title",
    "nodes": []
  }
}
```

`a11y` is shorthand for accessibility (a + 11 letters + y). The format is local to this project.

## Current limitations

These authoring gaps are known. They will be fixed in a later version. The live editor still only downloads a JSON file.

### Each save creates a new file

**Save** does not update the file from the last save. The editor builds a JSON blob and starts a browser download. The page never keeps a handle to that file, so it cannot open it again and replace the contents. Saving twice produces two downloads, often `document.a11ydoc.json` and `document (1).a11ydoc.json`.

### No cloud copy

Nothing is stored on a server. Closing the tab drops the document except for files already downloaded. A later version will save the checked document to cloud storage, then offer a separate **Download** button for a local copy. The accessibility check will still run before that cloud save is accepted.

### No PDF or Word export

The author editor can save only `.a11ydoc.json`. There is no PDF or Microsoft Word (`.docx`) export yet.

JSON is the working source format because it keeps the structure the rules check: title, heading levels, image alt text, and reading order. Word and PDF export are planned. Those exports will run only after the same accessibility check passes, and they will need to keep that structure (real heading styles and image alternatives in Word; a tagged PDF rather than a picture of the page). A visual-only PDF or a Word file that flattens headings into styled text would drop the properties this study is measuring.

## Getting started

Requires Node.js 20 or later and npm.

```bash
npm install
```

### Author (Tool B)

```bash
npm run dev:author
```

Open the URL Vite prints (usually http://localhost:5173). Use **Check** to run the rules, or **Save** to download `.a11ydoc.json` when there are no errors. See [Current limitations](#current-limitations).

Production build:

```bash
npm run build:author
```

### Checker (Tool A)

Requires [clasp](https://github.com/google/clasp) login and the Apps Script API enabled.

```bash
npm run build    # typecheck, bundle rules, copy sidebar HTML into dist/
npm run push     # build, then clasp push
npm run open     # open the bound Apps Script project
```

After a push, refresh the Google Doc. Use **Accessibility → Open checker**. If the menu is missing, run `onOpen` once from the Apps Script editor, then refresh the document.

Apps Script cannot import npm packages at runtime. `npm run build` bundles `@accessibility-docs/core` into `dist/Rules.js` and exposes `runAccessibilityChecks` on the global scope.

### Other scripts

| Script | Purpose |
|--------|---------|
| `npm run build:core` | Compile the shared package |
| `npm run lint` | ESLint on the Apps Script `src/` tree |
| `npm run lint:fix` | ESLint with auto-fix |

## Tools

| Tool | Role |
|------|------|
| [TypeScript](https://www.typescriptlang.org/) 5.9 | Language for core, checker, and author |
| [npm workspaces](https://docs.npmjs.com/cli/using-npm/workspaces) | Shares `@accessibility-docs/core` across apps |
| [Vite](https://vite.dev/) | Dev server and production build for the author app |
| [clasp](https://github.com/google/clasp) (`@google/clasp`) | Pushes `dist/` to the bound Google Apps Script project |
| [esbuild](https://esbuild.github.io/) | Bundles core into a single Apps Script file |
| [ESLint](https://eslint.org/) + [typescript-eslint](https://typescript-eslint.io/) | Lints the Apps Script sources |

## External packages

### Shared / checker (root)

| Package | Why it is here |
|---------|----------------|
| `typescript` | Compiles TypeScript |
| `@google/clasp` | Push and open the Apps Script project |
| `@types/google-apps-script` | Types for `DocumentApp`, `HtmlService`, and related services |
| `esbuild` | Bundle core rules for Apps Script |
| `eslint`, `@eslint/js`, `typescript-eslint`, `globals` | Lint `src/` |

### `@accessibility-docs/core`

No runtime dependencies. It only needs TypeScript to compile.

### Author app (`apps/author`)

| Package | Why it is here |
|---------|----------------|
| `react`, `react-dom` | UI |
| `@types/react`, `@types/react-dom` | React type definitions |
| `vite`, `@vitejs/plugin-react` | Dev server and bundler |
| `@tiptap/react`, `@tiptap/pm`, `@tiptap/starter-kit` | Structured editor (ProseMirror) |
| `@tiptap/extension-heading` | Heading levels; Title is a heading flagged `asTitle` |
| `@tiptap/extension-image` | Base for the custom figure node (image + alt fields) |
| `@tiptap/extension-placeholder` | Empty-editor placeholder |
| `@accessibility-docs/core` | Same rules and JSON format as the checker |

## Resources

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/) — the compliance target for the study (Level AA)
- [Understanding SC 1.1.1 Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html) — image alternatives
- [Understanding SC 1.3.1 Info and Relationships](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html) — headings and structure
- [Understanding SC 1.3.2 Meaningful Sequence](https://www.w3.org/WAI/WCAG22/Understanding/meaningful-sequence.html) — reading order
- [Google Apps Script](https://developers.google.com/apps-script) — checker runtime
- [Document Service](https://developers.google.com/apps-script/reference/document) — reading Docs content, headings, and inline images
- [clasp TypeScript guide](https://developers.google.com/apps-script/guides/clasp) — local development and push
- [TipTap docs](https://tiptap.dev/docs/editor/getting-started/overview) — author editor
- [TipTap Simple Editor template](https://tiptap.dev/docs/ui-components/templates/simple-editor) — the editor style this app follows (custom schema, not the Word/DOCX template)
