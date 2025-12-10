const result = await Bun.build({
  entrypoints: ['./src/collector.research.js'],
  outdir: './dist',
  naming: 'collector.prod.js', // Force specific output name
  target: 'browser',
  minify: true, // Minify for production
  sourcemap: 'external', // Useful for debugging
  // 1. Inject IIFE start
  banner: '(function() {',
  
  // 2. Inject IIFE end
  footer: '})();',
});

if (!result.success) {
  console.error("Build failed");
  for (const message of result.logs) {
    console.error(message);
  }
} else {
  console.log("Build successful! Output: script/dist/collector.prod.js");
}