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
| Fixes (PPTX) | Alt text, empty title, table header row, document title | Add missing title placeholder | Reading order, decorative flag |
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

Existing rules apply to PPTX and PDF through the model (for example A003 and A004 for images, A011 for tables). Add these, following the existing A-code style:

| Code | Severity | Check | Applies to |
| --- | --- | --- | --- |
| A013 | error | Slide has no title | pptx |
| A014 | warning | Two or more slides share the same title | pptx |
| A015 | error | Document language is not set | pdf (pptx P1) |
| A016 | error | PDF is untagged (no structure tree) | pdf |
| A017 | error | PDF pages have no extractable text (likely scanned) | pdf |

- FR-3.1 Each rule declares a `fixable` value: `"auto"`, `"ai-assisted"` or `"manual-only"`, plus plain-language manual instructions.
- FR-3.2 Mapping for existing rules: A001 auto (doc title), A003 and A004 ai-assisted (alt title and description), A011 auto (set header row), A013 ai-assisted, A016 and A017 manual-only.
- FR-3.3 Rules stay pure TypeScript with no runtime dependencies (C-1).

**Acceptance:** unit tests for each new rule; existing rule tests still pass; Checker build still passes.

### FR-4 `packages/formats`: readers (P0)

New workspace package `@accessibility-docs/formats`. Runtime dependencies allowed here: `jszip`, `pdfjs-dist`, `pdf-lib` (and a fast XML parser if needed).

**PPTX reader `pptxToModel(file)`:**
- FR-4.1 Unzip with JSZip, read `ppt/presentation.xml` for slide order, then each `ppt/slides/slideN.xml`.
- FR-4.2 Per slide: title from the placeholder with `type="title"` or `type="ctrTitle"`; text runs; pictures (`p:pic`); tables (`a:tbl`, header row from `a:tblPr firstRow`).
- FR-4.3 Picture alt fields map directly to the existing model: `p:cNvPr@title` is the alt title (A003) and `p:cNvPr@descr` is the alt description (A004).
- FR-4.4 Document title from `docProps/core.xml` (`dc:title`).
- FR-4.5 `location.bbox` from shape `a:off` and `a:ext` (EMU, convert to points: 1 pt = 12700 EMU).
- FR-4.6 Reject legacy `.ppt` with "Save as .pptx in PowerPoint, then upload again."

**PDF reader `pdfToModel(file)`:**
- FR-4.7 Use pdf.js: document title from metadata, language, `page.getStructTree()` for tagged structure (headings, Figure with alt, Table with TH or TD), `getTextContent()` to detect image-only pages.
- FR-4.8 Set `flags.tagged` from the presence of a structure tree. Untagged PDFs still produce a model so they rank and show A016.

### FR-5 `packages/formats`: writers (P0)

Writers take the original file plus a list of approved fixes and return a new file. **Never modify the original upload.**

**PPTX writer (JSZip, edit XML strings or DOM):**
- FR-5.1 Alt text: set `descr` (and `title` if provided) on the picture's `p:cNvPr`.
- FR-5.2 Empty title: write text into the existing title placeholder's `a:t`.
- FR-5.3 Table header: set `firstRow="1"` on `a:tblPr`.
- FR-5.4 Document title: set `dc:title` in `docProps/core.xml`.
- FR-5.5 (P1) Missing title placeholder: insert a `p:sp` with `p:ph type="title"`. If it would change the visual layout, place it off-slide and tell the user.

**PDF writer (pdf-lib, low-level object access):**
- FR-5.6 Document title: set Info `/Title` and `/ViewerPreferences /DisplayDocTitle true`.
- FR-5.7 Language: set `/Lang` on the catalog.
- FR-5.8 Alt text: set `/Alt` on the target Figure structure element (found via `sourceRef`).
- FR-5.9 (P1) Table headers: change header row elements from `/TD` to `/TH`.
- FR-5.10 Untagged or scanned PDFs are not fixed. Show: "This PDF needs full tagging (or OCR). Re-export from the source file with accessibility tags on, or use Adobe Acrobat's Autotag."

**Acceptance:** each writer test re-reads its output with the matching reader and confirms the issue is gone; fixed PPTX opens in PowerPoint with no repair prompt; fixed PDF passes that specific check in Acrobat.

### FR-6 Workbench: upload (P0)

