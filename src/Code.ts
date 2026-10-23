/**
 * Adds a custom menu when the document opens.
 * Refresh the Doc tab after pushing for the menu to appear.
 */
function onOpen(): void {
  DocumentApp.getUi()
    .createMenu("Accessibility")
    .addItem("Open checker", "showSidebar")
    .addSeparator()
    .addItem("Run check (Logs)", "checkAccessibility")
    .addItem("Inspect document (Logs)", "inspectDocument")
    .addToUi();
}

/** Opens the accessibility checker sidebar. */
function showSidebar(): void {
  const html = HtmlService.createHtmlOutputFromFile("Sidebar").setTitle(
    "Accessibility"
  );
  DocumentApp.getUi().showSidebar(html);
}

/**
 * Called from the sidebar via google.script.run.
 * Returns a plain object so HtmlService can serialize it.
 */
function getAccessibilityReport(): {
  documentName: string;
  issues: AccessibilityIssue[];
  errorCount: number;
  warningCount: number;
  manualCheckCount: number;
} {
  const document = buildDocumentModel();
  const report = runAccessibilityChecks(document);

  return {
    documentName: document.documentName,
    issues: report.issues,
    errorCount: report.errorCount,
    warningCount: report.warningCount,
    manualCheckCount: report.manualCheckCount,
  };
}

/** Entry point: build model, run checks, log the report. */
function checkAccessibility(): void {
  const result = getAccessibilityReport();
  console.log(JSON.stringify(result, null, 2));
}

function inspectDocument(): void {
  const document = buildDocumentModel();
  console.log(JSON.stringify(document, null, 2));
}
