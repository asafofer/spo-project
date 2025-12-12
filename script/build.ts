// Read package.json to get version
const packageJson = await Bun.file('./package.json').json();
const version = packageJson.version || '1.0.0';

const result = await Bun.build({
  entrypoints: ['./src/collector.js'],
  outdir: './dist',
  naming: 'collector.prod.js', // Force specific output name
  target: 'browser',
  minify: true, // Minify for production
  sourcemap: 'external', // Useful for debugging
  // 1. Inject IIFE start
  banner: '(function() {',
  
  // 2. Inject IIFE end
  footer: '})();',
  // 3. Define VERSION constant at build time
  define: {
    '__VERSION__': version,
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
  const outputPath = './dist/collector.prod.js';
  const outputContent = await Bun.file(outputPath).text();
  // Replace __VERSION__ (without quotes) with version string (without quotes)
  // This way: const VERSION = "__VERSION__" becomes const VERSION = "1.0.0"
  const updatedContent = outputContent.replace(/__VERSION__/g, version);
  await Bun.write(outputPath, updatedContent);
  
  console.log(`Build successful! Version: ${version}`);
  console.log("Output: script/dist/collector.prod.js");
}