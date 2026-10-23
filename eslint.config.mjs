import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

/**
 * Google Apps Script services used as globals.
 * @types/google-apps-script covers these for tsc;
 * ESLint still needs them listed for no-undef-style checks.
 */
const googleAppsScriptGlobals = {
  DocumentApp: "readonly",
  SpreadsheetApp: "readonly",
  DriveApp: "readonly",
  HtmlService: "readonly",
  PropertiesService: "readonly",
  UrlFetchApp: "readonly",
  Utilities: "readonly",
  Session: "readonly",
  CacheService: "readonly",
  MailApp: "readonly",
  Logger: "readonly",
  Console: "readonly",
  ScriptApp: "readonly",
  FormsApp: "readonly",
  FormApp: "readonly",
  CalendarApp: "readonly",
  ContentService: "readonly",
  CardService: "readonly",
};

export default tseslint.config(
  {
    ignores: ["dist/**", "node_modules/**", "packages/**/dist/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.ts"],
    ignores: ["src/gas-rules-entry.ts"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.es2021,
        ...googleAppsScriptGlobals,
        runAccessibilityChecks: "readonly",
        assertAccessible: "readonly",
      },
    },
    rules: {
      // Apps Script shares a global scope across files, so helpers
      // defined in one file and called from another look "unused".
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern:
            "^(onOpen|showSidebar|getAccessibilityReport|checkAccessibility|inspectDocument|buildDocumentModel)$",
        },
      ],
    },
  }
);
