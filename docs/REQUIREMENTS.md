# Accessibility Workbench: Requirements

**Status:** Source of truth for all coding tools (Claude Code, Cursor, Codex). If code and this file disagree, this file wins. Update this file first, then the code.
**Owner:** Sinclair Nzenwata
**Repo:** existing `accessibility-docs` monorepo (do not create a new repo)
**Demo deadline:** Tech Talk, November 30, 2026

---

## 1. Purpose

Faculty at Ball State need to make existing course materials (PowerPoint decks and PDFs) accessible before the ADA Title II deadline of April 26, 2027. Existing tools, including YuJa Panorama, score files but do not fix them. For PowerPoint structure issues, Panorama only shows manual instructions.

This work adds a third tool, the **Workbench**, to the existing project, and a **hub page** that ties all three together.

The Workbench lets a faculty member:

1. Upload many course documents at once.
2. See them ranked, so they know which document to fix first.
3. Open one document, see it rendered, and jump between its accessibility issues.
4. Get AI-suggested fixes (Gemini) for images, tables and slide titles.
5. Review, edit and apply each fix, then download a corrected file.

### Guiding principles

- **One rules engine.** Every format becomes a `DocumentModel` and runs through `runAccessibilityChecks()` from `@accessibility-docs/core`. Do not write a second, separate checker.
- **Human in the loop.** AI suggests, the user decides. Nothing is written to a file without an explicit user action.
- **Preserve instructional intent.** Suggestions should reflect what the material is teaching, not only what it looks like.
- **Honest scope.** If the tool cannot fix something, it says so and explains the manual fix. It never claims a file is compliant.
- **The tool itself must be accessible** (WCAG 2.2 AA).

---

## 2. Current state (do not break)

```text
accessibility-docs/
├── packages/core/     Shared types, rules (A001 to A012), .a11ydoc.json format
├── apps/author/       Tool B: TipTap authoring app (Vite + React), deployed at a11yeditor.netlify.app
├── src/               Tool A: Google Docs checker (Apps Script, clasp)
└── dist/              Built Apps Script files
```

```
Google Docs   →  documentModel.ts  →  DocumentModel  ┐
TipTap editor →  tiptapToModel.ts  →  DocumentModel  ┼→  runAccessibilityChecks()
.a11ydoc.json →  parseDocument()   →  DocumentModel  ┘
```

**Hard constraints:**

- C-1 `packages/core` must stay **free of runtime dependencies**. It is bundled into Apps Script by esbuild, which cannot use npm packages at runtime. Any parsing library (JSZip, pdf.js, pdf-lib) goes in a new package, never in core.
- C-2 `npm run build` and `npm run push` for the Checker must keep working after every change.
- C-3 The existing Author editor keeps working at its current behavior. It moves to the `/author` route (see FR-1).
- C-4 Existing rule codes A001 to A012 keep their codes, severities and meaning. New rules get new codes.
  - **Amendment, November 17 2026: A003 (image has no alt title) is withdrawn.** No WCAG success criterion requires it — SC 1.1.1 asks for one text alternative, which is A004 — and PowerPoint 365 no longer exposes the field, so its manual instruction could not be followed. A withdrawn code is never reissued; `RETIRED_RULES` in `packages/core/src/ruleCatalog.ts` records it so an older report that names A003 can still be explained. `FigureNode.altTitle` stays in the model: Google Docs still has the field, the PPTX reader and writer round-trip `p:cNvPr@title`, and the PDF exporter uses it as a fallback. The rest of C-4 is unchanged.

---

## 3. Target state

```text
accessibility-docs/
├── packages/core/       Shared types and rules (extended, still zero runtime deps)
├── packages/formats/    NEW: PPTX and PDF readers (→ DocumentModel) and writers (apply fixes)
├── apps/author/         React app, now with routes:
│     /                  Hub page
│     /author            Existing TipTap editor (unchanged behavior)
│     /workbench         NEW: upload, ranking, viewer, issue sidebar, fix panel
├── apps/worker/         NEW: Cloudflare Worker (serves the built React app + /api/suggest Gemini proxy)
├── src/                 Checker (unchanged)
└── docs/REQUIREMENTS.md This file
```

