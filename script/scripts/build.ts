import { join } from "node:path";
import { unlink } from "node:fs/promises";
import { parseArgs } from "node:util";

// --- Configuration ---
const PLACEHOLDER = "__BUNDLE_CONTENT__;";

// Type-safe environment variable validation
const env = process.env;

// Validate environment variables only when running as main script
// When imported by tests, these might not be set/needed immediately
if (import.meta.main) {
  if (!env.AXIOM_TOKEN) throw new Error("Missing AXIOM_TOKEN");
  if (!env.AXIOM_URL) throw new Error("Missing AXIOM_URL");
  if (!env.AXIOM_DATASET_ERRORS) throw new Error("Missing AXIOM_DATASET_ERRORS");
  if (!env.AXIOM_DATASET_EVENTS) throw new Error("Missing AXIOM_DATASET_EVENTS");
  if (!env.CLOUDFLARE_TRACE_URL) throw new Error("Missing CLOUDFLARE_TRACE_URL");
}

// Now TS knows these are strings
const AXIOM_TOKEN = env.AXIOM_TOKEN!;
const AXIOM_URL = env.AXIOM_URL!;
const AXIOM_DATASET_ERRORS = env.AXIOM_DATASET_ERRORS!;
const AXIOM_DATASET_EVENTS = env.AXIOM_DATASET_EVENTS!;
const CLOUDFLARE_TRACE_URL = env.CLOUDFLARE_TRACE_URL!;

export async function wrapAndBuild(
  innerContent: string,
  axiomUrl: string,
  axiomToken: string,
  minify = true,
  outputFile = "collector.prod.js"
) {
  // Fix: Resolve path relative to this script to work from any CWD
  const wrapperPath = join(import.meta.dir, "..", "src", "utils", "failsafe-wrapper.ts");
  
  if (!(await Bun.file(wrapperPath).exists())) {
    throw new Error(`Wrapper file not found at ${wrapperPath}`);
  }

  const wrapperContent = await Bun.file(wrapperPath).text();

  // This check is CRITICAL because .replace() fails silently
  if (!wrapperContent.includes(PLACEHOLDER)) {
    throw new Error(`Template missing placeholder: "${PLACEHOLDER}"`);
  }

  const wrappedContent = wrapperContent.replace(PLACEHOLDER, innerContent);
  const tempWrapperPath = "dist/collector.wrapper.ts";
  await Bun.write(tempWrapperPath, wrappedContent);

  const buildResult = await Bun.build({
    entrypoints: [tempWrapperPath],
    outdir: "dist",
    naming: outputFile,
    target: "browser",
    format: "iife",
    minify: minify,
    sourcemap: "external",
    define: {
      "BUILD_AXIOM_URL": JSON.stringify(axiomUrl),
      "BUILD_AXIOM_TOKEN": JSON.stringify(axiomToken),
    },
  });

  if (!buildResult.success) {
    console.error("Failsafe wrapper build failed:\n", buildResult.logs.join("\n"));
    throw new Error("Build failed");
  }

  // Cleanup temp file
  await unlink(tempWrapperPath).catch(() => {});

  return buildResult;
}

async function main() {
  // --- 1. Setup & Validation ---
  const { values: args } = parseArgs({
    args: Bun.argv,
    options: {
      "sample-rate": { type: "string", default: "100" },
    },
    strict: true,
    allowPositionals: true,
  });

  const sampleRate = parseInt(args["sample-rate"]!, 10);
  if (isNaN(sampleRate) || sampleRate < 0 || sampleRate > 100) {
    throw new Error(`Invalid sample-rate: ${sampleRate}. Must be 0-100.`);
  }

  // Environment variables are already validated globally at the top of the file
  
  const packageJson = await Bun.file("package.json").json();
  const version = packageJson.version || "1.0.0";
  const eventsUrl = `${AXIOM_URL}/${AXIOM_DATASET_EVENTS}`;
  const cloudflareTraceUrl = CLOUDFLARE_TRACE_URL;

  console.log(`Building collector (v${version}, sample rate: ${sampleRate}%)`);

  // --- 2. Build Inner Collector ---
  const innerBuildResult = await Bun.build({
    entrypoints: ["src/collector.ts"], // Bun resolves paths relative to cwd automatically
    outdir: "dist",
    naming: "collector.inner.js",
    target: "browser",
    format: "iife",
    define: {
      "BUILD_VERSION": JSON.stringify(version),
      "BUILD_SAMPLE_RATE": sampleRate.toString(),
      "BUILD_EVENTS_ENDPOINT_URL": JSON.stringify(eventsUrl),
      "BUILD_IP_ENDPOINT_URL": JSON.stringify(cloudflareTraceUrl),
      "BUILD_AXIOM_TOKEN": JSON.stringify(AXIOM_TOKEN),
    },
  });

  if (!innerBuildResult.success) {
    console.error("Inner build failed:\n", innerBuildResult.logs.join("\n"));
    process.exit(1);
  }

  // --- 3. Inject into Wrapper & Final Build ---
  const innerContent = await Bun.file("dist/collector.inner.js").text();
  const axiomErrorsUrl = `${AXIOM_URL}/${AXIOM_DATASET_ERRORS}`;
  
  await wrapAndBuild(
    innerContent, 
    axiomErrorsUrl, 
    AXIOM_TOKEN, 
    true, 
    "collector.prod.js"
  );

  // Cleanup inner collector
  await unlink("dist/collector.inner.js").catch(() => {});

  console.log("✅ Build successful -> script/dist/collector.prod.js");
}

if (import.meta.main) {
  await main();
}
