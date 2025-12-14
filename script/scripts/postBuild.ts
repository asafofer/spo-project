import { wrapBundleWithFailsafe } from "./wrapBundle.ts";

interface PostBuildOptions {
  outputPath: string;
  bundleContent: string;
  version: string;
  sampleRate: number;
  scriptDir: string;
}

/**
 * Process the built bundle: replace placeholders and wrap with fail-safe error handler
 */
export async function processPostBuild(options: PostBuildOptions): Promise<void> {
  const { outputPath, bundleContent, version, sampleRate, scriptDir } = options;

  // Replace placeholders in the built file
  // Both __VERSION__ and __SAMPLE_RATE__ appear as string literals in source,
  // so they must be replaced manually (define only works on identifiers)
  let updatedContent = bundleContent;

  // Replace __VERSION__: const VERSION = "__VERSION__" becomes const VERSION = "1.0.0"
  updatedContent = updatedContent.replace(/__VERSION__/g, version);

  // Replace __SAMPLE_RATE__: const SAMPLE_RATE = "__SAMPLE_RATE__" becomes const SAMPLE_RATE = 100
  updatedContent = updatedContent.replace(
    /"__SAMPLE_RATE__"/g,
    sampleRate.toString()
  );

  // --- Configuration from .env ---
  const axiomToken = process.env.AXIOM_TOKEN;
  const axiomUrl = process.env.AXIOM_URL;
  const axiomDatasetErrors = process.env.AXIOM_DATASET_ERRORS;
  const axiomDatasetEvents = process.env.AXIOM_DATASET_EVENTS;
  const cloudflareTraceUrl = process.env.CLOUDFLARE_TRACE_URL;

  // Require configuration
  if (!axiomToken) {
    throw new Error("AXIOM_TOKEN is required in .env file");
  }
  if (!axiomUrl) {
    throw new Error("AXIOM_URL is required in .env file");
  }
  if (!axiomDatasetErrors) {
    throw new Error("AXIOM_DATASET_ERRORS is required in .env file");
  }
  if (!axiomDatasetEvents) {
    throw new Error("AXIOM_DATASET_EVENTS is required in .env file");
  }
  if (!cloudflareTraceUrl) {
    throw new Error("CLOUDFLARE_TRACE_URL is required in .env file");
  }

  // Construct full URLs for each dataset
  const eventsUrl = `${axiomUrl}/${axiomDatasetEvents}`;
  const errorsUrl = `${axiomUrl}/${axiomDatasetErrors}`;

  // Replace placeholders in the bundle
  // const EVENTS_ENDPOINT_URL = "__AXIOM_EVENTS_URL__" becomes const EVENTS_ENDPOINT_URL = "https://..."
  updatedContent = updatedContent.replace(
    /"__AXIOM_EVENTS_URL__"/g,
    JSON.stringify(eventsUrl)
  );

  // const IP_ENDPOINT_URL = "__CLOUDFLARE_TRACE_URL__" becomes const IP_ENDPOINT_URL = "https://..."
  updatedContent = updatedContent.replace(
    /"__CLOUDFLARE_TRACE_URL__"/g,
    JSON.stringify(cloudflareTraceUrl)
  );

  // --- Fail Safe Wrapping ---
  updatedContent = await wrapBundleWithFailsafe(
    updatedContent,
    scriptDir,
    axiomToken,
    errorsUrl
  );

  await Bun.write(outputPath, updatedContent);

  console.log(`Build successful! Version: ${version}, Sample Rate: ${sampleRate}%`);
  console.log("Output: script/dist/collector.prod.js");
}