```
Google Docs   →  documentModel.ts  →  DocumentModel  ┐
TipTap editor →  tiptapToModel.ts  →  DocumentModel  │
.a11ydoc.json →  parseDocument()   →  DocumentModel  ┼→  runAccessibilityChecks()
.pptx         →  pptxToModel()     →  DocumentModel  │
.pdf          →  pdfToModel()      →  DocumentModel  ┘
```

**Files are processed in the browser.** Uploaded documents never leave the user's machine. Only the single image or table being fixed is sent to the Worker's `/api/suggest` endpoint, and only when the user clicks "Suggest." This is a deliberate privacy and security choice; keep it.

---

## 4. Priorities

| Priority | Meaning |
| --- | --- |
| **P0** | Required for the November 30 demo. Build these first, in order. |
| **P1** | Wanted for the demo if P0 is done. |
| **P2** | After the demo (spring 2027 study). Do not start until P0 and P1 are done. |

| Area | P0 (demo) | P1 | P2 (later) |
| --- | --- | --- | --- |
| Hub page | Links to researcher, Checker, Author, Workbench | | |
| Upload | Multiple .pptx and .pdf files | Drag and drop | Canvas (LTI 1.3) integration |
| Ranking | Score and rank all uploaded files | Effort estimate per file | |
| Viewer | Render PDF; render PPTX slides (or structure view fallback) | Highlight issue location | |
| Issue sidebar | List issues, click to jump | Filters | |
| AI suggestions | Image alt text, slide titles | Table headers | Long descriptions for charts |
| Fixes (PPTX) | Alt text, empty title, **add missing title placeholder**, table header row, document title | | Reading order, decorative flag |
| Fixes (PDF) | Document title, language, alt text on tagged figures | Table header cells on tagged PDFs | Untagged PDF tagging, OCR |
| Google Slides | | | Read and fix via Slides API |
| Export | Download fixed file | Before and after report | |

---

## 5. Functional requirements

### FR-1 Routing and hub page (P0)

- FR-1.1 Add React Router to `apps/author`. Routes: `/` hub, `/author` existing editor, `/workbench` new tool.
- FR-1.2 Deep links (`/author`, `/workbench`) must work on refresh. Handled by the Worker's static assets SPA fallback (see FR-13).
- FR-1.3 Hub page shows four cards, each with a one-sentence description and a link:

| Card | Link |
| --- | --- |
| About the researcher | `https://sinclairnzenwata.com` |
| Checker (Google Docs add-on) | `https://docs.google.com/document/d/1MJitDY4B4eKFei_fvgcy-C6Vwit8reCLoMXnKSyIZuY/edit` with the note "Open, then choose Accessibility → Open checker" |
| Author (accessible editor) | `/author` |
| Workbench (fix existing files) | `/workbench` |

- FR-1.4 Links live in `apps/author/src/config/links.ts`.
- FR-1.5 Use "About the researcher" for the person card, so it is not confused with the Author tool.

**Acceptance:** All links work on the deployed site; `/author` behaves exactly as the editor does today; axe scan shows zero serious or critical issues.

### FR-2 Extend the DocumentModel (P0)

The model must carry what PPTX and PDF need, without breaking existing adapters.

- FR-2.1 Add optional fields only (existing producers keep compiling):
  - `source?: "gdoc" | "tiptap" | "a11ydoc" | "pptx" | "pdf"`
  - On every node: `location?: { page: number; bbox?: [x, y, w, h] }` (page = slide or page number, 1-based; bbox in points)
  - On every node: `sourceRef?: string` (an opaque pointer the writer uses to find the element again, e.g. slide XML path plus shape id, or a PDF struct element object number)
  - A `slide` or `page` grouping so per-slide rules can run (for example `nodes` of type `section` with `role: "slide"` and an optional `title`)
  - On the document: `flags?: { tagged?: boolean; hasText?: boolean; language?: string }`
