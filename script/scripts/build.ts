import { unlink } from "node:fs/promises";
import { join } from "node:path";

// Bun automatically loads .env files
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
const sampleRate = sampleRateValue ? parseInt(sampleRateValue, 10) : 100;

if (isNaN(sampleRate) || sampleRate < 0 || sampleRate > 100) {
  throw new Error(
    `Invalid --sample-rate: ${sampleRateValue ?? "undefined"}. Must be a number between 0 and 100.`
  );
}

// Load environment variables
const {
  AXIOM_TOKEN: axiomToken,
  AXIOM_URL: axiomUrl,
  AXIOM_DATASET_ERRORS: axiomDatasetErrors,
  AXIOM_DATASET_EVENTS: axiomDatasetEvents,
  CLOUDFLARE_TRACE_URL: cloudflareTraceUrl,
} = process.env;

if (!axiomToken) throw new Error("AXIOM_TOKEN is required in .env file");
if (!axiomUrl) throw new Error("AXIOM_URL is required in .env file");
if (!axiomDatasetErrors) throw new Error("AXIOM_DATASET_ERRORS is required in .env file");
if (!axiomDatasetEvents) throw new Error("AXIOM_DATASET_EVENTS is required in .env file");
if (!cloudflareTraceUrl) throw new Error("CLOUDFLARE_TRACE_URL is required in .env file");

const eventsUrl = `${axiomUrl}/${axiomDatasetEvents}`;
const errorsUrl = `${axiomUrl}/${axiomDatasetErrors}`;

console.log(`Building collector (v${version}, sample rate: ${sampleRate}%)`);

// --- Step 1: Build the inner collector bundle ---
console.log("Step 1: Building inner collector...");

const innerBuildResult = await Bun.build({
  entrypoints: [join(rootDir, "src", "collector.ts")],
  outdir: join(rootDir, "dist"),
  naming: "collector.inner.js",
  target: "browser",
  format: "iife",
  minify: false,
  sourcemap: "none",
  define: {
    "BUILD_VERSION": JSON.stringify(version),
    "BUILD_SAMPLE_RATE": sampleRate.toString(),
    "BUILD_EVENTS_ENDPOINT_URL": JSON.stringify(eventsUrl),
    "BUILD_IP_ENDPOINT_URL": JSON.stringify(cloudflareTraceUrl),
    "BUILD_AXIOM_TOKEN": JSON.stringify(axiomToken),
  },
});

if (!innerBuildResult.success) {
  console.error("Inner build failed");
  for (const message of innerBuildResult.logs) console.error(message);
  process.exit(1);
}

// --- Step 2: Inject collector into wrapper ---
console.log("Step 2: Injecting collector into failsafe wrapper...");

const innerBundlePath = join(rootDir, "dist", "collector.inner.js");
const innerBundleContent = await Bun.file(innerBundlePath).text();

const wrapperTemplatePath = join(scriptDir, "failsafe-wrapper.ts");
let wrapperContent = await Bun.file(wrapperTemplatePath).text();

// Ensure the placeholder exists before replacing
if (!wrapperContent.includes("__BUNDLE_CONTENT__;")) {
  throw new Error("Could not find __BUNDLE_CONTENT__; placeholder in wrapper template");
}

wrapperContent = wrapperContent.replace("__BUNDLE_CONTENT__;", innerBundleContent);

const tempWrapperPath = join(rootDir, "dist", "collector.wrapper.ts");
await Bun.write(tempWrapperPath, wrapperContent);

// --- Step 3: Build the final wrapped bundle ---
console.log("Step 3: Building final production bundle...");

const finalBuildResult = await Bun.build({
  entrypoints: [tempWrapperPath],
  outdir: join(rootDir, "dist"),
  naming: "collector.prod.js",
  target: "browser",
  format: "iife",
  minify: true,
  sourcemap: "external",
  define: {
    "BUILD_AXIOM_URL": JSON.stringify(errorsUrl),
    "BUILD_AXIOM_TOKEN": JSON.stringify(axiomToken),
  },
});

if (!finalBuildResult.success) {
  console.error("Final build failed");
  for (const message of finalBuildResult.logs) console.error(message);
  process.exit(1);
}

// --- Step 4: Cleanup ---
console.log("Cleaning up temporary files...");
await Promise.allSettled([unlink(innerBundlePath), unlink(tempWrapperPath)]);

console.log("Build successful!");
console.log("Output: script/dist/collector.prod.js");
