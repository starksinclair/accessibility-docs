# Accessibility Docs

## Try the tools

Both tools are available now. No local install is required to use them.

| Tool | Open it | How to use it |
|------|---------|----------------|
| **Hub** | Local: `npm run dev:author` then `/` · Deploy: Cloudflare Worker URL (after `npm run deploy`) | Landing page for all three tools |
| **Checker** | [Accessibility Research Prototype](https://docs.google.com/document/d/1MJitDY4B4eKFei_fvgcy-C6Vwit8reCLoMXnKSyIZuY/edit) | Sign in to Google, open this document, then choose **Accessibility → Open checker**. The menu exists only in this document. The first run asks you to authorize the script. |
| **Author** | `/author` on the hub · interim: [a11yeditor.netlify.app](https://a11yeditor.netlify.app/) | Write in the browser. **Check** runs the rules. **Save** downloads a new `.a11ydoc.json` file when there are no errors. See [Current limitations](#current-limitations). |
| **Workbench** | `/workbench` | Upload PowerPoint files, see them ranked by what to fix first, then open one to walk its slides and findings. Repairs and PDF reading land in the next milestones. |

Research prototype for CS 499 / Ball State faculty document accessibility ahead of ADA Title II. Three tools share one rules engine in `@accessibility-docs/core`.

| Tool | App | What it does |
|------|-----|----------------|
| **Checker** | Google Docs add-on (`src/`) | Audits an existing Google Doc and shows issues in a sidebar |
| **Author** | React editor (`apps/author/` → `/author`) | Lets you write, style text, and insert images. Save is blocked when error-severity rules fail |
| **Workbench** | React app (`/workbench`) | Upload, rank, and fix existing course PowerPoints and PDFs |

```
Google Docs   →  documentModel.ts →  DocumentModel  ┐
TipTap editor →  tiptapToModel.ts →  DocumentModel  ┼→  runAccessibilityChecks()
.a11ydoc.json →  parseDocument()  →  DocumentModel  │
.pptx         →  pptxToModel()    →  DocumentModel  ┘
```

`packages/formats` is where parsing dependencies (JSZip, and later pdf.js) live.
`packages/core` stays free of runtime dependencies because esbuild bundles it
into Apps Script, which cannot load npm packages at runtime.

## Repository layout

```text
accessibility-docs/
├── packages/core/     Shared types, rules, ranking, outline, .a11ydoc.json format
├── packages/formats/  PPTX (and later PDF) readers → DocumentModel, plus fixtures
├── apps/author/       Hub + Author + Workbench UI (Vite + React)
├── apps/worker/       Cloudflare Worker (static SPA + /api/*)
├── src/               Tool A — Apps Script checker (clasp)
├── docs/REQUIREMENTS.md
└── dist/              Built Apps Script files that clasp pushes
```

## Rules

| Code | Severity | Check | Applies to | Fixable |
|------|----------|--------|------------|---------|
| A001 | error | Document has a semantic title | all | auto |
| A002 | warning | Bold, large text is not marked as a heading | all | manual-only |
| A004 | error | Image is missing an alt description | all | ai-assisted |
| A005 | error | Heading has no text | all | manual-only |
| A006 | warning | Heading levels skip (for example H1 → H3) | all | manual-only |
| A007 | error | Image is missing a source file | all | manual-only |
| A008 | warning | Document name is empty | all | auto |
| A009 | warning | Longer document has no headings for navigation | all | manual-only |
| A010 | error | Table has no rows/cells | all | manual-only |
| A011 | error | Table has no header cells | all | auto |
| A012 | warning | Table rows have inconsistent column counts | all | manual-only |
| A013 | error | Slide has no title | pptx | auto |
| A014 | warning | Two or more slides share the same title | pptx | ai-assisted |
| A015 | error | Document language is not set | pdf | auto |
| A016 | error | PDF is untagged (no structure tree) | pdf | manual-only |
| A017 | error | PDF pages have no extractable text (likely scanned) | pdf | manual-only |

A003 ("image has no alt title") was withdrawn on 17 November 2026: no WCAG success criterion asks for a second, shorter alternative, and PowerPoint 365 no longer exposes the field. `RETIRED_RULES` in `packages/core/src/ruleCatalog.ts` keeps the explanation, so an older report that names it can still be read.

Rules scoped to `pptx` or `pdf` run only when `DocumentModel.source` matches, so a Google Doc or an Author document never collects PowerPoint or PDF findings. Every rule also carries plain-language manual instructions — see `RULES` in `packages/core/src/ruleCatalog.ts`.

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

Open the URL Vite prints (usually http://localhost:5173). The hub is `/`, Author is `/author`, Workbench is `/workbench`. See [Current limitations](#current-limitations).

Production build / Cloudflare:

```bash
npm run build:author
npm run dev:workbench   # local Worker + built SPA
npm run deploy          # Cloudflare Workers deploy
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
| `npm test` | Vitest suites for `packages/core`, `packages/formats` and `apps/worker` |
| `npm run build:core` | Compile the shared package |
| `npm run build:formats` | Compile the PPTX/PDF readers |
| `npm run build:author` | Build the React hub/author/workbench app |
| `npm run dev:workbench` | Serve built SPA + Worker API locally |
| `npm run deploy` | Deploy SPA + Worker to Cloudflare |
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

No runtime dependencies. It only needs TypeScript to compile, plus `vitest` for
its tests.

### `@accessibility-docs/formats`

| Package | Why it is here |
|---------|----------------|
| `jszip` | A .pptx is a ZIP of XML parts; this opens it in the browser |
| `fast-xml-parser` | Reads the slide XML in document order, so reading order survives |
| `@accessibility-docs/core` | The DocumentModel the readers produce |

It holds both directions: `pptxToModel` reads a deck, `applyPptxFixes` writes
approved fixes into a copy of it (the upload is never modified).

This is the package that is allowed runtime dependencies. Test fixtures are real
PowerPoint files generated by `fixtures/generate.py` (python-pptx) and
committed; see `packages/formats/fixtures/README.md`.

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
| `@accessibility-docs/formats` | Reads and writes .pptx files in the Workbench |

### Worker (`apps/worker`)

Serves the built React app and `/api/suggest`, the Gemini proxy behind the
Workbench's "Suggest with AI" buttons. The API key is a Worker secret and never
reaches the browser:

```bash
npx wrangler secret put GEMINI_API_KEY
```

For local development, copy `apps/worker/.dev.vars.example` to
`apps/worker/.dev.vars` and put the key there. That file is gitignored. Without
a key the endpoint answers 503 with a message saying so, and the Workbench
still applies fixes you write yourself.

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