- FR-2.2 Every issue returned by `runAccessibilityChecks()` must carry the node's `location` and `sourceRef` through, so the UI can jump to it and the writer can fix it.
- FR-2.3 Keep `parseDocument()` and the `.a11ydoc.json` version 1 format readable.

### FR-3 New rules in core (P0)

Existing rules apply to PPTX and PDF through the model (for example A004 for images, A011 for tables). Add these, following the existing A-code style:

| Code | Severity | Check | Applies to |
| --- | --- | --- | --- |
| A013 | error | Slide has no title | pptx |
| A014 | warning | Two or more slides share the same title | pptx |
| A015 | error | Document language is not set | pdf (pptx P1) |
| A016 | error | PDF is untagged (no structure tree) | pdf |
| A017 | error | PDF pages have no extractable text (likely scanned) | pdf |

- FR-3.1 Each rule declares a `fixable` value: `"auto"`, `"ai-assisted"` or `"manual-only"`, plus plain-language manual instructions.
- FR-3.2 Mapping for existing rules: A001 auto (doc title), A004 ai-assisted (alt description), A011 auto (set header row), A016 and A017 manual-only.
- FR-3.2a **A013 (slide has no title) is `auto`, not `ai-assisted`.** Writing a slide title is the capability this project exists to add: Panorama can only print instructions for it. The Workbench always offers a one-click fix — a first-draft title taken from the slide's own text — and inserts a title placeholder when the slide has none (FR-5.5). "Suggest with AI" improves the wording; a fix never waits on it, and nothing is written without the user pressing Apply.
- FR-3.3 Rules stay pure TypeScript with no runtime dependencies (C-1).

**Acceptance:** unit tests for each new rule; existing rule tests still pass; Checker build still passes.

### FR-4 `packages/formats`: readers (P0)

New workspace package `@accessibility-docs/formats`. Runtime dependencies allowed here: `jszip`, `pdfjs-dist`, `pdf-lib` (and a fast XML parser if needed).

**PPTX reader `pptxToModel(file)`:**
- FR-4.1 Unzip with JSZip, read `ppt/presentation.xml` for slide order, then each `ppt/slides/slideN.xml`.
- FR-4.2 Per slide: title from the placeholder with `type="title"` or `type="ctrTitle"`; text runs; pictures (`p:pic`); tables (`a:tbl`, header row from `a:tblPr firstRow`).
- FR-4.3 Picture alt fields map directly to the existing model: `p:cNvPr@descr` is the alt description (A004). `p:cNvPr@title` is still read into `altTitle` and written back untouched, but nothing checks it any more (see the C-4 amendment). A picture PowerPoint has marked decorative (`adec:decorative`) is exempt from alt text, so it produces no figure node and no A004.
- FR-4.4 Document title from `docProps/core.xml` (`dc:title`).
- FR-4.5 `location.bbox` from shape `a:off` and `a:ext` (EMU, convert to points: 1 pt = 12700 EMU).
- FR-4.5a A non-empty slide title is also emitted as a `heading` node (level 2) beside the section marker's `title`. A slide title is how a deck is navigated, so this is the honest mapping, and without it A009 ("no headings to navigate by") would fire against every deck. Empty titles are not emitted as headings; A013 already reports them.
- FR-4.6 Reject legacy `.ppt` with "Save as .pptx in PowerPoint, then upload again."

