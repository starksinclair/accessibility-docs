# WCAG 2.2 PDF Accessibility Techniques

Source: [All WCAG 2.2 Techniques — PDF Techniques](https://www.w3.org/WAI/WCAG22/Techniques/?#pdf)

**Important (W3C recommendation):** Techniques are **examples** of ways to meet WCAG. They are **not required**. Content can satisfy WCAG even if it does not use these documented techniques. Failure techniques show how content can fail; content may still pass if equivalent accessible alternatives are provided.

This document lists all **23 PDF techniques (PDF1–PDF23)**, numbered in W3C order, with a short description, related success criteria, and practical recommendations drawn from each technique page.

---

## Cross-cutting recommendations from the PDF techniques

1. Prefer creating accessibility in the **authoring tool** (Word, LibreOffice/OpenOffice, TipTap IR, etc.) **before** conversion to PDF.
2. Always produce **tagged PDF** (`StructTreeRoot` / structure tags), not an untagged visual-only PDF.
3. Prefer **real text** over scanned images of text; run OCR and repair tags when only a scan is available.
4. Keep **visual order**, **tag/reading order**, and **keyboard tab order** aligned.
5. Use standard structure types (`H1`–`H6`, `P`, `Figure`, `Table`/`TR`/`TH`/`TD`, `L`/`LI`, `Link`, artifacts).
6. Provide programmatically associated names for non-text and interactive content (`/Alt`, tooltips `/TU`, link text).
7. Set document **language** (`/Lang`) and **title** (`/Title`), and show the title in the viewer when possible.
8. Mark decorative content as **`/Artifact`** so assistive technology can ignore it.
9. After conversion, **verify** with a screen reader, accessibility checker, and/or accessibility API inspection.

---

## 1. PDF1 — Applying text alternatives to images with the Alt entry

- **URL:** [PDF1](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF1)
- **Relates to:** 1.1.1 Non-text Content (Sufficient)
- **Applies to:** Tagged PDF documents with images

**Guideline:** Provide text alternatives for images (and similar non-text items) via an `/Alt` entry on the enclosing structure tag (typically `/Figure`).

**Recommendations:**
- Put meaningful alt text on informative images; include important words that appear in the image when they matter for meaning.
- Alt text should convey the **same meaning** as the image, not necessarily a visual description of every detail.
- If a non-standard tag name is used for figures, map it to `Figure` in the document `RoleMap`.
- Author alt text in Word/OpenOffice (or your editor) so conversion carries it into PDF when possible.

---

## 2. PDF2 — Creating bookmarks in PDF documents

- **URL:** [PDF2](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF2)
- **Relates to:** 2.4.5 Multiple Ways (Advisory)
- **Applies to:** Tagged PDF documents

**Guideline:** Provide bookmarks (outline entries) so users can locate content in long or highly subdivided documents.

**Recommendations:**
- Generate bookmarks from a properly styled heading hierarchy / table of contents.
- Include glossary and index sections under headings so they appear in bookmarks.
- For long documents, consider configuring the PDF to **show bookmarks by default** when opened.
- After conversion, you can create bookmarks from structure in Acrobat if needed.

---

## 3. PDF3 — Ensuring correct tab and reading order in PDF documents

- **URL:** [PDF3](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF3)
- **Relates to:** 1.3.2 Meaningful Sequence; 2.1.1 Keyboard; 2.4.3 Focus Order
- **Applies to:** Tagged PDF documents

**Guideline:** Ensure reading order and keyboard tab order match the logical meaning of the content.

**Recommendations:**
- Structure multi-column layouts correctly in the authoring tool before conversion.
- Prefer tab order based on **document structure** for tagged PDFs.
- Repair tag order (drag/cut-paste tags) when complex layouts convert incorrectly.
- Ensure form fields are present in the tag tree and appear in the correct place relative to surrounding content (not dumped at the end).

---

## 4. PDF4 — Hiding decorative images with the Artifact tag

- **URL:** [PDF4](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF4)
- **Relates to:** 1.1.1 Non-text Content (Sufficient)
- **Applies to:** Tagged PDF documents

**Guideline:** Mark purely decorative images/graphics so assistive technology can ignore them, using `/Artifact`.

**Recommendations:**
- Use Artifact for decorative images, separators, and similar non-content markings.
- Prefer artifacts with a property list (including bounding box) to support reflow.
- Do **not** artifact informative images; those need `/Alt` (PDF1).

---

## 5. PDF5 — Indicating required form controls in PDF forms

- **URL:** [PDF5](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF5)
- **Relates to:** 3.3.1 Error Identification; 3.3.2 Labels or Instructions (with G131)
- **Applies to:** Tagged PDF documents with forms

**Guideline:** Mark required fields (e.g., `/Ff` required flag) and notify users when required fields are incomplete.

**Recommendations:**
- Indicate required status in the visible label (e.g., “Date (required)” or “*” with a legend).
- Provide a clear text alert when submission fails validation.
- After dismissing an alert, consider moving focus to the field in error when that behavior is expected.
- Also expose the required state through the accessibility API.

---

## 6. PDF6 — Using table elements for table markup in PDF documents

- **URL:** [PDF6](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF6)
- **Relates to:** 1.3.1 Info and Relationships
- **Applies to:** Tagged PDF documents with tables

**Guideline:** Mark tables with `Table`, `TR`, `TH`, and `TD` so row/column relationships are programmatically available.

**Recommendations:**
- Mark header rows/columns in the authoring tool before conversion.
- Use `RowSpan` / `ColSpan` for spanning cells.
- Add empty `TD` cells when needed so rows/columns stay rectangular.
- After conversion, inspect and repair mistagged headers (`TD` that should be `TH`).

---

## 7. PDF7 — Performing OCR on a scanned PDF document to provide actual text

- **URL:** [PDF7](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF7)
- **Relates to:** 1.4.5 Images of Text; 1.4.9 Images of Text (No Exception)
- **Applies to:** Scanned PDF documents

**Guideline:** Convert scanned images of text into actual selectable/searchable text via OCR, then tag for accessibility.

**Recommendations:**
- Prefer authoring real text and exporting tagged PDF whenever the source is available.
- After OCR, correct “OCR suspects,” add tags, hide decorative artifacts, and run an accessibility check.
- Verify reading order after OCR; it often needs repair.

---

## 8. PDF8 — Providing definitions for abbreviations via an E entry

- **URL:** [PDF8](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF8)
- **Relates to:** 3.1.4 Abbreviations (with G102)
- **Applies to:** Tagged PDF documents containing abbreviations/acronyms

**Guideline:** Provide expansion/definition text for abbreviations using an `/E` entry on a structure element (often a `Span`).

**Recommendations:**
- On first occurrence, provide **both** the abbreviation and its expansion.
- Use `/E` on `Span`, `TH`, or other structure elements as appropriate.
- Expansions help users who decode slowly, use magnification, or have limited working memory.

---

## 9. PDF9 — Providing headings by marking content with heading tags

- **URL:** [PDF9](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF9)
- **Relates to:** 1.3.1 Info and Relationships; 2.4.1 Bypass Blocks
- **Applies to:** Tagged PDF documents with headings

**Guideline:** Mark headings with `H` / `H1`–`H6` in the structure tree so users can navigate by heading.

**Recommendations:**
- Use real heading styles in the authoring tool; keep levels logical (H2 after H1, etc.).
- Use headings to mark main content start, section starts, and major navigation regions.
- Repair incorrect heading levels after conversion when needed.
- Role-map custom heading names to standard heading types when tools use nonstandard tags.

---

## 10. PDF10 — Providing labels for interactive form controls

- **URL:** [PDF10](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF10)
- **Relates to:** 1.3.1 Info and Relationships; 3.3.2 Labels or Instructions; 4.1.2 Name, Role, Value
- **Applies to:** Tagged PDF with interactive forms

**Guideline:** Ensure every form control has a programmatically associated label that conveys its purpose.

**Recommendations:**
- Visible labels alone after conversion may not be associated; add a **tooltip (`/TU`)** as the accessible name.
- Keep tooltip/name consistent with the visible label text (Label in Name).
- Include format instructions in the label/tooltip when needed (e.g., date format).

---

## 11. PDF11 — Providing links and link text using Link annotation and /Link structure

- **URL:** [PDF11](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF11)
- **Relates to:** 1.3.1 Info and Relationships; 2.1.1 Keyboard; 2.4.4 Link Purpose (In Context); 2.4.9 Link Purpose (Link Only)
- **Applies to:** PDF documents that contain links

**Guideline:** Represent links with a `Link` structure element plus Link annotation so link text is available to keyboard and AT users.

**Recommendations:**
- Create links in the authoring tool before conversion when possible.
- Ensure link text (or surrounding context) clearly describes purpose; Acrobat tooltips alone are not reliable for screen readers.
- Verify links are keyboard-activatable (Tab + Enter).
- Follow general techniques G53 / G91 for clear link purpose.

---

## 12. PDF12 — Providing name, role, value information for form fields

- **URL:** [PDF12](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF12)
- **Relates to:** 1.3.1 Info and Relationships; 4.1.2 Name, Role, Value
- **Applies to:** Tagged PDF documents with interactive form fields

**Guideline:** Expose name, role, value/state for all form controls (text, checkbox, radio, combo, list, button, signature).

**Recommendations:**
- Use `/FT` for role, `/TU` (tooltip) for name, `/V`/`/DV` for value/default, and field flags for states (required, read-only, checked, etc.).
- For push buttons, use the caption (`/CA`) as the accessible name.
- In Acrobat, do **not** confuse the Properties “Name” field (`/T`) with the accessible name; use **Tooltip** (`/TU`).
- Ensure tooltip contains the visible label text for Label in Name.

---

## 13. PDF13 — Providing replacement text using the /Alt entry for links

- **URL:** [PDF13](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF13)
- **Relates to:** 2.4.4 Link Purpose (In Context); 2.4.9 Link Purpose (Link Only)
- **Applies to:** Tagged PDF documents that contain links

**Guideline:** When visible link text is inadequate (e.g., a raw URL), provide replacement link text via `/Alt` on the `Link` tag.

**Recommendations:**
- Prefer clear visible link text at authoring time; use `/Alt` when editing PDF afterward.
- When `/Alt` is present, screen readers use it instead of the visible link text objects.
- Ensure alternate link text still makes sense with surrounding content.

---

## 14. PDF14 — Providing running headers and footers in PDF documents

- **URL:** [PDF14](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF14)
- **Relates to:** 2.4.8 Location (Advisory); 3.2.3 Consistent Navigation (Advisory)
- **Applies to:** Tagged PDF documents

**Guideline:** Provide consistent running headers/footers (as pagination artifacts) to help users orient themselves.

**Recommendations:**
- Include useful location info: document title, chapter/section, page numbers (“Page 9 of 15”), author/date as appropriate.
- Create headers/footers in the authoring tool so they convert as pagination artifacts.
- Keep header/footer content consistent with in-document section titles.

---

## 15. PDF15 — Providing submit buttons with the submit-form action

- **URL:** [PDF15](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF15)
- **Relates to:** 3.2.2 On Input (with G80)
- **Applies to:** Tagged PDF documents with forms

**Guideline:** Provide an explicit submit control that uses the submit-form action so users request context changes deliberately.

**Recommendations:**
- Use a clearly labeled submit button rather than submitting on every field change.
- Prefer keyboard-accessible triggers such as Mouse Up (also works with keyboard activation patterns).
- Provide a tooltip/name for the button.

---

## 16. PDF16 — Setting the default language using the /Lang entry in the document catalog

- **URL:** [PDF16](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF16)
- **Relates to:** 3.1.1 Language of Page (Sufficient)
- **Applies to:** Tagged PDF documents

**Guideline:** Set the document default language with `/Lang` in the document catalog.

**Recommendations:**
- Always set a document language (e.g., `en`, `en-US`).
- If a language is missing from tool presets, use the ISO 639 code.
- Correct language improves pronunciation, script display, and captions.

---

## 17. PDF17 — Specifying consistent page numbering for PDF documents

- **URL:** [PDF17](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF17)
- **Relates to:** 1.3.1 Info and Relationships; 2.4.8 Location (Advisory); 3.2.3 Consistent Navigation (Advisory)
- **Applies to:** Tagged PDF documents

**Guideline:** Make viewer page controls match the document’s printed/logical page numbering via `/PageLabels`.

**Recommendations:**
- Reflect front matter (i, ii, iii), body (1, 2, 3), and appendix schemes (A-1) in `/PageLabels`.
- After conversion from Word/etc., repair page labels in Acrobat if the viewer numbering does not match the page content.
- Consistency helps keyboard, screen-reader, and low-vision users navigate predictably.

---

## 18. PDF18 — Specifying the document title using the Title entry

- **URL:** [PDF18](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF18)
- **Relates to:** 2.4.2 Page Titled (with G88)
- **Applies to:** Tagged PDF documents

**Guideline:** Provide a descriptive document title in the document information dictionary (`/Title`).

**Recommendations:**
- Set a human-meaningful title (not just a filename).
- Set viewer preferences so the **document title is displayed** (e.g., DisplayDocTitle / “Document Title” in Initial View).
- Titles help users identify the document in window titles, tabs, and AT announcements.

---

## 19. PDF19 — Specifying the language for a passage or phrase with the Lang entry

- **URL:** [PDF19](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF19)
- **Relates to:** 3.1.1 Language of Page; 3.1.2 Language of Parts
- **Applies to:** Tagged PDF documents

**Guideline:** Mark passages/phrases/words in a different language with `/Lang` on a tag or marked-content span.

**Recommendations:**
- Set document default language (PDF16), then override only the differing parts.
- When tagging a phrase in Acrobat, keep the split content tags in correct reading order at the same hierarchy level.
- Use language codes (including regional variants like `es-MX`) as needed.

---

## 20. PDF20 — Using Adobe Acrobat Pro’s Table Editor to repair mistagged tables

- **URL:** [PDF20](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF20)
- **Relates to:** 1.3.1 Info and Relationships
- **Applies to:** Tagged PDF documents with tables

**Guideline:** Repair incorrectly merged/split/mistagged table cells after conversion so logical row/column relationships remain clear.

**Recommendations:**
- Inspect converted tables even if the source table looked correct.
- Change data cells to header cells where needed; fix row/column spans.
- Verify with a screen reader configured **not** to guess table headers via heuristics.

---

## 21. PDF21 — Using List tags for lists in PDF documents

- **URL:** [PDF21](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF21)
- **Relates to:** 1.3.1 Info and Relationships
- **Applies to:** Tagged PDF documents with lists

**Guideline:** Mark related items with list structure (`L`, `LI`, and optionally `Lbl` / `LBody`), not just visual line breaks.

**Recommendations:**
- Create lists with real list tooling in Word/Writer before conversion.
- Repair fake lists (line-break-only) in the Tags panel after conversion.
- Nest additional `L` trees inside `LBody` for nested lists.
- Correct list markup enables AT list navigation commands.

---

## 22. PDF22 — Indicating when user input falls outside required format or values

- **URL:** [PDF22](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF22)
- **Relates to:** 3.3.1 Error Identification; 3.3.3 Error Suggestion
- **Applies to:** Tagged PDF documents

**Guideline:** Detect invalid formats/values and notify users with clear text errors and correction guidance.

**Recommendations:**
- State the required format in the control label/tooltip (e.g., “Date (MM/DD/YYYY)”).
- On invalid input, show an alert that identifies the error and suggests the correct format.
- Consider returning focus to the invalid field after the alert when that is expected.
- For multiple errors, use a broader error-reporting strategy than a single-field alert.

---

## 23. PDF23 — Providing interactive form controls in PDF documents

- **URL:** [PDF23](https://www.w3.org/WAI/WCAG22/Techniques/pdf/PDF23)
- **Relates to:** 2.1.1 Keyboard
- **Applies to:** Tagged PDF documents with forms

**Guideline:** Provide real interactive form controls that can be operated from the keyboard (text fields, checkboxes, radios, combos, lists, buttons).

**Recommendations:**
- Do not leave forms as static scanned/printed appearance only; make fields fillable.
- After conversion, use Identify Form Fields / Prepare Form tooling to create or repair controls.
- Verify every control is reachable and operable by Tab and keyboard activation.
- Combine with PDF10/PDF12 for names/roles/values and PDF5/PDF22 for validation.

---

## Quick index (PDF1–PDF23)

| # | ID | Topic |
|---|----|--------|
| 1 | PDF1 | Image text alternatives (`/Alt`) |
| 2 | PDF2 | Bookmarks / outlines |
| 3 | PDF3 | Reading order and tab order |
| 4 | PDF4 | Decorative images as artifacts |
| 5 | PDF5 | Required form fields |
| 6 | PDF6 | Table structure tags |
| 7 | PDF7 | OCR for scanned text |
| 8 | PDF8 | Abbreviation expansions (`/E`) |
| 9 | PDF9 | Heading tags |
| 10 | PDF10 | Form control labels |
| 11 | PDF11 | Links and link text |
| 12 | PDF12 | Form name / role / value |
| 13 | PDF13 | Alternate link text (`/Alt`) |
| 14 | PDF14 | Running headers and footers |
| 15 | PDF15 | Submit-form buttons |
| 16 | PDF16 | Document default language |
| 17 | PDF17 | Consistent page numbering |
| 18 | PDF18 | Document title metadata |
| 19 | PDF19 | Language of parts |
| 20 | PDF20 | Repair mistagged tables |
| 21 | PDF21 | List tags |
| 22 | PDF22 | Format/value validation errors |
| 23 | PDF23 | Keyboard-accessible form controls |

---

## Relevance notes for this project’s PDF compiler

Highest-impact techniques for the current tagged-PDF compiler path:

- **Already aligned / partially covered:** PDF9 (headings), PDF1 (figure `/Alt`), PDF16 (`/Lang`), PDF18 (`/Title`), PDF3 (reading order via tag order), PDF4 (skip decorative if modeled that way).
- **Natural next compiler/IR work:** lists (PDF21), tables (PDF6/PDF20), bookmarks (PDF2), richer artifacts/headers (PDF14), page labels (PDF17).
- **Mostly form-centric (lower priority unless forms are added):** PDF5, PDF10, PDF12, PDF15, PDF22, PDF23.

---

*Compiled from W3C WAI WCAG 2.2 Techniques (PDF1–PDF23). Techniques remain informative examples, not normative requirements.*
