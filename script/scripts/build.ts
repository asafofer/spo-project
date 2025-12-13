import { join } from "node:path";

// Read package.json to get version
const packageJsonPath = join(import.meta.dir, "..", "package.json");
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

const scriptDir = import.meta.dir;
const rootDir = join(scriptDir, "..");

const result = await Bun.build({
  entrypoints: [join(rootDir, "src", "collector.ts")],
  outdir: join(rootDir, "dist"),
  naming: "collector.prod.js", // Force specific output name
  target: "browser",
  format: "iife", // Output as IIFE to avoid module exports
  minify: true, // Minify for production
  sourcemap: "external", // Useful for debugging
  // Define constants at build time
  define: {
    __VERSION__: version,
    // Note: __SAMPLE_RATE__ is handled via manual replacement to ensure it's a number literal
  },
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
} else {
  // Replace version placeholder in the built file (fallback if define doesn't work)
  // Replace __VERSION__ with just the version string (no quotes) since source already has quotes
  const outputPath = join(rootDir, "dist", "collector.prod.js");
  const outputContent = await Bun.file(outputPath).text();
  // Replace __VERSION__ (without quotes) with version string (without quotes)
  // This way: const VERSION = "__VERSION__" becomes const VERSION = "1.0.0"
  // Replace __SAMPLE_RATE__ with sample rate number (no quotes, as number literal)
  // This way: const SAMPLE_RATE = "__SAMPLE_RATE__" becomes const SAMPLE_RATE = 100
  let updatedContent = outputContent.replace(/__VERSION__/g, version);
  // Replace __SAMPLE_RATE__ with the numeric value (no quotes for number literal)
  updatedContent = updatedContent.replace(
    /"__SAMPLE_RATE__"/g,
    sampleRate.toString()
  );
  await Bun.write(outputPath, updatedContent);

  console.log(`Build successful! Version: ${version}, Sample Rate: ${sampleRate}%`);
  console.log("Output: script/dist/collector.prod.js");
}