**PDF reader `pdfToModel(file)`:**
- FR-4.7 Use pdf.js: document title from metadata, language, `page.getStructTree()` for tagged structure (headings, Figure with alt, Table with TH or TD), `getTextContent()` to detect image-only pages.
- FR-4.7a **Decision (Milestone 6): the structure tree is the document's semantics.** What a page *looks* like is ignored — no font-size or bold heuristics for headings. Assistive technology reads the tree, so the tree is what is checked, and a PDF that only looks structured is reported as untagged, which is the truth a faculty member needs before re-exporting. Text is matched to elements through marked-content ids (`getTextContent({ includeMarkedContent: true })`), which is the only link the format itself defines between words and tags.
- FR-4.7b **Decision (Milestone 6): `FigureNode.src` carries the figure's address, not image bytes.** A PPTX picture is a file in the package (`ppt/media/image1.png`); a PDF figure is a marked region of a page's content stream, so there is nothing to extract. `src` is the same pointer as `sourceRef` (`pdf:figure#page=1&mcid=2`), which keeps A007 ("image is missing a source file") meaningful — it fires when the reader genuinely cannot locate the figure — and gives the writer the address it needs for FR-5.8. A consequence: "Suggest with AI" cannot be offered for a PDF figure, because FR-10.2 sends the image itself. The panel says so and takes a written description instead.
- FR-4.7c An unnumbered `H` element takes its level from how deeply it is nested inside `Sect`, `Part`, `Art` or `Div`, as PDF 1.7 14.8.4.3.1 defines it; `H1` to `H6` are used as given. The first heading on a page becomes that page's section title, which is what the page map and the outline navigate by.
- FR-4.8 Set `flags.tagged` from the presence of a structure tree. Untagged PDFs still produce a model so they rank and show A016. A page with no tagged content of its own produces a section marker and nothing else: no structure is invented for it.

### FR-5 `packages/formats`: writers (P0)

Writers take the original file plus a list of approved fixes and return a new file. **Never modify the original upload.**

**PPTX writer (JSZip, edit XML strings or DOM):**
- FR-5.1 Alt text: set `descr` (and `title` if provided) on the picture's `p:cNvPr`.
- FR-5.2 Empty title: write text into the existing title placeholder's `a:t`.
- FR-5.3 Table header: set `firstRow="1"` on `a:tblPr`.
- FR-5.4 Document title: set `dc:title` in `docProps/core.xml`.
- FR-5.5 **(P0, promoted from P1)** Missing title placeholder: insert a `p:sp` with `p:ph type="title"`. A slide with no title placeholder is the common case in the decks this tool is for, and refusing to fix it would leave the headline capability (FR-3.2a) working only on the easy half. The inserted placeholder is positioned off the visible slide area so the deck looks unchanged, and the user is told that the title is there for assistive technology but not shown on the slide.

**PDF writer (pdf-lib, low-level object access):**
- FR-5.6 Document title: set Info `/Title` and `/ViewerPreferences /DisplayDocTitle true`.
- FR-5.7 Language: set `/Lang` on the catalog.
- FR-5.8 Alt text: set `/Alt` on the target Figure structure element (found via `sourceRef`).
- FR-5.9 (P1) Table headers: change header row elements from `/TD` to `/TH`.
- FR-5.10 Untagged or scanned PDFs are not fixed. Show: "This PDF needs full tagging (or OCR). Re-export from the source file with accessibility tags on, or use Adobe Acrobat's Autotag."
- FR-5.10a **Decision (Milestone 6): FR-5.10 applies to structure, not to document properties.** `/Title` (FR-5.6) and `/Lang` (FR-5.7) are catalog and Info entries that exist in every PDF, tagged or not, and both are real improvements a screen reader acts on immediately — so they are still written for an untagged file. A016 stays in the report afterwards: nothing here claims the file is now tagged. Alt text (FR-5.8) needs a structure element to live on, so on an untagged file it is refused with the FR-5.10 message rather than written somewhere that changes nothing.
- FR-5.11 A figure is found the way the format defines the link: the page's `/StructParents` is a key into the structure tree's parent tree, and the figure's marked-content id indexes that key's array. Where a figure has no marked content of its own, the reader falls back to counting figures on the page (`pdf:figure#page=1&ordinal=2`) and the writer counts the same way. The writer refuses to write `/Alt` onto an element that is not tagged `/Figure`.

