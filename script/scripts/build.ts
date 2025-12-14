import { join } from "node:path";
import { processPostBuild } from "./postBuild.ts";

// Bun automatically loads .env files, so no manual loading needed
const scriptDir = import.meta.dir;
const rootDir = join(scriptDir, "..");

// Read package.json to get version
const packageJsonPath = join(rootDir, "package.json");
const packageJson = await Bun.file(packageJsonPath).json();
const version = packageJson.version || "1.0.0";

// Get sample rate from command-line argument or default to 100 (100%)
// Usage: bun run scripts/build.ts --sample-rate=50
const args = process.argv.slice(2);
const sampleRateArg = args.find((arg) => arg.startsWith("--sample-rate="));
const sampleRateValue = sampleRateArg?.split("=")[1];
const sampleRate = sampleRateValue
  ? parseInt(sampleRateValue, 10)
  : 100;

// Validate sample rate
if (isNaN(sampleRate) || sampleRate < 0 || sampleRate > 100) {
  throw new Error(
    `Invalid --sample-rate: ${sampleRateValue ?? "undefined"}. Must be a number between 0 and 100.`
  );
}

// Load environment variables for build-time constants
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

// Construct full URLs
const eventsUrl = `${axiomUrl}/${axiomDatasetEvents}`;

const result = await Bun.build({
  entrypoints: [join(rootDir, "src", "collector.ts")],
  outdir: join(rootDir, "dist"),
  naming: "collector.prod.js", // Force specific output name
  target: "browser",
  format: "iife", // Output as IIFE to avoid module exports
  minify: true, // Minify for production
  sourcemap: "external", // Useful for debugging
  define: {
    "BUILD_VERSION": JSON.stringify(version),
    "BUILD_SAMPLE_RATE": sampleRate.toString(),
    "BUILD_EVENTS_ENDPOINT_URL": JSON.stringify(eventsUrl),
    "BUILD_IP_ENDPOINT_URL": JSON.stringify(cloudflareTraceUrl),
    "BUILD_AXIOM_TOKEN": JSON.stringify(axiomToken),
  },
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
} else {
  const outputPath = join(rootDir, "dist", "collector.prod.js");
  const outputContent = await Bun.file(outputPath).text();

  // Construct errors URL for fail-safe wrapper
  const errorsUrl = `${axiomUrl}/${axiomDatasetErrors}`;

  await processPostBuild({
    outputPath,
    bundleContent: outputContent,
    scriptDir,
    axiomToken,
    errorsUrl,
  });
}
