import { join } from "node:path";
import { loadEnv } from "./loadEnv.ts";
import { processPostBuild } from "./postBuild.ts";

// Load environment variables manually to ensure they are available
const scriptDir = import.meta.dir;
const rootDir = join(scriptDir, "..");
await loadEnv(rootDir);

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

const result = await Bun.build({
  entrypoints: [join(rootDir, "src", "collector.ts")],
  outdir: join(rootDir, "dist"),
  naming: "collector.prod.js", // Force specific output name
  target: "browser",
  format: "iife", // Output as IIFE to avoid module exports
  minify: true, // Minify for production
  sourcemap: "external", // Useful for debugging
  // Note: __VERSION__ and __SAMPLE_RATE__ are handled via manual replacement
  // because they appear as string literals in source, not identifiers
  // define only works on identifiers, not string literals
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
} else {
  const outputPath = join(rootDir, "dist", "collector.prod.js");
  const outputContent = await Bun.file(outputPath).text();

  await processPostBuild({
    outputPath,
    bundleContent: outputContent,
    version,
    sampleRate,
    scriptDir,
  });
}