**Acceptance:** each writer test re-reads its output with the matching reader and confirms the issue is gone; fixed PPTX opens in PowerPoint with no repair prompt; fixed PDF passes that specific check in Acrobat.

### FR-6 Workbench: upload (P0)

- FR-6.1 Multi-file picker for `.pptx` and `.pdf`. Max 50 MB per file, 30 files per batch (config). Both formats are read in the browser; which reader runs comes from the file's signature, not its extension (FR-6.2), so a renamed file is still read, checked and downloaded as what it actually is.
- FR-6.2 Validate by file signature (ZIP for PPTX, `%PDF` for PDF), not only extension.
- FR-6.3 Per-file status: reading, checking, ready, failed (with reason).
- FR-6.4 Parse in a Web Worker so large files do not freeze the page.
- FR-6.5 Files stay in browser memory for the session. "Clear all" removes them. Nothing is persisted.
- FR-6.6 Banner: "Files are processed on your device. Do not upload files containing student information."

### FR-7 Workbench: ranking (P0)

- FR-7.1 Priority score per file:
  - `issueScore = 10 x errors + 3 x warnings`
  - `blockerBonus = +50` if A016 (untagged) or A017 (scanned) is present
  - `priority = issueScore + blockerBonus`
- FR-7.2 List sorted by priority, showing name, type, slide or page count, error and warning counts, and a "Start here" badge on the top file.
- FR-7.3 (P1) Effort estimate: counts of auto, ai-assisted and manual-only issues.
- FR-7.4 Weights in config; a "How is this ranked?" disclosure explains the formula.
- FR-7.5 The scoring itself lives in `packages/core/src/ranking.ts`: it is pure arithmetic over an `AccessibilityReport` with no runtime dependencies (C-1 safe), and keeping it beside the rule catalog stops the weights drifting from the severities they weigh. `apps/author/src/config/workbench.ts` holds the upload limits and re-exports the weights, so there is still one place to change them.

**Acceptance:** fixtures with known counts produce a deterministic order matching the formula.

### FR-8 Workbench: viewer and issue sidebar (P0)

- FR-8.1 Selecting a file opens a two-pane view: document (main) and issue sidebar.
- FR-8.2 PDF: render with pdf.js (or `react-pdf`). The viewer is format-agnostic: it works from the outline (`buildOutline`), which groups a model by `section` marker whether those sections are slides or pages, so a PDF opens in the same two-pane view with its pages, headings, figures, alt text and tables, and its page map.
- FR-8.2a **Decision (Milestone 6): page rasterisation is deferred, not cut.** A PDF shows the same structure view a deck does, for the reason FR-8.3a gives: it shows exactly what the rules see, in real HTML on a page that must itself meet WCAG 2.2 AA. Drawing each page to a canvas beside it is the remaining piece of FR-8.2 and is worth having for "is this the figure I think it is?", which the structure view cannot answer — a PDF figure has no image file to preview (FR-4.7b). It needs a canvas render path and a decision about memory for a 200-page file, so it is listed as remaining work rather than claimed.
- FR-8.3 PPTX: render slides in the browser. Evaluate a client-side PPTX renderer (for example `pptx-preview`) first. If fidelity is poor, use a **structure view** fallback: one card per slide showing its title, text, images (extracted from the zip) and tables. The structure view is acceptable for the demo.
- FR-8.3a **Decision (Milestone 4): structure view.** `pptx-preview` is maintained but pulls in `echarts` and `lodash`, and renders a deck as absolutely-positioned `div`s with no semantics — output that would have to be hidden from assistive technology, with the structure rebuilt beside it anyway, on a page that must itself meet WCAG 2.2 AA (NFR-1). The structure view shows exactly what the rules see, in real HTML: headings for slide titles, `img` plus its alt text, and tables with real `th` cells. Revisit only if open question 3 is answered by testing a renderer against three real decks.
- FR-8.3b Images are extracted on demand, one file at a time (`extractPptxMedia`), rather than at upload: a batch of 30 decks is read and ranked up front, and only the file on screen needs its pictures in memory. The uploaded `File` handle is kept so the deck can be re-read without holding every upload's bytes.
- FR-8.4 Thumbnails for navigation. With the structure view there is no rendered slide image to thumbnail, so the navigation rail is a **slide map**: slide number, title (or "No title") and its finding count, which is the information a person triaging a deck actually navigates by.
- FR-8.5 Sidebar lists issues grouped by slide or page with severity, message and status (open, fixed, skipped).
- FR-8.6 Clicking an issue scrolls to its slide or page. (P1: draw a highlight box from `location.bbox`.)
- FR-8.7 Keyboard: arrow keys move between issues, Enter opens the fix panel, visible focus at all times. Selecting an issue scrolls its slide into view but leaves focus in the issue list, otherwise the next arrow press has nowhere to go; the opened issue carries an explicit "Go to slide N" button for readers who want to land on the slide.
- FR-8.8 Live counter "12 of 31 issues fixed," announced through an ARIA live region. Until the writers land (FR-5), the count of fixed issues is honestly 0; issues can be marked skipped, and the counter reports that too.