- FR-6.1 Multi-file picker for `.pptx` and `.pdf`. Max 50 MB per file, 30 files per batch (config).
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

**Acceptance:** fixtures with known counts produce a deterministic order matching the formula.

### FR-8 Workbench: viewer and issue sidebar (P0)

- FR-8.1 Selecting a file opens a two-pane view: document (main) and issue sidebar.
- FR-8.2 PDF: render with pdf.js (or `react-pdf`).
- FR-8.3 PPTX: render slides in the browser. Evaluate a client-side PPTX renderer (for example `pptx-preview`) first. If fidelity is poor, use a **structure view** fallback: one card per slide showing its title, text, images (extracted from the zip) and tables. The structure view is acceptable for the demo.
- FR-8.4 Thumbnails for navigation.
- FR-8.5 Sidebar lists issues grouped by slide or page with severity, message and status (open, fixed, skipped).
- FR-8.6 Clicking an issue scrolls to its slide or page. (P1: draw a highlight box from `location.bbox`.)
- FR-8.7 Keyboard: arrow keys move between issues, Enter opens the fix panel, visible focus at all times.
- FR-8.8 Live counter "12 of 31 issues fixed," announced through an ARIA live region.

### FR-9 Workbench: fix panel and AI (P0)

**Images (A003, A004):**
- FR-9.1 Show the image, inputs for alt title and alt description (matching the existing figure node fields), and "Suggest with AI."
- FR-9.2 Optional **teaching goal** field: "What is this slide teaching?" sent with the request.
- FR-9.3 **Assessment mode** toggle: tells the AI not to reveal answers on quiz images, and shows a reminder to check.

**Slide titles (A013):**
- FR-9.4 "Suggest with AI" proposes a title from the slide's text. User edits, then applies.

**Tables (A011):**
- FR-9.5 One-click "Set first row as header" (no AI needed). (P1: AI suggests which row is the header.)

**All fixes:**
- FR-9.6 Buttons: Apply, Skip, Undo (session only). Every write needs a click.
- FR-9.7 After Apply, re-run the reader and checks on the working copy and update the score.
- FR-9.8 Manual-only issues show the rule's instructions instead of a fix button.
- FR-9.9 Every AI result is labeled "AI suggestion, review before applying."

**Acceptance:** for a slide image with no alt text, the user requests a suggestion, edits it, applies it, downloads the deck, and sees the alt text in PowerPoint's Alt Text pane.

### FR-10 AI endpoint (P0)

- FR-10.1 `POST /api/suggest` in `apps/worker/src/index.ts` calls the Gemini REST API with `fetch`. The API key is a Worker secret (`wrangler secret put GEMINI_API_KEY`), never in the browser bundle or `wrangler.jsonc`. For local dev use `apps/worker/.dev.vars`, which must be in `.gitignore`.
- FR-10.2 Request body: `kind` (`alt-text`, `title`, `table-header`), the single image (base64, max 5 MB) or table text, slide or page title, nearby text, optional teaching goal, assessment mode flag.
- FR-10.3 Response: validated JSON, e.g. `{ altTitle, altDescription, decorative, rationale }` or `{ title }`. On invalid JSON retry once, then return an error.
- FR-10.4 Prompts live in `apps/worker/src/prompts/` as versioned files, imported at build time (Workers have no file system at runtime).
- FR-10.5 Alt text prompt: describe purpose in context, no "image of," under 150 characters for the description unless the image is a complex chart, flag decorative images, never reveal answers in assessment mode.
- FR-10.6 Title prompt: under 60 characters, reflects the slide's main point, never generic ("Slide 4", "Introduction").
- FR-10.7 Basic abuse protection: reject request bodies over 6 MB, rate limit per IP with the Workers Rate Limiting binding (for example 20 requests per minute), accept only same-origin requests (check `Origin`), no logging of image data or document text.
- FR-10.8 Wrap the call behind a provider interface so a local model can replace Gemini later.

### FR-11 Export (P0)

- FR-11.1 Download the fixed file named `<original>-accessible.pptx` or `.pdf`.
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

- T-1 Fixtures in `packages/formats/fixtures/<ruleCode>/fail/` and `/pass/` for every rule that applies to PPTX or PDF.
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
| Nov 27 | PDF reader and PDF title, language and alt text writer |
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
