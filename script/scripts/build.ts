import { unlink } from "node:fs/promises";
import { parseArgs } from "node:util";

// --- Configuration ---
const PLACEHOLDER = "__BUNDLE_CONTENT__;";
const REQUIRED_ENVS = [
  "AXIOM_TOKEN",
  "AXIOM_URL",
  "AXIOM_DATASET_ERRORS",
  "AXIOM_DATASET_EVENTS",
  "CLOUDFLARE_TRACE_URL",
] as const;

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

// Bulk validate env vars to avoid 10 lines of "if" statements
const env = process.env as Record<string, string>;
const missingEnvs = REQUIRED_ENVS.filter((key) => !env[key]);

if (missingEnvs.length > 0) {
  throw new Error(`Missing required .env variables: ${missingEnvs.join(", ")}`);
}

const packageJson = await Bun.file("package.json").json();
const version = packageJson.version || "1.0.0";
const eventsUrl = `${env.AXIOM_URL}/${env.AXIOM_DATASET_EVENTS}`;
const cloudflareTraceUrl = env.CLOUDFLARE_TRACE_URL;

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
    "BUILD_AXIOM_TOKEN": JSON.stringify(env.AXIOM_TOKEN),
  },
});

if (!innerBuildResult.success) {
  console.error("Inner build failed:\n", innerBuildResult.logs.join("\n"));
  process.exit(1);
}

// --- 3. Inject into Wrapper ---
const innerContent = await Bun.file("dist/collector.inner.js").text();
let wrapperContent = await Bun.file("scripts/failsafe-wrapper.ts").text();

// This check is CRITICAL because .replace() fails silently
if (!wrapperContent.includes(PLACEHOLDER)) {
  throw new Error(`Template missing placeholder: "${PLACEHOLDER}"`);
}

wrapperContent = wrapperContent.replace(PLACEHOLDER, innerContent);
await Bun.write("dist/collector.wrapper.ts", wrapperContent);

// --- 4. Final Build ---
const finalBuildResult = await Bun.build({
  entrypoints: ["dist/collector.wrapper.ts"],
  outdir: "dist",
  naming: "collector.prod.js",
  target: "browser",
  format: "iife",
  minify: true,
  sourcemap: "external",
  define: {
    "BUILD_AXIOM_URL": JSON.stringify(`${env.AXIOM_URL}/${env.AXIOM_DATASET_ERRORS}`),
    "BUILD_AXIOM_TOKEN": JSON.stringify(env.AXIOM_TOKEN),
  },
});

if (!finalBuildResult.success) {
  console.error("Final build failed:\n", finalBuildResult.logs.join("\n"));
  process.exit(1);
}

// --- 5. Cleanup ---
await Promise.allSettled([
  unlink("dist/collector.inner.js"),
  unlink("dist/collector.wrapper.ts"),
]);

console.log("✅ Build successful -> script/dist/collector.prod.js");