### FR-9 Workbench: fix panel and AI (P0)

**Images (A004):**
- FR-9.1 Show the image, an input for the alt description, and "Suggest with AI." (The alt title input goes with the withdrawn A003; the field stays in the model but the panel no longer asks for it.)
- FR-9.2 Optional **teaching goal** field: "What is this slide teaching?" sent with the request.
- FR-9.3 **Assessment mode** toggle: tells the AI not to reveal answers on quiz images, and shows a reminder to check.

**Slide titles (A013):**
- FR-9.4 The panel proposes a title from the slide's own text with no AI call, so a fix is always one click away (FR-3.2a). "Suggest with AI" replaces that draft with a better one. User edits, then applies.

**Tables (A011):**
- FR-9.5 One-click "Set first row as header" (no AI needed). (P1: AI suggests which row is the header.)

**All fixes:**
- FR-9.6 Buttons: Apply, Skip, Undo (session only). Every write needs a click. Undo steps back through the last 10 Applies for a file; each step holds a whole deck in memory, so the depth is capped.
- FR-9.7 After Apply, re-run the reader and checks on the working copy and update the score.
- FR-9.8 Manual-only issues show the rule's instructions instead of a fix button.
- FR-9.9 Every AI result is labeled "AI suggestion, review before applying."

**Acceptance:** for a slide image with no alt text, the user requests a suggestion, edits it, applies it, downloads the deck, and sees the alt text in PowerPoint's Alt Text pane.

### FR-10 AI endpoint (P0)

- FR-10.1 `POST /api/suggest` in `apps/worker/src/index.ts` calls the Gemini REST API with `fetch`. The API key is a Worker secret (`wrangler secret put GEMINI_API_KEY`), never in the browser bundle or `wrangler.jsonc`. For local dev use `apps/worker/.dev.vars`, which must be in `.gitignore`.
- FR-10.2 Request body: `kind` (`alt-text`, `title`, `table-header`), the single image (base64, max 5 MB) or table text, slide or page title, nearby text, optional teaching goal, assessment mode flag.
- FR-10.3 Response: validated JSON — `{ altDescription, decorative, rationale, promptVersion }` or `{ title, rationale, promptVersion }`. (No `altTitle`: see the C-4 amendment.) On invalid JSON retry once, then return an error. A decorative image may come back with an empty description; anything else empty is treated as a failed suggestion rather than an answer.
- FR-10.4 Prompts live in `apps/worker/src/prompts/` as versioned files, imported at build time (Workers have no file system at runtime).
- FR-10.5 Alt text prompt: describe purpose in context, no "image of," under 150 characters for the description unless the image is a complex chart, flag decorative images, never reveal answers in assessment mode.
- FR-10.6 Title prompt: under 60 characters, reflects the slide's main point, never generic ("Slide 4", "Introduction").
- FR-10.7 Basic abuse protection: reject request bodies over 6 MB, rate limit per IP with the Workers Rate Limiting binding (for example 20 requests per minute), accept only same-origin requests (check `Origin`), no logging of image data or document text.
- FR-10.8 Wrap the call behind a provider interface so a local model can replace Gemini later.

