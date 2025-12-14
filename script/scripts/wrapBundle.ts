import { join } from "node:path";

/**
 * Wraps the built bundle with a fail-safe error handler that reports errors to Axiom
 * @param bundleContent - The content of the built bundle
 * @param scriptDir - Directory where the wrapper template is located
 * @param axiomToken - Axiom API token for authentication (required)
 * @param axiomUrl - Axiom endpoint URL for error reporting
 * @returns The wrapped bundle content
 */
export async function wrapBundleWithFailsafe(
  bundleContent: string,
  scriptDir: string,
  axiomToken: string,
  axiomUrl: string
): Promise<string> {
  if (!axiomToken) {
    throw new Error("AXIOM_TOKEN is required for fail-safe wrapper");
  }

  console.log(`Wrapping bundle with fail-safe error reporting to Axiom...`);
  console.log(`  Endpoint: ${axiomUrl}`);

  if (!bundleContent || bundleContent.trim().length === 0) {
    throw new Error("Bundle content is empty. Cannot wrap empty bundle.");
  }

  // Load wrapper template from separate file for better maintainability
  const wrapperTemplatePath = join(scriptDir, "failsafe-wrapper-template.js");
  let wrapperTemplate = await Bun.file(wrapperTemplatePath).text();

  // Remove comments from template BEFORE processing to prevent placeholder replacement in comments
  // This removes both single-line (//) and multi-line (/* */) comments
  // Must happen first to ensure __BUNDLE_CONTENT__ in comments is removed
  wrapperTemplate = wrapperTemplate
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .replace(/\/\/.*$/gm, ""); // Remove single-line comments

  // Validate that exactly one __BUNDLE_CONTENT__ remains after comment removal
  // (the one in code, not in comments)
  const occurrences = (wrapperTemplate.match(/__BUNDLE_CONTENT__/g) || []).length;
  if (occurrences === 0) {
    throw new Error("Wrapper template does not contain __BUNDLE_CONTENT__ placeholder after comment removal");
  }
  if (occurrences > 1) {
    throw new Error(
      `Wrapper template contains __BUNDLE_CONTENT__ ${occurrences} times after comment removal. ` +
      "Expected exactly 1 occurrence (in code). Comments may not have been removed properly."
    );
  }

  // Escape the strings to be safe in JS (escape backslashes first, then quotes)
  const escapeString = (str: string) => str.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeUrl = escapeString(axiomUrl);
  const safeToken = escapeString(axiomToken);

  // Replace placeholders in template
  // Replace __BUNDLE_CONTENT__ first (after comment removal, only the code occurrence should remain)
  // Use replace() instead of replace(/.../g) to replace only the first occurrence
  // This prevents replacing __BUNDLE_CONTENT__ if it appears as a string literal inside the bundle content
  // IMPORTANT: Use a callback function for replacement to prevent special replacement patterns
  // (like "$&") in the bundle content (e.g. minified code "$&&") from being interpreted.
  wrapperTemplate = wrapperTemplate.replace("__BUNDLE_CONTENT__", () => bundleContent);
  
  // Then replace Axiom placeholders
  // Also use callbacks to avoid any potential "$" issues in URLs or tokens
  wrapperTemplate = wrapperTemplate
    .replace(/__AXIOM_URL__/g, () => safeUrl)
    .replace(/__AXIOM_TOKEN__/g, () => safeToken);

  return wrapperTemplate.trim();
}
