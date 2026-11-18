import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  runAccessibilityChecks,
  type AccessibilityReport,
  type DocumentModel,
} from "@accessibility-docs/core";
import { pdfToModel, pptxToModel } from "../src/index.js";

const here = dirname(fileURLToPath(import.meta.url));
export const FIXTURES = join(here, "..", "fixtures");

/** Reads a fixture laid out as fixtures/<ruleCode>/<fail|pass>/<name>.pptx. */
export async function readFixture(
  code: string,
  outcome: "fail" | "pass",
  name: string
): Promise<DocumentModel> {
  return readDeck(join(FIXTURES, code, outcome, `${name}.pptx`));
}

export async function readDeck(path: string): Promise<DocumentModel> {
  const bytes = await readFile(path);
  return pptxToModel(new Uint8Array(bytes), {
    fileName: path.split("/").pop(),
  });
}

export async function checkFixture(
  code: string,
  outcome: "fail" | "pass",
  name: string
): Promise<AccessibilityReport> {
  return runAccessibilityChecks(await readFixture(code, outcome, name));
}

/** Reads a fixture laid out as fixtures/pdf/<ruleCode>/<fail|pass>/<name>.pdf. */
export async function readPdfFixture(
  code: string,
  outcome: "fail" | "pass",
  name: string
): Promise<DocumentModel> {
  return readPdf(join(FIXTURES, "pdf", code, outcome, `${name}.pdf`));
}

export async function readPdf(path: string): Promise<DocumentModel> {
  const bytes = await readFile(path);
  return pdfToModel(new Uint8Array(bytes), {
    fileName: path.split("/").pop(),
  });
}

export async function checkPdfFixture(
  code: string,
  outcome: "fail" | "pass",
  name: string
): Promise<AccessibilityReport> {
  return runAccessibilityChecks(await readPdfFixture(code, outcome, name));
}

export function codes(report: AccessibilityReport): string[] {
  return [...new Set(report.issues.map((issue) => issue.code))].sort();
}