### FR-11 Export (P0)

- FR-11.1 Download the fixed file named `<original>-accessible.pptx` or `.pdf`. **Built with Milestone 5**, because FR-9's own acceptance ends with the user downloading the deck and seeing the fix in PowerPoint; a writer that cannot be opened in PowerPoint is not demonstrably finished.
- FR-11.2 (P1) Before and after report (HTML): priority score, errors and warnings before vs. after, fixes applied, remaining manual items.

### FR-12 Google Slides (P2)

Read a deck via the Slides API (OAuth), convert to `DocumentModel`, apply alt text (`updatePageElementAltText`) and title fixes. Not part of the demo.

### FR-13 Deployment on Cloudflare (P0)

One Worker serves both the React app and the API, so everything is same-origin (no CORS).

- FR-13.1 New workspace `apps/worker` with `wrangler.jsonc`:
  - `assets.directory` points at the built React app (`apps/author/dist`).
  - `assets.not_found_handling: "single-page-application"` so `/author` and `/workbench` load on refresh.
  - `assets.run_worker_first` limited to `/api/*`, so static files are served without invoking the Worker code.
  - A rate limiting binding for `/api/suggest` (FR-10.7).
- FR-13.2 Worker code handles only `/api/*`. Anything else falls through to static assets.
- FR-13.3 Scripts in the root `package.json`:
  - `npm run dev:workbench` builds the React app and runs `wrangler dev` (app and API on one local URL).
  - `npm run deploy` builds the React app and runs `wrangler deploy`.
- FR-13.4 Secrets: `GEMINI_API_KEY` set with `wrangler secret put`. Local values in `.dev.vars` (gitignored). Never commit keys.
- FR-13.5 Set security headers on responses: `Content-Security-Policy` (allow self, plus blob and data URLs for rendered images and pdf.js workers), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- FR-13.6 The current site at `a11yeditor.netlify.app` stays up until the Cloudflare deployment is verified, then points users to the new URL (or is retired). The README's "Try the tools" links are updated to the new URL.
- FR-13.7 Confirm the exact `wrangler.jsonc` keys against current Cloudflare Workers static assets documentation before writing config; do not guess option names.

**Acceptance:** after `npm run deploy`, `/`, `/author` and `/workbench` load directly and on refresh; `/api/suggest` returns a suggestion; the Gemini key does not appear in any client bundle (search the built files).

---

## 6. Non-functional requirements

- NFR-1 Workbench and hub meet WCAG 2.2 AA; axe scan with zero serious or critical issues.
- NFR-2 Reading and checking a 30-slide deck or 20-page PDF takes under 15 seconds on a laptop.
- NFR-3 AI suggestions return in under 10 seconds, with a loading state and retry.
- NFR-4 TypeScript strict mode in all new code; ESLint passes.
- NFR-5 No secrets in the repo or the client bundle.
- NFR-6 The existing limitations listed in the README for the Author tool (save creates a new file, no cloud copy, no PDF or Word export) are out of scope for this work.

---

## 7. Testing

