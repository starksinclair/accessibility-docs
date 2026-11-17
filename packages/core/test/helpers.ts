import type {
  DocumentModel,
  DocumentNode,
  FigureNode,
  HeadingNode,
  ParagraphNode,
  SectionNode,
  TableNode,
  TitleNode,
} from "../src/types.js";
import { defaultTextFormatting } from "../src/types.js";

export function title(text: string, extra: Partial<TitleNode> = {}): TitleNode {
  return { type: "title", text, formatting: defaultTextFormatting(), ...extra };
}

export function heading(
  level: number,
  text: string,
  extra: Partial<HeadingNode> = {}
): HeadingNode {
  return {
    type: "heading",
    level,
    text,
    formatting: defaultTextFormatting(),
    ...extra,
  };
}

export function paragraph(
  text: string,
  extra: Partial<ParagraphNode> = {}
): ParagraphNode {
  return {
    type: "paragraph",
    text,
    formatting: defaultTextFormatting(),
    ...extra,
  };
}

export function figure(extra: Partial<FigureNode> = {}): FigureNode {
  return {
    type: "figure",
    altTitle: "Chart",
    altDescription: "A bar chart of enrolment by year.",
    src: "data:image/png;base64,AAAA",
    width: 100,
    height: 100,
    ...extra,
  };
}

export function table(extra: Partial<TableNode> = {}): TableNode {
  return {
    type: "table",
    rows: [
      {
        cells: [
          { text: "Year", header: true, colspan: 1, rowspan: 1 },
          { text: "Count", header: true, colspan: 1, rowspan: 1 },
        ],
      },
      {
        cells: [
          { text: "2024", header: false, colspan: 1, rowspan: 1 },
          { text: "120", header: false, colspan: 1, rowspan: 1 },
        ],
      },
    ],
    ...extra,
  };
}

export function slide(
  slideTitle: string | undefined,
  page: number,
  extra: Partial<SectionNode> = {}
): SectionNode {
  const node: SectionNode = {
    type: "section",
    role: "slide",
    location: { page },
    sourceRef: `ppt/slides/slide${page}.xml`,
    ...extra,
  };
  if (slideTitle !== undefined) {
    node.title = slideTitle;
  }
  return node;
}

export function doc(
  nodes: DocumentNode[],
  extra: Partial<DocumentModel> = {}
): DocumentModel {
  return { documentName: "Course pack", nodes, ...extra };
}

/** A model that produces no issues, as the baseline for isolation tests. */
export function cleanDoc(extra: Partial<DocumentModel> = {}): DocumentModel {
  return doc([title("Week 1: Cells"), paragraph("Body text.")], extra);
}

export function codes(
  issues: { code: string }[]
): string[] {
  return issues.map((i) => i.code).sort();
}
