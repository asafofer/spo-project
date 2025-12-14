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

  // Remove comments from template before processing to prevent placeholder replacement in comments
  // This removes both single-line (//) and multi-line (/* */) comments
  wrapperTemplate = wrapperTemplate
    .replace(/\/\*[\s\S]*?\*\//g, "") // Remove multi-line comments
    .replace(/\/\/.*$/gm, ""); // Remove single-line comments

  // Escape the strings to be safe in JS (escape backslashes first, then quotes)
  const safeUrl = axiomUrl.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const safeToken = axiomToken.replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  // Replace placeholders in template
  // Replace __BUNDLE_CONTENT__ first (before other replacements to avoid conflicts)
  // Use replace() instead of replace(/.../g) to replace only the first occurrence (the template placeholder)
  // This prevents replacing __BUNDLE_CONTENT__ if it appears as a string literal inside the bundle content
  if (!wrapperTemplate.includes("__BUNDLE_CONTENT__")) {
    throw new Error("Wrapper template does not contain __BUNDLE_CONTENT__ placeholder");
  }
  wrapperTemplate = wrapperTemplate.replace("__BUNDLE_CONTENT__", bundleContent);
  
  // Then replace Axiom placeholders
  wrapperTemplate = wrapperTemplate
    .replace(/__AXIOM_URL__/g, safeUrl)
    .replace(/__AXIOM_TOKEN__/g, safeToken);

  return wrapperTemplate.trim();
}
