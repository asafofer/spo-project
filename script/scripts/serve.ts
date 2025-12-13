import { join } from "node:path";

const PORT = 3000;

// Parse command-line arguments to extract --sample-rate
const args = process.argv.slice(2);
const sampleRateArg = args.find((arg) => arg.startsWith("--sample-rate="));

// Build the collector with the sample rate argument (if provided)
const buildScriptPath = join(import.meta.dir, "build.ts");
const buildArgs = sampleRateArg
  ? ["run", buildScriptPath, sampleRateArg]
  : ["run", buildScriptPath];

console.log("Building collector...");
const buildProcess = Bun.spawn(["bun", ...buildArgs], {
  stdio: ["inherit", "inherit", "inherit"],
});

const exitCode = await buildProcess.exited;

if (exitCode !== 0) {
  console.error(`Build failed with code ${exitCode}`);
  process.exit(exitCode);
}

console.log(`Serving static files at http://localhost:${PORT}`);

Bun.serve({
  port: PORT,
  fetch(req) {
    const url = new URL(req.url);

    // Default to index.html if root is requested
    let path = url.pathname;
    if (path === "/") path = "/index.html";

    // Resolve file relative to the script directory (one level up from scripts/)
    const file = Bun.file(import.meta.dir + "/.." + path);

    return new Response(file);
  },
  error() {
    return new Response(null, { status: 404 });
  },
});
