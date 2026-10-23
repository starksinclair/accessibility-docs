/**
 * Apps Script bridge: esbuild bundles this into dist/Rules.js
 * and exposes exports on globalThis for other .js files.
 */
export {
  assertAccessible,
  runAccessibilityChecks,
} from "@accessibility-docs/core";