- T-1 Fixtures in `packages/formats/fixtures/<ruleCode>/fail/` and `/pass/` for every rule that applies to PPTX or PDF. Rules that no PowerPoint file can produce through the reader (A005, A006, A010, A012) and those that need a damaged package (A007) get their fixtures with the writer round-trip tests instead; `packages/formats/fixtures/README.md` lists each gap and why. The fixtures are real PowerPoint packages, generated by `fixtures/generate.py` (python-pptx) and committed.
- T-2 Reader tests: fixture → expected `DocumentModel` shape and issue codes.
- T-3 Writer round-trip tests: fixture → apply fix → read again → issue gone.
- T-4 Ranking test with known counts.
- T-5 Mock the `/api/suggest` endpoint in tests. Never call Gemini in automated tests.
- T-6 Regression: Checker `npm run build` passes; existing core tests pass.

Add a test runner (Vitest) to `packages/core` and `packages/formats` if none exists.

---

## 8. Milestones to November 30

| Dates | Milestone |
| --- | --- |
| Nov 17 to 18 | Routing, hub page, editor moved to `/author`, first Cloudflare Worker deploy (FR-1, FR-13) |
| Nov 19 to 20 | Model extensions and new rules in core (FR-2, FR-3); Checker build still passes |
| Nov 21 to 22 | `packages/formats` PPTX reader; upload and ranking UI (FR-4, FR-6, FR-7) |
| Nov 23 to 24 | Viewer and sidebar, PPTX structure view or renderer (FR-8) |
| Nov 25 to 26 | PPTX writer, fix panel, AI endpoint (FR-5, FR-9, FR-10) |
| Nov 27 | PDF reader and PDF title, language and alt text writer — **done 17 November 2026** (FR-4.7, FR-4.8, FR-5.6 to FR-5.11; remaining: FR-8.2a page rasterisation, FR-5.9 PDF table headers) |
| Nov 28 | Export, accessibility pass on the new pages |
| Nov 29 | Rehearse with real files; bug fixes only |
| Nov 30 | Tech Talk |

If behind schedule, cut in this order: PDF writer (keep PDF checking and ranking), highlight boxes, effort estimate, before and after report. Never cut: hub, upload, ranking, PPTX alt text and title fixes, export.

---

## 9. Demo script (about 5 minutes)

1. Hub page: the research question, then the three tools sharing one rules engine.
2. Briefly show the Checker in Google Docs and the Author editor blocking a save.
3. Workbench: upload 6 to 8 real course files (with permission). Show the ranked list and "Start here."
4. Open the top PowerPoint. Jump through issues in the sidebar.
5. Fix a missing slide title with an AI suggestion, edited to show human review.
6. Fix an image's alt text using the teaching goal. Mention assessment mode.
7. Set a table header in one click.
8. Download, open in PowerPoint, show the fixes are really in the file.
9. Close: Panorama shows manual steps; this fixes the file. Next: Canvas integration and the spring faculty study.

---

## 10. Out of scope (do not build now)

- Canvas LTI integration (needs Ball State admin approval and a sandbox).
- Tagging untagged PDFs, OCR of scanned PDFs.
- Reading order, color contrast, math accessibility.
- User accounts or server-side storage.
- Word (.docx) files.
- Changes to the Checker beyond keeping its build green.

---

## 11. Open questions

1. **Gemini access:** Ball State approving Gemini in Google Workspace may not cover API use with course files. Confirm with Ball State IT which access is approved (API key or Vertex AI under a Ball State project) and whether course images may be sent to it. Until confirmed, demo only with files you own or have permission to use.
2. **Model shape:** confirm how slides and pages are best represented in the current `DocumentModel` node types (new `section` node vs. a `page` field only). Read `packages/core` before deciding.
3. **PPTX rendering:** test a browser renderer against 3 real decks before committing; fall back to structure view if needed.
4. **Hosting:** Cloudflare Workers is the target. For the talk, also have `npm run dev:workbench` working locally as a backup in case the network fails.
5. **Demo files:** which real decks and PDFs can be used, and with whose permission.
